/**
 * BRIXEL Extension - 07. Communications
 * IR, PN532, GPS, MFRC522, nRF24L01, LoRa
 *
 * RF433 은 제거했다 — 브릭셀 아두이노판은 VirtualWire/RH_ASK 의 4b6b 인코딩 + CRC-16 을
 * 쓰는데 이 확장은 생 NRZ + XOR-8 이라 양쪽이 서로 통신할 수 없었고, 동기 검출 자체가
 * 동작하지 않아 micro:bit 끼리도 수신이 되지 않았다. (2026-08-06)
 */

//% weight=1040 color=#F75ACF icon="\uf1eb" block="07. Communications"
//% groups='["Infrared","PN532","GPS","MFRC522","nRF24L01","LoRa"]'
namespace Communications07 {



    /********** IR 적외선 리모컨 **********/

    // IR 리모컨 수신기 (VS1838B, TSOP38238 등)
    // NEC 프로토콜 기반 (대부분의 리모컨 호환)

    // IR 리모컨 버튼 (일반 미니 리모컨 기준)
    export enum IRButton {
        //% block="0"
        Num0 = 0,
        //% block="1"
        Num1 = 1,
        //% block="2"
        Num2 = 2,
        //% block="3"
        Num3 = 3,
        //% block="4"
        Num4 = 4,
        //% block="5"
        Num5 = 5,
        //% block="6"
        Num6 = 6,
        //% block="7"
        Num7 = 7,
        //% block="8"
        Num8 = 8,
        //% block="9"
        Num9 = 9,
        //% block="*"
        Star = 10,
        //% block="#"
        Hash = 11,
        //% block="▲"
        Up = 12,
        //% block="▼"
        Down = 13,
        //% block="◀"
        Left = 14,
        //% block="▶"
        Right = 15,
        //% block="OK"
        OK = 16,
        //% block="other"
        Other = 99
    }

    // IR 상태 변수
    // P11 은 버튼 B 전용 핀(보드에 10k 풀업)이라 수신기 노이즈가 버튼 B 이벤트를
    // 유발한다. 그래서 P16 으로 옮긴다.
    let _irPin: DigitalPin = DigitalPin.P16
    let _irRawCode: number = 0
    let _irButton: number = -1
    let _irHasSignal: boolean = false
    let _irCallback: (button: number) => void = null

    // NEC 리모컨 코드 매핑 (일반적인 미니 리모컨)
    const IR_CODE_MAP: number[] = [
        0x16,  // 0
        0x0C,  // 1
        0x18,  // 2
        0x5E,  // 3
        0x08,  // 4
        0x1C,  // 5
        0x5A,  // 6
        0x42,  // 7
        0x52,  // 8
        0x4A,  // 9
        // 0x22 는 이 리모컨에 존재하지 않는 값이라 '*' 선택지가 영원히 참이 될 수 없었다.
        // 아두이노 readIR 표(IRremote/src/IRread.h:19-41)는 21개 명령을 정의하는데,
        // 위의 숫자 10개가 그 표와 정확히 일치하므로 같은 리모컨(HX1838 계열)이 맞다.
        // 그 표에서 0 과 같은 줄에 있는 100+(0x19)/200+(0x0D)가 여기 '*'/'#' 자리에
        // 대응한다. '#' 이 이미 200+(0x0D)이므로 '*' 는 100+(0x19)로 맞춘다.
        0x19,  // * (10)  = 리모컨의 100+
        0x0D,  // # (11)  = 리모컨의 200+
        0x46,  // ▲ (12)  = 리모컨의 CH
        0x15,  // ▼ (13)  = 리모컨의 VOL+
        0x44,  // ◀ (14)  = 리모컨의 |<< PREV
        0x43,  // ▶ (15)  = 리모컨의 >|| PLAY
        0x40   // OK (16) = 리모컨의 >>| NEXT
        // 표의 나머지 4개(0x45 CH-, 0x47 CH+, 0x07 VOL-, 0x09 EQ)는 대응하는 드롭다운
        // 항목이 없어 Other(99)로 나온다. 항목을 늘리려면 IRButton 열거형을 늘려야 하는데
        // 그러면 공개 API 가 바뀌므로 여기서는 그대로 둔다.
    ]

    //% block="IR remote receiver set: pin %pin"
    //% pin.defl=DigitalPin.P16
    //% group="Infrared" weight=45
    export function irInit(pin: DigitalPin): void {
        _irPin = pin
        _irRawCode = 0
        _irButton = -1
        _irHasSignal = false

        // 핀 이벤트 설정 (하강 에지에서 시작)
        pins.setPull(pin, PinPullMode.PullUp)

        // 백그라운드에서 IR 신호 모니터링
        control.inBackground(() => {
            while (true) {
                let code = irReadNEC()
                // NEC 는 bit31 이 ~command 의 MSB 라 정상 수신이면 code 가 항상 음수 int32 가
                // 된다. 예전 조건 (code > 0) 은 모든 정상 프레임을 버렸다.
                // 실패 경로는 전부 0 을 반환하므로 0 만 걸러내면 된다.
                if (code != 0) {
                    // NEC 순서는 address, ~address, command, ~command (각각 LSB first).
                    // 즉 command 는 bit16~23 이다. (code & 0xFF) 는 address 라 매핑이 안 됐다.
                    let cmd = (code >> 16) & 0xFF
                    // 아두이노 ESP32 경로는 _ir_last_code 에 decodedIRData.command,
                    // 즉 8비트 command 만 담는다(15_comm.js:62). 이 확장의 코드표도 그
                    // 8비트 표를 그대로 옮긴 것이라 원본 코드값도 같은 규약으로 맞춘다.
                    // 예전에는 조립한 32비트 값을 그대로 넣어서 CH- 가 -1169719552 같은
                    // 큰 음수로 보였다(아두이노는 AVR 0xFFA25D, ESP32 0x45=69).
                    _irRawCode = cmd
                    _irButton = irCodeToButton(cmd)
                    _irHasSignal = true

                    if (_irCallback != null) {
                        _irCallback(_irButton)
                    }
                }
                // irReadNEC 이 최대 20ms 동안 하강 에지를 기다리므로 짧게만 양보한다.
                // 50ms 를 쉬면 리모컨 프레임 대부분을 놓친다.
                basic.pause(5)
            }
        })
    }

    //% block="IR remote signal ?"
    //% group="Infrared" weight=44
    export function irHasSignal(): boolean {
        // 아두이노는 _ir_data_available 를 그대로 돌려주고, 이 플래그는 버튼을 읽을 때만
        // 지워진다(15_comm.js:34-36, :67, :89-96). 스스로 만료되지 않는다.
        // 예전의 500ms 만료는 1초 pause 가 있는 forever 루프처럼 조금만 늦게 확인해도
        // 눌림을 놓치게 만들어서, 부하에 따라 반응이 들쭉날쭉했다.
        return _irHasSignal
    }

    //% block="IR remote button #"
    //% group="Infrared" weight=43
    export function irButtonNumber(): number {
        // 아두이노 _getIRButton() 은 새 신호가 있을 때만 값을 돌려주고, 없으면 -1 이며
        // 읽는 순간 플래그를 지운다(15_comm.js:89-96). 즉 눌림 1회에 1회만 값이 나온다.
        // 예전 코드는 _irButton 을 한 번도 되돌리지 않아 한 번 누른 값이 영원히 남았다.
        if (!_irHasSignal) return -1
        let btn = _irButton
        _irHasSignal = false
        _irButton = -1
        return btn
    }

    //% block="IR remote original code value"
    //% group="Infrared" weight=42
    export function irRawCode(): number {
        // 8비트 NEC command 를 돌려준다 (아두이노 ESP32 경로와 같은 규약).
        // ⚠ 이 값은 irTransmit 에 그대로 넣으면 안 된다. irTransmit 의 code 는
        //   address/~address/command/~command 를 다 담은 32비트 NEC 워드다.
        //   32비트를 담던 예전에는 irRawCode → irTransmit 재생이 되었지만 이제는 안 된다.
        //   (아두이노 에디터에는 IR 송신 블록 자체가 없어 맞출 원본이 없다)
        return _irRawCode
    }

