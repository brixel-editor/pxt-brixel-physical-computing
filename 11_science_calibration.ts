namespace Sensors03 {
    let currentPins: number[] = []
    let currentZeros: number[] = []
    let currentCountsPerAmp: number[] = []
    /** a-032 WCS2801: power from 3.3V. Disconnect measured current before zeroing, then calibrate a known current again. A new zero clears the old sensitivity. Lost on restart. */
    //%  block="zero current sensor pin $pin" group="전류 센서(WCS2801)" pin.defl=AnalogPin.P1
    export function zeroCurrent(pin: AnalogPin): void {
        let index = currentPins.indexOf(pin)
        if (index < 0) { index = currentPins.length; currentPins.push(pin); currentZeros.push(-1); currentCountsPerAmp.push(0) }
        currentZeros[index] = -1; currentCountsPerAmp[index] = 0
        let raw = BrixelInternal.calibrationAnalog(pin)
        if (raw > 0 && raw < 1023) currentZeros[index] = raw
    }
    /** After zeroing, apply a known DC current measured by a reference meter. Sensitivity varies with supply voltage and module. */
    //%  block="current pin $pin calibrate reference $amps A" group="전류 센서(WCS2801)"
    //% pin.defl=AnalogPin.P1 amps.defl=0.5
    export function calibrateCurrent(pin: AnalogPin, amps: number): void {
        let index = currentPins.indexOf(pin)
        if (index < 0) return
        currentCountsPerAmp[index] = 0
        if (currentZeros[index] < 0 || !BrixelInternal.finite(amps) || Math.abs(amps) < 0.05 || Math.abs(amps) > 1) return
        let raw = BrixelInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023 || Math.abs(raw - currentZeros[index]) < 5) return
        currentCountsPerAmp[index] = (raw - currentZeros[index]) / amps
    }
    /** WCS2801 1A module, 3.3V supply. Zero and calibrate with a known current first. Failure/outside ±1A=-9999. */
    //%  block="current sensor pin $pin (A)" group="전류 센서(WCS2801)" pin.defl=AnalogPin.P1
    export function currentAmps(pin: AnalogPin): number {
        let index = currentPins.indexOf(pin)
        if (index < 0 || currentCountsPerAmp[index] == 0) return -9999
        let raw = BrixelInternal.analog(pin)
        if (raw <= 0 || raw >= 1023) return -9999
        let amps = (raw - currentZeros[index]) / currentCountsPerAmp[index]
        return Math.abs(amps) <= 1 ? amps : -9999
    }
}

namespace Sensors03 {
    let voltagePins: number[] = []
    let voltagePerCount: number[] = []
    /** A_034 voltage divider signal to the selected micro:bit analog pin. Raw 0..1023, no calibration needed. Signal must stay within 0..3.3V and board supply; never connect the measured voltage directly. Invalid pin=-1. */
    //%  block="voltage sensor pin $pin raw value" group="전압센서(Voltage Sensor)" weight=90
    //% pin.defl=AnalogPin.P1
    export function voltageRaw(pin: AnalogPin): number { return BrixelInternal.analog(pin) }

    /** Apply a known positive DC voltage through the divider and capture its analog value. The safe measured range depends on the divider and input voltage limit, not the module's 25V label. Reference 0.1..25V; raw 5..1022 required. Per-pin calibration resets on program restart. */
    //%  block="voltage sensor pin $pin calibrate at $voltage V" group="전압센서(Voltage Sensor)" weight=70
    //% pin.defl=AnalogPin.P1 voltage.defl=5 voltage.min=0.1 voltage.max=25
    export function calibrateVoltage(pin: AnalogPin, voltage: number): void {
        let index = voltagePins.indexOf(pin)
        if (index >= 0) voltagePerCount[index] = 0
        if (!BrixelInternal.finite(voltage) || voltage < 0.1 || voltage > 25) return
        let raw = BrixelInternal.calibrationAnalog(pin)
        if (raw < 5 || raw >= 1023) return
        if (index < 0) { index = voltagePins.length; voltagePins.push(pin); voltagePerCount.push(0) }
        voltagePerCount[index] = voltage / raw
    }

