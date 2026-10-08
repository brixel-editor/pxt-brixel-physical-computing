// Continuation of 03_sensors.ts. See SOURCES.md for packaging details.
namespace Sensors03 {


    /********** MQ 가스 센서 계열 (MQ-2/3/4/5/6/7/8/9/135) **********/
    /*
     * 원리
     *   모듈 부하저항 RL 양단 전압 Vout 으로 센서저항을 구한다.
     *     Rs = RL × (Vc − Vout) / Vout
     *   깨끗한 공기에서 잰 R0 와의 비를 데이터시트 로그-로그 곡선에 대입한다.
     *     ppm = a × (Rs/R0)^b        (a, b = 가스별 곡선 회귀계수)
     *
     * ★ 반드시 지킬 것
     *  1) R0 는 개체차가 매우 크다. mqCalibrate() 보정 없이는 ppm 이 무의미하다.
     *     보정 전에 read 하면 "지금 공기가 깨끗하다"고 가정하고 자동 1회 보정한다(상대비교용 근사).
     *  2) MQ 모듈은 5V 장치라 Vout 이 최대 5V 까지 나온다. micro:bit ADC 상한은 3.3V 이므로
     *     반드시 분압해서 연결하고 mqConfig() 의 divider 에 그 비율을 알려줘야 한다.
     *     분압 없이 직결하면 nRF52833 이 손상된다(5V 톨러런트 아님).
     *  3) 히터 예열 전 값은 신뢰할 수 없다(수 분~수십 시간). 첫 전원 인가 직후 보정 금지.
     *  4) a·b 계수는 데이터시트 곡선을 회귀한 커뮤니티 표준값이다.
     *     정밀 계측용이 아니라 교육용 상대 비교용으로 볼 것.
     */

    export enum MQSensor {
        //% block="MQ-2 (LPG/smoke)"
        MQ2 = 0,
        //% block="MQ-3 (alcohol)"
        MQ3 = 1,
        //% block="MQ-4 (methane)"
        MQ4 = 2,
        //% block="MQ-5 (LPG/natural gas)"
        MQ5 = 3,
        //% block="MQ-6 (LPG/butane)"
        MQ6 = 4,
        //% block="MQ-7 (carbon monoxide)"
        MQ7 = 5,
        //% block="MQ-8 (hydrogen)"
        MQ8 = 6,
        //% block="MQ-9 (CO/flammable gas)"
        MQ9 = 7,
        //% block="MQ-135 (air quality)"
        MQ135 = 8
    }

    // 곡선 계수 a (ppm = a × ratio^b)
    let _mqA: number[] = [574.25, 0.3934, 1012.7, 80.897, 1009.2, 99.042, 976.97, 599.65, 110.47]
    // 곡선 지수 b
    let _mqB: number[] = [-2.222, -1.504, -2.786, -2.431, -2.35, -1.518, -0.688, -2.244, -2.862]
    // 깨끗한 공기에서의 Rs/R0 (데이터시트 표준값)
    let _mqClean: number[] = [9.83, 60, 4.4, 6.5, 10, 27.5, 70, 9.6, 3.6]
    // 개체별 보정 R0 (kΩ). -1 = 미보정
    let _mqR0: number[] = [-1, -1, -1, -1, -1, -1, -1, -1, -1]

    let _mqRL = 10.0        // 모듈 부하저항 kΩ
    let _mqVc = 5.0         // 센서 회로 공급전압 V
    let _mqAdcRef = 3.3     // micro:bit ADC 기준전압 V
    let _mqDivider = 2.0    // 분압비 (2.0 = 절반으로 낮춘 경우)

    //% block="MQ sensor setup: load resistor %rl kΩ | supply %vc V | divider ratio %divider"
    //% rl.defl=10 vc.defl=5 divider.defl=2
    //% group="가스(MQ 계열)" weight=109
    //% inlineInputMode=inline
    export function mqConfig(rl: number, vc: number, divider: number): void {
        if (rl > 0) _mqRL = rl
        if (vc > 0) _mqVc = vc
        if (divider > 0) _mqDivider = divider
    }

    // 현재 센서저항 Rs (kΩ)
    function mqRs(pin: AnalogPin): number {
        let adc = pins.analogReadPin(pin)
        if (adc < 1) adc = 1
        let vPin = adc * _mqAdcRef / 1023       // micro:bit 핀에 실제로 걸린 전압
        let vOut = vPin * _mqDivider            // 분압 이전, 모듈이 낸 전압
        if (vOut < 0.001) vOut = 0.001
        if (vOut > _mqVc - 0.001) vOut = _mqVc - 0.001
        return _mqRL * (_mqVc - vOut) / vOut
    }