    //% block="Is the IR remote button %button ?"
    //% button.defl=IRButton.Num0
    //% group="Infrared" weight=41
    export function irButtonIs(button: IRButton): boolean {
        // 아두이노는 (_getIRButton() == N) 으로 컴파일되므로 눌림 1회당 딱 한 번만
        // 참이다(15_comm.js:150). 예전 코드는 _irHasSignal 을 보지 않고 _irButton 만
        // 비교해서, 한 번 누르면 forever 루프 안에서 계속 참이 되어 동작이 무한 반복됐다.
        // 아두이노판은 비교가 어긋나도 신호를 소비해 버려서 한 루프에서 여러 버튼을
        // 나란히 검사하면 두 번째부터는 절대 참이 되지 않는다. micro:bit 에서는 일치할
        // 때만 소비해서 그 부작용 없이 '1회성' 성질만 그대로 가져왔다.
        if (!_irHasSignal) return false
        if (_irButton != button) return false
        _irHasSignal = false
        _irButton = -1
        return true
    }

    //% block="When the IR remote button is pressed"
    //% group="Infrared" weight=40
    //% draggableParameters
    export function irOnButton(handler: (button: number) => void): void {
        _irCallback = handler
    }

    // NEC 프로토콜 읽기 (내부 함수)
    function irReadNEC(): number {
        // 하강 에지(HIGH → LOW) 대기 = 리더 버스트 시작점.
        // VS1838B 출력은 평소 HIGH 라 이 대기가 없으면 아래 while 문이 한 번도 돌지 않고
        // lowTime 이 0 이 되어 항상 0 을 반환했다. (수신이 거의 안 되던 원인)
        // runningTimeMicros 는 int32 라 약 35.8분마다 값이 음수로 넘어간다. 이 루프는
        // 신호가 없으면 계속 도는 곳이라 넘어가는 순간을 밟을 확률이 높은데, 그때
        // (지금 - edgeStart) 가 큰 음수가 되어 20000 비교가 영원히 성립하지 않는다.
        // 그러면 양보 없이 무한 루프가 되어 프로그램 전체가 멈추므로 음수도 타임아웃 처리.
        // ★ 이 대기는 신호가 없을 때 20ms 내내 도는 곳이라 양보 없이 돌리면 이 fiber 가
        //   CPU 를 80% 쥐고 있게 되어 사용자의 forever 루프가 눈에 띄게 느려진다.
        //   NEC 리더의 LOW 구간이 9ms 라 양보하며 살펴도 구간 자체는 놓치지 않는다.
        // ★★ 다만 '놓치지 않는다'와 '언제 시작했는지 안다'는 다르다. 양보하는 순간
        //   에지를 늦게 잡게 되고, 그만큼 아래 lowTime 이 9000 보다 짧게 측정된다.
        //   basic.pause(1) 은 스케줄러 틱에 맞춰 깨어나므로 실제 표본 간격은
        //   micro:bit V2(CODAL) 약 1ms, V1(DAL) 은 시스템 틱 그대로 6ms 다.
        //   즉 lowTime 은 V2 에서 8000 아래로, V1 에서는 3000 까지 내려간다 —
        //   예전의 고정 하한 8000 은 V1 에서 거의 모든 프레임을 버렸다.
        //   그래서 마지막으로 HIGH 를 본 시각(prev)과 에지 검출 시각의 차이
        //   (sampleGap = 에지를 늦게 잡은 최대 시간)만큼 판정창을 넓힌다.
        //   폴링 간격을 바꿔도 판정이 저절로 따라오므로 상수를 다시 손볼 필요가 없다.
        let edgeStart = input.runningTimeMicros()
        let prev = edgeStart
        while (pins.digitalReadPin(_irPin) == 1) {
            prev = input.runningTimeMicros()
            let waited = prev - edgeStart
            if (waited < 0 || waited > 20000) return 0
            basic.pause(1)
        }

        // 리더 펄스 대기 (9ms LOW)
        // 이 아래의 에지 대기 루프는 전부 타임아웃 비교에 (d < 0) 을 함께 넣는다.
        // runningTimeMicros 가 35.8분마다 음수로 넘어가는데, 그때 (지금 - 시작) 이 큰
        // 음수가 되어 상한 비교가 영원히 성립하지 않는다. 이 루프들은 양보를 하지 않으므로
        // 그 순간 프로그램 전체가 멈춘다. 특히 HIGH 를 기다리는 루프는 송신이 도중에
        // 끊겨 핀이 HIGH 로 굳어버린 평상시 상태에서도 들어오게 된다.
        // 비트 측정 루프에도 같은 검사를 넣지만 판정 여유(562 대 1687us)가 워낙 커서
        // 비교 한 번 늘어난 것이 비트 판별에 영향을 주지 않는다.
        let startTime = input.runningTimeMicros()
        let sampleGap = startTime - prev
        if (sampleGap < 0) return 0
        while (pins.digitalReadPin(_irPin) == 0) {
            let d = input.runningTimeMicros() - startTime
            if (d < 0 || d > 15000) return 0
        }
        let lowTime = input.runningTimeMicros() - startTime
        // 실제 마크 길이는 lowTime ~ (lowTime + sampleGap) 사이에 있다.
        // 그 구간이 NEC 리더 마크 9000us 와 겹쳐야 통과시킨다.
        // 하한 1000 은 마크가 거의 끝난 뒤에야 들어온 경우(=시작점을 모르는 경우)를 버린다.
        if (lowTime < 1000 || lowTime > 10000 || lowTime + sampleGap < 8000) return 0

        // 스페이스 대기 (4.5ms HIGH)
        // 여기는 양쪽 에지를 모두 바쁜 대기로 정확히 잡으므로 판정창을 좁게 유지한다.
        // 위에서 넓힌 마크 대신 이 4.5ms 검사와 아래 32비트 디코드가 실제 걸름망이다.
        startTime = input.runningTimeMicros()
        while (pins.digitalReadPin(_irPin) == 1) {
            let d = input.runningTimeMicros() - startTime
            if (d < 0 || d > 6000) return 0
        }
        let highTime = input.runningTimeMicros() - startTime
        if (highTime < 4000 || highTime > 5000) return 0

        // 32비트 데이터 읽기
        let data: number = 0
        for (let i = 0; i < 32; i++) {
            // LOW 구간 (562.5us)
            startTime = input.runningTimeMicros()
            while (pins.digitalReadPin(_irPin) == 0) {
                let dl = input.runningTimeMicros() - startTime
                if (dl < 0 || dl > 1000) return 0
            }

            // HIGH 구간 측정 (0: 562.5us, 1: 1687.5us)
            startTime = input.runningTimeMicros()
            while (pins.digitalReadPin(_irPin) == 1) {
                let dh = input.runningTimeMicros() - startTime
                if (dh < 0 || dh > 2000) return 0
            }
            let bitTime = input.runningTimeMicros() - startTime

            // 비트 판별
            if (bitTime > 1000) {
                data |= (1 << i)
            }
        }

        return data
    }

    // IR 코드를 버튼 번호로 변환 (내부 함수)
    function irCodeToButton(code: number): number {
        for (let i = 0; i < IR_CODE_MAP.length; i++) {
            if (IR_CODE_MAP[i] == code) {
                return i
            }
        }
        return IRButton.Other
    }

