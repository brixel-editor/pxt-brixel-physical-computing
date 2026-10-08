/**
 * BRIXEL Extension - 09. USB Serial (v3.0 — 브릭셀 에디터 호환)
 * 8-block 단일 인터페이스 + 형변환 3블록
 *
 * 핵심 변경:
 *  - 송신: [값] 보내기 1블록 (자동 \n)
 *  - 수신: 자동 코얼레스 (변경시만 / 매번)
 *  - 메시지 받았을 때 [statement] 핸들러
 *  - 파싱: split + 1-based 인덱스
 *  - 형변환: 정수 / 실수 / ASCII
 */

//% weight=1010 color=#367E7F icon="" block="09. USB Serial"
//% groups='["Settings","Send","Receive","Parse","Convert"]'
namespace USBSerial {

    let _connected: boolean = false
    let _lastMsg: string = ""
    let _prevMsg: string = ""
    let _msgReady: boolean = false
    let _msgConsumed: boolean = true
    let _anyReady: boolean = false
    let _anyConsumed: boolean = true
    let _parsedData: string = ""
    let _parsedDelim: string = ","
    let _pollStarted: boolean = false
    let _changedHandler: (msg: string) => void = null
    let _anyHandler: (msg: string) => void = null

    /********** 공용 UART 중재 **********/
    /*
     * micro:bit 는 UART 가 물리적으로 1개뿐이고 소프트웨어 시리얼이 없다.
     * (그래서 각 센서 블록에 있던 "software serial / hardware serial" 선택은
     *  아두이노에서 옮겨온 개념이라 실제로는 동작할 수 없었다.)
     *
     * 대신 serial.redirect() 로 런타임에 핀·보드레이트를 바꿀 수 있으므로,
     * 여러 UART 장치를 "번갈아" 쓰는 것은 가능하다. 이 중재자가 그 전환을 맡는다.
     *   - 각 장치는 init 에서 uartRegister() 로 자기 핀/보드레이트를 등록만 한다
     *   - 실제 통신 직전에 uartClaim() 이 필요할 때만 전환한다(같은 주인이면 무동작)
     *   - USB 수신 폴러는 소유권이 USB 가 아닐 때 읽기를 멈춘다(데이터 도둑질 방지)
     *
     * ★ 한계: 동시 사용은 불가능하다. PMS·GPS·WiFi(ESP) 처럼 계속 흘려보내는 장치는
     *   소유권을 잃은 동안의 데이터를 놓치며, 되찾은 뒤 프레임 헤더부터 재동기해야 한다.
     *   중재자는 시분할만 해줄 뿐 WiFi 에 전용 포트를 주지 않는다.
     */
    export enum UartOwner {
        //% block="USB (computer)"
        USB = 0,
        //% block="dust sensor (PMS)"
        PMS = 1,
        //% block="CO2 sensor (MH-Z19)"
        MHZ19 = 2,
        //% block="fingerprint sensor"
        Fingerprint = 3,
        //% block="GPS"
        GPS = 4,
        //% block="LoRa"
        LoRa = 5,
        // WiFi(08_wifi.ts) 도 같은 UART 를 쓰므로 중재 대상에 넣는다.
        // 드롭다운 번역 키를 새로 만들 수 없어 block 속성 주석은 붙이지 않는다
        // (블록/로케일 집계를 그대로 유지하기 위함. 라벨은 멤버 이름 "WiFi" 가 쓰인다)
        // ★ 이 설명 안에 퍼센트 지시자를 그대로 적으면 pxt 가 그걸 속성으로 읽어
        //   라벨이 "true" 가 된다. 주석에도 그 표기를 쓰지 말 것.
        WiFi = 6,
        // MP3 모듈 2종(06_output_device.ts)도 같은 UART 를 쓴다. 예전에는 serial.redirect 를
        // 직접 불러서 중재자의 _uartOwner 와 어긋났고, 그 상태로 USB 폴러가 계속 읽어
        // MP3 응답을 가로챘다(재생완료 조회가 영원히 0). WiFi 와 같은 이유로 block 속성 없음.
        KT403A = 7,
        DFPlayer = 8
    }