    //% block="MQ %sensor calibrate R0 in clean air, pin %pin"
    //% group="가스(MQ 계열)" weight=108
    //% inlineInputMode=inline
    export function mqCalibrate(sensor: MQSensor, pin: AnalogPin): number {
        // 노이즈 억제를 위해 여러 번 읽어 평균
        let sum = 0
        for (let i = 0; i < 32; i++) {
            sum += mqRs(pin)
            basic.pause(20)
        }
        let rsAir = sum / 32
        _mqR0[sensor] = rsAir / _mqClean[sensor]
        return _mqR0[sensor]
    }

    //% block="MQ %sensor R0 (kΩ)"
    //% group="가스(MQ 계열)" weight=107
    export function mqGetR0(sensor: MQSensor): number {
        return _mqR0[sensor]
    }

    //% block="MQ %sensor read concentration (ppm) pin %pin"
    //% group="가스(MQ 계열)" weight=106
    //% inlineInputMode=inline
    export function mqReadPPM(sensor: MQSensor, pin: AnalogPin): number {
        let rs = mqRs(pin)
        if (_mqR0[sensor] <= 0) {
            // 미보정 상태 — 현재 공기를 깨끗한 공기로 간주해 1회 자동 보정
            _mqR0[sensor] = rs / _mqClean[sensor]
        }
        let ratio = rs / _mqR0[sensor]
        if (ratio <= 0) return 0
        let ppm = _mqA[sensor] * Math.pow(ratio, _mqB[sensor])
        if (ppm < 0) return 0
        return ppm
    }

    //% block="MQ read raw ADC pin %pin"
    //% group="가스(MQ 계열)" weight=104
    //% inlineInputMode=inline
    export function mqReadRaw(pin: AnalogPin): number {
        // 원시 ADC 는 센서 종류와 무관하므로 sensor 인자를 두지 않는다
        return pins.analogReadPin(pin)
    }

    // ── 기존 계약 유지 (시그니처 동일, 본문만 실동작으로 교체) ──

    //% block="MQ-2 gas concentration read pin %pin"
    //% group="가스(MQ-2)" weight=105
    export function mq2Read(pin: AnalogPin): number {
        return mqReadPPM(MQSensor.MQ2, pin)
    }

    //% block="MQ-135 air quality read pin %pin"
    //% group="가스(MQ-135)" weight=100
    export function mq135Read(pin: AnalogPin): number {
        return mqReadPPM(MQSensor.MQ135, pin)
    }


    /********** 조이스틱 **********/

    // 아날로그 조이스틱 (KY-023 등)
    // X축, Y축 아날로그 값 (0~1023)과 버튼 지원

    // 조이스틱 방향
    export enum JoystickDir {
        //% block="center"
        Center = 0,
        //% block="up"
        Up = 1,
        //% block="down"
        Down = 2,
        //% block="left"
        Left = 3,
        //% block="right"
        Right = 4,
        //% block="left up"
        UpLeft = 5,
        //% block="right up"
        UpRight = 6,
        //% block="left down"
        DownLeft = 7,
        //% block="right down"
        DownRight = 8
    }

    // 조이스틱 상태 변수
    let _joyXPin: AnalogPin = AnalogPin.P0
    let _joyYPin: AnalogPin = AnalogPin.P1
    let _joyBtnPin: DigitalPin = DigitalPin.P2
    let _joyCenterX: number = 512
    let _joyCenterY: number = 512
    let _joyDeadzone: number = 100

    //% block="joystick set|Xaxis pin %xPin|Yaxis pin %yPin|button pin %btnPin"
    //% xPin.defl=AnalogPin.P0
    //% yPin.defl=AnalogPin.P1
    //% btnPin.defl=DigitalPin.P2
    //% group="Joystick" weight=88
    //% inlineInputMode=inline
    export function joystickInit(xPin: AnalogPin, yPin: AnalogPin, btnPin: DigitalPin): void {
        _joyXPin = xPin
        _joyYPin = yPin
        _joyBtnPin = btnPin
        pins.setPull(btnPin, PinPullMode.PullUp)

        // 중앙값 자동 보정
        _joyCenterX = pins.analogReadPin(xPin)
        _joyCenterY = pins.analogReadPin(yPin)
    }

    //% block="joystick Xaxis value"
    //% group="Joystick" weight=87
    export function joystickX(): number {
        return pins.analogReadPin(_joyXPin)
    }

    //% block="joystick Yaxis value"
    //% group="Joystick" weight=86
    export function joystickY(): number {
        return pins.analogReadPin(_joyYPin)
    }