    //% block="IR TX code %code|pin %pin"
    //% code.defl=0
    //% pin.defl=DigitalPin.P12
    //% group="Infrared" weight=39
    export function irTransmit(code: number, pin: DigitalPin): void {
        // 캐리어를 먼저 준비해 둔다. 아두이노 sendNEC 도 enableIROut(38) 로 타이머를
        // 한 번 켜 놓고 mark/space 는 핀만 붙였다 떼는 구조다(IR.cpp:70-88, :224-237).
        irCarrierSetup(pin)

        // NEC 프로토콜 송신
        // 리더 펄스 (9ms 38kHz, 4.5ms OFF)
        irCarrier(pin, 9000)
        control.waitMicros(4500)

        // 32비트 데이터 전송
        for (let i = 0; i < 32; i++) {
            // 562.5us 캐리어
            irCarrier(pin, 562)

            // 데이터 비트에 따라 대기
            if (code & (1 << i)) {
                control.waitMicros(1687)  // 1
            } else {
                control.waitMicros(562)   // 0
            }
        }

        // 종료 펄스
        irCarrier(pin, 562)
        irCarrierRelease(pin)
    }

    // 38kHz 캐리어 생성 (내부 함수)
    // 아두이노는 enableIROut(38) 으로 Timer2 를 38kHz 위상정정 PWM 에 올려놓고
    // mark()/space() 는 OC2B 를 연결/해제만 한다(IR.cpp:239-264, :224-237).
    // 그래서 캐리어 주파수도 구간 길이도 CPU 부하와 무관하게 정확하다.
    // 예전 micro:bit 구현은 26us 주기 안에 digitalWritePin 2회 + waitMicros 2회를
    // 넣어 직접 흔들었는데, 핀 쓰기 호출 비용만으로 주기가 40us 를 넘어(=25kHz 이하)
    // VS1838B/TSOP38238 통과대역을 벗어나고, 9ms 리더도 12ms 이상으로 늘어나
    // 수신기의 리더 판정창(6825~11375us, IRint.h:97/169)을 넘겨 프레임이 통째로 버려졌다.
    // 따라서 아두이노와 같이 하드웨어 PWM 으로 만들고 구간 길이만 따로 기다린다.
    // ★ 주의: micro:bit 는 하드웨어 PWM 채널이 3개뿐이고 주기가 채널 단위로 공유된다
    //   (05_actuators.ts 머리말의 서보 주기 경고와 같은 이유). 그래서 송신에 쓰는 핀은
    //   같은 채널에 걸린 서보/음계와 경합하고, 송신 중(약 90ms) 그쪽 파형이 흐트러진다.
    //   송신이 끝나면 주기를 micro:bit 기본값 20ms 로 되돌린 뒤 핀을 디지털로 놓아 준다.
    function irCarrierSetup(pin: DigitalPin): void {
        // DigitalPin 과 AnalogPin 은 MICROBIT_ID_IO_* 값이 같아 캐스팅으로 변환된다
        let apin = <AnalogPin><number>pin
        pins.analogWritePin(apin, 341)   // 듀티 약 1/3
        pins.analogSetPeriod(apin, 26)   // 26us 주기 = 약 38.5kHz
        pins.analogWritePin(apin, 0)     // 준비만 하고 일단 끈다
    }

    function irCarrier(pin: DigitalPin, durationUs: number): void {
        let apin = <AnalogPin><number>pin
        pins.analogWritePin(apin, 341)
        // control.waitMicros 는 6000us 이하를 상정한 함수라 9ms 리더는 나눠서 기다린다
        let left = durationUs
        for (let n = 0; n < 8 && left > 4000; n++) {
            control.waitMicros(4000)
            left -= 4000
        }
        if (left > 0) control.waitMicros(left)
        pins.analogWritePin(apin, 0)
    }

    // 송신이 끝나면 PWM 채널을 놓아 준다 (서보/음계가 다시 쓸 수 있도록)
    function irCarrierRelease(pin: DigitalPin): void {
        let apin = <AnalogPin><number>pin
        pins.analogWritePin(apin, 0)
        pins.analogSetPeriod(apin, 20000)   // micro:bit 기본 주기 20ms 로 복구
        pins.digitalWritePin(pin, 0)
    }


    /********** PN532 NFC 리더 **********/

    // PN532는 NFC 리더/라이터 모듈입니다.
    // RFID 카드 읽기, NFC 태그 읽기/쓰기 지원
    // I2C 또는 SPI 통신 사용

    // PN532 변수
    let _pn532Addr: number = 0x24
    let _pn532LastUID: string = ""

    // --- PN532 내부 헬퍼 ---
    // PN532 의 I2C 읽기는 항상 선두에 RDY(상태) 바이트가 하나 붙는다.
    // 또 명령을 쓰면 먼저 6바이트 ACK 프레임을 내놓고, 그 다음에 응답 프레임을 내놓는다.
    // 이 두 가지를 무시해서 기존 코드는 응답 위치를 전부 한 칸씩 잘못 읽고 있었다.

    function pn532Write(frame: number[]): void {
        let buf = pins.createBuffer(frame.length)
        for (let i = 0; i < frame.length; i++) {
            buf[i] = frame[i]
        }
        pins.i2cWriteBuffer(_pn532Addr, buf)
    }

    // 고정 pause 대신 RDY 상태 바이트를 폴링해서 응답 준비를 기다린다
    function pn532WaitReady(timeoutMs: number): boolean {
        let tries = Math.idiv(timeoutMs, 5)
        if (tries < 1) tries = 1
        for (let t = 0; t < tries; t++) {
            let st = pins.i2cReadBuffer(_pn532Addr, 1)
            if ((st[0] & 0x01) == 0x01) return true
            basic.pause(5)
        }
        return false
    }

    // 명령 직후의 ACK 프레임(00 00 FF 00 FF 00)을 비운다. 비우지 않으면 다음 읽기가
    // 응답 대신 ACK 를 읽어 통신이 한 프레임씩 어긋난다.
    function pn532WaitAck(): boolean {
        if (!pn532WaitReady(50)) return false
        let r = pins.i2cReadBuffer(_pn532Addr, 7)
        return r[1] == 0x00 && r[2] == 0x00 && r[3] == 0xFF && r[4] == 0x00 && r[5] == 0xFF
    }

    // InListPassiveTarget 를 보내고 응답에서 UID 까지 한 번에 꺼낸다.
    // 응답 프레임은 한 번만 읽을 수 있으므로 감지와 UID 추출을 분리하면 안 된다.
    function pn532Poll(): boolean {
        _pn532LastUID = ""

        pn532Write([0x00, 0x00, 0xFF, 0x04, 0xFC, 0xD4, 0x4A, 0x01, 0x00, 0xE1, 0x00])
        if (!pn532WaitAck()) return false
        if (!pn532WaitReady(100)) return false

        // [0]=RDY, [1..3]=00 00 FF, [4]=LEN, [5]=LCS, [6]=TFI(0xD5), [7]=응답코드(0x4B),
        // [8]=NbTg, [9]=Tg, [10..11]=SENS_RES, [12]=SEL_RES, [13]=UID 길이, [14..]=UID
        let r = pins.i2cReadBuffer(_pn532Addr, 25)
        if (r[0] != 0x01 || r[6] != 0xD5 || r[7] != 0x4B || r[8] < 1) return false

        let uidLen = r[13]
        if (uidLen < 1 || uidLen > 7) return false
        for (let i = 0; i < uidLen; i++) {
            let b = r[14 + i]
            _pn532LastUID += "0123456789ABCDEF".charAt((b >> 4) & 0x0F) + "0123456789ABCDEF".charAt(b & 0x0F)
        }
        return true
    }

