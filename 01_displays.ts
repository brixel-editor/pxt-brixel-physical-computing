/**
 * BRIXEL Extension - 01. Displays
 * LCD1602, LCD2004, TM1637, NeoPixel
 */

//% weight=1100 color=#FAC907 icon="\uf108" block="01. Displays"
//% groups='["LCD","숫자표시장치(TM1637)","네오픽셀(NeoPixel)"]'
namespace Displays01 {


    /********** LCD1602 디스플레이 **********/
    /********** LCD2004 디스플레이 **********/

    // LCD 타입
    export enum LCDType {
        //% block="LCD1602"
        LCD1602 = 0,
        //% block="LCD2004"
        LCD2004 = 1
    }

    // LCD 데이터 저장 변수
    // ★ 초기값이 0x27 이었는데, BRIXEL LCD 백팩은 0x20 이다.
    //   (아두이노판 lcd_i2c_setup 의 주소 드롭다운 첫 항목이 0x20 이고, 배포된 예제 XML 33곳이
    //    전부 0x20 을 쓴다.) 여기 블록 기본값도 addr.defl=0x20 이라, 학생이 LCD init 을 빼고
    //   LCD clear/backlight 부터 쓰면 0x27 로 나가 NAK 되고 모듈이 죽은 것처럼 보였다.
    let _lcdAddr: number = 0x20
    let _lcdType: LCDType = LCDType.LCD1602
    let _lcdBacklight: number = 0x08

    //% block="LCD init address %addr type %type"
    //% addr.defl=0x20
    //% group="LCD" weight=100
    export function lcdInit(addr: number, type: LCDType): void {
        _lcdAddr = addr
        _lcdType = type
        _lcdBacklight = 0x08

        // 초기화 시퀀스
        basic.pause(50)

        // ★ 아두이노판(LiquidCrystal_I2C::begin)은 여기서 백라이트 바이트만 한 번 그냥 써서
        //   PCF8574 를 리셋하고 RS/RW/En 을 전부 LOW 로 내린 뒤, delay(1000) 을 더 기다린 다음
        //   0x30 을 보낸다. 이 두 단계가 통째로 빠져 있어서, 전원을 갓 넣은 콜드 스타트에서
        //   4비트 모드 전환을 놓치고 화면이 백지나 블록 덩어리로 뜨는 일이 있었다.
        //   대기 시간은 아두이노의 1000ms 를 그대로 쓰지 않고 200ms 로 줄인 의도적 차이다:
        //   아두이노는 setup() 이 전원 인가 수 ms 만에 돌지만, micro:bit 은 CODAL 부팅 뒤에야
        //   사용자 코드가 시작되므로 이 시점에 LCD 전원은 이미 수백 ms 올라와 있다.
        //   (HD44780 데이터시트 최소 요구는 40ms 라 200ms 는 5배 여유다.)
        pins.i2cWriteNumber(_lcdAddr, _lcdBacklight, NumberFormat.UInt8BE)
        basic.pause(200)

        lcdWrite4bits(0x30)
        basic.pause(5)
        lcdWrite4bits(0x30)
        basic.pause(1)
        lcdWrite4bits(0x30)
        // ★ 아두이노판은 세 번째 0x30 과 0x20 사이에 delayMicroseconds(150) 이 명시돼 있는데
        //   빠져 있었다. 100kHz I2C 에서는 전송 시간만으로도 채워지지만 400kHz 로 올리면
        //   데이터시트 최소치(100us)를 밑돌게 된다.
        control.waitMicros(150)
        lcdWrite4bits(0x20)

        // 4비트 모드, 2라인, 5x8 폰트
        lcdCommand(0x28)
        // 디스플레이 ON, 커서 OFF
        lcdCommand(0x0C)
        // 클리어
        lcdCommand(0x01)
        basic.pause(2)
        // 엔트리 모드
        lcdCommand(0x06)
        // ★ 아두이노판 begin() 은 마지막에 home() (0x02 + 2ms) 을 호출한다. 0x01(클리어)이
        //   DDRAM 주소는 0으로 만들지만 표시 시프트(scrollDisplay 로 밀린 상태)는 되돌리지
        //   않는다. LCD 는 micro:bit 리셋으로 같이 리셋되지 않으므로, 앞서 실행된 프로그램이
        //   화면을 밀어둔 채 끝났다면 이게 없으면 글자가 통째로 어긋난 자리에 찍힌다.
        lcdCommand(0x02)
        basic.pause(2)
    }

    //% block="LCD string show %text x %x y %y"
    //% x.min=0 x.max=19 x.defl=0
    //% y.min=0 y.max=3 y.defl=0
    //% group="LCD" weight=99
    //% inlineInputMode=inline
    export function lcdShowString(text: string, x: number, y: number): void {
        // ★ 예전에는 커서 이동만 취소되고 글자는 그대로 써져, 범위를 벗어난 좌표가
        //   직전 커서 위치(다른 줄)를 덮어썼다. 커서 이동에 실패하면 아무것도 쓰지 않는다.
        if (!lcdSetCursor(x, y)) return
        // 오른쪽 끝에서 잘라내지 않는다 — 아두이노판(LiquidCrystal_I2C::print)은 길이 제한 없이
        // 다 쓰고 HD44780 의 DDRAM 자동증가에 맡긴다. 20x4 에서 0행이 넘치면 2행에 이어지는
        // 이 동작에 기대는 예제가 있어, 조용히 잘라내면 아두이노판과 결과가 달라진다.
        for (let i = 0; i < text.length; i++) {
            lcdData(text.charCodeAt(i))
        }
    }

