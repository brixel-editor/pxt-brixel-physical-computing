/**
 * BRIXEL Extension - 02. Advanced Displays
 * OLED, MAX7219, HT16K33, 74HC595, TFT (ST7735, ILI9341)
 */

//% weight=1090 color=#FAC907 icon="\uf108" block="02. Adv Displays"
//% groups='["OLED","도트매트릭스(I2C-HT16K33)","도트매트릭스(SPI-MAX7219)","LED바(74HC595)","TFT LCD"]'
namespace AdvDisplays {



    /********** SSD1306 OLED 디스플레이 **********/
    /********** SH1106 OLED 디스플레이 **********/

    // OLED 드라이버 타입
    export enum OLEDDriver {
        //% block="SSD1306"
        SSD1306 = 0,
        //% block="SH1106"
        SH1106 = 1
    }

    // OLED 해상도 (SSD1306용)
    export enum OLEDSize {
        //% block="128x64 (0.96inch)"
        Size128x64 = 0,
        //% block="128x32 (0.91inch)"
        Size128x32 = 1,
        //% block="64x128 (vertical)"
        Size64x128 = 2
    }

    // SSD1306 OLED 해상도
    export enum SSD1306Size {
        //% block="128x64 (0.96inch)"
        Size128x64_096 = 0,
        //% block="128x32 (0.91inch)"
        Size128x32_091 = 1,
        //% block="64x128 (vertical)"
        Size64x128 = 2
    }

    // SH1106 OLED 해상도 (1.3인치 전용)
    // OLED 색상
    export enum OLEDColor {
        //% block="white"
        White = 1,
        //% block="black"
        Black = 0
    }

    // OLED 데이터 저장 변수
    let _oledAddr: number = 0x3C
    let _oledWidth: number = 128
    let _oledHeight: number = 64
    let _oledDriver: OLEDDriver = OLEDDriver.SSD1306

    //% block="OLED(SSD1306) init address %addr size %size"
    //% addr.defl=60
    //% group="OLED" weight=92
    //% inlineInputMode=inline
    export function oledInitSSD1306(addr: number, size: SSD1306Size): void {
        _oledAddr = addr
        _oledDriver = OLEDDriver.SSD1306

        if (size == SSD1306Size.Size128x64_096) {
            _oledWidth = 128
            _oledHeight = 64
        } else if (size == SSD1306Size.Size128x32_091) {
            _oledWidth = 128
            _oledHeight = 32
        } else {
            // ★ SSD1306 의 GDDRAM 은 8페이지(=64행)가 상한이다.
            //   예전에는 _oledHeight=128 로 두어 존재하지 않는 페이지 8~15 를 주소로 썼다.
            //   64열 패널은 128열 컨트롤러의 일부를 쓰므로 높이는 64 로 제한한다.
            _oledWidth = 64
            _oledHeight = 64
        }

        oledInitSequence()
    }

    //% block="OLED(SH1106) init address %addr"
    //% addr.defl=60
    //% group="OLED" weight=91
    //% inlineInputMode=inline
    export function oledInitSH1106(addr: number): void {
        _oledAddr = addr
        _oledDriver = OLEDDriver.SH1106

        // SH1106 모듈은 128x64(1.3인치) 한 종류뿐이다.
        // 예전 size 인자는 선택지가 하나뿐인 enum 이라 고를 것이 없었고 값도 쓰이지 않았다 → 제거함.
        _oledWidth = 128
        _oledHeight = 64

        oledInitSequence()
    }

    //% block="OLED init address %addr driver %driver level %size"
    //% addr.defl=60
    //% group="OLED" weight=90
    //% inlineInputMode=inline
    //% deprecated=true
    export function oledInit(addr: number, driver: OLEDDriver, size: OLEDSize): void {
        _oledAddr = addr
        _oledDriver = driver

        if (size == OLEDSize.Size128x64) {
            _oledWidth = 128
            _oledHeight = 64
        } else if (size == OLEDSize.Size128x32) {
            _oledWidth = 128
            _oledHeight = 32
        } else {
            // ★ SSD1306 의 GDDRAM 은 8페이지(=64행)가 상한이다.
            //   예전에는 _oledHeight=128 로 두어 존재하지 않는 페이지 8~15 를 주소로 썼다.
            //   64열 패널은 128열 컨트롤러의 일부를 쓰므로 높이는 64 로 제한한다.
            _oledWidth = 64
            _oledHeight = 64
        }

        oledInitSequence()
    }

    // OLED 초기화 시퀀스 (내부 함수)
    function oledInitSequence(): void {
        // 초기화 명령 시퀀스
        oledCmd(0xAE)  // 디스플레이 OFF
        oledCmd(0xD5)  // 클럭 분주비
        oledCmd(0x80)
        oledCmd(0xA8)  // 멀티플렉스
        oledCmd(_oledHeight - 1)
        oledCmd(0xD3)  // 디스플레이 오프셋
        oledCmd(0x00)
        oledCmd(0x40)  // 시작 라인
        oledCmd(0x8D)  // 차지 펌프
        oledCmd(0x14)
        // ★ 메모리 주소지정 모드 = 페이지(0x02).
        //   예전에는 0x00(수평 주소지정)으로 설정해놓고 커서 이동은 페이지 전용 커맨드
        //   (0xB0+page / 0x00+하위열 / 0x10+상위열)만 썼다. 수평 모드에서 이 커맨드들은
        //   무시되므로 커서가 원하는 곳으로 가지 않았다. 코드 사용법에 맞춰 페이지 모드로 둔다.
        // ★ 단, SH1106 에는 0x20 자체가 정의되지 않은 명령이다. 양산 라이브러리
        //   OLED_HAN_UNO_SH1106.h 의 초기화 배열도 이 쌍을 일부러 빼 두었다
        //   ("SH1106 only supports page addressing mode, so no 0x20 command").
        //   그대로 보내면 뒤따르는 0x02 가 '하위 열 주소 = 2' 로 소비된다.
        //   SSD1306 은 커서 명령(0xB0/0x00/0x10)이 페이지 모드를 요구하므로 유지한다.
        if (_oledDriver == OLEDDriver.SSD1306) {
            oledCmd(0x20)  // 메모리 모드
            oledCmd(0x02)
        }
        oledCmd(0xA1)  // 세그먼트 리맵
        oledCmd(0xC8)  // COM 출력 스캔 방향
        oledCmd(0xDA)  // COM 핀 설정
        oledCmd(_oledHeight == 32 ? 0x02 : 0x12)
        oledCmd(0x81)  // 대비
        // ★ Adafruit_SSD1306::begin 은 패널 크기별로 대비를 다르게 준다
        //   (128x32 → 0x8F, 128x64 → 0xCF). 예전에는 크기와 무관하게 항상 0xCF 라
        //   0.91인치 128x32 패널이 기준보다 밝게 나왔다. COM 핀 설정(0xDA)에서
        //   이미 크기를 구분하고 있으므로 같은 자리에서 대비도 구분한다.
        oledCmd(_oledHeight == 32 ? 0x8F : 0xCF)
        oledCmd(0xD9)  // 프리차지
        oledCmd(0xF1)
        oledCmd(0xDB)  // VCOMH
        oledCmd(0x40)
        oledCmd(0xA4)  // 전체 ON 비활성화
        oledCmd(0xA6)  // 정상 표시
        // ★ Adafruit_SSD1306::begin 의 init5 는 DISPLAYON 직전에 0x2E(스크롤 정지)를 보낸다.
        //   이전 프로그램이 하드웨어 스크롤을 켜 둔 채 전원을 끊지 않고 리셋되면
        //   MakeCode 화면도 계속 흘러가는데, 이를 멈출 블록이 없기 때문이다.
        //   SH1106 에는 스크롤 명령군 자체가 없어 SSD1306 에만 보낸다.
        if (_oledDriver == OLEDDriver.SSD1306) {
            oledCmd(0x2E)
        }
        // ★ Adafruit_SH1106G::begin 은 설정 전송이 끝나면 100ms 를 기다렸다가
        //   DISPLAYON 을 낸다("100ms delay recommended"). 차지 펌프가 안정되기 전에
        //   켜서 첫 프레임이 흐릿하거나 노이즈로 보이는 것을 막는다.
        if (_oledDriver == OLEDDriver.SH1106) {
            basic.pause(100)
        }
        oledCmd(0xAF)  // 디스플레이 ON

        oledClear()
    }