    //% block="joystick Xaxis value (-100 ~ 100)"
    //% group="Joystick" weight=85
    export function joystickXPercent(): number {
        let raw = pins.analogReadPin(_joyXPin)
        let percent = Math.floor((raw - _joyCenterX) / 5.12)
        return Math.clamp(-100, 100, percent)
    }

    //% block="joystick Yaxis value (-100 ~ 100)"
    //% group="Joystick" weight=84
    export function joystickYPercent(): number {
        let raw = pins.analogReadPin(_joyYPin)
        let percent = Math.floor((raw - _joyCenterY) / 5.12)
        return Math.clamp(-100, 100, percent)
    }

    //% block="joystick button pressed?"
    //% group="Joystick" weight=83
    export function joystickButton(): boolean {
        return pins.digitalReadPin(_joyBtnPin) == 0
    }

    //% block="joystick direction"
    //% group="Joystick" weight=82
    export function joystickDirection(): JoystickDir {
        let x = pins.analogReadPin(_joyXPin)
        let y = pins.analogReadPin(_joyYPin)

        let dx = x - _joyCenterX
        let dy = y - _joyCenterY

        // 데드존 체크
        let isLeft = dx < -_joyDeadzone
        let isRight = dx > _joyDeadzone
        let isUp = dy < -_joyDeadzone
        let isDown = dy > _joyDeadzone

        if (isUp && isLeft) return JoystickDir.UpLeft
        if (isUp && isRight) return JoystickDir.UpRight
        if (isDown && isLeft) return JoystickDir.DownLeft
        if (isDown && isRight) return JoystickDir.DownRight
        if (isUp) return JoystickDir.Up
        if (isDown) return JoystickDir.Down
        if (isLeft) return JoystickDir.Left
        if (isRight) return JoystickDir.Right

        return JoystickDir.Center
    }

    //% block="joystick direction %dir ?"
    //% dir.defl=JoystickDir.Up
    //% group="Joystick" weight=81
    export function joystickIs(dir: JoystickDir): boolean {
        return joystickDirection() == dir
    }


    /********** 매트릭스 키패드 (4x4, 4x3) **********/

    // 매트릭스 키패드는 행/열 스캔 방식으로 동작합니다.
    // 4x4: 16키 (0-9, A-D, *, #)
    // 4x3: 12키 (0-9, *, #)

    // 키패드 타입
    export enum KeypadType {
        //% block="4x4 (16key)"
        Keypad4x4 = 0,
        //% block="4x3 (12key)"
        Keypad4x3 = 1
    }

    // 키패드 상태 변수
    let _kpType: KeypadType = KeypadType.Keypad4x4
    // 예전 기본값(행 P0~P3 / 열 P4~P7)은 P3/P4/P6/P7 이 LED 매트릭스와 겹치고
    // P5 는 A버튼이라, 아무 키도 안 눌러도 A버튼 때문에 "2" 가 읽히는 등 아예 동작하지 않았다.
    // 비어 있는 핀으로 바꾼다. (P13/P14/P15 는 SPI 겸용이라 nRF24/LoRa 를 같이 쓰면 P16 등으로 옮길 것)
    let _kpRows: DigitalPin[] = [DigitalPin.P0, DigitalPin.P1, DigitalPin.P2, DigitalPin.P8]
    let _kpCols: DigitalPin[] = [DigitalPin.P12, DigitalPin.P13, DigitalPin.P14, DigitalPin.P15]
    let _kpLastKey: string = ""

    // 4x4 키패드 키 매핑
    const KEYPAD_4X4: string[] = [
        "1", "2", "3", "A",
        "4", "5", "6", "B",
        "7", "8", "9", "C",
        "*", "0", "#", "D"
    ]

    // 4x3 키패드 키 매핑
    const KEYPAD_4X3: string[] = [
        "1", "2", "3",
        "4", "5", "6",
        "7", "8", "9",
        "*", "0", "#"
    ]

    // 선택되지 않은 행은 출력 HIGH 로 두지 않고 입력(high-Z)으로 풀어 준다.
    // 같은 열의 두 키를 동시에 누르면 HIGH 출력과 LOW 출력이 스위치를 통해 직접 단락되기 때문.
    // 대가로 3키 동시 입력에서 고스팅이 생길 수 있다(Arduino Keypad 라이브러리와 같은 절충).
    function keypadReleaseRow(p: DigitalPin): void {
        pins.setPull(p, PinPullMode.PullNone)
        pins.digitalReadPin(p)   // 읽는 순간 해당 핀이 디지털 입력(high-Z)으로 전환된다
    }