    let _uartRx: number[] = [SerialPin.USB_RX, 0, 0, 0, 0, 0, 0, 0, 0]
    let _uartTx: number[] = [SerialPin.USB_TX, 0, 0, 0, 0, 0, 0, 0, 0]
    let _uartBaud: number[] = [115200, 9600, 9600, 57600, 9600, 9600, 115200, 9600, 9600]
    let _uartRegistered: boolean[] = [true, false, false, false, false, false, false, false, false]
    let _uartOwner: number = UartOwner.USB
    let _rxBufSized: boolean = false
    let _txPadFixed: boolean = false

    // 장치가 자기 핀/보드레이트를 등록한다 (전환은 하지 않는다)
    export function uartRegister(dev: number, rx: number, tx: number, baud: number): void {
        _uartRx[dev] = rx
        _uartTx[dev] = tx
        _uartBaud[dev] = baud
        _uartRegistered[dev] = true
        if (_uartOwner == dev) _uartOwner = -1   // 설정이 바뀌었으니 다음 사용 때 강제 재전환
    }

    // 통신 직전 호출 — 이미 그 장치가 주인이면 아무것도 하지 않는다
    export function uartClaim(dev: number): void {
        if (_uartOwner == dev) return
        if (!_uartRegistered[dev]) return          // 등록 전이면 전환하지 않는다
        serial.redirect(<SerialPin>_uartTx[dev], <SerialPin>_uartRx[dev], _uartBaud[dev])
        basic.pause(20)                            // 전환 안정화
        _uartOwner = dev
    }

    // pxt 의 serial.writeLine 은 기본으로 32바이트 경계까지 공백을 채운다
    // (core/serial.ts: writeLinePadding = 32). "Hello" 가 "Hello"+공백25+CRLF 로 나간다.
    // 아두이노판 println 은 페이로드+CRLF 뿐이라 같은 문자열이 서로 다르게 전송됐고,
    // 받는 쪽 문자열 비교가 실패하며 LoRa 페이로드와 AT 명령까지 오염됐다.
    // 0 으로 두면 writeLine 이 아두이노 println 과 정확히 같아진다.
    //
    // ★ RX 링 확장(uartEnsureRxBuffer)과 일부러 분리해 둔다.
    //   송신만 하는 프로그램(Serial start 블록 없이 Serial send 만 쓰는 경우)에서도
    //   패딩은 반드시 꺼야 하지만, 읽지도 않을 254B RX 링까지 잡을 이유는 없다.
    function _ensureTxPadding(): void {
        if (_txPadFixed) return
        _txPadFixed = true
        serial.setWriteLinePadding(0)
    }

    // DAL 기본 RX 링은 20바이트(사용 가능 19B)뿐이라 115200bps 에서는 1.7ms 만에 넘치고
    // 그 뒤 도착한 바이트는 그냥 버려진다. AT 응답이나 +IPD 페이로드가 통째로 잘리는 원인.
    // setRxBufferSize 는 링을 free/realloc 하므로 읽는 중에 부르면 버퍼가 날아가거나
    // MICROBIT_SERIAL_IN_USE 로 실패한다 → 프로그램당 딱 한 번만 키운다.
    export function uartEnsureRxBuffer(): void {
        _ensureTxPadding()
        if (_rxBufSized) return
        _rxBufSized = true
        serial.setRxBufferSize(254)
    }

    //% block="switch UART to %dev"
    //% group="Settings" weight=51
    export function uartSwitch(dev: UartOwner): void {
        uartClaim(dev)
    }

    //% block="UART owner is %dev ?"
    //% group="Settings" weight=50
    export function uartIsOwner(dev: UartOwner): boolean {
        return _uartOwner == dev
    }