    //% block="NFC(PN532) I2C set address %addr"
    //% addr.defl=0x24
    //% group="PN532" weight=58
    export function pn532Init(addr: number): void {
        _pn532Addr = addr

        // PN532 웨이크업
        basic.pause(100)

        // SAM 설정 (Security Access Module)
        pn532Write([0x00, 0x00, 0xFF, 0x05, 0xFB, 0xD4, 0x14, 0x01, 0x00, 0x00, 0x17, 0x00])
        pn532WaitAck()
        if (pn532WaitReady(100)) pins.i2cReadBuffer(_pn532Addr, 12)   // 응답 프레임 비우기

        // RFConfiguration - MxRtyPassiveActivation 을 1 회로 제한한다.
        // 공장 기본값은 0xFF(무한 재시도)라서 카드가 없으면 InListPassiveTarget 이
        // 끝나지 않고, 다음 감지 명령이 그 위에 겹쳐 써져 통신이 완전히 어긋난다.
        // D4 32 05 FF 01 01 / LEN=0x06 LCS=0xFA DCS=0xF4
        pn532Write([0x00, 0x00, 0xFF, 0x06, 0xFA, 0xD4, 0x32, 0x05, 0xFF, 0x01, 0x01, 0xF4, 0x00])
        pn532WaitAck()
        if (pn532WaitReady(100)) pins.i2cReadBuffer(_pn532Addr, 12)
    }

    //% block="NFC card detected?"
    //% group="PN532" weight=57
    export function pn532CardPresent(): boolean {
        // ACK/RDY 처리와 응답 오프셋은 pn532Poll 에서 일괄 처리한다.
        // (기존 코드는 ACK 를 응답으로 오해하고 TFI 를 [7] 에서 찾아 항상 false 였다)
        return pn532Poll()
    }

    //% block="NFC card UID read"
    //% group="PN532" weight=56
    export function pn532ReadCard(): string {
        // 예전에는 감지 명령의 응답을 pn532CardPresent 가 이미 소비한 뒤에
        // 명령 없이 한 번 더 읽어서 항상 엉뚱한 바이트를 UID 로 해석했다.
        // 이제 pn532Poll 이 명령 전송 → ACK 비우기 → 응답 파싱을 한 번에 한다.
        if (!pn532Poll()) return ""
        return _pn532LastUID
    }

    //% block="NFC last UID"
    //% group="PN532" weight=55
    export function pn532LastUID(): string {
        return _pn532LastUID
    }

    //% block="NFC UID %targetUID ?"
    //% targetUID.defl="04A1B2C3"
    //% group="PN532" weight=54
    export function pn532UIDMatches(targetUID: string): boolean {
        return _pn532LastUID.toUpperCase() == targetUID.toUpperCase()
    }


    /********** GPS 모듈 (NEO-6M/7M 등) **********/

    // GPS 모듈은 NMEA 프로토콜로 위치 정보를 전송합니다.
    // NEO-6M, NEO-7M, NEO-M8N 등 대부분의 GPS 모듈 호환

    // GPS 시리얼 타입
    export enum GPSSerial {
        //% block="Serial"
        Hardware = 0,
        //% block="software serial"
        Software = 1
    }

    // GPS 데이터 타입
    export enum GPSData {
        //% block="latitude"
        Latitude = 0,
        //% block="longitude"
        Longitude = 1,
        //% block="altitude(m)"
        Altitude = 2,
        //% block="speed(km/h)"
        Speed = 3,
        //% block="direction(°)"
        Course = 4,
        //% block="satellite"
        Satellites = 5,
        //% block="time(UTC)"
        Time = 6,
        //% block="date"
        Date = 7
    }

    // 거리/방위 계산 타입
    export enum GPSCalcType {
        //% block="distance(m)"
        DistanceMeters = 0,
        //% block="distance(km)"
        DistanceKm = 1,
        //% block="bearing(°)"
        Bearing = 2
    }

    // GPS 상태 변수
    let _gpsSerial: GPSSerial = GPSSerial.Hardware
    let _gpsTx: SerialPin = SerialPin.P1
    let _gpsRx: SerialPin = SerialPin.P2
    let _gpsBaud: BaudRate = BaudRate.BaudRate9600
    let _gpsLatitude: number = 0
    let _gpsLongitude: number = 0
    let _gpsAltitude: number = 0
    let _gpsSpeed: number = 0
    let _gpsCourse: number = 0
    let _gpsSatellites: number = 0
    let _gpsTime: string = ""
    let _gpsDate: string = ""
    let _gpsFix: boolean = false
    let _gpsRawData: string = ""
    // GPSData.Time / GPSData.Date 드롭다운이 숫자로도 읽히도록 하는 값 (HHMMSS / DDMMYY)
    let _gpsTimeNum: number = 0
    let _gpsDateNum: number = 0

    // NMEA talker ID: GP=GPS 전용, GN=복합 해, GL=GLONASS, GA=Galileo, GB=BeiDou
    const NMEA_TALKERS: string[] = ["GP", "GN", "GL", "GA", "GB"]

    // $GPGGA 뿐 아니라 $GNGGA 등도 받는다. NEO-M8N 은 공장 설정이 GPS+GLONASS 라서
    // $GNGGA/$GNRMC 만 내보내므로 "$GP..." 만 찾으면 영원히 파싱되지 않았다.
    // 문장마다 두 번(GGA/RMC) 불리는 자리라 문자열을 새로 만들지 않는다.
    // "$"+talker+type 을 talker 개수만큼 이어 붙이면 gpsUpdate 한 번에 최대
    // 16문장 x 2종류 x 5토커 = 160개의 임시 문자열이 생겨 힙이 좁은 보드에서 부담된다.
    function isNmeaType(sentence: string, type: string): boolean {
        if (sentence.length < 6) return false
        if (sentence.charAt(0) != "$") return false
        if (sentence.substr(3, 3) != type) return false
        let talker = sentence.substr(1, 2)
        for (let k = 0; k < NMEA_TALKERS.length; k++) {
            if (talker == NMEA_TALKERS[k]) return true
        }
        return false
    }

    // 문장 끝('\r' 또는 '\n') 위치. 없으면 -1
    function findLineEnd(buf: string, from: number): number {
        let r = buf.indexOf("\r", from)
        let n = buf.indexOf("\n", from)
        if (r < 0) return n
        if (n < 0) return r
        return r < n ? r : n
    }

    // 16진 문자 1개 → 값. 16진수가 아니면 -1
    function nmeaHexVal(c: string): number {
        let v = c.charCodeAt(0)
        if (v >= 48 && v <= 57) return v - 48        // 0-9
        if (v >= 65 && v <= 70) return v - 55        // A-F
        if (v >= 97 && v <= 102) return v - 87       // a-f
        return -1
    }

    // NMEA 체크섬 검증 (내부 함수)
    // TinyGPS++ 는 '$' 다음부터 '*' 앞까지의 XOR 패리티가 '*' 뒤 두 자리 16진수와
    // 일치할 때만 문장을 커밋하고, 어긋나면 failedChecksumCount 만 올리고 값을 버린다
    // (TinyGPS++.cpp:56-98, :159-207). 예전 micro:bit 코드는 '*XX' 를 아예 읽지 않아
    // RX 링 넘침이나 파이버 전환으로 이어 붙은 문장도 parts.length 검사만 통과하면
    // 그대로 위도/경도/고도로 저장됐다. 아두이노가 조용히 버리는 바로 그 문장들이다.
    // sentence 는 '$' 로 시작해 '*XX' 까지 포함한 한 문장이다.
    function nmeaChecksumOk(sentence: string): boolean {
        let star = sentence.indexOf("*")
        if (star < 1 || star + 2 >= sentence.length) return false
        let parity = 0
        for (let i = 1; i < star; i++) {
            parity = parity ^ sentence.charCodeAt(i)
        }
        let hi = nmeaHexVal(sentence.charAt(star + 1))
        let lo = nmeaHexVal(sentence.charAt(star + 2))
        if (hi < 0 || lo < 0) return false
        return (hi * 16 + lo) == (parity & 0xFF)
    }

