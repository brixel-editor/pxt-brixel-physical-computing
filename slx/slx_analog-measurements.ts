// ⚠ 자동 생성 — 사이언스랩 analog-measurements.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
namespace slxElectric {
    let voltagePins: number[] = []
    let voltagePerCount: number[] = []
    /** A_034 voltage divider signal to the selected micro:bit analog pin. Raw 0..1023, no calibration needed. Signal must stay within 0..3.3V and board supply; never connect the measured voltage directly. Invalid pin=-1. */
    export function voltageRaw(pin: SlxAnalogPin): number { return slxInternal.analog(pin) }

    /** Apply a known positive DC voltage through the divider and capture its analog value. The safe measured range depends on the divider and input voltage limit, not the module's 25V label. Reference 0.1..25V; raw 5..1022 required. Per-pin calibration resets on program restart. */
    export function calibrateVoltage(pin: SlxAnalogPin, voltage: number): void {
        let index = voltagePins.indexOf(pin)
        if (index >= 0) voltagePerCount[index] = 0
        if (!slxInternal.finite(voltage) || voltage < 0.1 || voltage > 25) return
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw < 5 || raw >= 1023) return
        if (index < 0) { index = voltagePins.length; voltagePins.push(pin); voltagePerCount.push(0) }
        voltagePerCount[index] = voltage / raw
    }

    /** DC voltage calculated from the selected analog pin after reference calibration. Raw 0 is a valid zero voltage. Missing calibration, invalid pin, ADC saturation or outside 0..25V=-1. Actual safe input range depends on the divider. */
    export function voltage(pin: SlxAnalogPin): number {
        let index = voltagePins.indexOf(pin)
        let raw = voltageRaw(pin)
        if (raw < 0 || raw >= 1023) return -1
        // v0.8.0: before calibration use the BRIXEL divider ratio 5:1 (0..16.5 V), like the BrixelAI DSL micro:bit card.
        if (index < 0) return Math.round(raw * 3.3 / 1023 * 5 * 100) / 100
        if (voltagePerCount[index] <= 0) return -1
        let result = raw * voltagePerCount[index]
        return result <= 25 ? result : -1
    }
}
namespace slxWater {
    let turbidityPins: number[] = []
    let clearWaterCounts: number[] = []
    /** A_013/A_014 turbidity module signal to the selected micro:bit analog pin. Raw 0..1023, no calibration needed; not NTU. Signal must stay within 0..3.3V and board supply. Invalid pin=-1; disconnection cannot be reliably detected. */
    export function turbidityRaw(pin: SlxAnalogPin): number { return slxInternal.analog(pin) }

    /** Put the probe in clear water, shield ambient light and capture the selected analog input. Raw 5..1022 required. Invalid recalibration clears the old reference on that pin. Calibration resets on program restart. */
    export function calibrateTurbidity(pin: SlxAnalogPin): void {
        let index = turbidityPins.indexOf(pin)
        if (index >= 0) clearWaterCounts[index] = 0
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw < 5 || raw >= 1023) return
        if (index < 0) { index = turbidityPins.length; turbidityPins.push(pin); clearWaterCounts.push(0) }
        clearWaterCounts[index] = raw
    }

    /** Light passing through the water: clear water = 100%, cloudier = lower (milk ≈ 8%). Not NTU. Before calibration clear water = 800 (BRIXEL AZDM01 on the 5V port P10). Invalid pin, ADC saturation or over 120% = -1. */
    export function turbidity(pin: SlxAnalogPin): number {
        let index = turbidityPins.indexOf(pin)
        // v0.9.0: 보정 전 기본 맑은 물 = 800 (브릭셀 AZDM01, 5V 포트 P10 실측: 맑은 물 ≈800 · 우유 ≈60 — DSL마빗 실기 E18)
        let clear = index < 0 || clearWaterCounts[index] <= 0 ? 800 : clearWaterCounts[index]
        let raw = turbidityRaw(pin)
        if (raw < 0 || raw >= 1023) return -1
        let result = raw * 100 / clear
        return result <= 120 ? Math.round(result) : -1
    }
    /** v0.9.1 cloudiness 0..100% = (clear − now) ÷ clear: clear water ≈ 0%, milk ≈ 90%, no light through = 100%. Clear water = your «calibrate clear water» value, otherwise 800 (BRIXEL AZDM01 on the 5V port P10). Out of the water reads like clear water (0%). -1 = invalid pin. */
    export function turbidityCloudiness(pin: SlxAnalogPin): number {
        let index = turbidityPins.indexOf(pin)
        let clear = index < 0 || clearWaterCounts[index] <= 0 ? 800 : clearWaterCounts[index]
        let raw = turbidityRaw(pin)
        if (raw < 0) return -1
        return Math.max(0, Math.min(100, Math.round((clear - raw) * 100 / clear)))
    }
}
