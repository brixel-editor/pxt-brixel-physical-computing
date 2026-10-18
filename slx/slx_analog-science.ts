// ⚠ 자동 생성 — 사이언스랩 analog-science.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxCalibrationPoint {
    First = 0,
    Second = 1
}
namespace slxWeather {
    let ntcPins: number[] = []
    let ntcR25: number[] = []
    /** Capture a stable reference thermometer reading. One-point R25 correction for the documented B3950 divider only; not a B-value or wiring correction. Lost on restart. Failed capture invalidates this pin until recalibrated. */
    export function calibrateNTC(pin: SlxAnalogPin, temperature: number): void {
        let index = ntcPins.indexOf(pin)
        if (index < 0) { index = ntcPins.length; ntcPins.push(pin); ntcR25.push(0) }
        ntcR25[index] = 0
        if (!slxInternal.finite(temperature) || temperature < -20 || temperature > 100) return
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023) return
        // v0.8.4: BRIXEL NTC module (A_005) = VCC–10k–node–NTC–GND, so R_ntc = 10k × raw / (1023 − raw).
        let r25 = 10000 * raw / (1023 - raw) / Math.exp(3950 * (1 / (temperature + 273.15) - 1 / 298.15))
        if (r25 >= 5000 && r25 <= 20000) ntcR25[index] = r25
    }
    /** v0.9.0 BRIXEL high-temperature module (A_001 + probe A_002) analog value on a 3.3V port: hotter = larger (room ≈75, 75 °C water ≈210). */
    export function highTempRaw(pin: SlxAnalogPin): number { return slxInternal.analog(pin) }
    /** v0.9.0 probe tip temperature ≈ raw × 0.39 − 1.8 °C (BRIXEL module on 3.3V, fitted against a DS18B20 over 170 points, R² 0.98, about ±1.5 °C up to 77 °C). Above about 395 °C (raw ≥ 1020) = -1. Keep the wires and module away from the flame. */
    export function highTemp(pin: SlxAnalogPin): number {
        let raw = slxInternal.analog(pin)
        if (raw < 0 || raw >= 1020) return -1
        return Math.round((raw * 0.39 - 1.8) * 10) / 10
    }
    /** a-005: NTC 10kΩ/B3950 on the GND side with a 10kΩ resistor to VCC (BRIXEL module, corrected v0.8.4). Use 3.3V analog G/V/S. Module resistor orientation must match. Disconnected/rail reading=-127. */
    export function ntc(pin: SlxAnalogPin): number {
        let raw = slxInternal.analog(pin)
        if (raw <= 0 || raw >= 1023) return -127
        // v0.8.4 (field test 2026-10-17): the module has the NTC on the GND side — the old formula read 22.8 °C in a
        // 25–27 °C room and went DOWN when held (18.9 °C); with this formula 27.2 °C → 31.4 °C.
        let resistance = 10000 * raw / (1023 - raw)
        let index = ntcPins.indexOf(pin)
        let r25 = index < 0 ? 10000 : ntcR25[index]
        if (r25 <= 0) return -127
        return 1 / (1 / 298.15 + Math.log(resistance / r25) / 3950) - 273.15
    }
    let ptPins: number[] = []
    let ptRaw1: number[] = []
    let ptRaw2: number[] = []
    let ptTemp1: number[] = []
    let ptTemp2: number[] = []
    /** a-001 PT100 module: capture first, then second reference, at least 1 C and 5 ADC counts apart. A new first point clears the second; failed capture invalidates its point. Lost on restart. */
    export function calibratePT100(pin: SlxAnalogPin, point: SlxCalibrationPoint, temperature: number): void {
        let index = ptPins.indexOf(pin)
        if (index < 0) {
            index = ptPins.length; ptPins.push(pin)
            ptRaw1.push(-1); ptRaw2.push(-1); ptTemp1.push(0); ptTemp2.push(0)
        }
        if (point == SlxCalibrationPoint.First || (point != 0 && point != 1)) { ptRaw1[index] = -1; ptRaw2[index] = -1 }
        else ptRaw2[index] = -1
        if (!slxInternal.finite(temperature) || temperature < -200 || temperature > 850 || (point != 0 && point != 1)) return
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023) return
        if (point == SlxCalibrationPoint.First) { ptRaw1[index] = raw; ptTemp1[index] = temperature }
        else { ptRaw2[index] = raw; ptTemp2[index] = temperature }
    }
    /** PT100 analog module: first calibrate at two known temperatures. Linear estimate only within those points; unavailable/out-of-range=-9999 °C. */
    export function pt100(pin: SlxAnalogPin): number {
        let index = ptPins.indexOf(pin)
        if (index < 0 || ptRaw1[index] < 0 || ptRaw2[index] < 0 || Math.abs(ptRaw2[index] - ptRaw1[index]) < 5 || Math.abs(ptTemp2[index] - ptTemp1[index]) < 1) return -9999
        let raw = slxInternal.analog(pin)
        if (raw < Math.min(ptRaw1[index], ptRaw2[index]) || raw > Math.max(ptRaw1[index], ptRaw2[index])) return -9999
        return ptTemp1[index] + (raw - ptRaw1[index]) * (ptTemp2[index] - ptTemp1[index]) / (ptRaw2[index] - ptRaw1[index])
    }
}
namespace slxWater {
    let phPins: number[] = []
    let ph7: number[] = []
    let phOther: number[] = []
    let phReference: number[] = []
    /** Capture pH7 first, then pH4 for acidic experiments or pH10 for alkaline experiments. Wait until stable at the buffer's stated temperature. Calibration is lost on reset; failed captures invalidate the reference. */
    export function calibratePH(pin: SlxAnalogPin, reference: number): void {
        let index = phPins.indexOf(pin)
        if (index < 0) { index = phPins.length; phPins.push(pin); ph7.push(-1); phOther.push(-1); phReference.push(4) }
        if (reference == 7 || (reference != 7 && reference != 4 && reference != 10)) { ph7[index] = -1; phOther[index] = -1 }
        else phOther[index] = -1
        if (reference != 7 && reference != 4 && reference != 10) return
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023) return
        if (reference == 7) ph7[index] = raw
        else { phOther[index] = raw; phReference[index] = reference }
    }
    /** 3.3V analog pH module. Calibrate pH7 then pH4 or pH10 first. Outside those buffers is extrapolation, requiring separate validation. Failed/un-calibrated=-1; analog disconnection cannot be reliably detected. */
    export function ph(pin: SlxAnalogPin): number {
        let index = phPins.indexOf(pin)
        let raw = slxInternal.analog(pin)
        if (raw <= 0 || raw >= 1023) return -1
        // v0.8.0: before calibration use the BRIXEL E-201-C module default (pH7 = 1.65 V, 170 mV per pH,
        // higher voltage = more acidic) so the block works right away, like the BrixelAI DSL micro:bit card.
        if (index < 0 || ph7[index] < 0 || phOther[index] < 0) {
            let v = raw * 3.3 / 1023
            return Math.round(Math.max(0, Math.min(14, 7 + (1.65 - v) / 0.17)) * 100) / 100
        }
        if (Math.abs(phOther[index] - ph7[index]) < 5) return -1
        let value = 7 + (phReference[index] - 7) * (raw - ph7[index]) / (phOther[index] - ph7[index])
        return value >= 0 && value <= 14 ? value : -1
    }
    let tdsPins: number[] = []
    let tdsGains: number[] = []
    function tdsEstimate(raw: number, temperature: number): number {
        if (!slxInternal.finite(temperature) || temperature < 0 || temperature > 50 || raw < 0 || raw >= 1023) return -1
        let voltage = raw * 3.3 / 1023
        // Convert voltage to conductivity first, then compensate conductivity to 25 C.
        let value = (133.42 * voltage * voltage * voltage - 255.86 * voltage * voltage + 857.39 * voltage) * 0.5 / (1 + 0.02 * (temperature - 25))
        return slxInternal.finite(value) && value >= 0 ? value : -1
    }
    /** Use a known TDS standard stated at 25 C (ppm on factor 0.5), with actual water temperature. Stable capture; calibrate again after restart. Not an EC unit. Wrong/unstable references clear prior calibration. */
    export function calibrateTDS(pin: SlxAnalogPin, ppm: number, temperature: number): void {
        let index = tdsPins.indexOf(pin)
        if (index < 0) { index = tdsPins.length; tdsPins.push(pin); tdsGains.push(0) }
        tdsGains[index] = 0
        if (!slxInternal.finite(ppm) || ppm < 50 || ppm > 1000) return
        let estimate = tdsEstimate(slxInternal.calibrationAnalog(pin), temperature)
        if (estimate <= 0) return
        let gain = ppm / estimate
        if (gain >= 0.25 && gain <= 4) tdsGains[index] = gain
    }
    /** Gravity-compatible TDS estimate at 25 C, using actual water temperature 0..50 C. Calibrate with a standard first. Not EC or a direct dissolved-mass measurement. Uncalibrated, invalid or above 1000ppm=-1. */
    export function tds(pin: SlxAnalogPin, temperature: number): number {
        let index = tdsPins.indexOf(pin)
        // v0.8.0: before calibration use gain 1 (Gravity/DFRobot formula, EC x 0.5) like the BrixelAI DSL micro:bit card.
        let gain = index < 0 ? 1 : tdsGains[index]
        if (gain <= 0) return -1
        let estimate = tdsEstimate(slxInternal.analog(pin), temperature)
        if (estimate < 0) return -1
        let value = estimate * gain
        return value <= 1000 ? value : -1
    }
}
namespace slxWater {
    /** v0.8.0 electrical conductivity EC (μS/cm) = TDS ppm × 2 (factor 0.5), same calibration. Invalid=-1. */
    export function tdsEC(pin: SlxAnalogPin, temperature: number): number {
        let ppm = tds(pin, temperature)
        return ppm < 0 ? -1 : ppm * 2
    }
}
namespace slxElectric {
    let currentPins: number[] = []
    let currentZeros: number[] = []
    let currentCountsPerAmp: number[] = []
    /** a-032 WCS2801: power from 3.3V. Disconnect measured current before zeroing, then calibrate a known current again. A new zero clears the old sensitivity. Lost on restart. */
    export function zeroCurrent(pin: SlxAnalogPin): void {
        let index = currentPins.indexOf(pin)
        if (index < 0) { index = currentPins.length; currentPins.push(pin); currentZeros.push(-1); currentCountsPerAmp.push(0) }
        currentZeros[index] = -1; currentCountsPerAmp[index] = 0
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw > 0 && raw < 1023) currentZeros[index] = raw
    }
    /** After zeroing, apply a known DC current measured by a reference meter. Sensitivity varies with supply voltage and module. */
    export function calibrateCurrent(pin: SlxAnalogPin, amps: number): void {
        let index = currentPins.indexOf(pin)
        if (index < 0) return
        currentCountsPerAmp[index] = 0
        if (currentZeros[index] < 0 || !slxInternal.finite(amps) || Math.abs(amps) < 0.05 || Math.abs(amps) > 1) return
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023 || Math.abs(raw - currentZeros[index]) < 5) return
        currentCountsPerAmp[index] = (raw - currentZeros[index]) / amps
    }
    /** WCS2801 1A module, 3.3V supply. Zero and calibrate with a known current first. Failure/outside ±1A=-9999. */
    export function current(pin: SlxAnalogPin): number {
        let index = currentPins.indexOf(pin)
        if (index < 0 || currentCountsPerAmp[index] == 0) return -9999
        let raw = slxInternal.analog(pin)
        if (raw <= 0 || raw >= 1023) return -9999
        let amps = (raw - currentZeros[index]) / currentCountsPerAmp[index]
        return Math.abs(amps) <= 1 ? amps : -9999
    }
}

