// ⚠ 자동 생성 — 사이언스랩 lcd-driver.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Adapted from BRIXEL (MIT), 01_displays.ts. See _sources/manifest.json.
namespace slxLCDDriver {
    /********** LCD1602 디스플레이 **********/
    /********** LCD2004 디스플레이 **********/

    // LCD 타입
    export enum LCDType {

        LCD1602 = 0,

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





    export function lcdShowNumber(num: number, x: number, y: number): void {
        lcdShowString(lcdFormatNumber(num), x, y)
    }


    export function lcdClear(): void {
        lcdCommand(0x01)
        basic.pause(2)
    }



    export function lcdBacklight(state: boolean): void {
        _lcdBacklight = state ? 0x08 : 0x00
        pins.i2cWriteNumber(_lcdAddr, _lcdBacklight, NumberFormat.UInt8BE)
    }



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



}
