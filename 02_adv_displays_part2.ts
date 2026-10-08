// Continuation of 02_adv_displays.ts. See SOURCES.md for packaging details.
namespace AdvDisplays {

    //% block="I2C matrix %num |%row row|%col column|pixel %state"
    //% num.defl=1
    //% row.min=0 row.max=7 row.defl=0
    //% col.min=0 col.max=7 col.defl=0
    //% state.shadow="toggleOnOff" state.defl=true
    //% group="도트매트릭스(I2C-HT16K33)" weight=80
    //% inlineInputMode=inline
    export function ht16k33SetPixel(num: number, row: number, col: number, state: boolean): void {
        hkSel(num)
        // ★ 범위 검사는 Adafruit_8x16matrix::drawPixel 과 같은 규칙이다
        //   (행은 늘 0~7, 열은 장치 폭에 따라 0~7 또는 0~15).
        //   예전에는 열을 항상 0~7 로 잘라 8x16 모듈의 오른쪽 절반이 늘 꺼져 있었다.
        if (row < 0 || row > 7 || col < 0 || col >= hkWidth()) return
        hkRotate(row, col)
        hkPlot(_hkRotRow, _hkRotCol, state)
    }

    //% block="I2C bicolor matrix %num |%row row|%col column|color %color"
    //% num.defl=1
    //% row.min=0 row.max=7 row.defl=0
    //% col.min=0 col.max=7 col.defl=0
    //% group="도트매트릭스(I2C-HT16K33)" weight=79
    //% inlineInputMode=inline
    export function ht16k33SetBicolorPixel(num: number, row: number, col: number, color: HT16K33Color): void {
        hkSel(num)
        if (row < 0 || row > 7 || col < 0 || col > 7) return
        // ★ 회전이 ht16k33SetPixel 에만 적용되어 같은 (row,col) 이 두 블록에서
        //   서로 다른 LED 를 가리켰다. 여기에도 같은 좌표 변환을 적용한다.
        hkRotate(row, col)
        row = _hkRotRow
        col = _hkRotCol

        let greenIdx = row * 2
        let redIdx = row * 2 + 1

        // 색상 설정
        if (color == HT16K33Color.Off) {
            hkSet(greenIdx, hkGet(greenIdx) & ~(1 << col))
            hkSet(redIdx, hkGet(redIdx) & ~(1 << col))
        } else if (color == HT16K33Color.Green) {
            hkSet(greenIdx, hkGet(greenIdx) | (1 << col))
            hkSet(redIdx, hkGet(redIdx) & ~(1 << col))
        } else if (color == HT16K33Color.Red) {
            hkSet(greenIdx, hkGet(greenIdx) & ~(1 << col))
            hkSet(redIdx, hkGet(redIdx) | (1 << col))
        } else if (color == HT16K33Color.Orange) {
            hkSet(greenIdx, hkGet(greenIdx) | (1 << col))
            hkSet(redIdx, hkGet(redIdx) | (1 << col))
        }
    }

    //% block="I2C matrix %num |( %x1 row, %y1 column) → ( %x2 row, %y2 column) line draw"
    //% num.defl=1
    //% x1.min=0 x1.max=7 x1.defl=0
    //% y1.min=0 y1.max=7 y1.defl=0
    //% x2.min=0 x2.max=7 x2.defl=7
    //% y2.min=0 y2.max=7 y2.defl=7
    //% group="도트매트릭스(I2C-HT16K33)" weight=78
    //% inlineInputMode=inline
    export function ht16k33DrawLine(num: number, x1: number, y1: number, x2: number, y2: number): void {
        hkSel(num)
        // ★ x1/y1 은 ±1 씩만 움직이는데 끝점이 정수가 아니면(예: 소켓에 width/2 를 꽂은 경우)
        //   (x1==x2 && y1==y2) 가 영원히 성립하지 않아 while(true) 가 빠져나오지 못했다.
        //   → 보드가 멈추고 리셋해야 했다. 좌표를 정수로 반올림하고, NaN 같은 값에 대비해
        //   반복 상한도 둔다(8x8 에서 실제로 필요한 단계는 최대 8 이므로 64 면 충분하다).
        x1 = Math.round(x1)
        y1 = Math.round(y1)
        x2 = Math.round(x2)
        y2 = Math.round(y2)

        // Bresenham's line algorithm
        let dx = Math.abs(x2 - x1)
        let dy = Math.abs(y2 - y1)
        let sx = x1 < x2 ? 1 : -1
        let sy = y1 < y2 ? 1 : -1
        let err = dx - dy

        let guard = 0
        while (guard < 64) {
            guard++
            ht16k33SetPixel(num, x1, y1, true)

            if (x1 == x2 && y1 == y2) break
            let e2 = 2 * err
            if (e2 > -dy) {
                err -= dy
                x1 += sx
            }
            if (e2 < dx) {
                err += dx
                y1 += sy
            }
        }
    }