    //% block="GPS set: serial %serialType|baud rate %baud|↳ (software serial when selected) RX pin %rx|TX pin %tx"
    //% serialType.defl=GPSSerial.Hardware
    //% baud.defl=9600
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P1
    //% group="GPS" weight=53
    //% inlineInputMode=inline
    export function gpsInit(serialType: GPSSerial, baud: number, rx: SerialPin, tx: SerialPin): void {
        _gpsSerial = serialType
        _gpsTx = tx
        _gpsRx = rx

        if (baud == 4800) _gpsBaud = BaudRate.BaudRate4800
        else if (baud == 19200) _gpsBaud = BaudRate.BaudRate19200
        else if (baud == 38400) _gpsBaud = BaudRate.BaudRate38400
        else if (baud == 57600) _gpsBaud = BaudRate.BaudRate57600
        else if (baud == 115200) _gpsBaud = BaudRate.BaudRate115200
        else _gpsBaud = BaudRate.BaudRate9600

        // 즉시 전환하지 않고 중재자에 등록만 한다 (여러 UART 장치 공용)
        USBSerial.uartRegister(USBSerial.UartOwner.GPS, rx, tx, _gpsBaud)

        // CODAL 기본 RX 링은 20바이트뿐이라 9600bps NMEA 버스트(초당 약 500바이트)를
        // 담지 못하고 문장 중간이 소리 없이 잘린다. 링은 UART 전체가 공유하므로
        // 중재자의 1회성 헬퍼로 키운다 (직접 setRxBufferSize 를 부르면 중복 realloc 위험)
        USBSerial.uartEnsureRxBuffer()
        basic.pause(100)
    }

    //% block="GPS update (serial receive → parsing)"
    //% group="GPS" weight=52
    export function gpsUpdate(): void {
        USBSerial.uartClaim(USBSerial.UartOwner.GPS)
        // NMEA 문장 읽기
        let rawData = serial.readString()
        if (rawData.length == 0) return

        _gpsRawData += rawData

        // 아두이노는 while (available()) gps.encode(read()) 로 버퍼의 모든 바이트를
        // 상태 기계에 흘려 넣어서, 한 번에 몇 문장이 들어 있든 어떤 순서로 오든 전부
        // 처리된다(15_comm.js:266-268). 예전 코드는 GGA 를 먼저 찾아 그 앞을 통째로
        // 잘라내는 바람에, RMC 를 GGA 보다 먼저 내보내는 모듈에서는 매 주기마다 RMC 가
        // 삭제되어 속도/방향/날짜가 영원히 0 이었다.
        // 그래서 버퍼에 남아 있는 '완성된' 문장을 앞에서부터 순서대로 소비한다.
        // (한 번 호출에 최대 16문장 — 1초치 NMEA 버스트를 덮고도 남는다)
        for (let s = 0; s < 16; s++) {
            let start = _gpsRawData.indexOf("$")
            if (start < 0) {
                _gpsRawData = ""
                break
            }
            let end = findLineEnd(_gpsRawData, start)
            if (end < 0) {
                // 아직 끝나지 않은 문장이다. 앞의 찌꺼기만 버리고 다음 호출을 기다린다.
                if (start > 0) _gpsRawData = _gpsRawData.substr(start)
                break
            }
            let sentence = _gpsRawData.substr(start, end - start)
            _gpsRawData = _gpsRawData.substr(end)

            // 체크섬을 통과한 문장만 반영한다 (talker ID 는 GP/GN/GL/GA/GB 모두 허용)
            if (nmeaChecksumOk(sentence)) {
                if (isNmeaType(sentence, "GGA")) {
                    parseGPGGA(sentence)          // 위치, 고도, 위성 수
                } else if (isNmeaType(sentence, "RMC")) {
                    parseGPRMC(sentence)          // 위치, 속도, 방향, 날짜
                }
            }
        }

        // 버퍼 오버플로우 방지
        if (_gpsRawData.length > 500) {
            _gpsRawData = _gpsRawData.substr(_gpsRawData.length - 200)
        }
    }

    //% block="GPS value read %dataType"
    //% group="GPS" weight=51
    export function gpsRead(dataType: GPSData): number {
        switch (dataType) {
            case GPSData.Latitude: return _gpsLatitude
            case GPSData.Longitude: return _gpsLongitude
            case GPSData.Altitude: return _gpsAltitude
            case GPSData.Speed: return _gpsSpeed
            case GPSData.Course: return _gpsCourse
            case GPSData.Satellites: return _gpsSatellites
            // 드롭다운에는 있는데 case 가 없어 항상 0 이 나오던 항목 (HHMMSS / DDMMYY)
            case GPSData.Time: return _gpsTimeNum
            case GPSData.Date: return _gpsDateNum
            default: return 0
        }
    }

    //% block="GPS signal acquired (FIX)?"
    //% group="GPS" weight=50
    export function gpsHasFix(): boolean {
        // 의미 차이 기록: 아두이노 gps_has_fix 는 gps.location.isValid() 라서 한 번
        // 측위에 성공하면 그 뒤 신호가 끊겨도 계속 참이다(TinyGPS++.cpp:337-343 에서
        // valid 를 세우기만 하고 지우지 않음, 15_comm.js:290-292). 즉 '한 번이라도
        // 잡은 적 있음' 이다. 여기서는 가장 최근 문장의 상태를 그대로 돌려주므로
        // 터널/실내로 들어가 측위가 끊기면 거짓으로 되돌아간다.
        // micro:bit 쪽 의미가 더 유용하다고 판단해 그대로 두되, 아두이노 프로그램을
        // 옮겨 올 때 분기가 달라질 수 있다는 점을 여기 남긴다.
        return _gpsFix
    }

    //% block="calculate two coordinates|calc type %calcType|latitude1 %lat1|longitude1 %lon1|latitude2 %lat2|longitude2 %lon2"
    //% calcType.defl=GPSCalcType.DistanceMeters
    //% lat1.defl=37.5665 lon1.defl=126.978
    //% lat2.defl=35.1796 lon2.defl=129.0756
    //% group="GPS" weight=49
    //% inlineInputMode=inline
    export function gpsCalculate(calcType: GPSCalcType, lat1: number, lon1: number, lat2: number, lon2: number): number {
        // Haversine 공식으로 거리 계산
        // 반지름은 TinyGPS++ 가 쓰는 값과 같게 맞춘다(TinyGPS++.cpp:287-290, :307).
        // 6371000 을 쓰면 아두이노보다 약 0.028% 짧게 나와 서울~부산 기본값에서만도
        // 90m 넘게 차이가 났다. 두 공식 자체는 수학적으로 같으므로 반지름이 차이의 전부다.
        let R = 6372795  // 지구 반지름 (미터)
        let dLat = (lat2 - lat1) * Math.PI / 180
        let dLon = (lon2 - lon1) * Math.PI / 180
        let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        let distance = R * c

        if (calcType == GPSCalcType.DistanceMeters) {
            return Math.round(distance)
        } else if (calcType == GPSCalcType.DistanceKm) {
            return Math.round(distance / 10) / 100  // 소수점 2자리
        } else {
            // 방위각 계산
            let y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
            let x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
            let bearing = Math.atan2(y, x) * 180 / Math.PI
            return (bearing + 360) % 360
        }
    }

    //% block="bearing 16 directionsto|angle %angle"
    //% angle.defl=0
    //% group="GPS" weight=48
    export function gpsBearingTo16(angle: number): string {
        let directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        let index = Math.round(((angle % 360) + 360) % 360 / 22.5) % 16
        return directions[index]
    }

    //% block="GPS time (UTC)"
    //% group="GPS" weight=47
    export function gpsGetTime(): string {
        return _gpsTime
    }

    //% block="GPS date"
    //% group="GPS" weight=46
    export function gpsGetDate(): string {
        return _gpsDate
    }