    //% block="LCD number show %num x %x y %y"
    //% x.min=0 x.max=19 x.defl=0
    //% y.min=0 y.max=3 y.defl=0
    //% group="LCD" weight=98
    //% inlineInputMode=inline
    export function lcdShowNumber(num: number, x: number, y: number): void {
        lcdShowString(lcdFormatNumber(num), x, y)
    }

    //% block="LCD clear"
    //% group="LCD" weight=97
    export function lcdClear(): void {
        lcdCommand(0x01)
        basic.pause(2)
    }

    //% block="LCD backlight %state"
    //% state.shadow="toggleOnOff"
    //% group="LCD" weight=96
    export function lcdBacklight(state: boolean): void {
        _lcdBacklight = state ? 0x08 : 0x00
        pins.i2cWriteNumber(_lcdAddr, _lcdBacklight, NumberFormat.UInt8BE)
    }

    //% block="LCD screen %state"
    //% state.shadow="toggleOnOff"
    //% group="LCD" weight=95
    export function lcdDisplay(state: boolean): void {
        lcdCommand(state ? 0x0C : 0x08)
    }

    // LCD 내부 함수들
    // ★ 아두이노판 lcd_i2c_print 는 LiquidCrystal_I2C 가 Print 를 상속하므로(LiquidCrystal_I2C.h)
    //   정수형 값은 Print::print(int) 로 그대로 찍고, 실수형 값은 Print::print(double, 2) 가
    //   걸려 항상 소수점 2자리로 찍는다 (23.456 -> "23.46", 2.0f -> "2.00").
    //   MakeCode 는 num.toString() 이라 23.456 이 전부 나와 글자 수가 늘고 16칸 화면을 넘겼다.
    //   micro:bit 에는 int/float 구분이 없으니, 소수부가 있을 때만 2자리로 맞춰 폭을 일치시킨다.
    function lcdFormatNumber(num: number): string {
        // 정수는 아두이노도 소수점을 붙이지 않는다
        if (Math.floor(num) == num) return num.toString()
        // NaN 과, 100배 해도 int32 를 넘기는 큰 값은 손대지 않는다 (조건을 부정형으로 써서 NaN 도 걸린다)
        if (!(num > -10000000 && num < 10000000)) return num.toString()

        let neg = num < 0
        let scaled = Math.round(Math.abs(num) * 100)
        let ip = Math.idiv(scaled, 100)
        let fp = scaled % 100
        let frac = fp < 10 ? "0" + fp.toString() : fp.toString()
        let s = ip.toString() + "." + frac
        return neg ? "-" + s : s
    }

    // ★ LCD 타입별 화면 크기 (호출하는 쪽에서도 같은 기준으로 잘라내야 해서 함수로 뺐다)
    function lcdMaxX(): number {
        return _lcdType == LCDType.LCD2004 ? 20 : 16
    }

    function lcdMaxY(): number {
        return _lcdType == LCDType.LCD2004 ? 4 : 2
    }

    // 커서 이동 성공하면 true, 화면 범위를 벗어나면 false 를 돌려준다
    function lcdSetCursor(x: number, y: number): boolean {
        // ★ lcdInit 에서 받은 LCD1602/LCD2004 타입을 저장만 하고 쓰지 않아
        //   16x2 모듈에서도 x=0~19 / y=0~3 이 그대로 통과했다(DDRAM 이 접혀 엉뚱한 곳에 표시).
        let maxX = lcdMaxX()
        let maxY = lcdMaxY()
        if (x < 0 || y < 0 || x >= maxX || y >= maxY) return false

        let rowOffsets = [0x00, 0x40, 0x14, 0x54]
        lcdCommand(0x80 | (x + rowOffsets[y]))
        return true
    }

    function lcdCommand(cmd: number): void {
        lcdSend(cmd, 0)
    }

    function lcdData(data: number): void {
        lcdSend(data, 1)
    }

    function lcdSend(value: number, mode: number): void {
        let highNibble = value & 0xF0
        let lowNibble = (value << 4) & 0xF0
        lcdWrite4bits(highNibble | (mode ? 0x01 : 0))
        lcdWrite4bits(lowNibble | (mode ? 0x01 : 0))
    }

    function lcdWrite4bits(value: number): void {
        let data = value | _lcdBacklight
        pins.i2cWriteNumber(_lcdAddr, data, NumberFormat.UInt8BE)
        pins.i2cWriteNumber(_lcdAddr, data | 0x04, NumberFormat.UInt8BE)
        control.waitMicros(1)
        pins.i2cWriteNumber(_lcdAddr, data & ~0x04, NumberFormat.UInt8BE)
        control.waitMicros(50)
    }


    /********** TM1637 7세그먼트 디스플레이 **********/