    //% block="OLED string show x %x y %y text %text color %color"
    //% x.defl=0 y.defl=0
    //% group="OLED" weight=89
    //% inlineInputMode=inline
    export function oledShowString(x: number, y: number, text: string, color: OLEDColor): void {
        oledSetCursor(x, y)
        for (let i = 0; i < text.length; i++) {
            oledWriteChar(text.charCodeAt(i), color)
        }
    }

    //% block="OLED number show x %x y %y number %num color %color"
    //% x.defl=0 y.defl=0 num.defl=12
    //% group="OLED" weight=88
    //% inlineInputMode=inline
    export function oledShowNumber(x: number, y: number, num: number, color: OLEDColor): void {
        oledShowString(x, y, num.toString(), color)
    }

    //% block="OLED rectangle draw x1 %x1 y1 %y1 x2 %x2 y2 %y2 color %color"
    //% x1.defl=0 y1.defl=0 x2.defl=60 y2.defl=30
    //% group="OLED" weight=87
    //% inlineInputMode=inline
    export function oledDrawRect(x1: number, y1: number, x2: number, y2: number, color: OLEDColor): void {
        // ★ 선 길이가 (x2-x1) 이라 마지막 픽셀 (x2,y2) 가 빠져 우하단 모서리가 뚫려 있었다.
        //   또 x2<x1 처럼 모서리를 뒤집어 넣으면 길이가 음수가 되어 아무것도 그려지지 않았다.
        let ax = Math.min(x1, x2), bx = Math.max(x1, x2)
        let ay = Math.min(y1, y2), by = Math.max(y1, y2)
        oledDrawHLine(ax, ay, bx - ax + 1, color)
        oledDrawHLine(ax, by, bx - ax + 1, color)
        oledDrawVLine(ax, ay, by - ay + 1, color)
        oledDrawVLine(bx, ay, by - ay + 1, color)
    }

    //% block="OLED horizontal line draw x %x y %y length %len color %color"
    //% x.defl=0 y.defl=0 len.defl=10
    //% group="OLED" weight=86
    //% inlineInputMode=inline
    export function oledDrawHLine(x: number, y: number, len: number, color: OLEDColor): void {
        for (let i = 0; i < len; i++) {
            oledSetPixel(x + i, y, color)
        }
    }

    //% block="OLED vertical line draw x %x y %y length %len color %color"
    //% x.defl=0 y.defl=0 len.defl=10
    //% group="OLED" weight=85
    //% inlineInputMode=inline
    export function oledDrawVLine(x: number, y: number, len: number, color: OLEDColor): void {
        for (let i = 0; i < len; i++) {
            oledSetPixel(x, y + i, color)
        }
    }

    /*
     * ★ 섀도 프레임버퍼
     * SSD1306/SH1106 의 GDDRAM 은 1바이트가 세로 8픽셀(페이지)이다.
     * 예전 구현은 픽셀 하나를 찍을 때 (1<<bit) 를 바이트째로 덮어써서
     * 같은 페이지의 나머지 7픽셀이 함께 지워졌다(선·도형이 남지 않음).
     * 컨트롤러는 읽기가 사실상 불가하므로 MCU 쪽에 버퍼를 두고 read-modify-write 한다.
     */
    let _oledBuf: Buffer = null

    function oledEnsureBuf(): void {
        let need = _oledWidth * (_oledHeight >> 3)
        if (!_oledBuf || _oledBuf.length != need) _oledBuf = pins.createBuffer(need)
    }

    // SH1106 은 GDDRAM 이 132열이고 화면은 가운데 128열이라 2열 오프셋이 필요하다
    // ★ 64열 SSD1306 패널은 128열 컨트롤러의 가운데 64열에 배선되어 있다.
    //   Adafruit_SSD1306.cpp 의 display() 도 WIDTH==64 일 때만 열 윈도우를
    //   0x20(=32)~0x20+WIDTH-1 로 열고, 그 외에는 0 부터 연다.
    //   예전에는 항상 0 이라 64열 패널에서 그림이 32열 왼쪽으로 밀려
    //   왼쪽 절반은 화면 밖, 오른쪽 절반은 지워지지 않은 쓰레기 RAM 이 보였다.
    function oledColOffset(): number {
        if (_oledDriver == OLEDDriver.SH1106) return 2
        if (_oledWidth == 64) return 32
        return 0
    }

    function oledSeek(page: number, x: number): void {
        let col = x + oledColOffset()
        oledCmd(0xB0 + page)
        oledCmd(0x00 + (col & 0x0F))
        oledCmd(0x10 + (col >> 4))
    }

    //% block="OLED pixel x %x y %y color %color"
    //% x.defl=0 y.defl=0
    //% group="OLED" weight=84
    //% inlineInputMode=inline
    export function oledSetPixel(x: number, y: number, color: OLEDColor): void {
        if (x < 0 || x >= _oledWidth || y < 0 || y >= _oledHeight) return
        oledEnsureBuf()

        let page = y >> 3
        let bit = y & 0x07
        let idx = page * _oledWidth + x

        if (color == OLEDColor.White) _oledBuf[idx] = _oledBuf[idx] | (1 << bit)
        else _oledBuf[idx] = _oledBuf[idx] & ~(1 << bit)

        oledSeek(page, x)
        oledData(_oledBuf[idx])
    }

    //% block="OLED clear"
    //% group="OLED" weight=83
    export function oledClear(): void {
        oledEnsureBuf()
        _oledBuf.fill(0)                       // 섀도 버퍼도 함께 비운다
        for (let page = 0; page < _oledHeight / 8; page++) {
            oledSeek(page, 0)
            for (let col = 0; col < _oledWidth; col++) {
                oledData(0x00)
            }
        }
    }

    //% block="OLED screen %state"
    //% state.shadow="toggleOnOff"
    //% group="OLED" weight=82
    export function oledDisplay(state: boolean): void {
        oledCmd(state ? 0xAF : 0xAE)
    }

    //% block="OLED invert %invert"
    //% invert.shadow="toggleYesNo"
    //% group="OLED" weight=81
    export function oledInvert(invert: boolean): void {
        oledCmd(invert ? 0xA7 : 0xA6)
    }

    // OLED 내부 함수들
    function oledCmd(cmd: number): void {
        let buf = pins.createBuffer(2)
        buf[0] = 0x00
        buf[1] = cmd
        pins.i2cWriteBuffer(_oledAddr, buf)
    }

    function oledData(data: number): void {
        let buf = pins.createBuffer(2)
        buf[0] = 0x40
        buf[1] = data
        pins.i2cWriteBuffer(_oledAddr, buf)
    }

    // SH1106 열 오프셋 처리는 oledSeek 한 곳으로 모았다.
    // (예전에는 이 함수에만 +2 가 있고 oledSetPixel/oledClear 에는 빠져 있어
    //  같은 화면에서 텍스트와 도형의 좌표가 2픽셀 어긋났다)
    function oledSetCursor(x: number, y: number): void {
        _oledCurPage = y >> 3
        _oledCurCol = x
        // ★ 화면 밖 좌표(예: x<0)로 oledSeek 을 부르면 (col & 0x0F)/(col >> 4) 가
        //   엉뚱한 열 명령으로 나간다. 게다가 oledPutByte 가 화면 밖 열을 건너뛰므로
        //   하드웨어 열 포인터가 _oledCurCol 과 어긋난 채 남는다.
        //   화면 안일 때만 미리 이동하고, 아니면 첫 유효 바이트에서 다시 맞춘다.
        _oledCurSeeked = false
        if (x >= 0 && x < _oledWidth && _oledCurPage >= 0 && _oledCurPage < (_oledHeight >> 3)) {
            oledSeek(_oledCurPage, x)
            _oledCurSeeked = true
        }
    }

    /*
     * ★ 텍스트 출력이 GDDRAM 에만 쓰고 섀도 버퍼(_oledBuf)를 갱신하지 않았다.
     *   그래서 같은 8픽셀 페이지에 나중에 픽셀/선을 찍으면 0 으로 남아 있던
     *   버퍼 값이 되돌아 써져 글자가 지워졌다(반대 순서면 선이 지워졌다).
     *   커서 위치를 따라가며 버퍼와 GDDRAM 에 함께 기록한다.
     *   화면 밖 열은 전송도 건너뛴다 — 페이지 주소지정 모드에서는 열 포인터가
     *   0 으로 되감겨 왼쪽 끝을 망가뜨리기 때문이다.
     */
    let _oledCurPage: number = 0
    let _oledCurCol: number = 0
    let _oledCurSeeked: boolean = false   // 하드웨어 열 포인터가 _oledCurCol 과 일치하는가