    //% block="keypad set type %kpType|row pin %r1 %r2 %r3 %r4|column pin %c1 %c2 %c3 %c4"
    //% kpType.defl=KeypadType.Keypad4x4
    //% r1.defl=DigitalPin.P0 r2.defl=DigitalPin.P1 r3.defl=DigitalPin.P2 r4.defl=DigitalPin.P8
    //% c1.defl=DigitalPin.P12 c2.defl=DigitalPin.P13 c3.defl=DigitalPin.P14 c4.defl=DigitalPin.P15
    //% group="Keypad" weight=75
    //% inlineInputMode=inline
    export function keypadInit(kpType: KeypadType, r1: DigitalPin, r2: DigitalPin, r3: DigitalPin, r4: DigitalPin, c1: DigitalPin, c2: DigitalPin, c3: DigitalPin, c4: DigitalPin): void {
        _kpType = kpType
        _kpRows = [r1, r2, r3, r4]

        if (kpType == KeypadType.Keypad4x4) {
            _kpCols = [c1, c2, c3, c4]
        } else {
            _kpCols = [c1, c2, c3]
        }

        // LED 매트릭스 공유 핀을 고른 경우에만 디스플레이를 끈다.
        // 끄지 않으면 디스플레이 드라이버가 6ms마다 그 핀을 출력으로 되돌려 스캔이 깨진다.
        // (무조건 끄면 showNumber/showIcon 이 죽으므로 반드시 조건부)
        for (let rp of _kpRows) {
            if (isDisplaySharedPin(rp)) { led.enable(false); break }
        }
        for (let cp of _kpCols) {
            if (isDisplaySharedPin(cp)) { led.enable(false); break }
        }

        // 행 핀: 스캔 사이에는 high-Z, 열 핀: 입력 (풀업)
        for (let row of _kpRows) {
            keypadReleaseRow(row)
        }
        for (let col of _kpCols) {
            pins.setPull(col, PinPullMode.PullUp)
        }
    }

    //% block="keypad key read"
    //% group="Keypad" weight=74
    export function keypadRead(): string {
        let numCols = _kpType == KeypadType.Keypad4x4 ? 4 : 3
        let keys = _kpType == KeypadType.Keypad4x4 ? KEYPAD_4X4 : KEYPAD_4X3

        for (let r = 0; r < 4; r++) {
            // 현재 행만 LOW, 나머지 행은 high-Z 로 풀어 둔다
            for (let i = 0; i < 4; i++) {
                if (i == r) {
                    pins.digitalWritePin(_kpRows[i], 0)
                } else {
                    keypadReleaseRow(_kpRows[i])
                }
            }
            control.waitMicros(50)   // 행을 띄웠으므로 안정화 시간을 조금 늘린다

            // 열 스캔
            for (let c = 0; c < numCols; c++) {
                if (pins.digitalReadPin(_kpCols[c]) == 0) {
                    // 키 눌림 감지
                    _kpLastKey = keys[r * numCols + c]

                    // 모든 행 high-Z 로 복원
                    for (let i = 0; i < 4; i++) {
                        keypadReleaseRow(_kpRows[i])
                    }

                    // 디바운스
                    basic.pause(50)
                    return _kpLastKey
                }
            }
        }

        // 모든 행 high-Z 로 복원
        for (let i = 0; i < 4; i++) {
            keypadReleaseRow(_kpRows[i])
        }

        return ""
    }

    //% block="keypad key pressed?"
    //% group="Keypad" weight=73
    export function keypadPressed(): boolean {
        return keypadRead() != ""
    }

    //% block="keypad last key"
    //% group="Keypad" weight=72
    export function keypadLastKey(): string {
        return _kpLastKey
    }

    //% block="keypad key %key ?"
    //% key.defl="1"
    //% group="Keypad" weight=71
    export function keypadIs(key: string): boolean {
        let pressed = keypadRead()
        return pressed == key
    }

    //% block="keypad number key pressed? (0-9)"
    //% group="Keypad" weight=70
    export function keypadIsNumber(): boolean {
        let key = keypadRead()
        return key >= "0" && key <= "9"
    }

    //% block="keypad pressed key number to"
    //% group="Keypad" weight=69
    export function keypadNumber(): number {
        let key = _kpLastKey
        if (key >= "0" && key <= "9") {
            return parseInt(key)
        }
        return -1
    }


    /********** 버튼 **********/




    /********** 가변저항 **********/




    /********** ACS712 전류 센서 **********/

    // ACS712는 홀 효과 기반 아날로그 전류 센서입니다.
    // 5A, 20A, 30A 버전 있음