    // TM1637 소수점 옵션
    export enum TM1637Decimal {
        //% block="decimal none"
        None = 0,
        //% block="decimal 1digit"
        Dec1 = 1,
        //% block="decimal 2digit"
        Dec2 = 2,
        //% block="decimal 3digit"
        Dec3 = 3
    }

    // TM1637 음수 기호 옵션
    export enum TM1637Negative {
        //% block="show negative sign"
        Show = 1,
        //% block="hide negative sign"
        Hide = 0
    }

    // TM1637 콜론 옵션
    export enum TM1637Colon {
        //% block="colon"
        Colon = 1,
        //% block="none"
        None = 0
    }

    // TM1637 위치
    export enum TM1637Position {
        //% block="1st (left)"
        Pos1 = 0,
        //% block="2nd"
        Pos2 = 1,
        //% block="3rd"
        Pos3 = 2,
        //% block="4th (right)"
        Pos4 = 3
    }

    // TM1637 핀 저장 변수
    let _tm1637Clk: DigitalPin = DigitalPin.P2
    // ★ 기본 DATA 핀이 P3 였는데 P3 는 LED 매트릭스 열이라 화면 갱신과 충돌해 숫자가 깜빡였다.
    //   매트릭스와 겹치지 않는 P1 로 변경 (P3,P4,P6,P7,P9,P10 은 매트릭스 공용 핀)
    let _tm1637Dio: DigitalPin = DigitalPin.P1
    let _tm1637Brightness: number = 7
    let _tm1637Colon: boolean = false
    let _tm1637Buffer: number[] = [0, 0, 0, 0]

    // 7세그먼트 폰트 (0-9, A-Z, 일부 특수문자)
    const TM1637_FONT: number[] = [
        0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F,  // 0-9
        0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71,  // A-F
        0x3D, 0x76, 0x06, 0x1E, 0x76, 0x38, 0x15, 0x54, 0x3F,  // G-O
        0x73, 0x67, 0x50, 0x6D, 0x78, 0x3E, 0x1C, 0x2A, 0x76, 0x6E, 0x5B,  // P-Z
        0x00, 0x40  // 공백, 마이너스
    ]

    //% block="FND(TM1637) CLK pin %clk|DATA pin %dio set"
    //% clk.defl=DigitalPin.P2 dio.defl=DigitalPin.P1
    //% group="숫자표시장치(TM1637)" weight=100
    //% inlineInputMode=inline
    export function tm1637Init(clk: DigitalPin, dio: DigitalPin): void {
        _tm1637Clk = clk
        _tm1637Dio = dio
        _tm1637Brightness = 7
        _tm1637Colon = false
        _tm1637Buffer = [0, 0, 0, 0]

        // 초기화
        tm1637Start()
        tm1637WriteByte(0x40)  // 데이터 명령: 자동 주소 증가
        tm1637Stop()

        tm1637Clear()
        // ★ 시작 밝기를 7(최대)로 둔 것은 의도한 차이다. 아두이노판 생성기는 setup 에서
        //   display.setBrightness(0x0a) 를 부르고, 라이브러리가 (0x0a & 0x7) | 0x08 로 마스킹해
        //   결과적으로 레벨 2 로 켜진다. 하지만 0x0a 는 0~7 레벨 자리에 표시제어 바이트를
        //   잘못 넣은 값이고(아두이노 밝기 블록 드롭다운 자체는 0~7 이다), 여기 밝기 블록의
        //   기본값도 7 이라 7 로 통일한다. 어둡게 쓰려면 밝기 블록으로 낮추면 된다.
        tm1637SetBrightness(7)
    }