    /*
     * ★ Arduino 의 글자는 '투명'하다. 제너레이터가 인자 하나짜리 setTextColor(색) 만
     *   내보내므로 GFX 안에서 bg == color 가 되고, drawChar 는 글리프가 켜진 픽셀만
     *   건드린 뒤 배경 픽셀과 문자 사이 6번째 열은 손대지 않는다.
     *   예전 구현은 페이지 바이트를 통째로 대입해서 글자가 지나간 8픽셀 띠 안의
     *   선·사각형이 함께 지워졌고, Black 은 글리프가 아니라 6x8 블록 전체를 지웠다.
     *   erase=false 면 OR, erase=true 면 AND ~ 로 기존 버퍼 값과 합성한다.
     */
    function oledPutByte(b: number, erase: boolean): void {
        oledEnsureBuf()
        if (_oledCurCol < 0 || _oledCurCol >= _oledWidth ||
            _oledCurPage < 0 || _oledCurPage >= (_oledHeight >> 3)) {
            _oledCurCol++
            _oledCurSeeked = false   // 전송을 건너뛰었으니 하드웨어 포인터는 그대로다
            return
        }
        // 건너뛴 뒤 다시 화면 안으로 들어왔다면 열 포인터를 맞춰준다.
        // (안 그러면 섀도 버퍼는 제자리에, 화면은 다른 열에 그려져 서로 어긋난다)
        if (!_oledCurSeeked) {
            oledSeek(_oledCurPage, _oledCurCol)
            _oledCurSeeked = true
        }
        let idx = _oledCurPage * _oledWidth + _oledCurCol
        let merged = (erase ? (_oledBuf[idx] & ~b) : (_oledBuf[idx] | b)) & 0xFF
        _oledBuf[idx] = merged
        oledData(merged)
        _oledCurCol++
    }

    // 5x7 기본 폰트 (ASCII 32-127)
    const OLED_FONT: number[] = [
        0x00, 0x00, 0x00, 0x00, 0x00,  // 32: space
        0x00, 0x00, 0x5F, 0x00, 0x00,  // 33: !
        0x00, 0x07, 0x00, 0x07, 0x00,  // 34: "
        0x14, 0x7F, 0x14, 0x7F, 0x14,  // 35: #
        0x24, 0x2A, 0x7F, 0x2A, 0x12,  // 36: $
        0x23, 0x13, 0x08, 0x64, 0x62,  // 37: %
        0x36, 0x49, 0x55, 0x22, 0x50,  // 38: &
        0x00, 0x05, 0x03, 0x00, 0x00,  // 39: '
        0x00, 0x1C, 0x22, 0x41, 0x00,  // 40: (
        0x00, 0x41, 0x22, 0x1C, 0x00,  // 41: )
        0x08, 0x2A, 0x1C, 0x2A, 0x08,  // 42: *
        0x08, 0x08, 0x3E, 0x08, 0x08,  // 43: +
        0x00, 0x50, 0x30, 0x00, 0x00,  // 44: ,
        0x08, 0x08, 0x08, 0x08, 0x08,  // 45: -
        0x00, 0x60, 0x60, 0x00, 0x00,  // 46: .
        0x20, 0x10, 0x08, 0x04, 0x02,  // 47: /
        0x3E, 0x51, 0x49, 0x45, 0x3E,  // 48: 0
        0x00, 0x42, 0x7F, 0x40, 0x00,  // 49: 1
        0x42, 0x61, 0x51, 0x49, 0x46,  // 50: 2
        0x21, 0x41, 0x45, 0x4B, 0x31,  // 51: 3
        0x18, 0x14, 0x12, 0x7F, 0x10,  // 52: 4
        0x27, 0x45, 0x45, 0x45, 0x39,  // 53: 5
        0x3C, 0x4A, 0x49, 0x49, 0x30,  // 54: 6
        0x01, 0x71, 0x09, 0x05, 0x03,  // 55: 7
        0x36, 0x49, 0x49, 0x49, 0x36,  // 56: 8
        0x06, 0x49, 0x49, 0x29, 0x1E,  // 57: 9
        0x00, 0x36, 0x36, 0x00, 0x00,  // 58: :
        0x00, 0x56, 0x36, 0x00, 0x00,  // 59: ;
        0x00, 0x08, 0x14, 0x22, 0x41,  // 60: <
        0x14, 0x14, 0x14, 0x14, 0x14,  // 61: =
        0x41, 0x22, 0x14, 0x08, 0x00,  // 62: >
        0x02, 0x01, 0x51, 0x09, 0x06,  // 63: ?
        0x32, 0x49, 0x79, 0x41, 0x3E,  // 64: @
        0x7E, 0x11, 0x11, 0x11, 0x7E,  // 65: A
        0x7F, 0x49, 0x49, 0x49, 0x36,  // 66: B
        0x3E, 0x41, 0x41, 0x41, 0x22,  // 67: C
        0x7F, 0x41, 0x41, 0x22, 0x1C,  // 68: D
        0x7F, 0x49, 0x49, 0x49, 0x41,  // 69: E
        0x7F, 0x09, 0x09, 0x01, 0x01,  // 70: F
        0x3E, 0x41, 0x41, 0x51, 0x32,  // 71: G
        0x7F, 0x08, 0x08, 0x08, 0x7F,  // 72: H
        0x00, 0x41, 0x7F, 0x41, 0x00,  // 73: I
        0x20, 0x40, 0x41, 0x3F, 0x01,  // 74: J
        0x7F, 0x08, 0x14, 0x22, 0x41,  // 75: K
        0x7F, 0x40, 0x40, 0x40, 0x40,  // 76: L
        0x7F, 0x02, 0x04, 0x02, 0x7F,  // 77: M
        0x7F, 0x04, 0x08, 0x10, 0x7F,  // 78: N
        0x3E, 0x41, 0x41, 0x41, 0x3E,  // 79: O
        0x7F, 0x09, 0x09, 0x09, 0x06,  // 80: P
        0x3E, 0x41, 0x51, 0x21, 0x5E,  // 81: Q
        0x7F, 0x09, 0x19, 0x29, 0x46,  // 82: R
        0x46, 0x49, 0x49, 0x49, 0x31,  // 83: S
        0x01, 0x01, 0x7F, 0x01, 0x01,  // 84: T
        0x3F, 0x40, 0x40, 0x40, 0x3F,  // 85: U
        0x1F, 0x20, 0x40, 0x20, 0x1F,  // 86: V
        0x7F, 0x20, 0x18, 0x20, 0x7F,  // 87: W
        0x63, 0x14, 0x08, 0x14, 0x63,  // 88: X
        0x03, 0x04, 0x78, 0x04, 0x03,  // 89: Y
        0x61, 0x51, 0x49, 0x45, 0x43,  // 90: Z
        0x00, 0x00, 0x7F, 0x41, 0x41,  // 91: [
        0x02, 0x04, 0x08, 0x10, 0x20,  // 92: backslash
        0x41, 0x41, 0x7F, 0x00, 0x00,  // 93: ]
        0x04, 0x02, 0x01, 0x02, 0x04,  // 94: ^
        0x40, 0x40, 0x40, 0x40, 0x40,  // 95: _
        0x00, 0x01, 0x02, 0x04, 0x00,  // 96: `
        0x20, 0x54, 0x54, 0x54, 0x78,  // 97: a
        0x7F, 0x48, 0x44, 0x44, 0x38,  // 98: b
        0x38, 0x44, 0x44, 0x44, 0x20,  // 99: c
        0x38, 0x44, 0x44, 0x48, 0x7F,  // 100: d
        0x38, 0x54, 0x54, 0x54, 0x18,  // 101: e
        0x08, 0x7E, 0x09, 0x01, 0x02,  // 102: f
        0x08, 0x14, 0x54, 0x54, 0x3C,  // 103: g
        0x7F, 0x08, 0x04, 0x04, 0x78,  // 104: h
        0x00, 0x44, 0x7D, 0x40, 0x00,  // 105: i
        0x20, 0x40, 0x44, 0x3D, 0x00,  // 106: j
        0x00, 0x7F, 0x10, 0x28, 0x44,  // 107: k
        0x00, 0x41, 0x7F, 0x40, 0x00,  // 108: l
        0x7C, 0x04, 0x18, 0x04, 0x78,  // 109: m
        0x7C, 0x08, 0x04, 0x04, 0x78,  // 110: n
        0x38, 0x44, 0x44, 0x44, 0x38,  // 111: o
        0x7C, 0x14, 0x14, 0x14, 0x08,  // 112: p
        0x08, 0x14, 0x14, 0x18, 0x7C,  // 113: q
        0x7C, 0x08, 0x04, 0x04, 0x08,  // 114: r
        0x48, 0x54, 0x54, 0x54, 0x20,  // 115: s
        0x04, 0x3F, 0x44, 0x40, 0x20,  // 116: t
        0x3C, 0x40, 0x40, 0x20, 0x7C,  // 117: u
        0x1C, 0x20, 0x40, 0x20, 0x1C,  // 118: v
        0x3C, 0x40, 0x30, 0x40, 0x3C,  // 119: w
        0x44, 0x28, 0x10, 0x28, 0x44,  // 120: x
        0x0C, 0x50, 0x50, 0x50, 0x3C,  // 121: y
        0x44, 0x64, 0x54, 0x4C, 0x44,  // 122: z
        0x00, 0x08, 0x36, 0x41, 0x00,  // 123: {
        0x00, 0x00, 0x7F, 0x00, 0x00,  // 124: |
        0x00, 0x41, 0x36, 0x08, 0x00,  // 125: }
        0x08, 0x08, 0x2A, 0x1C, 0x08,  // 126: ~
        0x08, 0x1C, 0x2A, 0x08, 0x08   // 127: arrow
    ]

