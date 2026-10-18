// Sensor wrappers adapted from BRIXEL Science Lab v0.6.1 (MIT).

namespace Sensors03 {
    /** a-006: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="light sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function light(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 brightness 0..100% = raw ÷ 1023 (BRIXEL CdS: brighter = larger). -1 = invalid pin. */
    //%  block="light sensor $pin brightness (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function lightPercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 1023) }
    /** a-007: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="UV sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function uvRaw(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-030: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="sound sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function sound(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 loudness = largest − smallest of 200 readings in about 20 ms. Quiet = small, clap = large. -1 = invalid pin. */
    //%  block="sound sensor $pin loudness" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function soundLevel(pin: AnalogPin): number { return BrixelInternal.swing(pin, 200, 100) }
}

namespace Sensors03 {
    /** a-008: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="soil moisture sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function soilMoisture(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 moisture 0..100% = raw ÷ 550 (BRIXEL resistive soil sensor, wetter = larger: air 0 → 0%, fully in water ≈550 → 100%). Push it in to the same depth each time. -1 = invalid pin. */
    //%  block="soil moisture sensor $pin moisture (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function soilPercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 550) }
    /** a-015: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="water sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function water(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 water level 0..100% = raw ÷ 1023 (deeper = larger). -1 = invalid pin. */
    //%  block="water sensor $pin level (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function waterPercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 1023) }
    /** 2025 orders Sheet1 E26: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="rain sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    //% blockHidden=true
    export function rain(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
}

namespace Sensors03 {
    /** a-019: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="vibration sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function vibration(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 shake strength = largest − smallest of 50 readings in about 50 ms (piezo swings around a middle value). -1 = invalid pin. */
    //%  block="vibration sensor $pin shake strength" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function vibrationStrength(pin: AnalogPin): number { return BrixelInternal.swing(pin, 50, 1000) }
    /** a-021: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="magnet sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function magnet(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 magnet pole (BRIXEL Hall module, measured): below 436 = N, above 496 = S, between = no magnet. */
    //%  block="magnet sensor $pin pole is $pole" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function magnetPole(pin: AnalogPin, pole: BrixelMagnetPole): boolean {
        let v = BrixelInternal.analog(pin)
        if (v < 0) return false
        let now = v < 436 ? BrixelMagnetPole.North : (v > 496 ? BrixelMagnetPole.South : BrixelMagnetPole.None)
        return now == pole
    }
    /** a-023: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="force sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function force(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 press strength 0..100% = raw ÷ 800 (BRIXEL FSR402: not pressed 0 · squeezed hard ≈750). -1 = invalid pin. */
    //%  block="force sensor $pin strength (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function forcePercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 800) }
    /** a-025: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="rotation sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function rotation(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 knob position 0..100% = raw ÷ 1023. -1 = invalid pin. */
    //%  block="rotation sensor $pin position (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function rotationPercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 1023) }
    /** a-026: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="continuous rotation sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    //% blockHidden=true
    export function infiniteRotation(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-027: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="slider sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function slider(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 slider position 0..100% = raw ÷ 1023. -1 = invalid pin. */
    //%  block="slider sensor $pin position (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function sliderPercent(pin: AnalogPin): number { return BrixelInternal.percentOf(pin, 0, 1023) }
}

namespace Sensors03 {
    /** a-022: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="4-pad analog touch sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function analogTouch(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-029: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="line sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function line(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    let lineRefPins: number[] = []
    let lineWhite: number[] = []
    let lineBlack: number[] = []
    function lineRefIndex(pin: number): number {
        let i = lineRefPins.indexOf(pin)
        // 기본값 = BRIXEL TCRT5000 실측(3.3V, 바닥에서 5mm): 흰 종이 ≈27 · 검정 ≈50
        if (i < 0) { i = lineRefPins.length; lineRefPins.push(pin); lineWhite.push(27); lineBlack.push(50) }
        return i
    }
    /** v0.5.0 hold the sensor 3~5 mm above white paper (or the black line) and run once each; 10 readings averaged. Lost on restart. */
    //%  block="line sensor $pin calibrate $ref" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function lineCalibrate(pin: AnalogPin, ref: BrixelLineRef): void {
        let i = lineRefIndex(pin), sum = 0
        for (let k = 0; k < 10; k++) { let v = BrixelInternal.analog(pin); if (v < 0) return; sum += v }
        if (ref == BrixelLineRef.White) lineWhite[i] = sum / 10
        else lineBlack[i] = sum / 10
    }
    /** v0.5.0 true when the reading is closer to the black reference (defaults at 5 mm: white 27 · black 50). */
    //%  block="line sensor $pin on black line" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function lineOnBlack(pin: AnalogPin): boolean {
        let i = lineRefIndex(pin)
        let v = BrixelInternal.analog(pin)
        if (v < 0) return false
        let mid = (lineWhite[i] + lineBlack[i]) / 2
        return lineBlack[i] >= lineWhite[i] ? v > mid : v < mid
    }
    /** a-031: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="IR object sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function object(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** v0.5.0 nearness 0..100% (BRIXEL IR object module, analog, measured: nothing in front ≈570 → 0%, 2 cm ≈45 → 100%). -1 = invalid pin. */
    //%  block="IR object sensor $pin nearness (percent)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function objectNear(pin: AnalogPin): number {
        let v = BrixelInternal.analog(pin)
        if (v < 0) return -1
        return Math.max(0, Math.min(100, Math.round((570 - v) * 100 / 525)))
    }
    /** v0.5.0 joystick direction (BRIXEL module, measured: up = Y 1023). Centre = both axes within ±188 of 512. */
    //%  block="joystick X $px Y $py direction is $dir" group="아날로그 입력"
    //% px.defl=AnalogPin.P0 py.defl=AnalogPin.P1
    export function joystickXYIs(px: AnalogPin, py: AnalogPin, dir: BrixelJoystickDir): boolean {
        let x = BrixelInternal.analog(px), y = BrixelInternal.analog(py)
        if (x < 0 || y < 0) return false
        x -= 512; y -= 512
        let ox = Math.abs(x) > 188, oy = Math.abs(y) > 188
        let now = BrixelJoystickDir.Center
        if (ox && (!oy || Math.abs(x) >= Math.abs(y))) now = x < 0 ? BrixelJoystickDir.Left : BrixelJoystickDir.Right
        else if (oy) now = y > 0 ? BrixelJoystickDir.Up : BrixelJoystickDir.Down
        return now == dir
    }
    /** v0.5.0 BRIXEL high-temperature module (A_001 + probe A_002) on a 3.3V port: tip temperature ≈ raw × 0.39 − 1.8 °C (fitted against a DS18B20, about ±1.5 °C up to 77 °C). Above about 395 °C (raw ≥ 1020) = -1. */
    //%  block="high temperature sensor $pin temperature (°C)" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function highTempC(pin: AnalogPin): number {
        let raw = BrixelInternal.analog(pin)
        if (raw < 0 || raw >= 1020) return -1
        return Math.round((raw * 0.39 - 1.8) * 10) / 10
    }
    /** d-017~020: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="button $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function button(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-021: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="rocker switch $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function switchValue(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-022~026: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="touch sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function touch(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-013: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="human presence sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function human(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-015: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="tilt sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function tilt(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-016: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="digital vibration sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function vibrationDigital(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-010: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="water level sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function waterLevel(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-012: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="photointerrupter $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    //% blockHidden=true
    export function photoGate(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-027: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="flame sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function flame(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
}