namespace slxElectric {
    let acsPins: number[] = []
    let acsZeroMv: number[] = []
    let acsSensitivity = 1000
    /** v0.8.0 ACS712 current module (BRIXEL 1A, 5V port): only P10 is a 5V analog pin on the micro:bit Shield V2. Run with no current flowing to store the zero point. */
    export function acs712Zero(pin: SlxAnalogPin): void {
        let raw = slxInternal.calibrationAnalog(pin)
        if (raw <= 0 || raw >= 1023) return
        let i = acsPins.indexOf(pin)
        if (i < 0) { acsPins.push(pin); acsZeroMv.push(raw * 3300 / 1023) }
        else acsZeroMv[i] = raw * 3300 / 1023
    }
    /** v0.8.0 sensitivity in mV per A: BRIXEL 1A module 1000 (default) · 5A 185 · 20A 100 · 30A 66. */
    export function acs712Sensitivity(mv: number): void { if (mv > 0) acsSensitivity = mv }
    /** v0.8.0 current in mA = |mV − zero mV| × 1000 ÷ sensitivity (same as the BrixelAI DSL micro:bit card). Without zero, 2500 mV is used. Invalid pin or ADC at the rail=-1. */
    export function acs712(pin: SlxAnalogPin): number {
        let raw = slxInternal.analog(pin)
        if (raw < 0 || raw >= 1023) return -1
        let i = acsPins.indexOf(pin)
        let zero = i < 0 ? 2500 : acsZeroMv[i]
        return Math.round(Math.abs(raw * 3300 / 1023 - zero) * 1000 / acsSensitivity)
    }
}