    // ACS712 감도 타입
    export enum ACS712Type {
        //% block="5A (185mV/A)"
        ACS712_5A = 185,
        //% block="20A (100mV/A)"
        ACS712_20A = 100,
        //% block="30A (66mV/A)"
        ACS712_30A = 66
    }

    //% block="ACS712 current (A)|pin %pin|type %sensorType"
    //% pin.defl=AnalogPin.P0
    //% sensorType.defl=ACS712Type.ACS712_20A
    //% group="전류 센서(ACS712)" weight=58
    export function acs712Current(pin: AnalogPin, sensorType: ACS712Type): number {
        let raw = pins.analogReadPin(pin)
        // ACS712 는 5V 전용(데이터시트 Vcc 최소 4.5V) 비율식 소자라 3.3V 로는 동작하지 않는다.
        // 무전류 출력은 항상 Vcc/2 = 2.5V 다. 예전 코드의 1.65V 기준점은 근거가 없어서
        // 0A 에서 20A 모듈이 +8.5A 를 표시했다.
        // 아래 식은 AOUT 을 핀에 "직결" 한 것을 전제로 한다. 2:1 분압기를 넣으면 영점(2.5V)까지
        // 같이 나뉘어 1.25V 가 되므로 0A 가 -12.5A 로 읽힌다 — 감도만 절반으로 잡아도 맞지 않는다
        // (오프셋과 기울기를 함께 고쳐야 하는데 이 블록에는 분압비 인자가 없다).
        // 직결 시 micro:bit ADC 상한이 3.3V 라 20A 모듈 기준 약 -25A ~ +8A 만 읽히고
        // 그 위는 ADC 가 1023 에 붙어 잘린다. 큰 + 전류를 재려면 5A 모듈을 쓰는 편이 낫다.
        let voltage = raw * 3.3 / 1023
        let current = (voltage - 2.5) / (sensorType / 1000)
        return Math.round(current * 100) / 100
    }


    /********** 전압 센서 (분압 모듈) **********/

    // 전압 분압 모듈 (모듈 표기는 최대 25V 이지만 그건 5V ADC 기준이다)
    // 5:1 분압 비율 → micro:bit(3.3V ADC)에서 실제 측정 가능 범위는 0~16.5V

    //% block="voltage sensor read (V)|pin %pin|maxvoltage %maxVoltage"
    //% pin.defl=AnalogPin.P0
    //% maxVoltage.defl=25
    //% group="전압센서(Voltage Sensor)" weight=57
    export function voltageRead(pin: AnalogPin, maxVoltage: number): number {
        // 예전 식 raw*maxVoltage/1023 은 "ADC 만재 = maxVoltage" 라는 5V 아두이노 가정이라
        // 3.3V ADC 인 micro:bit 에서는 모든 값이 25/16.5 = 1.515배 부풀었다(12V → 18.18V).
        // maxVoltage 는 모듈에 적힌 정격(5V ADC 기준)이므로 /5 하면 분압비가 된다.
        let ratio = maxVoltage > 0 ? maxVoltage / 5.0 : 5.0
        let raw = pins.analogReadPin(pin)
        let voltage = raw * 3.3 / 1023 * ratio
        return Math.round(voltage * 100) / 100
    }

    //% block="battery level percent pin %pin min voltage %minV max voltage %maxV"
    //% pin.defl=AnalogPin.P0
    //% minV.defl=3.0 maxV.defl=4.2
    //% group="전압센서(Voltage Sensor)" weight=56
    //% inlineInputMode=inline
    export function batteryPercent(pin: AnalogPin, minV: number, maxV: number): number {
        // minV/maxV 는 "분압 후 핀에서 실제로 보이는 전압" 이다.
        // micro:bit ADC 는 3.3V 가 만재이므로 3.3V 를 넘는 전지를 핀에 직접 물리면 안 된다.
        //  - 직결(3.3V 이하 전원)  : 기본값 3.0/4.2 처럼 셀 전압을 그대로 넣으면
        //                            4.2V 를 볼 수 없어 최대 25% 까지밖에 표시되지 않는다.
        //  - 5:1 분압 모듈 사용 시 : 셀 전압을 5로 나눈 값을 넣는다 (예: 3.0/4.2 → 0.6/0.84)
        if (maxV <= minV) return 0   // 0 으로 나눠 NaN/Infinity 가 나오는 것을 막는다
        let raw = pins.analogReadPin(pin)
        let voltage = raw * 3.3 / 1023
        let percent = (voltage - minV) / (maxV - minV) * 100
        return Math.clamp(0, 100, Math.round(percent))
    }
}