    // GPGGA 문장 파싱 (내부 함수)
    function parseGPGGA(sentence: string): void {
        let parts = sentence.split(",")
        if (parts.length < 10) return

        // 시간 (HHMMSS.sss)
        if (parts[1].length >= 6) {
            _gpsTime = parts[1].substr(0, 2) + ":" + parts[1].substr(2, 2) + ":" + parts[1].substr(4, 2)
            // FIX 전에는 parts[1] 이 비어 있으므로 반드시 이 길이 검사 안에서만 변환한다
            _gpsTimeNum = parseInt(parts[1].substr(0, 6))
        }

        // 위도
        if (parts[2].length > 0) {
            let latDeg = parseFloat(parts[2].substr(0, 2))
            let latMin = parseFloat(parts[2].substr(2))
            _gpsLatitude = latDeg + latMin / 60
            if (parts[3] == "S") _gpsLatitude = -_gpsLatitude
        }

        // 경도
        if (parts[4].length > 0) {
            let lonDeg = parseFloat(parts[4].substr(0, 3))
            let lonMin = parseFloat(parts[4].substr(3))
            _gpsLongitude = lonDeg + lonMin / 60
            if (parts[5] == "W") _gpsLongitude = -_gpsLongitude
        }

        // Fix 상태 (0=없음, 1=GPS, 2=DGPS)
        _gpsFix = parseInt(parts[6]) > 0

        // 위성 수
        // 아두이노는 빈 term 을 아예 건너뛰어 직전 값을 유지한다(TinyGPS++.cpp:227).
        // 길이 검사 없이 parseInt("") 를 하면 NaN 이 들어가 LED 에 "NaN" 이 뜨고
        // 이후 계산이 전부 오염됐다. 옆 필드들과 같은 방식으로 막는다.
        if (parts[7].length > 0) {
            _gpsSatellites = parseInt(parts[7])
        }

        // 고도
        if (parts[9].length > 0) {
            _gpsAltitude = parseFloat(parts[9])
        }
    }

    // GPRMC 문장 파싱 (내부 함수)
    function parseGPRMC(sentence: string): void {
        let parts = sentence.split(",")
        if (parts.length < 10) return

        // 상태 (A=유효, V=무효)
        _gpsFix = (parts[2] == "A")

        // 속도 (노트 → km/h)
        if (parts[7].length > 0) {
            _gpsSpeed = parseFloat(parts[7]) * 1.852
        }

        // 방향
        if (parts[8].length > 0) {
            _gpsCourse = parseFloat(parts[8])
        }

        // 날짜 (DDMMYY)
        if (parts[9].length >= 6) {
            _gpsDate = parts[9].substr(0, 2) + "/" + parts[9].substr(2, 2) + "/20" + parts[9].substr(4, 2)
            _gpsDateNum = parseInt(parts[9].substr(0, 6))
        }
    }


    /********** MFRC522 RFID 리더 **********/

    // MFRC522는 13.56MHz RFID 카드 리더입니다.
    // Mifare Classic 1K/4K 카드 및 태그를 읽을 수 있습니다.
    // SPI 통신 사용

    // MFRC522 핀 저장 변수
    let _mfrc522RST: DigitalPin = DigitalPin.P8
    let _mfrc522SDA: DigitalPin = DigitalPin.P16  // CS/SDA
    let _mfrc522LastUID: string = ""
    let _mfrc522CardPresent: boolean = false

    // MFRC522 레지스터 주소
    const MFRC522_CommandReg = 0x01
    const MFRC522_ComIEnReg = 0x02
    const MFRC522_ComIrqReg = 0x04
    const MFRC522_DivIrqReg = 0x05
    const MFRC522_ErrorReg = 0x06
    const MFRC522_Status1Reg = 0x07
    const MFRC522_Status2Reg = 0x08
    const MFRC522_FIFODataReg = 0x09
    const MFRC522_FIFOLevelReg = 0x0A
    const MFRC522_ControlReg = 0x0C
    const MFRC522_BitFramingReg = 0x0D
    const MFRC522_ModeReg = 0x11
    const MFRC522_TxControlReg = 0x14
    const MFRC522_TxASKReg = 0x15
    const MFRC522_CRCResultRegH = 0x21
    const MFRC522_CRCResultRegL = 0x22
    const MFRC522_TModeReg = 0x2A
    const MFRC522_TPrescalerReg = 0x2B
    const MFRC522_TReloadRegH = 0x2C
    const MFRC522_TReloadRegL = 0x2D
    const MFRC522_VersionReg = 0x37

    //% block="RFID(MFRC522) set|RST pin %rst|SDA pin %sda"
    //% rst.defl=DigitalPin.P8
    //% sda.defl=DigitalPin.P16
    //% group="MFRC522" weight=64
    //% inlineInputMode=inline
    export function mfrc522Init(rst: DigitalPin, sda: DigitalPin): void {
        _mfrc522RST = rst
        _mfrc522SDA = sda

        // 핀 초기화
        pins.digitalWritePin(_mfrc522SDA, 1)
        pins.digitalWritePin(_mfrc522RST, 1)

        // 하드웨어 리셋
        pins.digitalWritePin(_mfrc522RST, 0)
        control.waitMicros(10)
        pins.digitalWritePin(_mfrc522RST, 1)
        basic.pause(50)

        // 소프트 리셋
        mfrc522WriteReg(MFRC522_CommandReg, 0x0F)
        basic.pause(50)

        // 타이머 설정
        mfrc522WriteReg(MFRC522_TModeReg, 0x8D)
        mfrc522WriteReg(MFRC522_TPrescalerReg, 0x3E)
        mfrc522WriteReg(MFRC522_TReloadRegH, 0x00)
        mfrc522WriteReg(MFRC522_TReloadRegL, 0x30)

        // 기타 설정
        mfrc522WriteReg(MFRC522_TxASKReg, 0x40)
        mfrc522WriteReg(MFRC522_ModeReg, 0x3D)

        // 안테나 ON
        let txControl = mfrc522ReadReg(MFRC522_TxControlReg)
        mfrc522WriteReg(MFRC522_TxControlReg, txControl | 0x03)
    }

    //% block="RFID card detected?"
    //% group="MFRC522" weight=63
    export function mfrc522CardPresent(): boolean {
        // REQA 명령 전송
        mfrc522WriteReg(MFRC522_BitFramingReg, 0x07)

        let result = mfrc522Transceive([0x26], 1)
        _mfrc522CardPresent = (result.length == 2)

        return _mfrc522CardPresent
    }

    //% block="RFID card UID read"
    //% group="MFRC522" weight=62
    export function mfrc522ReadUID(): string {
        if (!mfrc522CardPresent()) {
            _mfrc522LastUID = ""
            return ""
        }

        // Anticollision 명령
        mfrc522WriteReg(MFRC522_BitFramingReg, 0x00)
        let result = mfrc522Transceive([0x93, 0x20], 2)

        if (result.length >= 5) {
            // UID를 16진수 문자열로 변환
            _mfrc522LastUID = ""
            for (let i = 0; i < 4; i++) {
                let b = result[i]
                let hex = "0123456789ABCDEF".charAt((b >> 4) & 0x0F) + "0123456789ABCDEF".charAt(b & 0x0F)
                _mfrc522LastUID += hex
            }
        } else {
            _mfrc522LastUID = ""
        }

        return _mfrc522LastUID
    }

    //% block="RFID last UID"
    //% group="MFRC522" weight=61
    export function mfrc522LastUID(): string {
        return _mfrc522LastUID
    }

    //% block="RFID UID %targetUID ?"
    //% targetUID.defl="A1B2C3D4"
    //% group="MFRC522" weight=60
    export function mfrc522UIDMatches(targetUID: string): boolean {
        return _mfrc522LastUID.toUpperCase() == targetUID.toUpperCase()
    }

    //% block="RFID card detected"
    //% group="MFRC522" weight=59
    //% draggableParameters
    export function mfrc522OnCardDetected(handler: () => void): void {
        control.inBackground(() => {
            while (true) {
                if (mfrc522CardPresent()) {
                    mfrc522ReadUID()
                    handler()
                    basic.pause(500)  // 중복 감지 방지
                }
                basic.pause(100)
            }
        })
    }