    function oledWriteChar(c: number, color: OLEDColor): void {
        if (c < 32 || c > 127) c = 32  // 범위 밖이면 공백
        let index = (c - 32) * 5
        // ★ 예전에는 Black 일 때 ~data 로 반전시켜(반전 영상) 글자 대신 배경이 켜졌다.
        //   같은 color 드롭다운을 쓰는 픽셀·선·사각형 블록에서 Black 은 '픽셀 끄기'이므로
        //   여기서도 글리프 획만 지운다(Arduino 의 writePixel(x, y, 0) 과 같다).
        let erase = (color == OLEDColor.Black)
        for (let i = 0; i < 5; i++) {
            oledPutByte(OLED_FONT[index + i], erase)
        }
        // 문자 간격: Arduino 는 투명 모드에서 이 열을 건드리지 않는다.
        // 0 을 합성하면 값이 그대로 유지되면서 열 포인터만 한 칸 전진한다.
        oledPutByte(0x00, erase)
    }

    /********** MAX7219 도트 매트릭스 **********/

    // MAX7219 회전 방향
    export enum MAX7219Rotation {
        //% block="none"
        None = 0,
        //% block="90° clockwise"
        CW90 = 1,
        //% block="180°"
        CW180 = 2,
        //% block="90° counter-clockwise"
        CCW90 = 3
    }

    // MAX7219 정렬
    export enum MAX7219Align {
        //% block="left"
        Left = 0,
        //% block="right"
        Right = 1
    }

    // MAX7219 핀 저장 변수
    let _max7219DIN: DigitalPin = DigitalPin.P15
    let _max7219CS: DigitalPin = DigitalPin.P16
    let _max7219CLK: DigitalPin = DigitalPin.P13
    let _max7219Num: number = 1
    let _max7219Rotation: MAX7219Rotation = MAX7219Rotation.None
    let _max7219Buffer: number[][] = []
    let _max7219Ready: boolean = false

    /*
     * ★ _max7219Buffer 는 빈 배열로 시작하는데 _max7219Num 은 1 이라,
     *   "MAX7219 set" 없이 clear/fill/refresh/text 블록을 쓰면 _max7219Buffer[0]
     *   이 범위 밖이라 런타임 폴트가 났다. 버퍼와 칩 레지스터를 함께 지연 초기화한다.
     */
    function max7219Ensure(): void {
        if (_max7219Num < 1) _max7219Num = 1
        while (_max7219Buffer.length < _max7219Num) {
            _max7219Buffer.push([0, 0, 0, 0, 0, 0, 0, 0])
        }
        if (!_max7219Ready) {
            _max7219Ready = true          // 전송 전에 세워야 재진입하지 않는다
            max7219SendAll(0x09, 0x00)    // Decode Mode: 없음
            max7219SendAll(0x0A, 0x07)    // Intensity: 중간
            max7219SendAll(0x0B, 0x07)    // Scan Limit: 8줄 전체
            max7219SendAll(0x0C, 0x01)    // Shutdown: 정상 동작
            max7219SendAll(0x0F, 0x00)    // Display Test: 끔
        }
    }

    /*
     * ★ max7219SetRotation 이 _max7219Rotation 에 저장만 하고 아무 데서도 읽지 않아
     *   회전 블록이 완전한 무동작이었다. 버퍼는 그대로 두고 '전송 시점'에만 변환한다
     *   (버퍼를 직접 돌리면 refresh 를 반복하는 스크롤에서 회전이 누적된다).
     *   버퍼 규약: pixel(col c, row r) = _max7219Buffer[m][r] 의 bit (7-c)
     *   90°/270° 는 1×N 캐스케이드에서 전체 화면 회전을 표현할 수 없으므로 모듈 단위 회전이다.
     */
    function max7219RowOut(m: number, row: number): number {
        let buf = _max7219Buffer[m]
        let v = 0
        if (_max7219Rotation == MAX7219Rotation.CW90) {
            for (let b = 0; b < 8; b++) {
                if ((buf[b] >> (7 - row)) & 1) v |= (1 << b)
            }
        } else if (_max7219Rotation == MAX7219Rotation.CCW90) {
            for (let b = 0; b < 8; b++) {
                if ((buf[b] >> row) & 1) v |= (1 << (7 - b))
            }
        } else if (_max7219Rotation == MAX7219Rotation.CW180) {
            let src = buf[7 - row]
            for (let b = 0; b < 8; b++) {
                if ((src >> b) & 1) v |= (1 << (7 - b))
            }
        } else {
            v = buf[row]
        }
        return v & 0xFF
    }