    //% block="I2C matrix %num |center( %cx row, %cy column) radius %r|circle draw"
    //% num.defl=1
    //% cx.min=0 cx.max=7 cx.defl=3
    //% cy.min=0 cy.max=7 cy.defl=3
    //% r.min=1 r.max=4 r.defl=3
    //% group="도트매트릭스(I2C-HT16K33)" weight=77
    //% inlineInputMode=inline
    export function ht16k33DrawCircle(num: number, cx: number, cy: number, r: number): void {
        hkSel(num)
        // ★ ht16k33DrawLine 과 같은 종류의 무한 루프가 여기에도 남아 있었다.
        //   x 는 정수 1 씩만 줄고 y 는 1 씩만 늘기 때문에, 좌표가 정수가 아니면
        //   버퍼 인덱스(행*2)가 소수가 되어 엉뚱한 칸을 건드리고,
        //   r 이 유한하지 않으면(변수 소켓에 1/0 이 들어온 경우) x 가 영원히 줄지 않아
        //   while (x >= y) 가 절대 끝나지 않는다 → 보드가 멈추고 리셋해야 한다.
        //   좌표를 정수로 맞추고 반복 상한을 둔다
        //   (8x16 에서도 반지름 16 이면 필요한 단계는 12 정도이므로 64 면 충분하다).
        cx = Math.round(cx)
        cy = Math.round(cy)
        r = Math.round(r)

        // Midpoint circle algorithm
        let x = r
        let y = 0
        let err = 0

        let guard = 0
        while (x >= y && guard < 64) {
            guard++
            ht16k33SetPixel(num, cx + x, cy + y, true)
            ht16k33SetPixel(num, cx + y, cy + x, true)
            ht16k33SetPixel(num, cx - y, cy + x, true)
            ht16k33SetPixel(num, cx - x, cy + y, true)
            ht16k33SetPixel(num, cx - x, cy - y, true)
            ht16k33SetPixel(num, cx - y, cy - x, true)
            ht16k33SetPixel(num, cx + y, cy - x, true)
            ht16k33SetPixel(num, cx + x, cy - y, true)

            y++
            err += 1 + 2 * y
            if (2 * (err - x) + 1 > 0) {
                x--
                err += 1 - 2 * x
            }
        }
    }

    //% block="I2C matrix %num |start( %x row, %y column) level %w × %h|rectangle %style"
    //% num.defl=1
    //% x.min=0 x.max=7 x.defl=0
    //% y.min=0 y.max=7 y.defl=0
    //% w.min=1 w.max=8 w.defl=4
    //% h.min=1 h.max=8 h.defl=4
    //% group="도트매트릭스(I2C-HT16K33)" weight=76
    //% inlineInputMode=inline
    export function ht16k33DrawRect(num: number, x: number, y: number, w: number, h: number, style: HT16K33RectStyle): void {
        hkSel(num)
        // ★ Arduino 는 이 블록을 drawRect(C, R, W, H) / fillRect(C, R, W, H) 로 내보낸다.
        //   GFX 는 x=열, y=행이므로 W 는 가로(열) 방향, H 는 세로(행) 방향 길이다
        //   (drawRect 는 writeFastHLine(x, y, w) 로 열을 훑는다).
        //   예전에는 w 를 행 방향, h 를 열 방향으로 돌려 정사각형이 아닌 사각형이
        //   90° 회전된 채 그려졌다(가로 8×2 막대를 요청하면 세로 2×8 이 나왔다).
        //   여기서 x 는 행, y 는 열이다.
        if (style == HT16K33RectStyle.Outline) {
            // 외곽선만 — 위/아래 가로변은 열을 훑고, 좌/우 세로변은 행을 훑는다
            for (let i = 0; i < w; i++) {
                ht16k33SetPixel(num, x, y + i, true)
                ht16k33SetPixel(num, x + h - 1, y + i, true)
            }
            for (let j = 0; j < h; j++) {
                ht16k33SetPixel(num, x + j, y, true)
                ht16k33SetPixel(num, x + j, y + w - 1, true)
            }
        } else {
            // 채우기
            for (let i = 0; i < w; i++) {
                for (let j = 0; j < h; j++) {
                    ht16k33SetPixel(num, x + j, y + i, true)
                }
            }
        }
    }

    //% block="I2C matrix %num |fill all"
    //% num.defl=1
    //% group="도트매트릭스(I2C-HT16K33)" weight=75
    export function ht16k33Fill(num: number): void {
        hkSel(num)
        for (let i = 0; i < 16; i++) {
            hkSet(i, 0xFF)
        }
        ht16k33Refresh(num)
    }

    // 한 문자 표시 (내부 함수)
    // 문자 → 폰트 인덱스 (소문자도 받는다). 없으면 -1
    export function hkFontIndex(charCode: number): number {
        let c = charCode
        if (c >= 97 && c <= 122) c = c - 32          // 소문자 → 대문자
        if (c >= 48 && c <= 57) return c - 48        // 0-9
        if (c >= 65 && c <= 90) return c - 65 + 10   // A-Z
        return -1
    }