    /** DC voltage calculated from the selected analog pin after reference calibration. Raw 0 is a valid zero voltage. Missing calibration, invalid pin, ADC saturation or outside 0..25V=-1. Actual safe input range depends on the divider. */
    //%  block="voltage sensor pin $pin voltage (V)" group="전압센서(Voltage Sensor)" weight=80
    //% pin.defl=AnalogPin.P1
    export function voltageCalibrated(pin: AnalogPin): number {
        let index = voltagePins.indexOf(pin)
        if (index < 0 || voltagePerCount[index] <= 0) return -1
        let raw = voltageRaw(pin)
        if (raw < 0 || raw >= 1023) return -1
        let result = raw * voltagePerCount[index]
        return result <= 25 ? result : -1
    }
}
namespace Sensors03 {
    let turbidityPins: number[] = []
    let clearWaterCounts: number[] = []
    /** A_013/A_014 turbidity module signal to the selected micro:bit analog pin. Raw 0..1023, no calibration needed; not NTU. Signal must stay within 0..3.3V and board supply. Invalid pin=-1; disconnection cannot be reliably detected. */
    //%  block="turbidity sensor pin $pin raw value" group="탁도(Turbidity)" weight=90
    //% pin.defl=AnalogPin.P1
    export function turbidityRaw(pin: AnalogPin): number { return BrixelInternal.analog(pin) }

    /** Put the probe in clear water, shield ambient light and capture the selected analog input. Raw 5..1022 required. Invalid recalibration clears the old reference on that pin. Calibration resets on program restart. */
    //%  block="turbidity sensor pin $pin calibrate clear water" group="탁도(Turbidity)" weight=70
    //% pin.defl=AnalogPin.P1
    export function calibrateTurbidity(pin: AnalogPin): void {
        let index = turbidityPins.indexOf(pin)
        if (index >= 0) clearWaterCounts[index] = 0
        let raw = BrixelInternal.calibrationAnalog(pin)
        if (raw < 5 || raw >= 1023) return
        if (index < 0) { index = turbidityPins.length; turbidityPins.push(pin); clearWaterCounts.push(0) }
        clearWaterCounts[index] = raw
    }

    /** Relative transmission from the analog signal: clear water=100%, lower means cloudier. Not NTU. Raw zero is valid 0%. Missing calibration, invalid pin, ADC saturation or over 120%=-1. */
    //%  block="turbidity sensor pin $pin transmission (percent)" group="탁도(Turbidity)" weight=80
    //% pin.defl=AnalogPin.P1
    export function turbidityTransmission(pin: AnalogPin): number {
        let index = turbidityPins.indexOf(pin)
        if (index < 0 || clearWaterCounts[index] <= 0) return -1
        let raw = turbidityRaw(pin)
        if (raw < 0 || raw >= 1023) return -1
        let result = raw * 100 / clearWaterCounts[index]
        return result <= 120 ? result : -1
    }
}

namespace Sensors03 {
    let dustBusy = false
    let dustLastAt = -100
    /** A_016/017/018 Sharp-style analog dust kit: VO to a protected ADC pin, LED control to a digital pin. Needs 5V sensor power, VO voltage scaling and a voltage-compatible LED driver. Mean of 8 pulses, raw 0..1023, not PM2.5 or ug/m3. Timing/ADC streaming conflict=-1. */
    //%  block="analog dust sensor signal $signal LED $lamp raw value" group="미세먼지(GP2Y1014AU0F)"
    //% signal.defl=AnalogPin.P1 lamp.defl=DigitalPin.P8
    export function analogDustRaw(signal: AnalogPin, lamp: DigitalPin): number {
        if (!BrixelInternal.validDigital(lamp) || <number>signal == <number>lamp ||
            (signal != AnalogPin.P0 && signal != AnalogPin.P1 && signal != AnalogPin.P2 &&
             signal != AnalogPin.P3 && signal != AnalogPin.P4 && signal != AnalogPin.P10)) return -1
        while (dustBusy) basic.pause(1)
        dustBusy = true
        BrixelInternal.prepare(signal); BrixelInternal.prepare(lamp)
        let sum = 0
        let valid = true
        for (let i = 0; i < 8; i++) {
            let wait = 10 - (control.millis() - dustLastAt)
            if (wait > 0) basic.pause(wait)
            dustLastAt = control.millis()
            let sample = BrixelNative.sampleDust(signal, lamp)
            if (sample < 0 || sample > 1023) { valid = false; break }
            sum += sample
        }
        dustBusy = false
        return valid ? Math.round(sum / 8) : -1
    }
}