    // 8x8 폰트 (기본 ASCII 32-127)
    const MAX7219_FONT: number[][] = [
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],  // 32: 공백
        [0x00, 0x00, 0x5F, 0x00, 0x00, 0x00, 0x00, 0x00],  // 33: !
        [0x00, 0x07, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00],  // 34: "
        [0x14, 0x7F, 0x14, 0x7F, 0x14, 0x00, 0x00, 0x00],  // 35: #
        [0x24, 0x2A, 0x7F, 0x2A, 0x12, 0x00, 0x00, 0x00],  // 36: $
        [0x23, 0x13, 0x08, 0x64, 0x62, 0x00, 0x00, 0x00],  // 37: %
        [0x36, 0x49, 0x55, 0x22, 0x50, 0x00, 0x00, 0x00],  // 38: &
        [0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00],  // 39: '
        [0x00, 0x1C, 0x22, 0x41, 0x00, 0x00, 0x00, 0x00],  // 40: (
        [0x00, 0x41, 0x22, 0x1C, 0x00, 0x00, 0x00, 0x00],  // 41: )
        [0x08, 0x2A, 0x1C, 0x2A, 0x08, 0x00, 0x00, 0x00],  // 42: *
        [0x08, 0x08, 0x3E, 0x08, 0x08, 0x00, 0x00, 0x00],  // 43: +
        [0x00, 0x50, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00],  // 44: ,
        [0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x00, 0x00],  // 45: -
        [0x00, 0x60, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00],  // 46: .
        [0x20, 0x10, 0x08, 0x04, 0x02, 0x00, 0x00, 0x00],  // 47: /
        [0x3E, 0x51, 0x49, 0x45, 0x3E, 0x00, 0x00, 0x00],  // 48: 0
        [0x00, 0x42, 0x7F, 0x40, 0x00, 0x00, 0x00, 0x00],  // 49: 1
        [0x42, 0x61, 0x51, 0x49, 0x46, 0x00, 0x00, 0x00],  // 50: 2
        [0x21, 0x41, 0x45, 0x4B, 0x31, 0x00, 0x00, 0x00],  // 51: 3
        [0x18, 0x14, 0x12, 0x7F, 0x10, 0x00, 0x00, 0x00],  // 52: 4
        [0x27, 0x45, 0x45, 0x45, 0x39, 0x00, 0x00, 0x00],  // 53: 5
        [0x3C, 0x4A, 0x49, 0x49, 0x30, 0x00, 0x00, 0x00],  // 54: 6
        [0x01, 0x71, 0x09, 0x05, 0x03, 0x00, 0x00, 0x00],  // 55: 7
        [0x36, 0x49, 0x49, 0x49, 0x36, 0x00, 0x00, 0x00],  // 56: 8
        [0x06, 0x49, 0x49, 0x29, 0x1E, 0x00, 0x00, 0x00],  // 57: 9
        [0x00, 0x36, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00],  // 58: :
        [0x00, 0x56, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00],  // 59: ;
        [0x00, 0x08, 0x14, 0x22, 0x41, 0x00, 0x00, 0x00],  // 60: <
        [0x14, 0x14, 0x14, 0x14, 0x14, 0x00, 0x00, 0x00],  // 61: =
        [0x41, 0x22, 0x14, 0x08, 0x00, 0x00, 0x00, 0x00],  // 62: >
        [0x02, 0x01, 0x51, 0x09, 0x06, 0x00, 0x00, 0x00],  // 63: ?
        [0x32, 0x49, 0x79, 0x41, 0x3E, 0x00, 0x00, 0x00],  // 64: @
        [0x7E, 0x11, 0x11, 0x11, 0x7E, 0x00, 0x00, 0x00],  // 65: A
        [0x7F, 0x49, 0x49, 0x49, 0x36, 0x00, 0x00, 0x00],  // 66: B
        [0x3E, 0x41, 0x41, 0x41, 0x22, 0x00, 0x00, 0x00],  // 67: C
        [0x7F, 0x41, 0x41, 0x22, 0x1C, 0x00, 0x00, 0x00],  // 68: D
        [0x7F, 0x49, 0x49, 0x49, 0x41, 0x00, 0x00, 0x00],  // 69: E
        [0x7F, 0x09, 0x09, 0x01, 0x01, 0x00, 0x00, 0x00],  // 70: F
        [0x3E, 0x41, 0x41, 0x51, 0x32, 0x00, 0x00, 0x00],  // 71: G
        [0x7F, 0x08, 0x08, 0x08, 0x7F, 0x00, 0x00, 0x00],  // 72: H
        [0x00, 0x41, 0x7F, 0x41, 0x00, 0x00, 0x00, 0x00],  // 73: I
        [0x20, 0x40, 0x41, 0x3F, 0x01, 0x00, 0x00, 0x00],  // 74: J
        [0x7F, 0x08, 0x14, 0x22, 0x41, 0x00, 0x00, 0x00],  // 75: K
        [0x7F, 0x40, 0x40, 0x40, 0x40, 0x00, 0x00, 0x00],  // 76: L
        [0x7F, 0x02, 0x04, 0x02, 0x7F, 0x00, 0x00, 0x00],  // 77: M
        [0x7F, 0x04, 0x08, 0x10, 0x7F, 0x00, 0x00, 0x00],  // 78: N
        [0x3E, 0x41, 0x41, 0x41, 0x3E, 0x00, 0x00, 0x00],  // 79: O
        [0x7F, 0x09, 0x09, 0x09, 0x06, 0x00, 0x00, 0x00],  // 80: P
        [0x3E, 0x41, 0x51, 0x21, 0x5E, 0x00, 0x00, 0x00],  // 81: Q
        [0x7F, 0x09, 0x19, 0x29, 0x46, 0x00, 0x00, 0x00],  // 82: R
        [0x46, 0x49, 0x49, 0x49, 0x31, 0x00, 0x00, 0x00],  // 83: S
        [0x01, 0x01, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x00],  // 84: T
        [0x3F, 0x40, 0x40, 0x40, 0x3F, 0x00, 0x00, 0x00],  // 85: U
        [0x1F, 0x20, 0x40, 0x20, 0x1F, 0x00, 0x00, 0x00],  // 86: V
        [0x7F, 0x20, 0x18, 0x20, 0x7F, 0x00, 0x00, 0x00],  // 87: W
        [0x63, 0x14, 0x08, 0x14, 0x63, 0x00, 0x00, 0x00],  // 88: X
        [0x03, 0x04, 0x78, 0x04, 0x03, 0x00, 0x00, 0x00],  // 89: Y
        [0x61, 0x51, 0x49, 0x45, 0x43, 0x00, 0x00, 0x00],  // 90: Z
    ]

    //% block="MAX7219 set|matrix count %num|DIN pin %din|CS pin %cs|CLK pin %clk"
    //% num.defl=1 num.min=1 num.max=8
    //% din.defl=DigitalPin.P15 cs.defl=DigitalPin.P16 clk.defl=DigitalPin.P13
    //% group="도트매트릭스(SPI-MAX7219)" weight=76
    //% inlineInputMode=inline
    export function max7219Init(num: number, din: DigitalPin, cs: DigitalPin, clk: DigitalPin): void {
        // ★ max7219SendAll 은 모듈 개수만큼 반복해서 바이트를 밀어넣는다. num 이 1 미만이면
        //   레지스터 설정이 한 바이트도 나가지 않는데, 아래에서 _max7219Ready 를 세워 버리므로
        //   지연 초기화(max7219Ensure)마저 건너뛰어 칩이 영영 Shutdown 상태로 남았다.
        //   (음수·0·NaN 을 한 번에 거른다 — NaN 은 어떤 비교도 false 라 not 으로 잡아야 한다)
        if (!(num >= 1)) num = 1
        _max7219Num = num
        _max7219DIN = din
        _max7219CS = cs
        _max7219CLK = clk

        // 버퍼 초기화
        _max7219Buffer = []
        for (let i = 0; i < num; i++) {
            _max7219Buffer.push([0, 0, 0, 0, 0, 0, 0, 0])
        }

        // MAX7219 초기화
        max7219SendAll(0x09, 0x00)  // Decode Mode: 없음
        max7219SendAll(0x0A, 0x07)  // Intensity: 중간
        max7219SendAll(0x0B, 0x07)  // Scan Limit: 8줄 전체
        max7219SendAll(0x0C, 0x01)  // Shutdown: 정상 동작
        max7219SendAll(0x0F, 0x00)  // Display Test: 끔
        _max7219Ready = true        // 여기서 이미 초기화했으므로 max7219Ensure 가 다시 보내지 않게 한다

        max7219Clear()
    }

    //% block="MAX7219 rotate %rotation"
    //% group="도트매트릭스(SPI-MAX7219)" weight=75
    export function max7219SetRotation(rotation: MAX7219Rotation): void {
        _max7219Rotation = rotation
    }

    //% block="MAX7219 text show %text|align %align|screen clear %clear"
    //% text.defl="Hi!"
    //% clear.shadow="toggleYesNo" clear.defl=true
    //% group="도트매트릭스(SPI-MAX7219)" weight=74
    //% inlineInputMode=inline
    export function max7219ShowText(text: string, align: MAX7219Align, clear: boolean): void {
        max7219Ensure()
        if (clear) max7219Clear()

        text = text.toUpperCase()

        // 텍스트 너비 계산
        // ★ 예전에는 '모듈 개수'로 글자 수를 잘라 너비를 구했다(단위가 서로 다르다).
        //   모듈은 8픽셀, 글자칸은 6픽셀이라 4모듈(32px)에 "HELLO"(30px)가 들어가는데도
        //   너비를 24 로 계산해 오른쪽 정렬이 8px 밀리고 마지막 글자가 잘렸다.
        //   실제로 그려지는 글자(32~90)만 세고, 마지막 글자 뒤의 1픽셀 간격은 뺀다.
        let printable = 0
        for (let i = 0; i < text.length; i++) {
            let cc = text.charCodeAt(i)
            if (cc >= 32 && cc <= 90) printable++
        }
        let totalWidth = printable > 0 ? printable * 6 - 1 : 0

        let offset = 0
        if (align == MAX7219Align.Right) {
            offset = (_max7219Num * 8) - totalWidth
            if (offset < 0) offset = 0
        }

        // 각 문자 표시
        let xPos = offset
        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i)
            if (charCode >= 32 && charCode <= 90) {
                let fontData = MAX7219_FONT[charCode - 32]
                for (let col = 0; col < 5; col++) {
                    let matrixIdx = Math.floor(xPos / 8)
                    let colIdx = xPos % 8
                    if (matrixIdx < _max7219Num) {
                        for (let row = 0; row < 8; row++) {
                            if (fontData[col] & (1 << row)) {
                                _max7219Buffer[matrixIdx][row] |= (1 << (7 - colIdx))
                            }
                        }
                    }
                    xPos++
                }
                xPos++  // 문자 간격
            }
        }

        max7219Refresh()
    }

    //% block="MAX7219 scroll text %text|delay %delay ms"
    //% text.defl="Hello World!"
    //% delay.defl=100 delay.min=20 delay.max=500
    //% group="도트매트릭스(SPI-MAX7219)" weight=73
    //% inlineInputMode=inline
    export function max7219ScrollText(text: string, delay: number): void {
        max7219Ensure()
        text = text.toUpperCase()

        // 전체 스크롤 버퍼 생성
        let scrollBuffer: number[] = []

        // 앞쪽 빈 공간
        for (let i = 0; i < _max7219Num * 8; i++) {
            scrollBuffer.push(0)
        }

        // 텍스트 데이터
        for (let i = 0; i < text.length; i++) {
            let charCode = text.charCodeAt(i)
            if (charCode >= 32 && charCode <= 90) {
                let fontData = MAX7219_FONT[charCode - 32]
                for (let col = 0; col < 5; col++) {
                    scrollBuffer.push(fontData[col])
                }
                scrollBuffer.push(0)  // 문자 간격
            }
        }

        // 뒤쪽 빈 공간
        for (let i = 0; i < _max7219Num * 8; i++) {
            scrollBuffer.push(0)
        }

        // 스크롤 애니메이션
        // ★ scrollBuffer 는 폰트 그대로의 '열' 바이트인데(bit = row),
        //   예전에는 이를 _max7219Buffer[m][col] 즉 '행' 자리에 그대로 넣어
        //   글리프가 90° 전치+거울상으로 나왔다. 여기서 전치해 준다.
        //   out[row] 의 bit (7-col) = window[col] 의 bit row  (max7219ShowText 와 동일 규약)
        for (let pos = 0; pos < scrollBuffer.length - _max7219Num * 8; pos++) {
            for (let m = 0; m < _max7219Num; m++) {
                for (let row = 0; row < 8; row++) {
                    let v = 0
                    for (let col = 0; col < 8; col++) {
                        if (scrollBuffer[pos + m * 8 + col] & (1 << row)) {
                            v |= (1 << (7 - col))
                        }
                    }
                    _max7219Buffer[m][row] = v
                }
            }
            max7219Refresh()
            basic.pause(delay)
        }
    }

    //% block="MAX7219 pixel set x %x|y %y|value %value"
    //% x.min=0 x.max=63 x.defl=0
    //% y.min=0 y.max=7 y.defl=0
    //% value.shadow="toggleOnOff" value.defl=true
    //% group="도트매트릭스(SPI-MAX7219)" weight=72
    //% inlineInputMode=inline
    export function max7219SetPixel(x: number, y: number, value: boolean): void {
        max7219Ensure()
        let matrixIdx = Math.floor(x / 8)
        let col = x % 8
        // ★ x 의 하한 검사가 없어 x=-1 이면 matrixIdx=-1 이 검사를 통과해
        //   _max7219Buffer[-1] 로 런타임 폴트가 났다(오른쪽 밖은 이미 무시된다).
        if (x >= 0 && matrixIdx < _max7219Num && y >= 0 && y < 8) {
            if (value) {
                _max7219Buffer[matrixIdx][y] |= (1 << (7 - col))
            } else {
                _max7219Buffer[matrixIdx][y] &= ~(1 << (7 - col))
            }
        }
    }

    //% block="MAX7219 refresh"
    //% group="도트매트릭스(SPI-MAX7219)" weight=71
    export function max7219Refresh(): void {
        max7219Ensure()
        // 180° 는 캐스케이드 전체를 뒤집는 것이 정확한 회전이므로 모듈 순서도 뒤집는다.
        // 90°/270° 는 1×N 배열에서 전체 회전이 성립하지 않아 모듈 순서는 그대로 둔다.
        let rev = _max7219Rotation == MAX7219Rotation.CW180
        for (let row = 0; row < 8; row++) {
            pins.digitalWritePin(_max7219CS, 0)
            for (let m = _max7219Num - 1; m >= 0; m--) {
                let src = rev ? (_max7219Num - 1 - m) : m
                max7219SendByte(row + 1)
                max7219SendByte(max7219RowOut(src, row))
            }
            pins.digitalWritePin(_max7219CS, 1)
        }
    }

    //% block="MAX7219 clear all"
    //% group="도트매트릭스(SPI-MAX7219)" weight=70
    export function max7219Clear(): void {
        max7219Ensure()
        for (let m = 0; m < _max7219Num; m++) {
            for (let i = 0; i < 8; i++) {
                _max7219Buffer[m][i] = 0
            }
        }
        max7219Refresh()
    }

    //% block="MAX7219 fill all"
    //% group="도트매트릭스(SPI-MAX7219)" weight=69
    export function max7219Fill(): void {
        max7219Ensure()
        for (let m = 0; m < _max7219Num; m++) {
            for (let i = 0; i < 8; i++) {
                _max7219Buffer[m][i] = 0xFF
            }
        }
        max7219Refresh()
    }

    //% block="MAX7219 brightness set %brightness"
    //% brightness.min=0 brightness.max=15 brightness.defl=7
    //% group="도트매트릭스(SPI-MAX7219)" weight=68
    export function max7219SetBrightness(brightness: number): void {
        // ★ 지연 초기화(max7219Ensure)가 Intensity 를 0x07 로 되돌리므로, 여기서 먼저
        //   초기화를 끝내지 않으면 "밝기 설정 → 텍스트 표시" 순서에서 밝기가 덮어써진다.
        max7219Ensure()
        max7219SendAll(0x0A, Math.clamp(0, 15, brightness))
    }

    //% block="MAX7219 power %state"
    //% state.shadow="toggleOnOff" state.defl=true
    //% group="도트매트릭스(SPI-MAX7219)" weight=67
    export function max7219Power(state: boolean): void {
        // ★ 같은 이유 — max7219Ensure 가 Shutdown 을 0x01(정상)로 되돌리므로
        //   "전원 끄기 → refresh" 순서에서 화면이 다시 켜져 버린다.
        max7219Ensure()
        max7219SendAll(0x0C, state ? 0x01 : 0x00)
    }

    // MAX7219 내부 함수들
    function max7219SendByte(data: number): void {
        for (let i = 7; i >= 0; i--) {
            pins.digitalWritePin(_max7219CLK, 0)
            pins.digitalWritePin(_max7219DIN, (data >> i) & 1)
            pins.digitalWritePin(_max7219CLK, 1)
        }
    }

    function max7219SendAll(reg: number, data: number): void {
        pins.digitalWritePin(_max7219CS, 0)
        for (let i = 0; i < _max7219Num; i++) {
            max7219SendByte(reg)
            max7219SendByte(data)
        }
        pins.digitalWritePin(_max7219CS, 1)
    }


    /********** HT16K33 LED 드라이버 (I2C 도트 매트릭스) **********/

    // HT16K33 매트릭스 크기
    export enum HT16K33Size {
        //% block="8x8 matrix"
        Size8x8 = 0,
        //% block="8x16 matrix"
        Size8x16 = 1,
        //% block="8x8 bicolor"
        Bicolor8x8 = 2
    }

    // HT16K33 스크롤 방향
    export enum HT16K33Scroll {
        //% block="left"
        Left = 0,
        //% block="right"
        Right = 1
    }

    // HT16K33 바이컬러 색상
    export enum HT16K33Color {
        //% block="off"
        Off = 0,
        //% block="green"
        Green = 1,
        //% block="red"
        Red = 2,
        //% block="orange"
        Orange = 3
    }

    // HT16K33 사각형 스타일
    export enum HT16K33RectStyle {
        //% block="Outline"
        Outline = 0,
        //% block="Fill"
        Fill = 1
    }

    // HT16K33 데이터 — 장치 8개를 각각 보관한다.
    // (이전에는 단일 변수뿐이라 블록의 "# %num" 인자가 무시되고 항상 마지막 init 장치로 나갔다.)
    const HT_MAX = 8
    export const HT_BYTES = 16
    let _ht16k33Addr: number[] = [0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77]
    let _ht16k33Size: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    let _ht16k33Brightness: number[] = [15, 15, 15, 15, 15, 15, 15, 15]
    let _ht16k33Blink: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    let _ht16k33Rotation: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    let _ht16k33Buffer: number[] = []      // HT_MAX × HT_BYTES 평면 배열
    let _ht16k33Cur: number = 0            // 현재 선택된 장치 (num 없는 블록이 대상으로 삼음)

    // num(1~8) 을 장치 인덱스로 바꾸고 현재 장치로 선택한다
    export function hkSel(num: number): number {
        _ht16k33Cur = Math.constrain(num - 1, 0, HT_MAX - 1)
        return _ht16k33Cur
    }
    function hkEnsureBuf(): void {
        if (_ht16k33Buffer.length >= HT_MAX * HT_BYTES) return
        _ht16k33Buffer = []
        for (let k = 0; k < HT_MAX * HT_BYTES; k++) _ht16k33Buffer.push(0)
    }
    // 현재 장치 버퍼 접근자
    export function hkGet(i: number): number {
        hkEnsureBuf()
        return _ht16k33Buffer[_ht16k33Cur * HT_BYTES + i]
    }
    export function hkSet(i: number, v: number): void {
        hkEnsureBuf()
        _ht16k33Buffer[_ht16k33Cur * HT_BYTES + i] = v & 0xFF
    }

    // 현재 장치의 화면 폭(열 개수).
    // ★ 8x16 은 Arduino 에서 Adafruit_8x16matrix(GFX 16×8)로 잡히므로 열이 0~15 다.
    //   예전에는 _ht16k33Size 를 저장만 하고 어디서도 읽지 않아 장치 드롭다운이 무의미했다.
    export function hkWidth(): number {
        return _ht16k33Size[_ht16k33Cur] == HT16K33Size.Size8x16 ? 16 : 8
    }

    // 물리 좌표(행 0~7, 열 0~15) 한 점을 현재 장치 버퍼에 기록한다.
    // ★ Adafruit_LEDBackpack 은 displaybuffer[행] 의 bit(열) 을 세우고,
    //   writeDisplay 가 하위 바이트를 행*2, 상위 바이트를 행*2+1 로 나눠 보낸다.
    //   예전 코드는 항상 행*2(하위 바이트)만 써서 8x16 모듈의 열 8~15 가
    //   어떤 그리기 블록으로도 켜지지 않았다.
    export function hkPlot(row: number, col: number, state: boolean): void {
        if (row < 0 || row > 7 || col < 0 || col > 15) return
        let idx = row * 2 + (col >= 8 ? 1 : 0)
        let bit = 1 << (col & 7)
        if (state) {
            hkSet(idx, hkGet(idx) | bit)
        } else {
            hkSet(idx, hkGet(idx) & ~bit)
        }
    }

    // 8x8 폰트 (간소화된 버전, 0-9, A-Z)
    export const HT16K33_FONT: number[][] = [
        [0x3E, 0x51, 0x49, 0x45, 0x3E, 0x00, 0x00, 0x00],  // 0
        [0x00, 0x42, 0x7F, 0x40, 0x00, 0x00, 0x00, 0x00],  // 1
        [0x42, 0x61, 0x51, 0x49, 0x46, 0x00, 0x00, 0x00],  // 2
        [0x21, 0x41, 0x45, 0x4B, 0x31, 0x00, 0x00, 0x00],  // 3
        [0x18, 0x14, 0x12, 0x7F, 0x10, 0x00, 0x00, 0x00],  // 4
        [0x27, 0x45, 0x45, 0x45, 0x39, 0x00, 0x00, 0x00],  // 5
        [0x3C, 0x4A, 0x49, 0x49, 0x30, 0x00, 0x00, 0x00],  // 6
        [0x01, 0x71, 0x09, 0x05, 0x03, 0x00, 0x00, 0x00],  // 7
        [0x36, 0x49, 0x49, 0x49, 0x36, 0x00, 0x00, 0x00],  // 8
        [0x06, 0x49, 0x49, 0x29, 0x1E, 0x00, 0x00, 0x00],  // 9
        [0x7E, 0x11, 0x11, 0x11, 0x7E, 0x00, 0x00, 0x00],  // A
        [0x7F, 0x49, 0x49, 0x49, 0x36, 0x00, 0x00, 0x00],  // B
        [0x3E, 0x41, 0x41, 0x41, 0x22, 0x00, 0x00, 0x00],  // C
        [0x7F, 0x41, 0x41, 0x22, 0x1C, 0x00, 0x00, 0x00],  // D
        [0x7F, 0x49, 0x49, 0x49, 0x41, 0x00, 0x00, 0x00],  // E
        [0x7F, 0x09, 0x09, 0x01, 0x01, 0x00, 0x00, 0x00],  // F
        [0x3E, 0x41, 0x41, 0x51, 0x32, 0x00, 0x00, 0x00],  // G
        [0x7F, 0x08, 0x08, 0x08, 0x7F, 0x00, 0x00, 0x00],  // H
        [0x00, 0x41, 0x7F, 0x41, 0x00, 0x00, 0x00, 0x00],  // I
        [0x20, 0x40, 0x41, 0x3F, 0x01, 0x00, 0x00, 0x00],  // J
        [0x7F, 0x08, 0x14, 0x22, 0x41, 0x00, 0x00, 0x00],  // K
        [0x7F, 0x40, 0x40, 0x40, 0x40, 0x00, 0x00, 0x00],  // L
        [0x7F, 0x02, 0x04, 0x02, 0x7F, 0x00, 0x00, 0x00],  // M
        [0x7F, 0x04, 0x08, 0x10, 0x7F, 0x00, 0x00, 0x00],  // N
        [0x3E, 0x41, 0x41, 0x41, 0x3E, 0x00, 0x00, 0x00],  // O
        [0x7F, 0x09, 0x09, 0x09, 0x06, 0x00, 0x00, 0x00],  // P
        [0x3E, 0x41, 0x51, 0x21, 0x5E, 0x00, 0x00, 0x00],  // Q
        [0x7F, 0x09, 0x19, 0x29, 0x46, 0x00, 0x00, 0x00],  // R
        [0x46, 0x49, 0x49, 0x49, 0x31, 0x00, 0x00, 0x00],  // S
        [0x01, 0x01, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x00],  // T
        [0x3F, 0x40, 0x40, 0x40, 0x3F, 0x00, 0x00, 0x00],  // U
        [0x1F, 0x20, 0x40, 0x20, 0x1F, 0x00, 0x00, 0x00],  // V
        [0x7F, 0x20, 0x18, 0x20, 0x7F, 0x00, 0x00, 0x00],  // W
        [0x63, 0x14, 0x08, 0x14, 0x63, 0x00, 0x00, 0x00],  // X
        [0x03, 0x04, 0x78, 0x04, 0x03, 0x00, 0x00, 0x00],  // Y
        [0x61, 0x51, 0x49, 0x45, 0x43, 0x00, 0x00, 0x00],  // Z
    ]

    //% block="I2C dot matrix(HT16K33) set # %num|device %size|I2C address %addr|brightness(0-15) %brightness|blink %blink|rotate %rotation"
    //% num.defl=1 num.min=1 num.max=8
    //% addr.defl=0x70
    //% brightness.defl=15 brightness.min=0 brightness.max=15
    //% blink.shadow="toggleOnOff" blink.defl=false
    //% rotation.defl=0 rotation.min=0 rotation.max=3
    //% group="도트매트릭스(I2C-HT16K33)" weight=86
    //% inlineInputMode=inline
    export function ht16k33Init(num: number, size: HT16K33Size, addr: number, brightness: number, blink: boolean, rotation: number): void {
        hkSel(num)
        _ht16k33Addr[_ht16k33Cur] = addr
        _ht16k33Size[_ht16k33Cur] = size
        _ht16k33Brightness[_ht16k33Cur] = brightness
        _ht16k33Blink[_ht16k33Cur] = blink ? 1 : 0
        _ht16k33Rotation[_ht16k33Cur] = rotation

        // 버퍼 확보 후 이 장치 영역만 0 으로
        hkEnsureBuf()
        for (let i = 0; i < HT_BYTES; i++) hkSet(i, 0)

        // HT16K33 초기화
        // ★ Adafruit_LEDBackpack::begin 은 0x21(오실레이터 ON) 바로 뒤에
        //   clear() + writeDisplay() 로 표시 RAM 을 먼저 비우고, 그 다음에야
        //   blinkRate() 로 디스플레이를 켠다. 라이브러리 주석이 이유를 밝혀 두었다 —
        //   내부 RAM 은 전원 투입 시 난수로 시작하므로 켜기 전에 지워야 한다.
        //   예전에는 켜기(0x81)가 먼저라 리셋할 때마다 난수 픽셀이 잠깐 보였다.
        pins.i2cWriteNumber(_ht16k33Addr[_ht16k33Cur], 0x21, NumberFormat.UInt8BE)  // 시스템 오실레이터 ON
        hkRefreshCur()                    // 0 으로 채운 버퍼 먼저 전송 (begin() 의 clear()+writeDisplay())
        ht16k33SetBrightness(brightness)
        ht16k33SetBlink(blink)
        ht16k33Clear()                    // 제너레이터도 setup 끝에서 clear()+writeDisplay() 를 한 번 더 한다
    }

    //% block="I2C matrix %num |char %text |scroll %scroll|speed(second) %speed"
    //% num.defl=1
    //% text.defl="Hello"
    //% speed.defl=0.2
    //% group="도트매트릭스(I2C-HT16K33)" weight=85
    //% inlineInputMode=inline
    export function ht16k33ShowText(num: number, text: string, scroll: HT16K33Scroll, speed: number): void {
        hkSel(num)
        let delayMs = Math.max(10, Math.floor(speed * 1000))

        if (!text || text.length == 0) return

        // 문자열 전체를 가로로 이어붙인 비트맵 위에서 화면 폭만큼의 창을 이동시킨다.
        // (이전에는 scroll 인자를 무시하고 글자를 한 장씩 갈아끼우기만 했다)
        // ★ 세 가지를 Arduino 에 맞췄다.
        //   (1) 글자 한 칸이 6열이다(글리프 5열 + 공백 1열). GFX 의 커서 전진이
        //       `cursor_x += textsize_x * 6` 이고 제너레이터도 strlen(s)*6 으로 폭을 잡는다.
        //       예전에는 8열 칸이라 글자 사이가 3열로 벌어지고 프레임 수가 약 33% 더 많았다.
        //       HT16K33_FONT 의 인덱스 5 는 0 으로 채워져 있어 그대로 공백 열이 된다.
        //   (2) Arduino 는 x 를 +8 에서 -문자열폭 까지 훑어 글자가 화면 밖에서 들어와
        //       밖으로 빠져나간다. 예전에는 창이 문자열 내부에만 머물러 이미 반쯤 보이는
        //       상태로 시작해 꼬리가 남은 채 끝났다.
        //   (3) 한 글자짜리 문자열도 Arduino 는 똑같이 스크롤하므로 예외 처리를 없앴다.
        const CELL = 6
        let cols = text.length * CELL
        let vw = hkWidth()              // 화면 폭(8x16 장치는 16열)
        let steps = cols + 8
        for (let s = 0; s < steps; s++) {
            // off = 화면 0열에 보이는 문자열 열 번호. 왼쪽 스크롤이면 -8 에서 cols-1 로 증가.
            let off = (scroll == HT16K33Scroll.Right) ? (cols - 1 - s) : (s - 8)
            // ★ Adafruit_LEDBackpack::clear() 는 16바이트를 모두 0 으로 만든다.
            //   예전에는 짝수(하위) 바이트 8개만 지워, 바이컬러의 빨강면과 8x16 의
            //   열 8~15 에 남아 있던 그림 위로 글자가 흘러갔다.
            for (let i = 0; i < HT_BYTES; i++) hkSet(i, 0)
            for (let b = 0; b < vw; b++) {
                let gcol = off + b
                if (gcol < 0 || gcol >= cols) continue    // 화면 밖에서 들어오고 나가는 구간
                let fi = hkFontIndex(text.charCodeAt(Math.idiv(gcol, CELL)))
                if (fi < 0 || fi >= HT16K33_FONT.length) continue
                let colBits = HT16K33_FONT[fi][gcol % CELL]
                // ★ HT16K33_FONT 는 '열' 바이트 배열이다(fontCol[c] 의 bit r = 픽셀(c,r)).
                //   회전(hkRotate)은 비트를 다른 바이트로 옮기므로 픽셀 단위로 채운다.
                for (let r = 0; r < 8; r++) {
                    if ((colBits >> r) & 1) {
                        hkRotate(r, b)
                        hkPlot(_hkRotRow, _hkRotCol, true)
                    }
                }
            }
            hkRefreshCur()
            basic.pause(delayMs)
        }
    }

    // 현재 선택된 장치의 버퍼를 전송한다 (선택을 바꾸지 않는다). 내부 전용.
    export function hkRefreshCur(): void {
        hkEnsureBuf()
        let buf = pins.createBuffer(17)
        buf[0] = 0x00  // 시작 주소
        for (let i = 0; i < HT_BYTES; i++) {
            buf[i + 1] = hkGet(i)
        }
        pins.i2cWriteBuffer(_ht16k33Addr[_ht16k33Cur], buf)
    }

    //% block="I2C matrix %num |screenat show"
    //% num.defl=1
    //% group="도트매트릭스(I2C-HT16K33)" weight=84
    export function ht16k33Refresh(num: number): void {
        hkSel(num)
        hkRefreshCur()
    }

    // 현재 선택된 장치를 지운다 (num 인자가 있는 블록이 마지막으로 고른 장치)
    //% block="I2C matrix screen clear"
    //% group="도트매트릭스(I2C-HT16K33)" weight=83
    export function ht16k33Clear(): void {
        for (let i = 0; i < HT_BYTES; i++) {
            hkSet(i, 0)
        }
        hkRefreshCur()   // ht16k33Refresh(1) 하드코딩 제거 — 장치 선택이 1번으로 튀던 버그
    }

    //% block="I2C matrix brightness(0-15) %brightness"
    //% brightness.defl=15 brightness.min=0 brightness.max=15
    //% group="도트매트릭스(I2C-HT16K33)" weight=82
    export function ht16k33SetBrightness(brightness: number): void {
        _ht16k33Brightness[_ht16k33Cur] = Math.clamp(0, 15, brightness)
        pins.i2cWriteNumber(_ht16k33Addr[_ht16k33Cur], 0xE0 | _ht16k33Brightness[_ht16k33Cur], NumberFormat.UInt8BE)
    }

    //% block="I2C matrix blink %blink"
    //% blink.shadow="toggleOnOff" blink.defl=false
    //% group="도트매트릭스(I2C-HT16K33)" weight=81
    export function ht16k33SetBlink(blink: boolean): void {
        _ht16k33Blink[_ht16k33Cur] = blink ? 1 : 0
        // 0x81: ON 깜빡임 없음, 0x83: ON 2Hz 깜빡임
        pins.i2cWriteNumber(_ht16k33Addr[_ht16k33Cur], 0x81 | (_ht16k33Blink[_ht16k33Cur] << 1), NumberFormat.UInt8BE)
    }

    // ★ ht16k33Init 이 받은 rotation(0~3) 을 저장만 하고 렌더링에서 한 번도 쓰지 않았다.
    //   좌표 변환으로 실제 회전을 적용한다(90° 단위, 장치 폭에 맞춰).
    export let _hkRotRow = 0, _hkRotCol = 0
    export function hkRotate(row: number, col: number): void {
        // ★ 라이브러리의 회전식은 열 방향 상수가 장치 폭을 따른다.
        //   Adafruit_8x8matrix 는 `x = 8 - x - 1`, Adafruit_8x16matrix 는 `x = 16 - x - 1`.
        //   예전에는 8x8 상수(7)로 고정되어 8x16 에서 회전이 어긋났다.
        let cmax = hkWidth() - 1
        switch (_ht16k33Rotation[_ht16k33Cur] & 3) {
            case 1: _hkRotRow = col; _hkRotCol = cmax - row; break     // 90°
            case 2: _hkRotRow = 7 - row; _hkRotCol = cmax - col; break // 180°
            case 3: _hkRotRow = 7 - col; _hkRotCol = row; break        // 270°
            default: _hkRotRow = row; _hkRotCol = col                  // 0°
        }
    }
}
