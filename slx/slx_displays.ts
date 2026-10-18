// ⚠ 자동 생성 — 사이언스랩 displays.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxOLEDType {
    SSD1306 = 0,
    SH1106 = 1
}
enum SlxPixelColor {
    Red = 0xFF0000,
    Yellow = 0xFFFF00,
    Green = 0x00FF00,
    Blue = 0x0000FF,
    Purple = 0x800080,
    White = 0xFFFFFF,
    Off = 0
}
namespace slxDisplay {
    let lcdAddress = 0
    let oledAddress = 0
    let oledType = SlxOLEDType.SSD1306
    let pixelBusy = false
    let pixelPin = -1
    let pixelCount = 0
    let pixelColor = 0
    let pixelLevel = 32
    let displayOK = false
    function lcdReady(): boolean {
        if (lcdAddress != 0 && slxBus.read(lcdAddress, 1)) return true
        lcdAddress = 0
        let addresses = [0x20, 0x27, 0x3F]
        for (let i = 0; i < addresses.length; i++) {
            if (slxBus.read(addresses[i], 1)) {
                lcdAddress = addresses[i]
                slxLCDDriver.lcdInit(lcdAddress, slxLCDDriver.LCDType.LCD1602)
                return true
            }
        }
        return false
    }
    /** dis-001: connect LCD1602 to the shield's suitable I2C supply port. Address 0x20/0x27/0x3F is found automatically. English/numbers, 16 characters per line. */
    export function lcdLine(line: number, text: any): void {
        displayOK = false
        if (line != 1 && line != 2) return
        let shown = slxInternal.displayText(text)
        slxBus.acquire()
        if (lcdReady()) {
            shown = shown.substr(0, 16)
            while (shown.length < 16) shown += " "
            slxLCDDriver.lcdShowString(shown, 0, line - 1)
            displayOK = true
        }
        slxBus.release()
    }
    /** v0.8.0 write text at row 0..1, column 0..15 (no padding), like the BrixelAI DSL micro:bit card. */
    export function lcdText(row: number, col: number, text: any): void {
        displayOK = false
        if (row < 0 || row > 1 || col < 0 || col > 15) return
        let shown = slxInternal.displayText(text)
        slxBus.acquire()
        if (lcdReady()) {
            slxLCDDriver.lcdShowString(shown.substr(0, 16 - col), col, row)
            displayOK = true
        }
        slxBus.release()
    }
    /** Erase both lines of the automatically detected I2C LCD1602. */
    export function lcdClear(): void {
        slxBus.acquire()
        displayOK = lcdReady()
        if (displayOK) slxLCDDriver.lcdClear()
        slxBus.release()
    }
    function oledReady(): boolean {
        if (oledAddress != 0 && slxBus.write(oledAddress, [0x00, 0xE3])) return true
        oledAddress = 0
        for (let address = 0x3C; address <= 0x3D; address++) {
            if (slxBus.write(address, [0x00, 0xAE])) {
                oledAddress = address
                if (oledType == SlxOLEDType.SH1106) slxOLEDDriver.oledInitSH1106(address)
                else slxOLEDDriver.oledInitSSD1306(address, slxOLEDDriver.SSD1306Size.Size128x64_096)
                return true
            }
        }
        return false
    }
    /** Default SSD1306 matches both OLED sizes in the order list. Select SH1106 only when the module controller is confirmed; size alone does not identify the chip. */
    export function setOLED(model: SlxOLEDType): void {
        slxBus.acquire()
        oledType = model
        oledAddress = 0
        slxBus.release()
    }
    /** dis-011/012: 128x64 I2C OLED. Line 1..8, up to 21 English letters/numbers. Initializes automatically. */
    export function oledLine(line: number, text: any): void {
        displayOK = false
        if (line < 1 || line > 8 || line != Math.floor(line)) return
        let shown = slxInternal.displayText(text)
        slxBus.acquire()
        if (oledReady()) {
            // Replace one entire page, so writing a shorter value clears the previous digits.
            slxOLEDDriver.clearTextLine(line - 1)
            slxOLEDDriver.oledShowString(0, (line - 1) * 8, shown.substr(0, 21), slxOLEDDriver.OLEDColor.White)
            displayOK = true
        }
        slxBus.release()
    }
    let oledSize = 1
    /** v0.8.0 text size for «OLED row column text»: 1 = 6x8 (8 rows × 21 columns), 2 = 12x16 (4 rows × 10 columns). Like the BrixelAI DSL micro:bit card. */
    export function oledTextSize(size: number): void { oledSize = size == 2 ? 2 : 1 }
    /** v0.8.0 write text at row, column in the current text size (size 1: row 0..7, column 0..20; size 2: row 0..3, column 0..9), like the BrixelAI DSL micro:bit card. */
    export function oledText(row: number, col: number, text: any): void {
        displayOK = false
        let rows = oledSize == 2 ? 4 : 8, cols = oledSize == 2 ? 10 : 21
        if (row < 0 || row >= rows || col < 0 || col >= cols) return
        let shown = slxInternal.displayText(text).substr(0, cols - col)
        slxBus.acquire()
        if (oledReady()) {
            // v0.9.0: 쓰기 전에 그 칸부터 줄 끝까지 지운다 — 지우기 블록 없이 숫자가 겹치지 않게
            if (oledSize == 2) {
                slxOLEDDriver.clearTextFrom(row * 2, col * 12)
                slxOLEDDriver.clearTextFrom(row * 2 + 1, col * 12)
                slxOLEDDriver.oledShowString2x(col * 12, row * 16, shown)
            } else {
                slxOLEDDriver.clearTextFrom(row, col * 6)
                slxOLEDDriver.oledShowString(col * 6, row * 8, shown, slxOLEDDriver.OLEDColor.White)
            }
            displayOK = true
        }
        slxBus.release()
    }
    /** Erase all eight OLED lines. */
    export function oledClear(): void {
        slxBus.acquire()
        displayOK = oledReady()
        if (displayOK) slxOLEDDriver.oledClear()
        slxBus.release()
    }
    // ---- Strip model: set up pin/count once, then light LEDs by number (1..count). ----
    let stripScale = 255
    /** v0.8.0 overall NeoPixel brightness 0..255 (default 255 = no change), applied to the following LED blocks on top of their own brightness. Like the BrixelAI DSL micro:bit card's brightness block. */
    export function setStripBrightness(level: number): void {
        if (slxInternal.finite(level)) stripScale = Math.max(0, Math.min(255, Math.round(level)))
    }
    let stripPin = -1
    let stripData: Buffer = null   // GRB bytes, brightness already applied
    /** Run once at start: the pin the NeoPixel signal wire is in and how many LEDs (1..64). All LEDs start off. Many LEDs at high brightness need more current than the shield 5V may supply; start low. */
    export function setupStrip(pin: SlxDigitalPin, count: number): void {
        if (!slxInternal.validDigital(pin) || !slxInternal.finite(count) || count < 1 || count > 64) return
        stripPin = pin
        stripData = pins.createBuffer(Math.floor(count) * 3)
        sendStrip()
    }
    /** Light LED number 1..LED count with a brightness 0..255 and a color. Plug a variable into the number to walk along the strip, or a sensor value into the brightness. Needs the set-up block first; other numbers are ignored. */
    export function setLed(index: number, brightness: number, color: number): void {
        if (!stripData || !slxInternal.finite(index)) return
        index = Math.floor(index)
        if (index < 1 || index * 3 > stripData.length) return
        putLed(index - 1, brightness, color)
        sendStrip()
    }
    /** Light every LED with the same brightness 0..255 and color. Needs the set-up block first. */
    export function setAll(brightness: number, color: number): void {
        if (!stripData) return
        for (let i = 0; i * 3 < stripData.length; i++) putLed(i, brightness, color)
        sendStrip()
    }
    /** Turn every LED off. */
    export function clearStrip(): void {
        if (!stripData) return
        stripData.fill(0)
        sendStrip()
    }
    function putLed(i: number, brightness: number, color: number): void {
        if (!slxInternal.finite(brightness) || !slxInternal.finite(color)) return
        let level = Math.idiv(Math.max(0, Math.min(255, Math.round(brightness))) * stripScale, 255)
        stripData[i * 3] = Math.idiv(((color >> 8) & 255) * level, 255)
        stripData[i * 3 + 1] = Math.idiv(((color >> 16) & 255) * level, 255)
        stripData[i * 3 + 2] = Math.idiv((color & 255) * level, 255)
    }
    function sendStrip(): void {
        displayOK = false
        if (stripPin < 0 || !stripData) return
        while (pixelBusy) basic.pause(1)
        pixelBusy = true
        slxInternal.prepare(stripPin)
        displayOK = slxNative.showPixels(stripPin, stripData)
        // CODAL WS2812B::play blocks until its DMA stream consumes the frame. Yield between frames.
        basic.pause(5)
        pixelBusy = false
    }
    /** dis-013/014 WS2812 RGB: pick the color and brightness 0..255. Many LEDs at high brightness need more current than the shield 5V may supply; start low. V2 hardware DMA; BLE coexistence still needs physical testing. */
    export function pixelsColor(pin: SlxDigitalPin, count: number, color: number, brightness: number): void {
        showColor(pin, count, color, brightness)
    }
    /** Mix a color from red, green and blue, each 0..255. Plugs into the NeoPixel color slot. */
    export function rgb(red: number, green: number, blue: number): number {
        let r = Math.max(0, Math.min(255, Math.round(red)))
        let g = Math.max(0, Math.min(255, Math.round(green)))
        let b = Math.max(0, Math.min(255, Math.round(blue)))
        return (r << 16) | (g << 8) | b
    }
    /** Change the brightness (0..255) of the NeoPixels last lit by the NeoPixel color block and redraw them. Plug a variable or sensor value in, e.g. light level. Running the color block again uses its own brightness. */
    export function pixelsBrightness(brightness: number): void {
        if (!slxInternal.finite(brightness)) return
        pixelLevel = Math.max(0, Math.min(255, Math.round(brightness)))
        if (pixelPin >= 0) showColor(pixelPin, pixelCount, pixelColor, pixelLevel)
    }
    /** Older fixed-color block kept so saved projects still open; brightness 32/255. */
    export function pixels(pin: SlxDigitalPin, count: number, color: SlxPixelColor): void {
        showColor(pin, count, color, 32)
    }
    function showColor(pin: SlxDigitalPin, count: number, color: number, brightness: number): void {
        displayOK = false
        if (!slxInternal.validDigital(pin) || !slxInternal.finite(count) || count < 1 || count > 64) return
        if (!slxInternal.finite(color) || !slxInternal.finite(brightness)) return
        brightness = Math.max(0, Math.min(255, Math.round(brightness)))
        pixelPin = pin; pixelCount = count; pixelColor = color; pixelLevel = brightness
        while (pixelBusy) basic.pause(1)
        pixelBusy = true
        slxInternal.prepare(pin)
        count = Math.floor(count)
        let data = pins.createBuffer(count * 3)
        let red = (color >> 16) & 255
        let green = (color >> 8) & 255
        let blue = color & 255
        for (let i = 0; i < count; i++) {
            data[i * 3] = Math.idiv(green * brightness, 255)
            data[i * 3 + 1] = Math.idiv(red * brightness, 255)
            data[i * 3 + 2] = Math.idiv(blue * brightness, 255)
        }
        displayOK = slxNative.showPixels(pin, data)
        // CODAL WS2812B::play blocks until its DMA stream consumes the frame. Yield between frames.
        basic.pause(5)
        pixelBusy = false
    }
    // Internal diagnostic for text programs, no extra student-facing status block.
    export function lastDisplayAvailable(): boolean { return displayOK }
}
