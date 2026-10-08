/**
 * BRIXEL Extension - 08. WiFi (v3.0 — 브릭셀 에디터 호환)
 * ESP8266 / ESP32 WebSocket — 8-block 단일 인터페이스
 *
 * 핵심 변경:
 *  - 송신: WS [값] 보내기 1블록 (자동 \n)
 *  - 수신: 자동 코얼레스 (변경시만 / 매번)
 *  - WS 메시지 받았을 때 [statement] 핸들러
 *  - 파싱: split + 1-based 인덱스
 */

//% weight=1020 color=#4285F4 icon="" block="08. WiFi"
//% groups='["Settings","Send","Receive","Parse"]'
namespace WiFi08 {

    let _wifiTx: SerialPin = SerialPin.P1
    let _wifiRx: SerialPin = SerialPin.P2
    let _wifiBaud: BaudRate = BaudRate.BaudRate115200
    let _wifiConnected: boolean = false
    let _wifiIP: string = ""
    let _wifiLastCheck: number = 0     // 마지막으로 모듈에 접속 상태를 물어본 시각(ms)

    let _wsLastMsg: string = ""
    let _wsPrevMsg: string = ""
    let _wsMsgReady: boolean = false
    let _wsMsgConsumed: boolean = true
    let _wsAnyReady: boolean = false
    let _wsAnyConsumed: boolean = true
    let _wsParsedData: string = ""
    let _wsParsedDelim: string = ","
    let _wsPollStarted: boolean = false
    let _wsChangedHandler: (msg: string) => void = null
    let _wsAnyHandler: (msg: string) => void = null
    let _wsLink: number = 0            // 마지막으로 +IPD 를 보낸 클라이언트의 CIPMUX 링크 ID
    let _wsPollPaused: boolean = false // AT 명령 응답을 기다리는 동안 폴러를 재운다
    let _wsSpill: string = ""          // AT 왕복 중에 _at 이 대신 읽어버린 바이트 (폴러에게 돌려준다)
    let _wsLastRx: number = 0          // 마지막으로 +IPD 한 줄을 처리한 시각(ms)
    let _wifiUartRegistered: boolean = false

    // UART 소유권을 WiFi 로 가져온다.
    // micro:bit 는 UART 가 1개뿐이라 PMS/GPS/USB 폴러와 반드시 번갈아 써야 한다.
    // (예전에는 serial.redirect 를 직접 불러 중재자를 통째로 우회했다)
    function _claimUart(): void {
        if (!_wifiUartRegistered) {
            _wifiUartRegistered = true
            USBSerial.uartRegister(USBSerial.UartOwner.WiFi, _wifiRx, _wifiTx, _wifiBaud)
            USBSerial.uartEnsureRxBuffer()
        }
        USBSerial.uartClaim(USBSerial.UartOwner.WiFi)
    }

    // UART 는 하나뿐이라 AT 왕복이 도는 동안 도착한 바이트는 폴러가 아니라 _at 이 읽어간다.
    // 그 안에는 클라이언트가 보낸 +IPD 프레임이 섞여 있을 수 있는데, 그냥 버리면
    // "WiFi connected?" 를 forever 에서 부를 때마다 수신 메시지가 조용히 사라진다.
    // → 읽은 바이트를 그대로 모아 두었다가 폴러가 다음 회전에 이어서 파싱하게 한다.
    function _spill(s: string): void {
        if (!_wsPollStarted) return        // 폴러가 없으면 모아둘 이유가 없다
        _wsSpill += s
        if (_wsSpill.length > 1024) _wsSpill = _wsSpill.substr(_wsSpill.length - 512)
    }

