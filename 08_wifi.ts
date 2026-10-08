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
        if (_wsSpill.length > 4096) _wsConfigure()
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
            let stale = _readBinary()
            if (stale.length === 0) break
            _spill(stale)
        }
        serial.writeString(cmd + "\r\n")
        let resp = ""
        let waited = 0
        while (waited < waitMs) {
            basic.pause(5)
            waited += 5
            let chunk = _readBinary()
            if (chunk && chunk.length > 0) {
                _spill(chunk)              // resp 는 512자에서 잘리므로 잘리기 전에 넘긴다
                resp += _lastAtText
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

    let _netBuffer = ""
    let _wsLastSendOK = false
    let _atPending = ""
    let _atPayloadLeft = 0
    let _lastAtText = ""
    // ESP-AT notifications can be interleaved with command replies. Never treat
    // a '>' or 'SEND OK' inside length-delimited +IPD data as an AT reply.
    function _readBinary(): string {
        let raw = BrixelWebSocket.binary(serial.readBuffer(0))
        _atPending += raw
        _lastAtText = ""
        while (_atPending.length > 0) {
            if (_atPayloadLeft > 0) {
                let count = Math.min(_atPayloadLeft, _atPending.length)
                _atPending = _atPending.substr(count); _atPayloadLeft -= count
                continue
            }
            if (_atPending.indexOf("+IPD,") == 0) {
                let colon = _atPending.indexOf(":")
                if (colon < 0) { if (_atPending.length > 64) _atPending = ""; break }
                let header = _atPending.substr(0, colon).split(",")
                let count = parseInt(header[header.length - 1])
                _atPending = _atPending.substr(colon + 1)
                if (isNaN(count) || count < 0 || count > 2048) { _atPending = ""; break }
                _atPayloadLeft = count
                continue
            }
            if (_atPending.length < 5 && "+IPD,".indexOf(_atPending) == 0) break
            _lastAtText += _atPending.charAt(0)
            _atPending = _atPending.substr(1)
        }
        return raw
    }
    function _wsConfigure(): void {
        _netBuffer = ""; _wsSpill = ""; _wsLastSendOK = false
        _atPending = ""; _atPayloadLeft = 0; _lastAtText = ""
        _wsLastMsg = ""; _wsPrevMsg = ""; _wsMsgReady = false; _wsAnyReady = false
        _wsMsgConsumed = true; _wsAnyConsumed = true; _wsParsedData = ""; _wsLastRx = 0
        BrixelWebSocket.configure(_sendPacket, (id: number, message: string) => {
            _wsLink = id
            let lines = message.split("\n")
            for (let i=0;i<lines.length;i++) _handleWsLine(lines[i])
        })
    }
    // Read the exact UTF-8/binary byte count requested by ESP-AT, waiting for its prompt and SEND OK.
    function _sendPacket(id: number, packet: Buffer): boolean {
        if (id < 0 || id > 4 || packet.length > 2048 || _wsPollPaused) return false
        _wsPollPaused = true
        _claimUart()
        serial.writeString("AT+CIPSEND=" + id + "," + packet.length + "\r\n")
        let response = "", start = control.millis(), prompt = false
        while (control.millis() - start < 1000 && USBSerial.uartIsOwner(USBSerial.UartOwner.WiFi)) {
            let chunk = _readBinary(); _spill(chunk); response += _lastAtText
            if (response.indexOf(">") >= 0) { prompt = true; break }
            if (response.indexOf("ERROR") >= 0 || response.indexOf("FAIL") >= 0) break
            if (response.length > 4096) break
            basic.pause(5)
        }
        let success = false
        if (prompt) {
            serial.writeBuffer(packet)
            response = ""; start = control.millis()
            while (control.millis() - start < 2000 && USBSerial.uartIsOwner(USBSerial.UartOwner.WiFi)) {
                let chunk = _readBinary(); _spill(chunk); response += _lastAtText
                if (response.indexOf("SEND OK") >= 0) { success = true; break }
                if (response.indexOf("ERROR") >= 0 || response.indexOf("FAIL") >= 0) break
                if (response.length > 4096) break
                basic.pause(5)
            }
        }
        _wsPollPaused = false
        return success
    }
    // TCP segmentation and WebSocket fragmentation are separate: +IPD boundaries are not message boundaries.
    function _consumeNetwork(chunk: string): void {
        _netBuffer += chunk
        if (_netBuffer.length > 4096) { _wsConfigure(); return }
        for (let turn=0;turn<16;turn++) {
            let start = _netBuffer.indexOf("+IPD,")
            let prefix = start < 0 ? _netBuffer : _netBuffer.substr(0,start)
            for(let id=0;id<5;id++) if(prefix.indexOf(id+",CLOSED")>=0) BrixelWebSocket.reset(id)
            if(start<0) { if(_netBuffer.length>64)_netBuffer=_netBuffer.substr(_netBuffer.length-64); break }
            if(start>0)_netBuffer=_netBuffer.substr(start)
            let colon=_netBuffer.indexOf(":")
            if(colon<0)break
            let header=_netBuffer.substr(0,colon).split(",")
            let id=header.length==3?parseInt(header[1]):-1
            let count=header.length==3?parseInt(header[2]):-1
            if(id<0 || id>4 || isNaN(id) || count<0 || count>2048 || isNaN(count)) { _wsConfigure(); return }
            if(_netBuffer.length<colon+1+count)break
            let payload=_netBuffer.substr(colon+1,count)
            _netBuffer=_netBuffer.substr(colon+1+count)
            BrixelWebSocket.feed(id,payload)
        }
        for(let id=0;id<5;id++)BrixelWebSocket.feed(id,"")
    }
    function _ensureWsPoll(): void {
        if (_wsPollStarted) return
        _wsPollStarted = true
        USBSerial.uartEnsureRxBuffer()
        control.inBackground(() => {
            while (true) {
                if (!USBSerial.uartIsOwner(USBSerial.UartOwner.WiFi)) {
                    _wsConfigure(); basic.pause(20); continue
                }
                if (_wsPollPaused) { basic.pause(5); continue }
                let chunk = _wsSpill + _readBinary(); _wsSpill = ""
                _consumeNetwork(chunk)
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
        if (port < 1 || port > 65535 || port != Math.floor(port)) return
        _wsConfigure()
        _at("AT+CIPDINFO=0", 500)
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
        _wsLastSendOK = BrixelWebSocket.sendText(_wsLink, value + "\n")
    }
    /** False before sending, before WebSocket handshake, on timeout, or when the UTF-8 message exceeds 1024 bytes. */
    //% block="WS last send succeeded?" group="Send" weight=95
    export function wsSendSucceeded(): boolean { return _wsLastSendOK }

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
