// ⚠ 자동 생성 — 사이언스랩 oled-driver.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Adapted from BRIXEL (MIT), 02_adv_displays.ts. See _sources/manifest.json.
namespace slxOLEDDriver {
    // v0.9.0: x 부터 줄 끝까지 지우기(«줄 칸» 글쓰기가 옛 글자 위에 겹쳐 쓰지 않게 — DSL마빗 v6.6 과 같은 버그)
    export function clearTextFrom(page: number, x: number): void {
        oledEnsureBuf()
        if (x < 0) x = 0
        if (x >= 128) return
        oledSeek(page, x)
        let n = 128 - x
        for (let col = x; col < 128; col++) _oledBuf[page * 128 + col] = 0
        while (n > 0) {
            let k = Math.min(16, n)
            let blank = pins.createBuffer(k + 1)
            blank[0] = 0x40
            pins.i2cWriteBuffer(_oledAddr, blank)
            n -= k
        }
    }
    export function clearTextLine(page: number): void {
        oledEnsureBuf()
        oledSeek(page, 0)
        let blank = pins.createBuffer(17)
        blank[0] = 0x40
        for (let col = 0; col < 128; col++) _oledBuf[page * 128 + col] = 0
        for (let chunk = 0; chunk < 8; chunk++) pins.i2cWriteBuffer(_oledAddr, blank)
    }
    /********** SSD1306 OLED 디스플레이 **********/
    /********** SH1106 OLED 디스플레이 **********/

    // OLED 드라이버 타입
    export enum OLEDDriver {

        SSD1306 = 0,

        SH1106 = 1
    }

    // OLED 해상도 (SSD1306용)
    export enum OLEDSize {

        Size128x64 = 0,

        Size128x32 = 1,

        Size64x128 = 2
    }

    // SSD1306 OLED 해상도
    export enum SSD1306Size {

        Size128x64_096 = 0,

        Size128x32_091 = 1,

        Size64x128 = 2
    }

    // SH1106 OLED 해상도 (1.3인치 전용)
    // OLED 색상
    export enum OLEDColor {

        White = 1,

        Black = 0
    }

    // OLED 데이터 저장 변수
    let _oledAddr: number = 0x3C
    let _oledWidth: number = 128
    let _oledHeight: number = 64
    let _oledDriver: OLEDDriver = OLEDDriver.SSD1306




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




    export function oledInitSH1106(addr: number): void {
        _oledAddr = addr
        _oledDriver = OLEDDriver.SH1106

        // SH1106 모듈은 128x64(1.3인치) 한 종류뿐이다.
        // 예전 size 인자는 선택지가 하나뿐인 enum 이라 고를 것이 없었고 값도 쓰이지 않았다 → 제거함.
        _oledWidth = 128
        _oledHeight = 64

        oledInitSequence()
    }





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




    export function oledShowString(x: number, y: number, text: string, color: OLEDColor): void {
        oledSetCursor(x, y)
        for (let i = 0; i < text.length; i++) {
            oledWriteChar(text.charCodeAt(i), color)
        }
    }




    export function oledShowNumber(x: number, y: number, num: number, color: OLEDColor): void {
        oledShowString(x, y, num.toString(), color)
    }




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




    export function oledDrawHLine(x: number, y: number, len: number, color: OLEDColor): void {
        for (let i = 0; i < len; i++) {
            oledSetPixel(x + i, y, color)
        }
    }




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



    export function oledDisplay(state: boolean): void {
        oledCmd(state ? 0xAF : 0xAE)
    }



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

    // v0.8.0 글자 크기 2 — 각 글리프 열 비트를 위아래로 두 배(페이지 2장), 열도 두 번 → 12x16 칸.
    export function oledShowString2x(x: number, y: number, text: string): void {
        for (let i = 0; i < text.length; i++) {
            let c = text.charCodeAt(i)
            if (c < 32 || c > 127) c = 32
            let base = (c - 32) * 5
            for (let half = 0; half < 2; half++) {
                oledSetCursor(x + i * 12, y + half * 8)
                for (let col = 0; col < 6; col++) {
                    let b = col < 5 ? OLED_FONT[base + col] : 0
                    let src = half == 0 ? (b & 0x0F) : ((b >> 4) & 0x0F)
                    let wide = 0
                    for (let k = 0; k < 4; k++) if (src & (1 << k)) wide |= 3 << (k * 2)
                    oledPutByte(wide, false)
                    oledPutByte(wide, false)
                }
            }
        }
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


}