    // AT 응답 읽기.
    //   예전에는 basic.pause(waitMs) 한 번 쉬고 readString() 을 딱 한 번 불렀는데,
    //   DAL RX 링이 20바이트(사용 19B)라 AT+CIFSR 의 ~110바이트 응답 중 앞 19바이트만
    //   남고 나머지는 쉬는 동안 버려졌다. 그래서 "STAIP" 나 IP 문자열이 잘려
    //   연결 상태·IP 블록이 늘 빈 값/false 를 냈다.
    //   → OK/ERROR/FAIL 종결자가 보일 때까지 5ms 간격으로 조금씩 모아 읽는다.
    //   waitMs 는 고정 대기가 아니라 상한선이다.
    function _at(cmd: string, waitMs: number): string {
        _wsPollPaused = true               // 폴러가 응답을 가로채지 못하게 막는다
        _claimUart()
        // 앞 명령의 잔여 바이트를 걷어내 응답이 섞이지 않게 한다 (최대 8회로 제한).
        // 걷어낸 바이트도 버리지 않고 폴러에게 넘긴다.
        for (let d = 0; d < 8; d++) {
            let stale = serial.readString()
            if (stale.length === 0) break
            _spill(stale)
        }
        serial.writeString(cmd + "\r\n")
        let resp = ""
        let waited = 0
        while (waited < waitMs) {
            basic.pause(5)
            waited += 5
            let chunk = serial.readString()
            if (chunk && chunk.length > 0) {
                _spill(chunk)              // resp 는 512자에서 잘리므로 잘리기 전에 넘긴다
                resp += chunk
                if (resp.indexOf("OK\r\n") >= 0) break
                if (resp.indexOf("ERROR\r\n") >= 0) break
                // ★ AT+CWJAP 은 실패할 때 ERROR 가 아니라 FAIL 로 끝난다.
                //   이걸 안 보면 비밀번호가 틀렸을 때 상한선 10초를 통째로 소모한다.
                if (resp.indexOf("FAIL\r\n") >= 0) break
                if (resp.length > 512) resp = resp.substr(resp.length - 256)
            }
        }
        _wsPollPaused = false
        return resp
    }

    // AT+CIFSR 응답에서 STAIP 를 뽑는다. indexOf 결과를 -1 로 직접 검사한다
    // (예전 `s > 6` 검사는 -1+7 == 6 이라 우연히 맞았을 뿐이라 접두사가 바뀌면 깨진다)
    //
    // ★ ESP 는 AP 에 붙지 못한 상태에서도 STAIP,"0.0.0.0" 를 돌려준다.
    //   그래서 "STAIP 가 보이면 연결됨" 으로 판정하면 항상 true 가 되고,
    //   _wifiIP 에 0.0.0.0 이 한 번 캐시되면 나중에 진짜로 연결돼도 영영 갱신되지 않는다.
    //   → 유효한 IP 를 얻었을 때만 저장하고 true 를 돌려준다.
    function _parseIp(resp: string): boolean {
        let p = resp.indexOf("STAIP,\"")
        if (p < 0) return false
        let s = p + 7
        let e = resp.indexOf("\"", s)
        if (e <= s) return false
        let ip = resp.substr(s, e - s)
        if (ip === "" || ip === "0.0.0.0") return false
        _wifiIP = ip
        return true
    }

    // 모듈에 실제로 접속 상태를 물어보는 단 하나의 자리. 조사 빈도를 여기서 통제한다.
    //  - 아두이노의 WiFi.status() 는 칩 안의 레지스터를 읽는 거라 공짜지만,
    //    여기서는 AT 왕복이라 UART 를 그동안 독점한다. 그래서 무한정 물으면 안 된다.
    //  - 방금 +IPD 를 받았다면 링크가 살아 있는 게 확실하므로 왕복 자체를 생략한다.
    //  - 끊긴 상태(ESP 가 아예 안 꽂혀 있는 경우 포함)에서는 응답이 없어 _at 이
    //    상한선을 꽉 채운다. 이때 1초 간격으로 계속 물으면 forever 가 사실상 멈추므로
    //    간격을 3초로 벌린다.
    //  - control.millis() 는 32비트라 약 24.8일에 음수로 되감긴다. 그러면
    //    now - _wifiLastCheck 가 음수가 되어 영원히 캐시만 돌려주므로 따로 잡아준다.
    // needIp: "My IP address" 처럼 IP 문자열 자체가 필요한 호출이면 true.
    //         (이 경우 수신 활동만 보고 넘어가면 IP 가 영영 빈 값으로 남는다)
    function _wifiProbe(needIp: boolean): void {
        let now = control.millis()
        if (now < _wifiLastCheck) _wifiLastCheck = 0        // 타이머 되감김
        if (now < _wsLastRx) _wsLastRx = 0
        if (!needIp && _wsLastRx > 0 && now - _wsLastRx < 3000) {
            _wifiConnected = true
            return
        }
        let gap = _wifiConnected ? 1000 : 3000
        if (_wifiLastCheck > 0 && now - _wifiLastCheck < gap) return
        _wifiLastCheck = now
        if (_parseIp(_at("AT+CIFSR", 500))) {
            _wifiConnected = true
        } else {
            _wifiConnected = false
            _wifiIP = ""       // 재접속 시 바뀐 IP 를 다시 읽도록 캐시를 비운다
        }
    }