    //% block="FNDnumber show %num|%decimal|%negative"
    //% num.defl=1234
    //% group="숫자표시장치(TM1637)" weight=99
    //% inlineInputMode=inline
    export function tm1637ShowNumber(num: number, decimal: TM1637Decimal, negative: TM1637Negative): void {
        let isNegative = num < 0
        num = Math.abs(num)

        // 소수점 처리
        if (decimal != TM1637Decimal.None) {
            num = Math.round(num * Math.pow(10, decimal))
        }
        // ★ 소수점 없음일 때 1.5 같은 값이 그대로 들어와 폰트 배열을 소수 인덱스로 읽었다.
        //   아두이노판은 int/uint16_t 로 받아 0 방향으로 버리므로(위에서 abs 를 이미 했다)
        //   Math.floor 가 정확한 등가다. Math.round 를 쓰면 1.5 가 2 로 나와 결과가 달라진다.
        num = Math.floor(num)

        let digits: number[] = [0, 0, 0, 0]
        let minusAt = -1
        // ★ `num != 0` 이 있어야 아두이노와 같다. 원본은 `int num` 으로 받아 **자른 뒤**에
        //   `num < 0` 으로 부호를 보므로, -0.4 는 int 0 이 되어 기호가 붙지 않는다.
        //   여기서는 부호를 자르기 전에 봤기 때문에 -0.4 가 "000-" 로 나왔다.
        let showMinus = isNegative && num != 0 && negative == TM1637Negative.Show

        // 숫자 분리 + 음수 기호 자리 결정
        // ★ 아두이노판 TM1637Display::showNumberBaseEx 와 같은 규칙이다.
        //   자리를 오른쪽(3번)부터 왼쪽(0번)으로 돌면서, 나눌 값이 0이 된 첫 자리
        //   (= 최상위 유효숫자 바로 왼쪽)에 마이너스를 넣고 그 뒤로는 넣지 않는다.
        //   -12 -> "0-12", -102 -> "-102", -1002 -> 네 자리를 다 써서 기호 없음("1002").
        //   예전에는 0~2번 자리 중 아무 0이나 찾아 바꾸고 그 앞을 아예 쓰지 않아,
        //   0번 자리에 이전 화면 값이 그대로 남았다(-1002 -> "8-02").
        for (let i = 3; i >= 0; i--) {
            digits[i] = num % 10
            if (num == 0 && minusAt < 0 && showMinus) {
                minusAt = i
            }
            num = Math.floor(num / 10)
        }

        // 버퍼에 저장 — 네 자리를 항상 전부 덮어쓴다(이전 화면 잔상 방지).
        // ★ 소수점도 0번 자리를 포함한 전 자리에서 찍어야 한다. 예전에는 쓰기 루프가
        //   마이너스 다음 자리부터 시작해, 소수점 3자리(점이 0번 자리)에서 점이 사라졌다.
        for (let i = 0; i < 4; i++) {
            _tm1637Buffer[i] = i == minusAt ? 0x40 : TM1637_FONT[digits[i]]
            // 소수점 추가
            if (decimal != TM1637Decimal.None && i == (3 - decimal)) {
                _tm1637Buffer[i] |= 0x80
            }
        }

        // 콜론 추가 (2번째 자리)
        if (_tm1637Colon) {
            _tm1637Buffer[1] |= 0x80
        }

        tm1637Display()
    }

    //% block="FNDtime show %hour|: %minute|%colon show"
    //% hour.min=0 hour.max=23 hour.defl=12
    //% minute.min=0 minute.max=59 minute.defl=30
    //% group="숫자표시장치(TM1637)" weight=98
    //% inlineInputMode=inline
    export function tm1637ShowTime(hour: number, minute: number, colon: TM1637Colon): void {
        // ★ min/max 는 슬라이더에만 적용돼 변수로 -1 같은 값이 들어오면 폰트 배열을
        //   범위 밖으로 읽어 이상한 글자가 나왔다. 실제 값도 범위 안으로 제한한다.
        hour = Math.clamp(0, 23, Math.floor(hour))
        minute = Math.clamp(0, 59, Math.floor(minute))

        _tm1637Buffer[0] = TM1637_FONT[Math.floor(hour / 10)]
        _tm1637Buffer[1] = TM1637_FONT[hour % 10]
        _tm1637Buffer[2] = TM1637_FONT[Math.floor(minute / 10)]
        _tm1637Buffer[3] = TM1637_FONT[minute % 10]

        // 콜론 표시
        if (colon == TM1637Colon.Colon) {
            _tm1637Buffer[1] |= 0x80
        }

        tm1637Display()
    }

    //% block="FND text show %text |scroll delay %delay ms"
    //% text.defl="Hello"
    //% delay.defl=500 delay.min=100 delay.max=2000
    //% group="숫자표시장치(TM1637)" weight=97
    //% inlineInputMode=inline
    export function tm1637ShowText(text: string, delay: number): void {
        text = text.toUpperCase()
        let len = text.length

        if (len <= 4) {
            // 4자 이하면 바로 표시
            for (let i = 0; i < 4; i++) {
                if (i < len) {
                    _tm1637Buffer[i] = tm1637CharToSegment(text.charCodeAt(i))
                } else {
                    _tm1637Buffer[i] = 0
                }
            }
            tm1637Display()
        } else {
            // 4자 초과면 스크롤
            let padded = "    " + text + "    "
            for (let pos = 0; pos < padded.length - 3; pos++) {
                for (let i = 0; i < 4; i++) {
                    _tm1637Buffer[i] = tm1637CharToSegment(padded.charCodeAt(pos + i))
                }
                tm1637Display()
                basic.pause(delay)
            }
        }
    }

    //% block="FND position %pos|at number %digit show"
    //% digit.min=0 digit.max=9 digit.defl=8
    //% group="숫자표시장치(TM1637)" weight=96
    //% inlineInputMode=inline
    export function tm1637ShowDigitAt(pos: TM1637Position, digit: number): void {
        // ★ 음수/소수 변수가 들어오면 폰트 배열을 범위 밖으로 읽었다 (예: -1 % 10 = -1).
        //   아두이노판(tm1637_display_digit)은 display.encodeDigit(digit) 을 쓰고, 그 구현은
        //   digitToSegment[digit & 0x0f] 이다 (uint8_t 로 받으므로 -1 은 255 -> 15 -> 'F').
        //   TM1637_FONT 의 앞 16칸이 digitToSegment 와 바이트까지 같으므로 & 0x0F 가 정확한
        //   등가이고, 동시에 인덱스가 0~15 로 묶여 배열 범위를 벗어날 수 없다.
        _tm1637Buffer[pos] = TM1637_FONT[Math.floor(digit) & 0x0F]
        tm1637Display()
    }

