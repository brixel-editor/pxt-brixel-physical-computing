// ⚠ 자동 생성 — 사이언스랩 motion-i2c.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxAxis {
    X = 0,
    Y = 1,
    Z = 2
}
enum SlxMotionValue {
    Acceleration = 0,
    Gyro = 1
}
enum SlxTilt {
    Roll = 0,
    Pitch = 1
}
enum SlxGravityReference {
    Positive = 0,
    Negative = 1
}
enum SlxColorChannel {
    Red = 0,
    Green = 1,
    Blue = 2,
    Clear = 3
}
namespace slxMotion {
    let mpuReady = false
    let mpuAt = -1000
    let mpuFrame: Buffer = null
    let gyroOffsets: number[] = [0, 0, 0]
    let gyroCalibrationFailed = false
    let accelPositive: number[] = [0, 0, 0]
    let accelNegative: number[] = [0, 0, 0]
    let accelCalibrated: boolean[] = [false, false, false]
    function mpuInit(): boolean {
        let id = slxBus.register(0x68, 0x75, 1)
        if (!id || id[0] != 0x68) return false
        if (!slxBus.write(0x68, [0x6B, 1])) return false
        basic.pause(100)
        return slxBus.write(0x68, [0x19, 0]) && slxBus.write(0x68, [0x1A, 0]) &&
            slxBus.write(0x68, [0x1B, 8]) && slxBus.write(0x68, [0x1C, 0])
    }
    /** i2c-007: I2C MPU6050, ±2 g / ±500 °/s. Same-address RTC cannot share the bus. Failure=-999. */
    export function mpu6050(value: SlxMotionValue, axis: SlxAxis): number {
        if (axis < 0 || axis > 2 || axis != Math.floor(axis) || (value != 0 && value != 1)) return -999
        slxBus.acquire()
        if (control.millis() - mpuAt >= 20) {
            if (!mpuReady) mpuReady = mpuInit()
            mpuFrame = mpuReady ? slxBus.register(0x68, 0x3B, 14) : null
            if (!mpuFrame) mpuReady = false
            mpuAt = control.millis()
        }
        let result = -999
        if (mpuFrame) {
            if (value == SlxMotionValue.Acceleration) {
                result = slxBus.signedBE(mpuFrame, axis * 2) / 16384
                if (accelCalibrated[axis]) {
                    if (accelPositive[axis] <= 0 || accelNegative[axis] >= 0) result = -999
                    else result = (result - (accelPositive[axis] + accelNegative[axis]) / 2) * 2 / (accelPositive[axis] - accelNegative[axis])
                }
            } else if (!gyroCalibrationFailed) result = slxBus.signedBE(mpuFrame, 8 + axis * 2) / 65.5 - gyroOffsets[axis]
        }
        slxBus.release()
        return result
    }
    /** v0.8.0 tilt angle in degrees from gravity: roll = atan2(ay, az), pitch = atan2(−ax, √(ay²+az²)) — same formulas as the BrixelAI DSL micro:bit firmware (anx/any). Sensor missing=-999. */
    export function mpu6050Tilt(dir: SlxTilt): number {
        let ax = mpu6050(SlxMotionValue.Acceleration, SlxAxis.X)
        let ay = mpu6050(SlxMotionValue.Acceleration, SlxAxis.Y)
        let az = mpu6050(SlxMotionValue.Acceleration, SlxAxis.Z)
        if (ax == -999 || ay == -999 || az == -999) return -999
        let rad = dir == SlxTilt.Roll ? Math.atan2(ay, az) : Math.atan2(-ax, Math.sqrt(ay * ay + az * az))
        return Math.round(rad * 18000 / Math.PI) / 100
    }
    /** Keep MPU6050 still for about one second. Only gyro zero is adjusted; gravity remains in acceleration. */
    export function zeroGyro(): void {
        slxBus.acquire()
        gyroCalibrationFailed = true
        if (!mpuReady) mpuReady = mpuInit()
        let sum = [0, 0, 0]
        let low = [1000, 1000, 1000], high = [-1000, -1000, -1000]
        let ok = mpuReady
        for (let i = 0; i < 50 && ok; i++) {
            let data = slxBus.register(0x68, 0x3B, 14)
            if (!data) { ok = false; break }
            for (let axis = 0; axis < 3; axis++) {
                let speed = slxBus.signedBE(data, 8 + axis * 2) / 65.5
                sum[axis] += speed; low[axis] = Math.min(low[axis], speed); high[axis] = Math.max(high[axis], speed)
            }
            basic.pause(20)
        }
        for (let axis = 0; axis < 3; axis++) if (high[axis] - low[axis] > 5) ok = false
        if (ok) {
            for (let axis = 0; axis < 3; axis++) gyroOffsets[axis] = sum[axis] / 50
            gyroCalibrationFailed = false
        }
        mpuFrame = null
        mpuAt = -1000
        slxBus.release()
    }
    /** For each axis, point its positive arrow straight up (+1g), then straight down (-1g), keeping still for 1s each. Six captures correct axis offset/scale, not misalignment. Gravity is retained. Partial/failed calibration=-999 on that axis. Lost on restart. */
    export function calibrateAcceleration(axis: SlxAxis, reference: SlxGravityReference): void {
        if (axis < 0 || axis > 2 || axis != Math.floor(axis)) return
        slxBus.acquire()
        accelCalibrated[axis] = true
        if (reference == 0 || reference != 1) { accelPositive[axis] = 0; accelNegative[axis] = 0 }
        else accelNegative[axis] = 0
        let ok = reference == 0 || reference == 1
        if (ok && !mpuReady) mpuReady = mpuInit()
        ok = ok && mpuReady
        let sum = 0, low = 3, high = -3
        for (let i = 0; i < 50 && ok; i++) {
            let data = slxBus.register(0x68, 0x3B, 14)
            if (!data) { ok = false; break }
            let g = slxBus.signedBE(data, axis * 2) / 16384
            if ((reference == 0 && (g < 0.7 || g > 1.3)) || (reference == 1 && (g < -1.3 || g > -0.7))) { ok = false; break }
            sum += g; low = Math.min(low, g); high = Math.max(high, g)
            basic.pause(20)
        }
        if (ok && high - low <= 0.05) {
            if (reference == 0) accelPositive[axis] = sum / 50
            else accelNegative[axis] = sum / 50
        }
        mpuFrame = null; mpuAt = -1000
        slxBus.release()
    }
    let weightAddress = 0x63
    /** v0.8.0 I2C address of the BRIXEL weight module (HX711 + I2C, default 99 = 0x63). Same as the BrixelAI DSL micro:bit card's weight setup. */
    export function setWeightAddress(addr: number): void {
        let n = Math.round(addr)
        if (n >= 1 && n <= 127) weightAddress = n
    }
    /** v0.8.0 True when the weight module answers with a valid frame. */
    export function weightAvailable(): boolean { return weight() >= 0 }
    /** i2c-010 MCU/HX711 module, I2C address 0x63; connect its load-cell plate. The module sends whole grams and zeros itself when its power comes on, so keep the plate empty at power-on. No reply=-1. */
    export function weight(): number {
        slxBus.acquire()
        // This module is a stream, not a register device. Never write a probe register or tare opcode.
        // Read with the core call, which ignores the I2C status: on micro:bit V2 this module's (ATmega slave)
        // reply ends with a status CODAL reports as an error although the 3 bytes are valid, so
        // slxBus.read (status-checked) always failed (-1). Field-verified 10-09 via the physical-computing extension.
        // No device -> NACK -> zero buffer -> [0] != 0xFF. Floating lines -> FF FF FF -> rejected (real values stay < ~3.2kg).
        let data = pins.i2cReadBuffer(weightAddress, 3)
        let valid = data.length == 3 && data[0] == 0xFF && !(data[1] == 0xFF && data[2] == 0xFF)
        let result = valid ? slxBus.be16(data, 1) : -1
        slxBus.release()
        return result
    }
    /** a-028 joystick: connect the selected X or Y signal to a 3.3V analog pin. Returns 0..1023. */
    export function joystick(pin: SlxAnalogPin): number { return slxInternal.analog(pin) }
    /** v0.9.0 joystick direction (BRIXEL module, measured: up = Y 1023). Centre = both axes within ±188 of 512. */
    export function joystickDirection(px: SlxAnalogPin, py: SlxAnalogPin, dir: SlxJoystickDir): boolean {
        let x = slxInternal.analog(px), y = slxInternal.analog(py)
        if (x < 0 || y < 0) return false
        x -= 512; y -= 512
        let ox = Math.abs(x) > 188, oy = Math.abs(y) > 188
        let now = SlxJoystickDir.Center
        if (ox && (!oy || Math.abs(x) >= Math.abs(y))) now = x < 0 ? SlxJoystickDir.Left : SlxJoystickDir.Right
        else if (oy) now = y > 0 ? SlxJoystickDir.Up : SlxJoystickDir.Down
        return now == dir
    }
    /** v0.8.0 joystick push button. v0.8.4: hidden — the BRIXEL joystick module (A_028) has no button (pins G/V/X/Y). Kept for saved projects. */
    export function joystickButton(pin: SlxDigitalPin): boolean { return slxInternal.digital(pin) == 1 }
}
namespace slxDetection {
    let ultrasonicTemperature = 20
    let ultrasonicPairs: number[] = []
    let ultrasonicOffsets: number[] = []
    /** Ambient air temperature for sound-speed compensation (0..50 C). Default 20 C. Not suitable for water. Invalid input disables distance until a valid temperature is supplied. Lost on restart. */
    export function setUltrasonicTemperature(temperature: number): void {
        ultrasonicTemperature = slxInternal.finite(temperature) && temperature >= 0 && temperature <= 50 ? temperature : -999
    }
    /** Set temperature first, then measure a flat perpendicular target with a ruler (10..300cm). Captures 8 echoes to correct a small mounting offset (within 10cm), not reflectivity or sound speed. Lost on restart; failed capture makes this pair unavailable until recalibrated. */
    export function calibrateUltrasonic(trigger: SlxDigitalPin, echo: SlxDigitalPin, cm: number): void {
        if (!slxInternal.validDigital(trigger) || !slxInternal.validDigital(echo) || trigger == echo) return
        let key = trigger * 1000 + echo
        let index = ultrasonicPairs.indexOf(key)
        if (index < 0) { index = ultrasonicPairs.length; ultrasonicPairs.push(key); ultrasonicOffsets.push(-999) }
        ultrasonicOffsets[index] = -999
        if (!slxInternal.finite(cm) || cm < 10 || cm > 300) return
        let sum = 0, low = 1000, high = 0
        for (let i = 0; i < 8; i++) {
            let value = ultrasonicRaw(trigger, echo)
            if (value < 0) return
            sum += value; low = Math.min(low, value); high = Math.max(high, value)
            basic.pause(60)
        }
        let offset = cm - sum / 8
        if (high - low <= 2 && Math.abs(offset) <= 10) ultrasonicOffsets[index] = offset
    }
    let colorReady = false
    let colorAt = -1000
    let colorFrame: Buffer = null
    function colorInit(): boolean {
        let id = slxBus.register(0x29, 0x92, 1)
        if (!id || (id[0] != 0x44 && id[0] != 0x4D)) return false
        if (!slxBus.write(0x29, [0x80, 1])) return false
        basic.pause(3)
        if (!slxBus.write(0x29, [0x81, 0xC0]) || !slxBus.write(0x29, [0x8D, 0]) ||
            !slxBus.write(0x29, [0x8F, 2]) || !slxBus.write(0x29, [0x80, 3])) return false
        basic.pause(160)
        return true
    }
    /** i2c-012 TCS34725: I2C, raw light counts 0..65535. Do not share address 0x29 with VL53L0X. Failure=-1. */
    export function color(channel: SlxColorChannel): number {
        if (channel < 0 || channel > 3) return -1
        slxBus.acquire()
        if (control.millis() - colorAt >= 160) {
            colorFrame = null
            if (!colorReady) colorReady = colorInit()
            if (colorReady) {
                let status = slxBus.register(0x29, 0x93, 1)
                if (status && (status[0] & 1)) colorFrame = slxBus.register(0x29, 0xB4, 8)
                if (!status) colorReady = false
            }
            colorAt = control.millis()
        }
        let result = colorFrame ? slxBus.u16(colorFrame, channel == SlxColorChannel.Clear ? 0 : 2 + channel * 2) : -1
        slxBus.release()
        return result
    }
    /** v0.8.0 color name number: 0 red · 1 orange · 2 yellow · 3 green · 4 blue · 5 purple · 6 white · 7 black (same numbers as the BrixelAI DSL micro:bit card). Rules from BRIXEL Physical Computing v0.2.0. Sensor missing=-1. */
    export function colorName(): number {
        let c = color(SlxColorChannel.Clear)
        let r0 = color(SlxColorChannel.Red), g0 = color(SlxColorChannel.Green), b0 = color(SlxColorChannel.Blue)
        if (c < 0 || r0 < 0 || g0 < 0 || b0 < 0) return -1
        if (c < 600) return 7
        let d = c > 0 ? c : 1
        let r = Math.min(255, Math.round(r0 * 255 / d)), g = Math.min(255, Math.round(g0 * 255 / d)), b = Math.min(255, Math.round(b0 * 255 / d))
        if (Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b)) < 30) return 6
        if (r >= g && r > b) return g > b + 60 ? 2 : g > b + 25 ? 1 : 0
        if (g > r && g > b) return 3
        if (b > r && b > g) return r > g + 30 ? 5 : 4
        return 6
    }
    /** v0.9.1 color as a word: 빨강·주황·노랑·초록·파랑·보라·흰색·검정 (same order as the color number), «없음» when the sensor is not connected. Hold the object about 1 cm in front. */
    export function colorNameText(): string {
        let n = colorName()
        if (n < 0 || n > 7) return "없음"
        return ["빨강", "주황", "노랑", "초록", "파랑", "보라", "흰색", "검정"][n]
    }
    /** Two-signal ultrasonic only: connect separate TRIG and ECHO. A 3-pin single-signal module requires another protocol and is not supported here. Level-shift 5V ECHO. No echo=-1 cm. */
    export function ultrasonic(trigger: SlxDigitalPin, echo: SlxDigitalPin): number {
        let raw = ultrasonicRaw(trigger, echo)
        if (raw < 0) return -1
        let index = ultrasonicPairs.indexOf(trigger * 1000 + echo)
        let offset = index < 0 ? 0 : ultrasonicOffsets[index]
        let value = raw + offset
        return offset != -999 && value >= 0 ? Math.round(value * 100) / 100 : -1
    }
    function ultrasonicRaw(trigger: SlxDigitalPin, echo: SlxDigitalPin): number {
        if (!slxInternal.validDigital(trigger) || !slxInternal.validDigital(echo) || trigger == echo) return -1
        if (ultrasonicTemperature == -999) return -1
        slxInternal.prepare(trigger)
        slxInternal.prepare(echo)
        // Native polling measurement (slxNative.echoPulse), not pins.pulseIn: on V2 the
        // event-based pulseIn worked briefly and then returned only timeouts in field tests.
        // A single missed echo is common (soft or angled target); try up to 3 pings before reporting -1.
        let duration = 0
        for (let i = 0; i < 3 && duration <= 0; i++) {
            if (i > 0) basic.pause(60)
            duration = slxNative.echoPulse(trigger, echo, 30000)
        }
        return duration > 0 ? duration * (331 + 0.6 * ultrasonicTemperature) / 20000 : -1
    }
}