    // 현재 장치 버퍼에 한 글자를 그린다 (전송은 하지 않는다)
    /*
     * ★ HT16K33_FONT 는 5×7 폰트의 '열(column)' 바이트 배열이다
     *   (예: '0' = 0x3E,0x51,0x49,0x45,0x3E — 각 바이트가 세로 한 줄).
     *   그런데 예전 코드는 이를 그대로 표시 RAM 의 '행(row)' 바이트로 써 넣어
     *   글리프가 90° 전치되어 나왔다. 여기서 전치해 준다.
     *     rowByte[r] 의 bit c = fontCol[c] 의 bit r
     */
    function hkDrawChar(charCode: number): void {
        let fi = hkFontIndex(charCode)
        // ★ Adafruit_LEDBackpack::clear() 는 displaybuffer 8개(=전송 16바이트)를 모두 0 으로 만든다.
        //   예전에는 짝수(하위) 바이트 8개만 지워 바이컬러의 빨강면과 8x16 의 열 8~15 가
        //   이전 그림 그대로 남았다.
        for (let i = 0; i < HT_BYTES; i++) hkSet(i, 0)
        if (fi < 0 || fi >= HT16K33_FONT.length) return
        const glyph = HT16K33_FONT[fi]
        // ★ 회전(hkRotate)이 ht16k33SetPixel 에만 적용되어 도형은 돌아가는데
        //   글자만 그대로 나왔다. 90° 회전은 비트가 다른 바이트로 옮겨가므로
        //   행 단위 대입 대신 미리 지우고 픽셀 단위로 채운다(회전 0 일 때 결과는 동일).
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((glyph[c] >> r) & 1) {
                    hkRotate(r, c)
                    hkPlot(_hkRotRow, _hkRotCol, true)
                }
            }
        }
    }

    // ★ 이전 ht16k33ShowChar 는 마지막에 ht16k33Refresh(1) 을 호출해
    //   장치 선택을 항상 1번으로 되돌려버렸다(다중 장치가 깨지는 원인). hkDrawChar 로 분리함.
    //   지금은 호출되는 곳이 없다 — Arduino 가 한 글자짜리 문자열도 스크롤하므로
    //   ht16k33ShowText 의 length==1 예외 경로를 없앴다. 한 글자 정적 표시가 다시 필요하면 여기서 쓴다.
    function ht16k33ShowChar(charCode: number): void {
        hkDrawChar(charCode)
        hkRefreshCur()
    }


    /********** 74HC595 시프트 레지스터 **********/

    // 74HC595 핀 저장 변수
    let _hc595Data: DigitalPin = DigitalPin.P0    // DS (SER)
    let _hc595Clock: DigitalPin = DigitalPin.P1   // SHCP (SRCLK)
    let _hc595Latch: DigitalPin = DigitalPin.P2   // STCP (RCLK)
    let _hc595ChipCount: number = 1
    let _hc595Buffer: number[] = [0]

    //% block="74HC595 set|data pin(DS) %data|clock pin(SHCP) %clock|latch pin(STCP) %latch|chip count %count"
    //% data.defl=DigitalPin.P0
    //% clock.defl=DigitalPin.P1
    //% latch.defl=DigitalPin.P2
    //% count.defl=1 count.min=1 count.max=8
    //% group="LED바(74HC595)" weight=54
    //% inlineInputMode=inline
    export function hc595Init(data: DigitalPin, clock: DigitalPin, latch: DigitalPin, count: number): void {
        _hc595Data = data
        _hc595Clock = clock
        _hc595Latch = latch
        _hc595ChipCount = count

        // 버퍼 초기화
        _hc595Buffer = []
        for (let i = 0; i < count; i++) {
            _hc595Buffer.push(0)
        }

        // 핀 초기화
        pins.digitalWritePin(_hc595Data, 0)
        pins.digitalWritePin(_hc595Clock, 0)
        pins.digitalWritePin(_hc595Latch, 0)

        // 모든 출력 끄기
        hc595Clear()
    }

    //% block="74HC595 byte output %value"
    //% value.min=0 value.max=255 value.defl=0
    //% group="LED바(74HC595)" weight=53
    export function hc595Output(value: number): void {
        _hc595Buffer[0] = value & 0xFF
        hc595Update()
    }

    //% block="74HC595 chip %chipIndex at byte %value output"
    //% chipIndex.min=0 chipIndex.max=7 chipIndex.defl=0
    //% value.min=0 value.max=255 value.defl=0
    //% group="LED바(74HC595)" weight=52
    export function hc595OutputToChip(chipIndex: number, value: number): void {
        if (chipIndex >= 0 && chipIndex < _hc595ChipCount) {
            _hc595Buffer[chipIndex] = value & 0xFF
            hc595Update()
        }
    }

    //% block="74HC595 pin %pin %state"
    //% pin.min=0 pin.max=63 pin.defl=0
    //% state.shadow="toggleOnOff" state.defl=true
    //% group="LED바(74HC595)" weight=51
    export function hc595SetPin(pin: number, state: boolean): void {
        let chipIndex = Math.floor(pin / 8)
        let bitIndex = pin % 8

        if (chipIndex >= 0 && chipIndex < _hc595ChipCount) {
            if (state) {
                _hc595Buffer[chipIndex] |= (1 << bitIndex)
            } else {
                _hc595Buffer[chipIndex] &= ~(1 << bitIndex)
            }
            hc595Update()
        }
    }

    //% block="74HC595 pin %pin toggle"
    //% pin.min=0 pin.max=63 pin.defl=0
    //% group="LED바(74HC595)" weight=50
    export function hc595TogglePin(pin: number): void {
        let chipIndex = Math.floor(pin / 8)
        let bitIndex = pin % 8

        if (chipIndex >= 0 && chipIndex < _hc595ChipCount) {
            _hc595Buffer[chipIndex] ^= (1 << bitIndex)
            hc595Update()
        }
    }

    //% block="74HC595 pin %pin state"
    //% pin.min=0 pin.max=63 pin.defl=0
    //% group="LED바(74HC595)" weight=49
    export function hc595GetPin(pin: number): boolean {
        let chipIndex = Math.floor(pin / 8)
        let bitIndex = pin % 8

        if (chipIndex >= 0 && chipIndex < _hc595ChipCount) {
            return (_hc595Buffer[chipIndex] & (1 << bitIndex)) != 0
        }
        return false
    }

    //% block="74HC595 all on"
    //% group="LED바(74HC595)" weight=48
    export function hc595Fill(): void {
        for (let i = 0; i < _hc595ChipCount; i++) {
            _hc595Buffer[i] = 0xFF
        }
        hc595Update()
    }

    //% block="74HC595 all off"
    //% group="LED바(74HC595)" weight=47
    export function hc595Clear(): void {
        for (let i = 0; i < _hc595ChipCount; i++) {
            _hc595Buffer[i] = 0x00
        }
        hc595Update()
    }

    //% block="74HC595 left shift"
    //% group="LED바(74HC595)" weight=46
    export function hc595ShiftLeft(): void {
        let carry = 0
        for (let i = 0; i < _hc595ChipCount; i++) {
            let newCarry = (_hc595Buffer[i] & 0x80) ? 1 : 0
            _hc595Buffer[i] = ((_hc595Buffer[i] << 1) | carry) & 0xFF
            carry = newCarry
        }
        hc595Update()
    }

    //% block="74HC595 right shift"
    //% group="LED바(74HC595)" weight=45
    export function hc595ShiftRight(): void {
        let carry = 0
        for (let i = _hc595ChipCount - 1; i >= 0; i--) {
            let newCarry = (_hc595Buffer[i] & 0x01) ? 0x80 : 0
            _hc595Buffer[i] = ((_hc595Buffer[i] >> 1) | carry) & 0xFF
            carry = newCarry
        }
        hc595Update()
    }

    //% block="74HC595 LED bar graph value %value|max %max"
    //% value.defl=0
    //% max.defl=8 max.min=1 max.max=64
    //% group="LED바(74HC595)" weight=44
    export function hc595BarGraph(value: number, max: number): void {
        let totalBits = _hc595ChipCount * 8
        let ledsOn = Math.floor((value * totalBits) / max)
        ledsOn = Math.clamp(0, totalBits, ledsOn)

        for (let i = 0; i < _hc595ChipCount; i++) {
            let bitsForThisChip = ledsOn - (i * 8)
            if (bitsForThisChip >= 8) {
                _hc595Buffer[i] = 0xFF
            } else if (bitsForThisChip > 0) {
                _hc595Buffer[i] = (1 << bitsForThisChip) - 1
            } else {
                _hc595Buffer[i] = 0x00
            }
        }
        hc595Update()
    }

    // 74HC595 내부: 버퍼를 시프트 레지스터로 전송
    function hc595Update(): void {
        pins.digitalWritePin(_hc595Latch, 0)

        // 마지막 칩부터 전송 (데이지 체인)
        for (let i = _hc595ChipCount - 1; i >= 0; i--) {
            hc595ShiftOut(_hc595Buffer[i])
        }

        // 래치: 출력에 반영
        pins.digitalWritePin(_hc595Latch, 1)
        control.waitMicros(1)
        pins.digitalWritePin(_hc595Latch, 0)
    }

    // 74HC595 내부: 1바이트 시프트 아웃 (MSB first)
    function hc595ShiftOut(value: number): void {
        for (let i = 7; i >= 0; i--) {
            pins.digitalWritePin(_hc595Clock, 0)
            pins.digitalWritePin(_hc595Data, (value >> i) & 1)
            pins.digitalWritePin(_hc595Clock, 1)
        }
    }


    /********** ST7735 TFT 디스플레이 **********/

    // TFT 색상 (RGB565 형식)
    export enum TFTColor {
        //% block="black"
        Black = 0x0000,
        //% block="white"
        White = 0xFFFF,
        //% block="red"
        Red = 0xF800,
        //% block="green"
        Green = 0x07E0,
        //% block="blue"
        Blue = 0x001F,
        //% block="yellow"
        Yellow = 0xFFE0,
        //% block="cyan"
        Cyan = 0x07FF,
        //% block="magenta"
        Magenta = 0xF81F,
        //% block="orange"
        Orange = 0xFC00,
        //% block="purple"
        Purple = 0x8010,
        //% block="gray"
        Gray = 0x8410
    }

    // TFT 회전
    export enum TFTRotation {
        //% block="0°"
        Rotate0 = 0,
        //% block="90°"
        Rotate90 = 1,
        //% block="180°"
        Rotate180 = 2,
        //% block="270°"
        Rotate270 = 3
    }

    // TFT 폰트 크기
    export enum TFTFontSize {
        //% block="small"
        Small = 1,
        //% block="medium"
        Medium = 2,
        //% block="large"
        Large = 3
    }

    // ST7735 핀 저장 변수
    let _st7735CS: DigitalPin = DigitalPin.P16
    let _st7735DC: DigitalPin = DigitalPin.P8
    let _st7735RST: DigitalPin = DigitalPin.P12
    let _st7735Width: number = 128
    let _st7735Height: number = 160
    let _st7735Rotation: TFTRotation = TFTRotation.Rotate0

    //% block="ST7735 TFT set|CS pin %cs|DC pin %dc|RST pin %rst|rotate %rotation"
    //% cs.defl=DigitalPin.P16
    //% dc.defl=DigitalPin.P8
    //% rst.defl=DigitalPin.P12
    //% group="TFT LCD" weight=70
    //% inlineInputMode=inline
    export function st7735Init(cs: DigitalPin, dc: DigitalPin, rst: DigitalPin, rotation: TFTRotation): void {
        _st7735CS = cs
        _st7735DC = dc
        _st7735RST = rst
        _st7735Rotation = rotation

        // 핀 초기화
        pins.digitalWritePin(_st7735CS, 1)
        pins.digitalWritePin(_st7735DC, 0)

        // 하드웨어 리셋
        pins.digitalWritePin(_st7735RST, 1)
        basic.pause(10)
        pins.digitalWritePin(_st7735RST, 0)
        basic.pause(10)
        pins.digitalWritePin(_st7735RST, 1)
        basic.pause(120)

        // ST7735 초기화 시퀀스
        st7735WriteCmd(0x01)  // Software Reset
        basic.pause(150)
        st7735WriteCmd(0x11)  // Sleep Out
        basic.pause(120)

        st7735WriteCmd(0x3A)  // Color Mode
        st7735WriteData(0x05) // 16-bit color (RGB565)

        st7735WriteCmd(0x36)  // Memory Access Control
        let madctl = 0x00
        if (rotation == TFTRotation.Rotate0) {
            madctl = 0x00
            _st7735Width = 128
            _st7735Height = 160
        } else if (rotation == TFTRotation.Rotate90) {
            madctl = 0x60
            _st7735Width = 160
            _st7735Height = 128
        } else if (rotation == TFTRotation.Rotate180) {
            madctl = 0xC0
            _st7735Width = 128
            _st7735Height = 160
        } else {
            madctl = 0xA0
            _st7735Width = 160
            _st7735Height = 128
        }
        st7735WriteData(madctl)

        st7735WriteCmd(0x29)  // Display ON
        basic.pause(10)

        st7735FillScreen(TFTColor.Black)
    }

    //% block="ST7735 screen fill color %color"
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=69
    export function st7735FillScreen(color: number): void {
        st7735SetWindow(0, 0, _st7735Width - 1, _st7735Height - 1)
        st7735WriteCmd(0x2C)  // Memory Write

        let hi = (color >> 8) & 0xFF
        let lo = color & 0xFF

        pins.digitalWritePin(_st7735CS, 0)
        pins.digitalWritePin(_st7735DC, 1)
        for (let i = 0; i < _st7735Width * _st7735Height; i++) {
            pins.spiWrite(hi)
            pins.spiWrite(lo)
        }
        pins.digitalWritePin(_st7735CS, 1)
    }

    //% block="ST7735 pixel x %x|y %y|color %color"
    //% x.min=0 x.defl=0
    //% y.min=0 y.defl=0
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=68
    //% inlineInputMode=inline
    export function st7735DrawPixel(x: number, y: number, color: number): void {
        if (x < 0 || x >= _st7735Width || y < 0 || y >= _st7735Height) return

        st7735SetWindow(x, y, x, y)
        st7735WriteCmd(0x2C)
        st7735WriteData((color >> 8) & 0xFF)
        st7735WriteData(color & 0xFF)
    }

    //% block="ST7735 line draw (%x1,%y1) → (%x2,%y2)|color %color"
    //% x1.defl=0 y1.defl=0 x2.defl=50 y2.defl=50
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=67
    //% inlineInputMode=inline
    export function st7735DrawLine(x1: number, y1: number, x2: number, y2: number, color: number): void {
        // ★ 좌표가 정수가 아니면 (변수 소켓에 3.5 같은 값이 들어오면) 아래 Bresenham 루프의
        //   종료 조건 x1 == x2 && y1 == y2 에 영원히 도달하지 못해 보드가 멈춘다.
        //   ht16k33DrawLine 과 같은 방식으로 반올림 + 반복 상한으로 막는다.
        x1 = Math.round(x1); y1 = Math.round(y1)
        x2 = Math.round(x2); y2 = Math.round(y2)

        let dx = Math.abs(x2 - x1)
        let dy = Math.abs(y2 - y1)
        let sx = x1 < x2 ? 1 : -1
        let sy = y1 < y2 ? 1 : -1
        let err = dx - dy
        let guard = 0

        while (true) {
            st7735DrawPixel(x1, y1, color)
            if (x1 == x2 && y1 == y2) break
            guard++
            if (guard > 512) break     // 패널 대각선(160x128)보다 크면 비정상 — 탈출
            let e2 = 2 * err
            if (e2 > -dy) { err -= dy; x1 += sx }
            if (e2 < dx) { err += dx; y1 += sy }
        }
    }

    //% block="ST7735 rectangle (%x,%y) level %w×%h|color %color|fill %fill"
    //% x.defl=10 y.defl=10 w.defl=50 h.defl=30
    //% color.shadow="tftColorPicker"
    //% fill.shadow="toggleYesNo" fill.defl=false
    //% group="TFT LCD" weight=66
    //% inlineInputMode=inline
    export function st7735DrawRect(x: number, y: number, w: number, h: number, color: number, fill: boolean): void {
        if (fill) {
            // ★ 채우기 경로만 클리핑이 없어, 화면을 넘는 사각형이 범위 밖 주소창(CASET/RASET)을
            //   설정한 뒤 w*h 픽셀을 그대로 밀어넣어 엉뚱한 곳에 번지거나 화면이 깨졌다.
            //   (외곽선 경로는 st7735DrawPixel 이 좌표를 검사하므로 멀쩡했다)
            //   size>=2 인 텍스트도 이 경로로 그려지므로 함께 해결된다.
            let x0 = Math.max(0, x)
            let y0 = Math.max(0, y)
            let x1 = Math.min(_st7735Width - 1, x + w - 1)
            let y1 = Math.min(_st7735Height - 1, y + h - 1)
            if (x1 < x0 || y1 < y0) return
            let cw = x1 - x0 + 1
            let ch = y1 - y0 + 1

            st7735SetWindow(x0, y0, x1, y1)
            st7735WriteCmd(0x2C)

            let hi = (color >> 8) & 0xFF
            let lo = color & 0xFF

            pins.digitalWritePin(_st7735CS, 0)
            pins.digitalWritePin(_st7735DC, 1)
            for (let i = 0; i < cw * ch; i++) {
                pins.spiWrite(hi)
                pins.spiWrite(lo)
            }
            pins.digitalWritePin(_st7735CS, 1)
        } else {
            st7735DrawLine(x, y, x + w - 1, y, color)
            st7735DrawLine(x, y + h - 1, x + w - 1, y + h - 1, color)
            st7735DrawLine(x, y, x, y + h - 1, color)
            st7735DrawLine(x + w - 1, y, x + w - 1, y + h - 1, color)
        }
    }

    //% block="ST7735 circle center (%cx,%cy) radius %r|color %color"
    //% cx.defl=64 cy.defl=80 r.defl=20
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=65
    //% inlineInputMode=inline
    export function st7735DrawCircle(cx: number, cy: number, r: number, color: number): void {
        // ★ st7735DrawLine 과 같은 이유 — x 는 1 씩만 줄고 y 는 1 씩만 늘어서,
        //   r 이 유한하지 않으면 while (x >= y) 를 영영 못 빠져나온다.
        //   좌표를 정수로 맞추고 반복 상한을 둔다
        //   (패널 최대 변이 160 이라 실제로 필요한 단계는 약 0.71×r ≈ 114 이므로 256 이면 충분하다).
        cx = Math.round(cx)
        cy = Math.round(cy)
        r = Math.round(r)

        let x = r
        let y = 0
        let err = 0

        let guard = 0
        while (x >= y && guard < 256) {
            guard++
            st7735DrawPixel(cx + x, cy + y, color)
            st7735DrawPixel(cx + y, cy + x, color)
            st7735DrawPixel(cx - y, cy + x, color)
            st7735DrawPixel(cx - x, cy + y, color)
            st7735DrawPixel(cx - x, cy - y, color)
            st7735DrawPixel(cx - y, cy - x, color)
            st7735DrawPixel(cx + y, cy - x, color)
            st7735DrawPixel(cx + x, cy - y, color)

            y++
            err += 1 + 2 * y
            if (2 * (err - x) + 1 > 0) {
                x--
                err += 1 - 2 * x
            }
        }
    }

    //% block="ST7735 text %text|position (%x,%y)|color %color|size %size"
    //% text.defl="Hello"
    //% x.defl=10 y.defl=10
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=64
    //% inlineInputMode=inline
    export function st7735DrawText(text: string, x: number, y: number, color: number, size: TFTFontSize): void {
        let cursorX = x
        for (let i = 0; i < text.length; i++) {
            st7735DrawChar(text.charCodeAt(i), cursorX, y, color, size)
            cursorX += 6 * size
        }
    }

    //% block="RGB color R %r|G %g|B %b"
    //% r.min=0 r.max=255 r.defl=255
    //% g.min=0 g.max=255 g.defl=0
    //% b.min=0 b.max=255 b.defl=0
    //% group="TFT LCD" weight=63
    export function tftRGB(r: number, g: number, b: number): number {
        // RGB888 → RGB565 변환
        return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
    }

    // ★ fieldEditor 이름이 잘못돼 있었다. pxt 의 "colorwheel" 은 색상판이 아니라
    //   0~255 슬라이더(FieldSlider)라서 colours/columns 는 무시되고, 드라이버가 기대하는
    //   16비트 RGB565 대신 0~255 만 들어왔다. RGB565 에서 빨강은 0x0800 이상이 필요하므로
    //   빨강·노랑·흰색 등은 아예 만들 수 없고 모든 색이 검정/남색으로 나왔다.
    //   10칸 색상판은 "colornumber" 이며 0xRRGGBB 를 준다 → 여기서 RGB565 로 변환한다.
    //   (변환 코드가 실제로 돌아야 하므로 항등 시임인 shim=TD_ID 를 뺐다.
    //    blockHidden=true 라 팔레트에는 여전히 나오지 않는다)
    //% block="%color"
    //% blockId="tftColorPicker"
    //% color.fieldEditor="colornumber"
    //% color.fieldOptions.decompileLiterals=true
    //% color.fieldOptions.colours='["#000000","#FFFFFF","#FF0000","#00FF00","#0000FF","#FFFF00","#00FFFF","#FF00FF","#FFA500","#808080"]'
    //% color.fieldOptions.columns=5
    //% color.defl='0xFFFFFF'
    //% group="TFT LCD" weight=62
    //% blockHidden=true
    export function tftColorPicker(color: number): number {
        // RGB888 → RGB565
        return ((color >> 8) & 0xF800) | ((color >> 5) & 0x07E0) | ((color >> 3) & 0x001F)
    }

    //% block="TFT color %color"
    //% group="TFT LCD" weight=61
    export function tftPresetColor(color: TFTColor): number {
        return color
    }

    // ST7735 내부 함수들
    function st7735WriteCmd(cmd: number): void {
        pins.digitalWritePin(_st7735DC, 0)
        pins.digitalWritePin(_st7735CS, 0)
        pins.spiWrite(cmd)
        pins.digitalWritePin(_st7735CS, 1)
    }

    function st7735WriteData(data: number): void {
        pins.digitalWritePin(_st7735DC, 1)
        pins.digitalWritePin(_st7735CS, 0)
        pins.spiWrite(data)
        pins.digitalWritePin(_st7735CS, 1)
    }

    function st7735SetWindow(x0: number, y0: number, x1: number, y1: number): void {
        st7735WriteCmd(0x2A)  // Column Address Set
        st7735WriteData(0x00)
        st7735WriteData(x0)
        st7735WriteData(0x00)
        st7735WriteData(x1)

        st7735WriteCmd(0x2B)  // Row Address Set
        st7735WriteData(0x00)
        st7735WriteData(y0)
        st7735WriteData(0x00)
        st7735WriteData(y1)
    }

    // 간단한 5x7 폰트 (숫자, 대문자)
    const TFT_FONT: number[] = [
        0x00, 0x00, 0x00, 0x00, 0x00,  // 32: 공백
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
    ]

    function st7735DrawChar(c: number, x: number, y: number, color: number, size: number): void {
        // ★ TFT_FONT 는 32~90(대문자까지)만 있어 소문자가 전부 공백이 되었다.
        //   기본값 "Hello" 조차 'H' 하나만 나왔다. hkFontIndex 처럼 대문자로 접는다.
        //   (접은 뒤 최대 인덱스는 (90-32)*5+4 = 294 로 표 크기 295 를 넘지 않는다)
        if (c >= 97 && c <= 122) c = c - 32
        if (c < 32 || c > 90) c = 32  // 지원하지 않는 문자는 공백

        let fontIdx = (c - 32) * 5

        for (let col = 0; col < 5; col++) {
            let line = TFT_FONT[fontIdx + col]
            for (let row = 0; row < 7; row++) {
                if (line & (1 << row)) {
                    if (size == 1) {
                        st7735DrawPixel(x + col, y + row, color)
                    } else {
                        st7735DrawRect(x + col * size, y + row * size, size, size, color, true)
                    }
                }
            }
        }
    }


    /********** ILI9341 TFT 디스플레이 **********/

    // ILI9341 핀 저장 변수
    let _ili9341CS: DigitalPin = DigitalPin.P16
    let _ili9341DC: DigitalPin = DigitalPin.P8
    let _ili9341RST: DigitalPin = DigitalPin.P12
    let _ili9341Width: number = 240
    let _ili9341Height: number = 320

    //% block="ILI9341 TFT set|CS pin %cs|DC pin %dc|RST pin %rst|rotate %rotation"
    //% cs.defl=DigitalPin.P16
    //% dc.defl=DigitalPin.P8
    //% rst.defl=DigitalPin.P12
    //% group="TFT LCD" weight=60
    //% inlineInputMode=inline
    export function ili9341Init(cs: DigitalPin, dc: DigitalPin, rst: DigitalPin, rotation: TFTRotation): void {
        _ili9341CS = cs
        _ili9341DC = dc
        _ili9341RST = rst

        // 핀 초기화
        pins.digitalWritePin(_ili9341CS, 1)
        pins.digitalWritePin(_ili9341DC, 0)

        // 하드웨어 리셋
        pins.digitalWritePin(_ili9341RST, 1)
        basic.pause(10)
        pins.digitalWritePin(_ili9341RST, 0)
        basic.pause(10)
        pins.digitalWritePin(_ili9341RST, 1)
        basic.pause(120)

        // ILI9341 초기화 시퀀스
        ili9341WriteCmd(0x01)  // Software Reset
        basic.pause(150)
        ili9341WriteCmd(0x11)  // Sleep Out
        basic.pause(120)

        ili9341WriteCmd(0x3A)  // Pixel Format
        ili9341WriteData(0x55) // 16-bit color

        ili9341WriteCmd(0x36)  // Memory Access Control
        let madctl = 0x48
        if (rotation == TFTRotation.Rotate0) {
            madctl = 0x48
            _ili9341Width = 240
            _ili9341Height = 320
        } else if (rotation == TFTRotation.Rotate90) {
            madctl = 0x28
            _ili9341Width = 320
            _ili9341Height = 240
        } else if (rotation == TFTRotation.Rotate180) {
            madctl = 0x88
            _ili9341Width = 240
            _ili9341Height = 320
        } else {
            madctl = 0xE8
            _ili9341Width = 320
            _ili9341Height = 240
        }
        ili9341WriteData(madctl)

        ili9341WriteCmd(0x29)  // Display ON
        basic.pause(10)

        ili9341FillScreen(TFTColor.Black)
    }

    //% block="ILI9341 screen fill color %color"
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=59
    export function ili9341FillScreen(color: number): void {
        ili9341SetWindow(0, 0, _ili9341Width - 1, _ili9341Height - 1)
        ili9341WriteCmd(0x2C)

        let hi = (color >> 8) & 0xFF
        let lo = color & 0xFF

        pins.digitalWritePin(_ili9341CS, 0)
        pins.digitalWritePin(_ili9341DC, 1)
        // ILI9341은 240x320으로 더 큼 - 분할 전송
        for (let row = 0; row < _ili9341Height; row++) {
            for (let col = 0; col < _ili9341Width; col++) {
                pins.spiWrite(hi)
                pins.spiWrite(lo)
            }
        }
        pins.digitalWritePin(_ili9341CS, 1)
    }

    //% block="ILI9341 pixel x %x|y %y|color %color"
    //% x.min=0 x.defl=0
    //% y.min=0 y.defl=0
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=58
    //% inlineInputMode=inline
    export function ili9341DrawPixel(x: number, y: number, color: number): void {
        if (x < 0 || x >= _ili9341Width || y < 0 || y >= _ili9341Height) return

        ili9341SetWindow(x, y, x, y)
        ili9341WriteCmd(0x2C)
        ili9341WriteData((color >> 8) & 0xFF)
        ili9341WriteData(color & 0xFF)
    }

    //% block="ILI9341 rectangle (%x,%y) level %w×%h|color %color|fill %fill"
    //% x.defl=10 y.defl=10 w.defl=50 h.defl=30
    //% color.shadow="tftColorPicker"
    //% fill.shadow="toggleYesNo" fill.defl=true
    //% group="TFT LCD" weight=57
    //% inlineInputMode=inline
    export function ili9341DrawRect(x: number, y: number, w: number, h: number, color: number, fill: boolean): void {
        if (fill) {
            // ★ st7735DrawRect 와 같은 문제 — 채우기 경로에 클리핑이 없어 화면을 넘는
            //   사각형이 범위 밖 주소창을 설정하고 w*h 픽셀을 흘려보냈다.
            let x0 = Math.max(0, x)
            let y0 = Math.max(0, y)
            let x1 = Math.min(_ili9341Width - 1, x + w - 1)
            let y1 = Math.min(_ili9341Height - 1, y + h - 1)
            if (x1 < x0 || y1 < y0) return
            let cw = x1 - x0 + 1
            let ch = y1 - y0 + 1

            ili9341SetWindow(x0, y0, x1, y1)
            ili9341WriteCmd(0x2C)

            let hi = (color >> 8) & 0xFF
            let lo = color & 0xFF

            pins.digitalWritePin(_ili9341CS, 0)
            pins.digitalWritePin(_ili9341DC, 1)
            for (let i = 0; i < cw * ch; i++) {
                pins.spiWrite(hi)
                pins.spiWrite(lo)
            }
            pins.digitalWritePin(_ili9341CS, 1)
        } else {
            // 외곽선만 그리기
            for (let i = 0; i < w; i++) {
                ili9341DrawPixel(x + i, y, color)
                ili9341DrawPixel(x + i, y + h - 1, color)
            }
            for (let j = 0; j < h; j++) {
                ili9341DrawPixel(x, y + j, color)
                ili9341DrawPixel(x + w - 1, y + j, color)
            }
        }
    }

    //% block="ILI9341 text %text|position (%x,%y)|color %color|size %size"
    //% text.defl="Hello"
    //% x.defl=10 y.defl=10
    //% color.shadow="tftColorPicker"
    //% group="TFT LCD" weight=56
    //% inlineInputMode=inline
    export function ili9341DrawText(text: string, x: number, y: number, color: number, size: TFTFontSize): void {
        let cursorX = x
        for (let i = 0; i < text.length; i++) {
            ili9341DrawChar(text.charCodeAt(i), cursorX, y, color, size)
            cursorX += 6 * size
        }
    }

    // ILI9341 내부 함수들
    function ili9341WriteCmd(cmd: number): void {
        pins.digitalWritePin(_ili9341DC, 0)
        pins.digitalWritePin(_ili9341CS, 0)
        pins.spiWrite(cmd)
        pins.digitalWritePin(_ili9341CS, 1)
    }

    function ili9341WriteData(data: number): void {
        pins.digitalWritePin(_ili9341DC, 1)
        pins.digitalWritePin(_ili9341CS, 0)
        pins.spiWrite(data)
        pins.digitalWritePin(_ili9341CS, 1)
    }

    function ili9341SetWindow(x0: number, y0: number, x1: number, y1: number): void {
        ili9341WriteCmd(0x2A)  // Column Address Set
        ili9341WriteData((x0 >> 8) & 0xFF)
        ili9341WriteData(x0 & 0xFF)
        ili9341WriteData((x1 >> 8) & 0xFF)
        ili9341WriteData(x1 & 0xFF)

        ili9341WriteCmd(0x2B)  // Row Address Set
        ili9341WriteData((y0 >> 8) & 0xFF)
        ili9341WriteData(y0 & 0xFF)
        ili9341WriteData((y1 >> 8) & 0xFF)
        ili9341WriteData(y1 & 0xFF)
    }

    function ili9341DrawChar(c: number, x: number, y: number, color: number, size: number): void {
        // ★ st7735DrawChar 와 동일 — 소문자(97~122)가 전부 공백이 되던 것을 대문자로 접는다.
        if (c >= 97 && c <= 122) c = c - 32
        if (c < 32 || c > 90) c = 32

        let fontIdx = (c - 32) * 5

        for (let col = 0; col < 5; col++) {
            let line = TFT_FONT[fontIdx + col]
            for (let row = 0; row < 7; row++) {
                if (line & (1 << row)) {
                    if (size == 1) {
                        ili9341DrawPixel(x + col, y + row, color)
                    } else {
                        ili9341DrawRect(x + col * size, y + row * size, size, size, color, true)
                    }
                }
            }
        }
    }
}