    // 아두이노 수신 폴러는 한 줄을 완성한 직후 String::trim() 을 걸어
    // 앞뒤 공백(스페이스·탭·CR·LF)을 전부 지운 값을 저장/비교/파싱한다
    // (15_comm.js:362 `String line = _sys_rx_buffer; line.trim();`).
    // 여기서는 끝의 CR 하나만 지웠던 탓에 스페이스·탭이 그대로 남아
    // 변경감지 비교(line !== _prevMsg)와 사용자 문자열 비교, 파싱 토큰이
    // 아두이노판과 달라졌다. 정적 TS 라 정규식을 못 쓰므로 직접 훑는다.
    function _trimWs(s: string): string {
        let a = 0
        let b = s.length
        while (a < b) {
            let c = s.charCodeAt(a)
            // 32=space, 9..13=tab/LF/VT/FF/CR  (C isspace 와 동일 집합)
            if (c === 32 || (c >= 9 && c <= 13)) a++
            else break
        }
        while (b > a) {
            let c = s.charCodeAt(b - 1)
            if (c === 32 || (c >= 9 && c <= 13)) b--
            else break
        }
        if (a === 0 && b === s.length) return s
        return s.substr(a, b - a)
    }

    function _ensurePoll(): void {
        if (_pollStarted) return
        _pollStarted = true
        uartEnsureRxBuffer()
        control.inBackground(() => {
            let acc = ""
            while (true) {
                // UART 소유권이 USB 가 아니면 읽지 않는다.
                // (센서가 쓰는 동안 이 루프가 읽으면 센서 응답을 가로채 양쪽 다 깨진다)
                //
                // ★ 예전에는 serial.readUntil() 로 읽었는데, 이건 개행이 올 때까지
                //   파이버를 무기한 재우면서 RX 락을 계속 쥔다. 그래서 위 소유권 검사를
                //   통과해 들어간 뒤 소유권이 센서로 넘어가도 폴러가 빠져나오지 못하고,
                //   센서가 읽어야 할 첫 프레임을 가로채 버렸다.
                //   → 비차단 readString() 누적 방식으로 바꿔 매 회전마다 소유권을 다시 본다.
                if (_uartOwner != UartOwner.USB) { acc = ""; basic.pause(20); continue }
                let chunk = serial.readString()
                if (chunk && chunk.length > 0) {
                    acc += chunk
                    let nl = acc.indexOf("\n")
                    while (nl >= 0) {
                        let line = acc.substr(0, nl)
                        acc = acc.substr(nl + 1)
                        // 아두이노와 동일하게 앞뒤 공백을 모두 제거한다(CR 하나만이 아니라)
                        line = _trimWs(line)
                        if (line.length > 0) {
                            _lastMsg = line
                            _anyReady = true
                            _anyConsumed = false
                            if (_anyHandler) _anyHandler(line)
                            if (line !== _prevMsg) {
                                _prevMsg = line
                                _msgReady = true
                                _msgConsumed = false
                                if (_changedHandler) _changedHandler(line)
                            }
                        }
                        nl = acc.indexOf("\n")
                    }
                    // 개행 없는 쓰레기가 무한히 쌓이지 않도록 상한을 둔다.
                    // 아두이노는 버퍼가 한계에 닿으면 통째로 버린다
                    // (15_comm.js:373-377 `else { _sys_rx_buffer = ""; }`).
                    // 예전처럼 뒤쪽 256자를 남기면 그 꼬리가 다음 줄 앞부분과 이어붙어
                    // 원본에 없던 문자열이 만들어진다 → 아두이노처럼 통째로 버린다.
                    // ★ "긴 줄은 절대 배달 안 된다"는 뜻은 아니다. 비운 뒤 도착하는
                    //   바이트는 다시 쌓이므로, 지나치게 긴 줄은 개행 시점에 '뒤쪽 조각'
                    //   으로 배달된다 — 아두이노도 동일하다(위 else 분기 뒤 재누적).
                    // 임계값만 다르다(아두이노 256 / 여기 512). micro:bit 는 readString()
                    // 덩어리 단위로 읽어 acc 가 줄 길이를 잠깐 넘길 수 있어 여유를 뒀다.
                    if (acc.length > 512) acc = ""
                }
                basic.pause(5)
            }
        })
    }