    //% block="FNDscreen clear"
    //% group="숫자표시장치(TM1637)" weight=95
    export function tm1637Clear(): void {
        _tm1637Buffer = [0, 0, 0, 0]
        tm1637Display()
    }

    //% block="FNDbrightness set %brightness"
    //% brightness.min=0 brightness.max=7 brightness.defl=7
    //% group="숫자표시장치(TM1637)" weight=94
    export function tm1637SetBrightness(brightness: number): void {
        _tm1637Brightness = Math.clamp(0, 7, brightness)
        // 표시 갱신(tm1637Display)에서도 같은 제어 바이트를 써야 해서 함수로 통일했다
        tm1637SendControl()
    }

    //% block="FNDcolon %colon show"
    //% group="숫자표시장치(TM1637)" weight=93
    export function tm1637SetColon(colon: TM1637Colon): void {
        _tm1637Colon = (colon == TM1637Colon.Colon)
        if (_tm1637Colon) {
            _tm1637Buffer[1] |= 0x80
        } else {
            _tm1637Buffer[1] &= 0x7F
        }
        tm1637Display()
    }

    // 문자를 7세그먼트 코드로 변환
    function tm1637CharToSegment(charCode: number): number {
        if (charCode >= 48 && charCode <= 57) {
            // 0-9
            return TM1637_FONT[charCode - 48]
        } else if (charCode >= 65 && charCode <= 90) {
            // A-Z
            return TM1637_FONT[charCode - 65 + 10]
        } else if (charCode == 32) {
            // 공백
            return 0x00
        } else if (charCode == 45) {
            // 마이너스
            return 0x40
        }
        return 0x00
    }

    // TM1637 표시 제어 명령 — 항상 ON 비트(0x08)를 세운다.
    // ★ 밝기 0 을 "화면 OFF"로 해석하면 안 된다. 아두이노판 TM1637Display::setBrightness 는
    //   m_brightness = (b & 0x7) | 0x08 로 ON 비트를 항상 세우고, setSegments 가 매번
    //   그 값을 보낸다. 즉 밝기 0 = 1/16 듀티(가장 어둡지만 보이는 상태)이지 꺼짐이 아니다.
    //   블록의 드롭다운도 0 을 "가장 어둡게"로 표기한다.
    function tm1637SendControl(): void {
        tm1637Start()
        tm1637WriteByte(0x88 | _tm1637Brightness)
        tm1637Stop()
    }

    // TM1637 디스플레이 갱신
    function tm1637Display(): void {
        // ★ 아두이노판 TM1637Display::setSegments 는 갱신할 때마다 COMM1(0x40, 데이터 명령 =
        //   표시 레지스터 쓰기 + 자동 주소 증가 + 일반 모드)을 별도 start/stop 프레임으로 먼저
        //   보낸다. 여기서는 설정 블록(tm1637Init)에서 딱 한 번만 보내고 있어서, 설정 블록을
        //   빼먹었거나 모듈을 도중에 다시 꽂았거나 순간 전압 강하로 칩이 리셋되면 0xC0 뒤의
        //   네 바이트가 엉뚱한 레지스터로 들어가 화면이 굳거나 깨졌다. 갱신마다 1바이트 추가.
        tm1637Start()
        tm1637WriteByte(0x40)
        tm1637Stop()

        tm1637Start()
        tm1637WriteByte(0xC0)  // 주소 명령: 첫 번째 주소
        for (let i = 0; i < 4; i++) {
            tm1637WriteByte(_tm1637Buffer[i])
        }
        tm1637Stop()

        tm1637SendControl()
    }

    // TM1637 통신 함수들
    // ★ 비트 전환 간격. 아두이노판은 DEFAULT_BIT_DELAY 100us(약 3~5kHz)로 아주 보수적인데
    //   여기는 2us(100kHz 급)라 타이밍 여유가 50배 적었다. 긴/비차폐 FND 케이블이나 느린
    //   호환칩에서 자릿수가 간헐적으로 깨지는 원인이 될 수 있어 5us 로 올린다.
    //   TM1637 은 최대 클럭(약 500kHz)만 규정하고 최소는 없으므로 느린 쪽이 항상 안전하다.
    //   100us 를 그대로 베끼지는 않는다 — 4자리 갱신이 눈에 띄게 느려진다.
    const TM1637_BIT_DELAY_US = 5