    // MFRC522 내부 함수들
    function mfrc522WriteReg(reg: number, value: number): void {
        pins.digitalWritePin(_mfrc522SDA, 0)
        pins.spiWrite((reg << 1) & 0x7E)
        pins.spiWrite(value)
        pins.digitalWritePin(_mfrc522SDA, 1)
    }

    function mfrc522ReadReg(reg: number): number {
        pins.digitalWritePin(_mfrc522SDA, 0)
        pins.spiWrite(((reg << 1) & 0x7E) | 0x80)
        let value = pins.spiWrite(0x00)
        pins.digitalWritePin(_mfrc522SDA, 1)
        return value
    }

    function mfrc522Transceive(data: number[], txBits: number): number[] {
        // ComIrqReg 를 한 번도 지우지 않아 IdleIRq(리셋값 0x14 에 이미 세트)가 계속 걸려
        // 있었고, 아래 대기 루프가 첫 번째 폴링에서 곧바로 빠져나가 카드가 응답하기 전에
        // FIFO 를 읽었다. 명령을 Idle 로 되돌리고 IRQ 플래그를 모두 지운 뒤 시작한다.
        mfrc522WriteReg(MFRC522_CommandReg, 0x00)   // PCD_Idle
        mfrc522WriteReg(MFRC522_ComIrqReg, 0x7F)    // Set1=0 → 표시된 비트 클리어

        // FIFO 클리어
        mfrc522WriteReg(MFRC522_FIFOLevelReg, 0x80)

        // 데이터를 FIFO에 쓰기
        for (let byte of data) {
            mfrc522WriteReg(MFRC522_FIFODataReg, byte)
        }

        // Transceive 명령 실행
        mfrc522WriteReg(MFRC522_CommandReg, 0x0C)
        mfrc522WriteReg(MFRC522_BitFramingReg, mfrc522ReadReg(MFRC522_BitFramingReg) | 0x80)

        // 응답 대기
        let timeout = 25
        let irq = 0
        while (timeout > 0) {
            irq = mfrc522ReadReg(MFRC522_ComIrqReg)
            if ((irq & 0x30) != 0) break  // RxIRq 또는 IdleIRq
            timeout--
            basic.pause(1)
        }

        // 전송 중지
        mfrc522WriteReg(MFRC522_BitFramingReg, mfrc522ReadReg(MFRC522_BitFramingReg) & 0x7F)

        // 에러 체크
        if (timeout == 0 || (mfrc522ReadReg(MFRC522_ErrorReg) & 0x1B) != 0) {
            return []
        }

        // 결과 읽기
        let result: number[] = []
        let fifoLen = mfrc522ReadReg(MFRC522_FIFOLevelReg)
        for (let i = 0; i < fifoLen; i++) {
            result.push(mfrc522ReadReg(MFRC522_FIFODataReg))
        }

        return result
    }


    /********** nRF24L01 2.4GHz 무선 모듈 **********/

    // nRF24L01은 2.4GHz 대역의 무선 통신 모듈입니다.
    // 최대 2Mbps 속도, 최대 100m 거리 통신 가능
    // micro:bit 간 또는 아두이노와 통신할 때 사용

    // nRF24L01 핀 저장 변수
    let _nrfCE: DigitalPin = DigitalPin.P8
    let _nrfCSN: DigitalPin = DigitalPin.P16
    let _nrfChannel: number = 76
    let _nrfPayloadSize: number = 32
    let _nrfDataReceived: boolean = false
    let _nrfRxBuffer: number[] = []

    // nRF24L01 모드
    export enum NRFMode {
        //% block="TX (TX)"
        Transmit = 0,
        //% block="receive (RX)"
        Receive = 1
    }

    // nRF24L01 전송 속도
    export enum NRFDataRate {
        //% block="1Mbps"
        Rate1Mbps = 0,
        //% block="2Mbps"
        Rate2Mbps = 1,
        //% block="250Kbps"
        Rate250Kbps = 2
    }

    // nRF24L01 출력 세기
    export enum NRFPower {
        //% block="max (0dBm)"
        Max = 3,
        //% block="high (-6dBm)"
        High = 2,
        //% block="medium (-12dBm)"
        Medium = 1,
        //% block="low (-18dBm)"
        Low = 0
    }

    //% block="nRF24L01 set|CE pin %ce|CSN pin %csn|channel %channel"
    //% ce.defl=DigitalPin.P8
    //% csn.defl=DigitalPin.P16
    //% channel.defl=76 channel.min=0 channel.max=125
    //% group="nRF24L01" weight=77
    //% inlineInputMode=inline
    export function nrf24l01Init(ce: DigitalPin, csn: DigitalPin, channel: number): void {
        _nrfCE = ce
        _nrfCSN = csn
        _nrfChannel = channel

        // 핀 초기화
        pins.digitalWritePin(_nrfCE, 0)
        pins.digitalWritePin(_nrfCSN, 1)

        basic.pause(100)

        // 레지스터 초기화
        // CONFIG 비트: [3]EN_CRC [2]CRCO [1]PWR_UP [0]PRIM_RX
        // 예전 값 0x0C 는 PWR_UP=0 이라 칩이 영원히 Power Down 상태였다(송수신 전혀 안 됨)
        nrfWriteReg(0x00, 0x0E)  // CONFIG: EN_CRC | CRCO | PWR_UP, PRIM_RX=0
        basic.pause(5)           // Tpd2stby = 1.5ms
        nrfWriteReg(0x01, 0x3F)  // EN_AA: 자동 ACK 활성화
        nrfWriteReg(0x02, 0x03)  // EN_RXADDR: 파이프 0,1 활성화
        nrfWriteReg(0x03, 0x03)  // SETUP_AW: 5바이트 주소
        nrfWriteReg(0x04, 0x03)  // SETUP_RETR: 재전송 설정
        nrfWriteReg(0x05, channel) // RF_CH: 채널 설정
        nrfWriteReg(0x06, 0x07)  // RF_SETUP: 1Mbps, 0dBm
        nrfWriteReg(0x11, _nrfPayloadSize)  // RX_PW_P0

        // FIFO 클리어
        nrfFlushTx()
        nrfFlushRx()
        nrfWriteReg(0x07, 0x70)  // STATUS: 플래그 클리어

        basic.pause(10)
    }

    //% block="nRF24L01 mode set %mode"
    //% group="nRF24L01" weight=76
    export function nrf24l01SetMode(mode: NRFMode): void {
        let config = nrfReadReg(0x00)
        // 읽어온 값이 이상해도 PWR_UP(0x02)은 항상 강제로 세운다
        if (mode == NRFMode.Receive) {
            config = (config | 0x02) | 0x01  // PWR_UP, PRIM_RX = 1
            nrfWriteReg(0x00, config)
            pins.digitalWritePin(_nrfCE, 1)  // RX 모드 시작
        } else {
            config = (config | 0x02) & 0xFE  // PWR_UP, PRIM_RX = 0
            nrfWriteReg(0x00, config)
            pins.digitalWritePin(_nrfCE, 0)
        }
        basic.pause(2)
    }