    //% block="📡 Serial start RX %rx TX %tx Baud %baud"
    //% rx.defl=SerialPin.USB_RX
    //% tx.defl=SerialPin.USB_TX
    //% baud.defl=BaudRate.BaudRate115200
    //% group="Settings" weight=100
    //% inlineInputMode=inline
    export function serialStart(rx: SerialPin, tx: SerialPin, baud: BaudRate): void {
        // 중재자에 USB 를 등록하고 소유권을 가져온다
        uartRegister(UartOwner.USB, rx, tx, baud)
        uartEnsureRxBuffer()          // RX 링 확장 + writeLine 패딩 해제
        _uartOwner = -1
        uartClaim(UartOwner.USB)
        _connected = true
        basic.pause(100)
        _ensurePoll()
    }

    //% block="📡 Serial connected?"
    //% group="Settings" weight=99
    export function serialIsConnected(): boolean {
        return _connected
    }

    //% block="📤 Serial send %value"
    //% value.defl="Hello"
    //% group="Send" weight=98
    export function serialSend(value: string): void {
        // 센서가 UART 주인이면 이 글자들이 센서 RX 핀으로 나가버린다. 먼저 되찾는다.
        // (이미 USB 가 주인이면 uartClaim 은 아무것도 하지 않는다)
        uartClaim(UartOwner.USB)
        // Serial start 없이 이 블록만 쓰는 프로그램도 있다. 그 경로에서는
        // 패딩 해제가 한 번도 안 걸려 "Hello" 가 32바이트로 채워져 나갔다.
        _ensureTxPadding()
        serial.writeLine(value)
    }

    //% block="📥 on Serial message changed"
    //% group="Receive" weight=97
    //% draggableParameters
    export function onSerialMessageChanged(handler: (message: string) => void): void {
        _changedHandler = handler
        _ensurePoll()
    }

    //% block="📥 on Serial message any"
    //% group="Receive" weight=96
    //% draggableParameters
    export function onSerialMessageAny(handler: (message: string) => void): void {
        _anyHandler = handler
        _ensurePoll()
    }

    //% block="📥 Serial received value"
    //% group="Receive" weight=95
    export function serialGetReceived(): string {
        _ensurePoll()
        return _lastMsg
    }

    //% block="📥 Serial new message?"
    //% group="Receive" weight=94
    export function serialHasNew(): boolean {
        _ensurePoll()
        if (_msgReady && !_msgConsumed) {
            _msgConsumed = true
            return true
        }
        return false
    }

    //% block="🔍 Serial parse received with %delimiter"
    //% delimiter.defl=","
    //% group="Parse" weight=93
    export function serialParse(delimiter: string): void {
        _parsedDelim = delimiter && delimiter.length > 0 ? delimiter : ","
        _parsedData = _lastMsg
    }

    //% block="🔍 Serial parsed %index th value"
    //% index.defl=1 index.min=1
    //% group="Parse" weight=92
    export function serialParsedGet(index: number): string {
        if (!_parsedData || _parsedData.length === 0) return ""
        let parts = _parsedData.split(_parsedDelim)
        if (index < 1 || index > parts.length) return ""
        return parts[index - 1]
    }

    //% block="🔢 %value to integer"
    //% value.defl="0"
    //% group="Convert" weight=91
    export function commToInt(value: string): number {
        let n = parseFloat(value)
        if (isNaN(n)) return 0
        return Math.trunc(n)
    }

    //% block="🔢 %value to float"
    //% value.defl="0"
    //% group="Convert" weight=90
    export function commToFloat(value: string): number {
        let n = parseFloat(value)
        return isNaN(n) ? 0 : n
    }

    //% block="🔢 %value ASCII byte"
    //% value.defl="A"
    //% group="Convert" weight=89
    export function commToAscii(value: string): number {
        if (!value || value.length === 0) return 0
        return value.charCodeAt(0)
    }
}