    function tm1637Start(): void {
        pins.digitalWritePin(_tm1637Dio, 1)
        pins.digitalWritePin(_tm1637Clk, 1)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Dio, 0)
    }

    function tm1637Stop(): void {
        pins.digitalWritePin(_tm1637Clk, 0)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Dio, 0)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Clk, 1)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Dio, 1)
    }

    function tm1637WriteByte(data: number): void {
        for (let i = 0; i < 8; i++) {
            pins.digitalWritePin(_tm1637Clk, 0)
            control.waitMicros(TM1637_BIT_DELAY_US)
            pins.digitalWritePin(_tm1637Dio, (data >> i) & 1)
            control.waitMicros(TM1637_BIT_DELAY_US)
            pins.digitalWritePin(_tm1637Clk, 1)
            control.waitMicros(TM1637_BIT_DELAY_US)
        }
        // ACK
        // ★ 아두이노판은 9번째 클럭 동안 DIO 를 INPUT 으로 풀어(오픈드레인 흉내) TM1637 이
        //   직접 LOW 로 끌게 하고 그 값을 읽는다. micro:bit 은 진짜 오픈드레인 출력이 없어
        //   완전한 등가가 불가능하고, 널리 쓰이는 micro:bit TM1637 드라이버들도 여기서
        //   HIGH 로 밀어버린다. 실동작에는 문제가 없으므로 그대로 둔다(여유/진단 문제).
        pins.digitalWritePin(_tm1637Clk, 0)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Dio, 1)
        control.waitMicros(TM1637_BIT_DELAY_US)
        pins.digitalWritePin(_tm1637Clk, 1)
        control.waitMicros(TM1637_BIT_DELAY_US)
    }


    /********** WS2812B 네오픽셀 LED **********/

    // NeoPixel 포맷
    export enum NeoPixelFormat {
        //% block="RGB (GRB format)"
        RGB = 1,
        //% block="RGB+W"
        RGBW = 2,
        //% block="RGB (RGB format)"
        RGB_RGB = 3
    }

    // NeoPixel 색상 프리셋
    export enum NeoPixelColors {
        //% block="빨강"
        Red = 0xFF0000,
        //% block="주황"
        Orange = 0xFFA500,
        //% block="노랑"
        Yellow = 0xFFFF00,
        //% block="초록"
        Green = 0x00FF00,
        //% block="파랑"
        Blue = 0x0000FF,
        //% block="남색"
        Indigo = 0x4B0082,
        //% block="보라"
        Purple = 0xFF00FF,
        //% block="흰색"
        White = 0xFFFFFF,
        //% block="검정"
        Black = 0x000000
    }

    // NeoPixel 스트립 클래스
    export class NeoPixelStrip {
        buf: Buffer
        pin: DigitalPin
        brightness: number
        start: number
        _length: number
        _mode: NeoPixelFormat

        // ★ RGBW 는 LED 하나당 4바이트인데 읽고 쓰는 쪽이 전부 3바이트로 고정돼 있어
        //   버퍼가 어긋나고 뒤쪽 1/4 이 안 켜졌다. 간격 계산을 한 곳으로 모은다.
        stride(): number {
            return this._mode == NeoPixelFormat.RGBW ? 4 : 3
        }

        // ★ 아두이노(Adafruit_NeoPixel)는 setBrightness(b) 에서 b+1 을 저장해 두고
        //   (v * (b+1)) >> 8 로 곱한다. 그래서 최대치 255 는 곱수가 256 이 되어 (v*256)>>8 == v,
        //   즉 값이 그대로 통과한다. 여기서는 0~255 를 그대로 곱해 최대 밝기에서도 255 가
        //   254 로 깎였고(순백이 0xFFFFFF 에 도달하지 못했다), 아두이노와 같은 바이트를
        //   절대 낼 수 없었다. 곱수를 밝기+1 로 맞춘다.
        brightnessScale(v: number): number {
            return (v * (this.brightness + 1)) >> 8
        }

        // 색상 표시
        showColor(color: number): void {
            let red = (color >> 16) & 0xFF
            let green = (color >> 8) & 0xFF
            let blue = color & 0xFF

            red = this.brightnessScale(red)
            green = this.brightnessScale(green)
            blue = this.brightnessScale(blue)

            for (let i = 0; i < this._length; i++) {
                this.setPixelRGB(i, red, green, blue)
            }
            this.show()
        }

        // 개별 픽셀 설정 (RGB)
        setPixelRGB(index: number, r: number, g: number, b: number): void {
            if (index < 0 || index >= this._length) return
            let offset = (this.start + index) * this.stride()
            // GRB 순서 (대부분의 WS2812B)
            if (this._mode == NeoPixelFormat.RGB_RGB) {
                this.buf[offset] = r
                this.buf[offset + 1] = g
                this.buf[offset + 2] = b
            } else {
                this.buf[offset] = g
                this.buf[offset + 1] = r
                this.buf[offset + 2] = b
            }
        }

        // 개별 픽셀 설정 (색상값)
        setPixelColor(index: number, color: number): void {
            let red = (color >> 16) & 0xFF
            let green = (color >> 8) & 0xFF
            let blue = color & 0xFF
            red = this.brightnessScale(red)
            green = this.brightnessScale(green)
            blue = this.brightnessScale(blue)
            this.setPixelRGB(index, red, green, blue)
        }

        // 무지개 효과
        showRainbow(startHue: number = 1, endHue: number = 360): void {
            let stepHue = (endHue - startHue) / this._length
            for (let i = 0; i < this._length; i++) {
                let hue = startHue + i * stepHue
                let color = neopixelHSL(hue, 100, 50)
                this.setPixelColor(i, color)
            }
            this.show()
        }

        // 바 그래프
        showBarGraph(value: number, high: number): void {
            if (high <= 0) {
                this.clear()
                return
            }
            let n = Math.floor((value * this._length) / high)
            for (let i = 0; i < this._length; i++) {
                if (i < n) {
                    this.setPixelColor(i, NeoPixelColors.Green)
                } else {
                    this.setPixelColor(i, NeoPixelColors.Black)
                }
            }
            this.show()
        }

        // 화면 갱신
        show(): void {
            light.sendWS2812Buffer(this.buf, this.pin)
        }

        // 전체 지우기
        // ★ range 로 만든 서브 스트립도 buf 를 공유하기 때문에, 자기 구간(start/_length)만
        //   건드려야 한다. 예전에는 버퍼 전체를 지워 스트립 전부가 꺼졌다.
        clear(): void {
            let st = this.stride()
            this.buf.fill(0, this.start * st, this._length * st)
            this.show()
        }

        // 밝기 설정
        // ★ 아두이노(Adafruit_NeoPixel::setBrightness)는 밝기를 바꾸는 즉시 이미 버퍼에 들어
        //   있는 바이트를 전부 다시 스케일한다. 그래서 '색 표시 -> 밝기 변경 -> 갱신' 순서로도
        //   밝기가 반영되고, 아두이노 breathe 애니메이션(색은 한 번만 채우고 setBrightness +
        //   show 만 반복)이 성립한다. 여기서는 밝기를 저장만 하고 픽셀을 쓸 때 곱했기 때문에
        //   버퍼가 이미 곱해진 값을 들고 있어, 뒤이은 갱신이 똑같은 데이터를 다시 보낼 뿐이었다
        //   (밝기 블록을 써도 화면이 전혀 변하지 않았다). 같은 방식으로 버퍼를 다시 스케일한다.
        //   range 로 만든 서브 스트립은 buf 를 공유하므로 자기 구간만 손댄다.
        setBrightness(brightness: number): void {
            let nb = Math.clamp(0, 255, brightness)
            let ob = Math.clamp(0, 255, this.brightness)
            if (nb == ob) {
                this.brightness = nb
                return
            }
            let st = this.stride()
            let from = this.start * st
            let to = from + this._length * st
            // 저장된 바이트는 (v * (밝기+1)) >> 8 로 곱해져 있으니 (새+1)/(옛+1) 배로 고쳐준다.
            // 8.8 고정소수점 (분모가 최소 1 이라 0 나눗셈은 생기지 않는다)
            let scale = Math.idiv((nb + 1) << 8, ob + 1)
            for (let i = from; i < to; i++) {
                let v = (this.buf[i] * scale) >> 8
                this.buf[i] = v > 255 ? 255 : v
            }
            this.brightness = nb
        }

        // 픽셀 이동 (자기 구간 안에서만)
        shift(offset: number = 1): void {
            let st = this.stride()
            // ★ core 의 shift 는 이동량이 구간 길이 이상이면 버퍼 전체를 0으로 채운다.
            //   서브 스트립이 다른 구간까지 지우지 않도록 여기서 직접 처리한다.
            if (Math.abs(offset) >= this._length) {
                this.buf.fill(0, this.start * st, this._length * st)
                return
            }
            this.buf.shift(offset * st, this.start * st, this._length * st)
        }

        // 픽셀 회전 (자기 구간 안에서만)
        rotate(offset: number = 1): void {
            let st = this.stride()
            this.buf.rotate(offset * st, this.start * st, this._length * st)
        }

        // 범위 지정 (서브 스트립)
        range(start: number, length: number): NeoPixelStrip {
            let strip = new NeoPixelStrip()
            strip.buf = this.buf
            strip.pin = this.pin
            strip.brightness = this.brightness
            strip.start = this.start + start
            strip._length = Math.min(length, this._length - start)
            strip._mode = this._mode
            return strip
        }

        // 길이 반환
        length(): number {
            return this._length
        }
    }

    //% block="NeoPixel pin %pin|LED count %numLeds|format %mode"
    //% pin.defl=DigitalPin.P0
    //% numLeds.defl=16 numLeds.min=1 numLeds.max=300
    //% group="네오픽셀(NeoPixel)" weight=100
    //% blockSetVariable=strip
    export function neopixelCreate(pin: DigitalPin, numLeds: number, mode: NeoPixelFormat): NeoPixelStrip {
        let strip = new NeoPixelStrip()
        let stride = (mode == NeoPixelFormat.RGBW) ? 4 : 3
        strip.buf = pins.createBuffer(numLeds * stride)
        strip.start = 0
        strip._length = numLeds
        strip._mode = mode
        strip.pin = pin
        strip.brightness = 255
        strip.buf.fill(0)
        pins.digitalWritePin(pin, 0)
        // ★ 아두이노판 setup 은 begin(); clear(); show(); 까지 해서 0 프레임을 실제로 스트립에
        //   밀어 넣는다. 여기서는 RAM 버퍼만 지우고 끝나, WS2812 래치에 남아 있던 직전 프로그램의
        //   마지막 화면이 그대로 켜져 있었다(micro:bit 을 리셋해도 스트립 전원은 유지되므로
        //   '시작할 때 이전 색이 그대로 남아 있다'로 보인다). 0 프레임을 한 번 내보낸다.
        strip.show()
        return strip
    }

    //% block="%strip|range start %start|count %length set to"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% start.defl=1 start.min=1 length.defl=4
    //% group="네오픽셀(NeoPixel)" weight=99
    //% blockSetVariable=range
    export function neopixelRange(strip: NeoPixelStrip, start: number, length: number): NeoPixelStrip {
        return strip.range(start - 1, length)
    }

    //% block="%strip|rainbow show color %startHue from %endHue to"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% startHue.defl=1 endHue.defl=360
    //% group="네오픽셀(NeoPixel)" weight=98
    export function neopixelShowRainbow(strip: NeoPixelStrip, startHue: number, endHue: number): void {
        strip.showRainbow(startHue, endHue)
    }

    //% block="%strip|color %color show"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% color.shadow="neopixelPresetColorPicker"
    //% group="네오픽셀(NeoPixel)" weight=97
    export function neopixelShowColor(strip: NeoPixelStrip, color: number): void {
        strip.showColor(color)
    }

    //% block="%strip|bar graph value %value|max %high"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% value.defl=0 high.defl=255
    //% group="네오픽셀(NeoPixel)" weight=96
    export function neopixelShowBarGraph(strip: NeoPixelStrip, value: number, high: number): void {
        strip.showBarGraph(value, high)
    }

    //% block="%strip|refresh"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% group="네오픽셀(NeoPixel)" weight=95
    export function neopixelShow(strip: NeoPixelStrip): void {
        strip.show()
    }

    //% block="%strip|clear all"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% group="네오픽셀(NeoPixel)" weight=94
    export function neopixelClear(strip: NeoPixelStrip): void {
        strip.clear()
    }

    //% block="%strip|pixel %offset shift"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% offset.defl=1
    //% group="네오픽셀(NeoPixel)" weight=93
    export function neopixelShift(strip: NeoPixelStrip, offset: number): void {
        strip.shift(offset)
    }

    //% block="%strip|pixel %offset rotate"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% offset.defl=1
    //% group="네오픽셀(NeoPixel)" weight=92
    export function neopixelRotate(strip: NeoPixelStrip, offset: number): void {
        strip.rotate(offset)
    }

    //% block="%strip|brightness %brightness set"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% brightness.min=0 brightness.max=255 brightness.defl=128
    //% group="네오픽셀(NeoPixel)" weight=91
    export function neopixelSetBrightness(strip: NeoPixelStrip, brightness: number): void {
        strip.setBrightness(brightness)
    }

    //% block="%strip|pixel %index at color %color set"
    //% strip.shadow="variables_get" strip.defl="strip"
    //% color.shadow="neopixelPresetColorPicker"
    //% index.defl=1 index.min=1
    //% group="네오픽셀(NeoPixel)" weight=90
    export function neopixelSetPixelColor(strip: NeoPixelStrip, index: number, color: number): void {
        strip.setPixelColor(index - 1, color)
    }

    //% block="HSL color H %h|S %s|L %l"
    //% h.min=0 h.max=360 h.defl=0
    //% s.min=0 s.max=100 s.defl=100
    //% l.min=0 l.max=100 l.defl=50
    //% group="네오픽셀(NeoPixel)" weight=85
    export function neopixelHSL(h: number, s: number, l: number): number {
        h = h % 360
        s = Math.clamp(0, 100, s) / 100
        l = Math.clamp(0, 100, l) / 100

        let c = (1 - Math.abs(2 * l - 1)) * s
        let x = c * (1 - Math.abs((h / 60) % 2 - 1))
        let m = l - c / 2

        let r = 0, g = 0, b = 0
        if (h < 60) { r = c; g = x; b = 0 }
        else if (h < 120) { r = x; g = c; b = 0 }
        else if (h < 180) { r = 0; g = c; b = x }
        else if (h < 240) { r = 0; g = x; b = c }
        else if (h < 300) { r = x; g = 0; b = c }
        else { r = c; g = 0; b = x }

        r = Math.round((r + m) * 255)
        g = Math.round((g + m) * 255)
        b = Math.round((b + m) * 255)

        return (r << 16) | (g << 8) | b
    }

    //% block="RGB color R %r|G %g|B %b"
    //% r.min=0 r.max=255 r.defl=255
    //% g.min=0 g.max=255 g.defl=0
    //% b.min=0 b.max=255 b.defl=0
    //% group="네오픽셀(NeoPixel)" weight=88
    export function neopixelRGB(r: number, g: number, b: number): number {
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF)
    }

    //% block="%color"
    //% blockId="neopixelColorPicker"
    //% shim=TD_ID
    //% color.fieldEditor="colorwheel"
    //% color.fieldOptions.colours='["#ff0000","#ffa500","#ffff00","#00ff00","#0000ff","#4b0082","#ff00ff","#ffffff","#000000"]'
    //% color.fieldOptions.columns=3
    //% color.defl=0xff0000
    //% group="네오픽셀(NeoPixel)" weight=88
    //% blockHidden=true
    export function neopixelColorPicker(color: number): number {
        return color
    }

    //% block="색상 %color"
    //% blockId="neopixelPresetColorPicker"
    //% shim=TD_ID
    //% group="네오픽셀(NeoPixel)" weight=88
    //% blockHidden=true
    export function neopixelPresetColor(color: NeoPixelColors): number {
        return color
    }
}