    //% block="nRF24L01 address set %addr"
    //% addr.defl="BRIX1"
    //% group="nRF24L01" weight=75
    export function nrf24l01SetAddress(addr: string): void {
        // 5바이트 주소 설정
        let addrBytes: number[] = []
        for (let i = 0; i < 5; i++) {
            addrBytes.push(i < addr.length ? addr.charCodeAt(i) : 0)
        }

        // TX 주소와 RX 파이프 0 주소 설정
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0x20 | 0x10)  // W_REGISTER | TX_ADDR
        for (let byte of addrBytes) {
            pins.spiWrite(byte)
        }
        pins.digitalWritePin(_nrfCSN, 1)

        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0x20 | 0x0A)  // W_REGISTER | RX_ADDR_P0
        for (let byte of addrBytes) {
            pins.spiWrite(byte)
        }
        pins.digitalWritePin(_nrfCSN, 1)
    }

    //% block="nRF24L01 string send %text"
    //% text.defl="Hello"
    //% group="nRF24L01" weight=74
    export function nrf24l01SendString(text: string): boolean {
        let payload: number[] = []
        for (let i = 0; i < _nrfPayloadSize; i++) {
            payload.push(i < text.length ? text.charCodeAt(i) : 0)
        }
        return nrfSendPayload(payload)
    }

    //% block="nRF24L01 number send %value"
    //% group="nRF24L01" weight=73
    export function nrf24l01SendNumber(value: number): boolean {
        return nrf24l01SendString("" + value)
    }

    //% block="nRF24L01 data receive?"
    //% group="nRF24L01" weight=72
    export function nrf24l01DataReady(): boolean {
        let status = nrfReadReg(0x07)
        return (status & 0x40) != 0  // RX_DR 플래그
    }

    //% block="nRF24L01 string receive"
    //% group="nRF24L01" weight=71
    export function nrf24l01ReceiveString(): string {
        if (!nrf24l01DataReady()) return ""

        // 데이터 읽기
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0x61)  // R_RX_PAYLOAD
        let result = ""
        for (let i = 0; i < _nrfPayloadSize; i++) {
            let byte = pins.spiWrite(0xFF)
            if (byte > 0 && byte < 128) {
                result += String.fromCharCode(byte)
            }
        }
        pins.digitalWritePin(_nrfCSN, 1)

        // 플래그 클리어
        nrfWriteReg(0x07, 0x40)

        return result
    }

    //% block="nRF24L01 number receive"
    //% group="nRF24L01" weight=70
    export function nrf24l01ReceiveNumber(): number {
        let str = nrf24l01ReceiveString()
        let num = parseFloat(str)
        return isNaN(num) ? 0 : num
    }

    // nRF24L01 내부 함수들
    function nrfWriteReg(reg: number, value: number): void {
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0x20 | reg)
        pins.spiWrite(value)
        pins.digitalWritePin(_nrfCSN, 1)
    }

    function nrfReadReg(reg: number): number {
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(reg)
        let value = pins.spiWrite(0xFF)
        pins.digitalWritePin(_nrfCSN, 1)
        return value
    }

    function nrfFlushTx(): void {
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0xE1)
        pins.digitalWritePin(_nrfCSN, 1)
    }

    function nrfFlushRx(): void {
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0xE2)
        pins.digitalWritePin(_nrfCSN, 1)
    }

    function nrfSendPayload(payload: number[]): boolean {
        // TX FIFO에 데이터 쓰기
        pins.digitalWritePin(_nrfCSN, 0)
        pins.spiWrite(0xA0)  // W_TX_PAYLOAD
        for (let byte of payload) {
            pins.spiWrite(byte)
        }
        pins.digitalWritePin(_nrfCSN, 1)

        // 전송 시작
        pins.digitalWritePin(_nrfCE, 1)
        control.waitMicros(15)
        pins.digitalWritePin(_nrfCE, 0)

        // 전송 완료 대기
        basic.pause(10)
        let status = nrfReadReg(0x07)

        // MAX_RT 등으로 전송에 실패한 페이로드는 TX FIFO 에 그대로 남는다. 비우지 않으면
        // 3번 실패한 뒤 3단 FIFO 가 가득 차서 이후 모든 전송이 조용히 버려진다.
        // 32바이트 @1Mbps + ARC=3/ARD=250us 는 10ms 안에 반드시 끝나므로
        // TX_DS 가 없다는 건 전송 중이 아니라 실패했다는 뜻이다.
        if ((status & 0x20) == 0) nrfFlushTx()

        // 플래그 클리어
        nrfWriteReg(0x07, 0x30)

        return (status & 0x20) != 0  // TX_DS 플래그
    }


    /********** LoRa 장거리 무선 모듈 **********/

    // LoRa는 장거리 저전력 무선 통신 모듈입니다.
    // 최대 10km 이상 통신 가능 (환경에 따라 다름)
    // ※ 이 구현은 UART(시리얼)로 문자열을 주고받는 모듈 전용이다.
    //    SX1276/SX1278/Ra-02 는 SPI 전용 칩이라 이 구현으로는 동작하지 않는다.
    //    (channel/address 는 모듈별 설정 명령이 확인되지 않아 아직 모듈로 전송되지 않는다)

    // LoRa 핀 저장 변수
    let _loraTx: SerialPin = SerialPin.P1
    let _loraRx: SerialPin = SerialPin.P2
    let _loraChannel: number = 0
    let _loraAddress: number = 0
    let _loraRxBuf: string = ""

    //% block="LoRa set|TX pin %tx|RX pin %rx|channel %channel|address %addr"
    //% tx.defl=SerialPin.P1
    //% rx.defl=SerialPin.P2
    //% channel.defl=0 channel.min=0 channel.max=31
    //% addr.defl=0 addr.min=0 addr.max=65535
    //% group="LoRa" weight=69
    //% inlineInputMode=inline
    export function loraInit(tx: SerialPin, rx: SerialPin, channel: number, addr: number): void {
        _loraTx = tx
        _loraRx = rx
        _loraChannel = channel
        _loraAddress = addr

        USBSerial.uartRegister(USBSerial.UartOwner.LoRa, rx, tx, BaudRate.BaudRate9600)

        // 기본 20바이트 RX 링으로는 폴링 방식 수신에서 바이트를 흘린다 (GPS 와 같은 이유)
        USBSerial.uartEnsureRxBuffer()
        basic.pause(100)
    }

    //% block="LoRa string send %text"
    //% text.defl="Hello"
    //% group="LoRa" weight=68
    export function loraSendString(text: string): void {
        USBSerial.uartClaim(USBSerial.UartOwner.LoRa)
        serial.writeLine(text)
    }

    //% block="LoRa number send %value"
    //% group="LoRa" weight=67
    export function loraSendNumber(value: number): void {
        USBSerial.uartClaim(USBSerial.UartOwner.LoRa)
        serial.writeLine("" + value)
    }

    //% block="LoRa data receive"
    //% group="LoRa" weight=66
    export function loraReceive(): string {
        USBSerial.uartClaim(USBSerial.UartOwner.LoRa)

        // serial.readLine() 은 '\n' 이 올 때까지 파이버를 무기한 재우는 블로킹 읽기라
        // 상대 노드가 조용하면 forever 루프 전체가 멈춘 것처럼 보였다. 게다가 잠든 사이
        // 다른 장치가 UART 를 가져가면 그 장치의 바이트를 LoRa 메시지로 반환한다.
        // 비차단 readString() 으로 모아 두었다가 한 줄이 완성됐을 때만 돌려준다.
        _loraRxBuf += serial.readString()

        let idx = _loraRxBuf.indexOf("\n")
        if (idx < 0) {
            // 줄바꿈 없이 계속 쌓이는 경우 버퍼 폭주 방지
            if (_loraRxBuf.length > 200) {
                _loraRxBuf = _loraRxBuf.substr(_loraRxBuf.length - 100)
            }
            return ""
        }

        let line = _loraRxBuf.substr(0, idx)
        _loraRxBuf = _loraRxBuf.substr(idx + 1)

        // CRLF 의 '\r' 제거
        if (line.length > 0 && line.charCodeAt(line.length - 1) == 13) {
            line = line.substr(0, line.length - 1)
        }
        return line
    }

    //% block="LoRa target address set %addr"
    //% addr.defl=0 addr.min=0 addr.max=65535
    //% group="LoRa" weight=65
    export function loraSetTarget(addr: number): void {
        USBSerial.uartClaim(USBSerial.UartOwner.LoRa)
        // AT 명령어로 대상 주소 설정 (모듈에 따라 다름)
        serial.writeLine("AT+ADDR=" + addr)
        basic.pause(100)
    }
}