    function _handleWsLine(line: string): void {
        if (line.charCodeAt(line.length - 1) === 13) {
            line = line.substr(0, line.length - 1)
        }
        if (line.length === 0) return
        // 한 줄을 받았다는 건 TCP 링크가 살아 있다는 뜻 = 접속돼 있다.
        // _wifiProbe 가 이걸 보고 불필요한 AT 왕복을 건너뛴다.
        _wsLastRx = control.millis()
        _wsLastMsg = line
        _wsAnyReady = true
        _wsAnyConsumed = false
        if (_wsAnyHandler) _wsAnyHandler(line)
        if (line !== _wsPrevMsg) {
            _wsPrevMsg = line
            _wsMsgReady = true
            _wsMsgConsumed = false
            if (_wsChangedHandler) _wsChangedHandler(line)
        }
    }

    function _ensureWsPoll(): void {
        if (_wsPollStarted) return
        _wsPollStarted = true
        // RX 링을 20B 에서 254B 로 키운다. 안 키우면 +IPD 페이로드가 19바이트에서 잘린다.
        USBSerial.uartEnsureRxBuffer()
        control.inBackground(() => {
            let buf = ""
            while (true) {
                // 다른 UART 장치(PMS·GPS·MP3·USB)가 주인이면 읽지 않는다.
                // (읽으면 그쪽 응답을 가로채 양쪽 다 깨진다. 그동안의 바이트는 어차피
                //  못 받으므로, 끊긴 반쪽 프레임이 다음 프레임에 붙지 않도록 비운다)
                if (!USBSerial.uartIsOwner(USBSerial.UartOwner.WiFi)) {
                    buf = ""
                    _wsSpill = ""
                    basic.pause(20)
                    continue
                }
                // AT 응답을 기다리는 동안에는 _at 이 대신 읽는다. 여기서 같이 읽으면
                // 응답을 가로채 양쪽 다 깨지므로 잠깐 비켜준다.
                // ★ 이때 buf 를 비우면 안 된다. _at 이 읽어간 바이트를 _wsSpill 로
                //   그대로 돌려주므로 반쪽 프레임이 끊기지 않고 이어진다.
                if (_wsPollPaused) {
                    basic.pause(5)
                    continue
                }
                let chunk = serial.readString()
                // _at 이 대신 읽어둔 바이트를 먼저 이어붙인다 (도착 순서를 지킨다)
                if (_wsSpill.length > 0) {
                    chunk = _wsSpill + chunk
                    _wsSpill = ""
                }
                if (chunk && chunk.length > 0) {
                    buf += chunk
                    let ipdIdx = buf.indexOf("+IPD")
                    while (ipdIdx >= 0) {
                        let colon = buf.indexOf(":", ipdIdx)
                        if (colon < 0) break
                        let header = buf.substr(ipdIdx, colon - ipdIdx)
                        let parts = header.split(",")
                        // CIPMUX=1 이면 헤더가 "+IPD,<링크ID>,<길이>" 다.
                        // 이 링크 ID 를 기억해야 응답을 그 클라이언트에게 보낼 수 있다
                        // (예전엔 버리고 CIPSEND=0 으로 고정 → 링크 1 이후 전송이 죽었다)
                        if (parts.length >= 3) {
                            let id = parseInt(parts[1])
                            if (!isNaN(id) && id >= 0) _wsLink = id
                        }
                        let len = parseInt(parts[parts.length - 1])
                        if (isNaN(len) || len <= 0) {
                            buf = buf.substr(colon + 1)
                            ipdIdx = buf.indexOf("+IPD")
                            continue
                        }
                        if (buf.length < colon + 1 + len) break
                        let payload = buf.substr(colon + 1, len)
                        buf = buf.substr(colon + 1 + len)
                        let lines = payload.split("\n")
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].length > 0) _handleWsLine(lines[i])
                        }
                        ipdIdx = buf.indexOf("+IPD")
                    }
                    if (buf.length > 1024) buf = buf.substr(buf.length - 512)
                }
                // 5ms. 20ms 로 쉬면 115200bps 에서 ~230바이트가 흘러가 링이 넘친다.
                basic.pause(5)
            }
        })
    }

    //% block="📶 WiFi start SSID %ssid Password %password"
    //% ssid.defl="SSID"
    //% password.defl="PASSWORD"
    //% group="Settings" weight=100
    //% inlineInputMode=inline
    export function wifiStart(ssid: string, password: string): void {
        // 공용 UART 중재자에 WiFi 를 등록하고 소유권을 가져온다
        _claimUart()
        basic.pause(100)
        _wifiConnected = false
        _wifiIP = ""       // 다른 AP 로 다시 시작할 때 예전 IP 가 남아 있으면 안 된다

        _at("AT+RST", 2000)
        // 리셋 후 부팅 메시지("ready")가 끝날 때까지 기다린다.
        // ESP8266 AT 펌웨어는 리셋 직후 "OK" 를 먼저 뱉고 1.5~2초 뒤에야 명령을 받는데,
        // 종결자 감지 때문에 위 _at 은 그 "OK" 를 보고 ~20ms 만에 돌아온다.
        // 여기서 예전의 2000ms 대기를 그대로 복원하지 않으면 바로 뒤의 AT+CWMODE 가
        // 부팅 중인 ESP 에 도착해 통째로 무시된다(= 접속 실패).
        basic.pause(2000)
        _at("ATE0", 300)                   // 에코가 켜져 있으면 명령 반향이 응답 창을 다 먹는다
        _at("AT+CWMODE=1", 500)
        // AT+CWJAP 은 혼잡한 2.4GHz·WPA2·ESP 콜드 부팅에서 5초를 쉽게 넘긴다.
        // 5초에 끊고 곧바로 AT+CIFSR 를 던지면 ESP 는 아직 CWJAP 처리 중이라
        // "busy p..." 만 돌려주고, _parseIp 가 실패해 실제로는 접속에 성공했는데도
        // 연결 상태가 프로그램이 끝날 때까지 false 로 남았다.
        // Arduino 는 WiFi.status()==WL_CONNECTED 가 될 때까지 while 로 계속 기다려
        // 반쯤 붙은 상태로 다음 줄이 실행되는 일이 없다(15_comm.js wifi_setup).
        // micro:bit 에서 영원히 멈출 수는 없으므로 총 예산(최대 약 28초)을 두고
        // 유효한 IP 가 나올 때까지 AT+CIFSR 를 반복한다.
        // (_parseIp 가 0.0.0.0 을 거부하므로 DHCP 가 끝날 때까지 기다리는 효과도 같다)
        _at("AT+CWJAP=\"" + ssid + "\",\"" + password + "\"", 10000)

        for (let t = 0; t < 12; t++) {
            let resp = _at("AT+CIFSR", 1000)
            if (_parseIp(resp)) {
                _wifiConnected = true
                break
            }
            basic.pause(500)
        }
        _wifiLastCheck = control.millis()
    }

    //% block="📶 WS server start port %port"
    //% port.defl=81 port.min=1 port.max=65535
    //% group="Settings" weight=99
    export function wsServerStart(port: number): void {
        _at("AT+CIPMUX=1", 500)
        _at("AT+CIPSERVER=1," + port, 500)
        _ensureWsPoll()
    }

    //% block="📶 WiFi connected?"
    //% group="Settings" weight=98
    export function wifiIsConnected(): boolean {
        // Arduino 는 (WiFi.status() == WL_CONNECTED) 로 라디오 상태를 호출할 때마다
        // 새로 읽는다(15_comm.js wifi_is_connected). 여기처럼 wifiStart 때 캐시한 값을
        // 그대로 돌려주면 AP 가 사라진 뒤에도 계속 true 로 남고, 반대로 wifiStart 가
        // 끝난 뒤 늦게 접속됐을 때는 영영 false 로 남는다. → 모듈에 직접 물어본다.
        // 빈도 제어와 캐시는 _wifiProbe 안에 모여 있다 (forever 안에서 불려도 안전).
        _wifiProbe(false)
        return _wifiConnected
    }

    //% block="📶 My IP address"
    //% group="Settings" weight=97
    export function wifiLocalIp(): string {
        // 아직 IP 를 모를 때만 묻는다. 여기서도 _wifiProbe 를 거쳐야 하는 이유:
        // wifiIsConnected 가 실패할 때마다 _wifiIP 를 비우므로, 끊긴 상태로 forever 를
        // 돌면 이 블록이 매 회전마다 AT 왕복을 걸어 프로그램을 멈춰 세운다.
        if (_wifiIP === "") _wifiProbe(true)
        return _wifiIP
    }

    //% block="📤 WS send %value"
    //% value.defl="Hello"
    //% group="Send" weight=96
    export function wsSend(value: string): void {
        _claimUart()                       // 다른 UART 장치가 주인이면 되찾는다
        // Arduino 는 webSocket.broadcastTXT(String(v) + "\n") 로 LF 하나만 붙인다
        // (15_comm.js wifi_ws_send). CR 까지 붙이면 받는 쪽 PC/브라우저가 문자열을
        // 그대로 비교할 때 Arduino 빌드에는 없던 \r 이 딸려와 매칭이 어긋난다.
        // 아래 CIPSEND 길이는 data.length 에서 계산하므로 함께 맞춰진다.
        let data = value + "\n"
        // 링크 ID 를 0 으로 고정하면 재접속·2번째 클라이언트(링크 1 이상)에게는
        // 영영 못 보낸다. 폴러가 기억해 둔 마지막 +IPD 링크 ID 를 쓴다.
        serial.writeString("AT+CIPSEND=" + _wsLink + "," + data.length + "\r\n")
        basic.pause(100)
        serial.writeString(data)
        basic.pause(50)
    }

    //% block="📥 on WS message changed"
    //% group="Receive" weight=95
    //% draggableParameters
    export function onWsMessageChanged(handler: (message: string) => void): void {
        _wsChangedHandler = handler
        _ensureWsPoll()
    }

    //% block="📥 on WS message any"
    //% group="Receive" weight=94
    //% draggableParameters
    export function onWsMessageAny(handler: (message: string) => void): void {
        _wsAnyHandler = handler
        _ensureWsPoll()
    }

    //% block="📥 WS received value"
    //% group="Receive" weight=93
    export function wsGetReceived(): string {
        // ★ 폴러는 UART 주인이 WiFi 일 때만 읽는다. 다른 장치(PMS·GPS·MP3·USB)가 한 번
        //   가져가면 아무도 되찾아 주지 않아 수신이 영영 멈춘다. 사용자가 이 블록을 부르는
        //   것 자체가 "지금 WiFi 를 쓰겠다"는 뜻이므로 여기서 소유권을 되찾는다.
        //   (이미 WiFi 가 주인이면 uartClaim 은 아무것도 하지 않는다)
        _claimUart()
        _ensureWsPoll()
        return _wsLastMsg
    }

    //% block="📥 WS new message?"
    //% group="Receive" weight=92
    export function wsHasNew(): boolean {
        _claimUart()          // wsGetReceived 와 같은 이유 (소유권 되찾기)
        _ensureWsPoll()
        if (_wsMsgReady && !_wsMsgConsumed) {
            _wsMsgConsumed = true
            return true
        }
        return false
    }

    //% block="🔍 WS parse received with %delimiter"
    //% delimiter.defl=","
    //% group="Parse" weight=91
    export function wsParse(delimiter: string): void {
        _wsParsedDelim = delimiter && delimiter.length > 0 ? delimiter : ","
        _wsParsedData = _wsLastMsg
    }

    //% block="🔍 WS parsed %index th value"
    //% index.defl=1 index.min=1
    //% group="Parse" weight=90
    export function wsParsedGet(index: number): string {
        if (!_wsParsedData || _wsParsedData.length === 0) return ""
        let parts = _wsParsedData.split(_wsParsedDelim)
        if (index < 1 || index > parts.length) return ""
        return parts[index - 1]
    }
}
