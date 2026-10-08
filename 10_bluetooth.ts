/**
 * BRIXEL Extension - 10. Bluetooth (v3.0 — 브릭셀AI 호환)
 * micro:bit 내장 BLE Nordic UART Service wrapper
 *
 * 브릭셀AI WebBLE → micro:bit "BBC micro:bit [코드]" 선택 → 즉시 연결
 * (페어링 다이얼로그 없음 — pxt.json yotta config: pairing_mode=0, open=1)
 *
 * 핵심 변경 (기존 bluetooth 확장 대비):
 *  - 송신: BT [값] 보내기 1블록 (자동 \n)
 *  - 수신: 자동 코얼레스 (변경시만 / 매번)
 *  - hat 안에서 readUntil 강제 호출 안함 — 언제든 getReceived/hasNew 가능
 *  - 파싱: split + 1-based 인덱스 (08·09와 동일)
 */

//% weight=1000 color=#007EF4 icon="" block="10. Bluetooth"
//% groups='["Settings","Send","Receive","Parse"]'
namespace Bluetooth10 {

    let _btConnected: boolean = false
    let _btStarted: boolean = false
    let _btLastMsg: string = ""
    let _btPrevMsg: string = ""
    let _btMsgReady: boolean = false
    let _btMsgConsumed: boolean = true
    let _btParsedData: string = ""
    let _btParsedDelim: string = ","
    let _btChangedHandler: (msg: string) => void = null
    let _btAnyHandler: (msg: string) => void = null
    let _btConnectedHandler: () => void = null
    let _btDisconnectedHandler: () => void = null

    function _handleLine(raw: string): void {
        if (!raw || raw.length === 0) return
        let line = raw
        if (line.charCodeAt(line.length - 1) === 13) {
            line = line.substr(0, line.length - 1)
        }
        if (line.length === 0) return
        _btLastMsg = line
        if (_btAnyHandler) _btAnyHandler(line)
        if (line !== _btPrevMsg) {
            _btPrevMsg = line
            _btMsgReady = true
            _btMsgConsumed = false
            if (_btChangedHandler) _btChangedHandler(line)
        }
    }

    //% block="🔵 Bluetooth start"
    //% group="Settings" weight=100
    export function btStart(): void {
        if (_btStarted) return
        _btStarted = true

        bluetooth.startUartService()

        bluetooth.onBluetoothConnected(() => {
            _btConnected = true
            if (_btConnectedHandler) _btConnectedHandler()
        })

        bluetooth.onBluetoothDisconnected(() => {
            _btConnected = false
            if (_btDisconnectedHandler) _btDisconnectedHandler()
        })

        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), () => {
            let data = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
            _handleLine(data)
        })
    }

    //% block="🔵 Bluetooth connected?"
    //% group="Settings" weight=99
    export function btIsConnected(): boolean {
        // 아두이노 bt_connected 는 항상 true 를 돌려주므로, 연결 확인만 하는 프로그램도
        // 그대로 진행되고 셋업 쪽에서 BT 링크가 올라간다.
        // 여기서 btStart() 를 부르지 않으면 UART 서비스가 시작되지 않아
        // 폰이 연결될 수 없고 _btConnected 가 영영 true 가 되지 못한다(영구 교착).
        // 그래서 이 네임스페이스의 나머지 전부와 동일하게 먼저 시작시킨다.
        if (!_btStarted) btStart()
        return _btConnected
    }

    //% block="🔵 on Bluetooth connected"
    //% group="Settings" weight=98
    export function onBtConnected(handler: () => void): void {
        _btConnectedHandler = handler
        btStart()
    }

    //% block="🔵 on Bluetooth disconnected"
    //% group="Settings" weight=97
    export function onBtDisconnected(handler: () => void): void {
        _btDisconnectedHandler = handler
        btStart()
    }

    //% block="📤 BT send %value"
    //% value.defl="Hello"
    //% group="Send" weight=96
    export function btSend(value: string): void {
        if (!_btStarted) btStart()
        bluetooth.uartWriteString(value + "\n")
    }

    //% block="📥 on BT message changed"
    //% group="Receive" weight=95
    //% draggableParameters
    export function onBtMessageChanged(handler: (message: string) => void): void {
        _btChangedHandler = handler
        btStart()
    }

    //% block="📥 on BT message any"
    //% group="Receive" weight=94
    //% draggableParameters
    export function onBtMessageAny(handler: (message: string) => void): void {
        _btAnyHandler = handler
        btStart()
    }

    //% block="📥 BT received value"
    //% group="Receive" weight=93
    export function btGetReceived(): string {
        if (!_btStarted) btStart()
        return _btLastMsg
    }

    //% block="📥 BT new message?"
    //% group="Receive" weight=92
    export function btHasNew(): boolean {
        if (!_btStarted) btStart()
        if (_btMsgReady && !_btMsgConsumed) {
            _btMsgConsumed = true
            return true
        }
        return false
    }

    //% block="🔍 BT parse received with %delimiter"
    //% delimiter.defl=","
    //% group="Parse" weight=91
    export function btParse(delimiter: string): void {
        // 아두이노 bt_parse 는 injectBtPoll() 로 수신 기계를 함께 심는다.
        // (bt_parsed_get 은 addParseHelper 만 — 그래서 여기만 시작시킨다.)
        // 시작하지 않으면 _btLastMsg 가 영원히 ""라 파싱 결과가 항상 빈 문자열이 된다.
        if (!_btStarted) btStart()
        _btParsedDelim = delimiter && delimiter.length > 0 ? delimiter : ","
        _btParsedData = _btLastMsg
    }

    //% block="🔍 BT parsed %index th value"
    //% index.defl=1 index.min=1
    //% group="Parse" weight=90
    export function btParsedGet(index: number): string {
        if (!_btParsedData || _btParsedData.length === 0) return ""
        let parts = _btParsedData.split(_btParsedDelim)
        if (index < 1 || index > parts.length) return ""
        return parts[index - 1]
    }
}
