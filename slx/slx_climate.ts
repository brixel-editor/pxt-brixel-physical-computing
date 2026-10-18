// ⚠ 자동 생성 — 사이언스랩 climate.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxClimateValue {
    Temperature = 0,
    Humidity = 1
}
enum SlxPressureValue {
    Pressure = 0,
    Temperature = 1,
    Altitude = 2
}
enum SlxIRTemperature {
    Object = 0,
    Ambient = 1
}

namespace slxWeather {
    let shtAt = -1000
    let shtAddress = 0x44
    /** v0.8.0 SHT31/SHT30/GXHT30 I2C address: 68 (0x44, ADDR pin low, default) or 69 (0x45). */
    export function setSHT31Address(addr: number): void {
        if (addr == 0x44 || addr == 0x45) { shtAddress = addr; shtAt = -1000 }
    }
    let shtTemp = -127
    let shtHumidity = -1
    /** i2c-002: GXHT30/SHT30/SHT31 at I2C 0x44. Shared single-shot command, CRC and conversion verified in GXHT30 datasheet sections 7.3/7.11/7.12. Failed temperature=-127, humidity=-1. */
    export function sht31(value: SlxClimateValue): number {
        slxBus.acquire()
        if (control.millis() - shtAt >= 100) {
            shtTemp = -127
            shtHumidity = -1
            // GXHT30 and SHT3x high-repeatability single shot (no clock stretching).
            if (slxBus.write(shtAddress, [0x24, 0x00])) {
                basic.pause(16)
                let data = slxBus.read(shtAddress, 6)
                if (data && slxBus.crc8(data, 0, 2, 255, 0x31) == data[2] &&
                    slxBus.crc8(data, 3, 2, 255, 0x31) == data[5]) {
                    shtTemp = -45 + 175 * slxBus.be16(data, 0) / 65535
                    shtHumidity = 100 * slxBus.be16(data, 3) / 65535
                }
            }
            shtAt = control.millis()
        }
        let result = value == SlxClimateValue.Temperature ? shtTemp : shtHumidity
        slxBus.release()
        return result
    }

    let bmpAddress = 0
    let bmpCalibration: Buffer = null
    let bmpAt = -1000
    let bmpTemp = -127
    let bmpPressure = -1
    let bmpSeaLevel = 1013.25
    /** Set the local sea-level pressure (QNH), not unadjusted station pressure. Affects altitude only. Default 1013.25 hPa is a standard-atmosphere estimate; setting is lost on restart. */
    export function setSeaLevelPressure(hpa: number): void {
        bmpSeaLevel = slxInternal.finite(hpa) && hpa >= 850 && hpa <= 1100 ? hpa : 0
    }
    // Bosch floating-point compensation, preserved from the BRIXEL BMP280 driver.
    function bmpInit(): boolean {
        for (let address = 0x76; address <= 0x77; address++) {
            let id = slxBus.register(address, 0xD0, 1)
            if (!id || id[0] != 0x58) continue
            if (!slxBus.write(address, [0xE0, 0xB6])) continue
            basic.pause(5)
            let cal = slxBus.register(address, 0x88, 24)
            if (!cal || slxBus.u16(cal, 0) == 0 || slxBus.u16(cal, 0) == 65535 ||
                slxBus.u16(cal, 6) == 0 || slxBus.u16(cal, 6) == 65535) continue
            if (!slxBus.write(address, [0xF4, 0x3F])) continue
            // v0.9.0: 1초에 한 번 + IIR 4 — 쉼 없이 재면 칩이 데워져 온도가 +5℃ 높았다(DSL마빗 실기 10-18). 온도 = 칩 온도.
            slxBus.write(address, [0xF5, 0xA8])
            bmpAddress = address
            bmpCalibration = cal
            basic.pause(100)
            return true
        }
        return false
    }
    export function compensateBMP(cal: Buffer, adcT: number, adcP: number): number[] {
        let t1 = slxBus.u16(cal, 0)
        let t2 = slxBus.s16(cal, 2)
        let t3 = slxBus.s16(cal, 4)
        let v1 = (adcT / 16384 - t1 / 1024) * t2
        let d = adcT / 131072 - t1 / 8192
        let fine = v1 + d * d * t3
        let temperature = fine / 5120
        v1 = fine / 2 - 64000
        let v2 = v1 * v1 * slxBus.s16(cal, 16) / 32768
        v2 += v1 * slxBus.s16(cal, 14) * 2
        v2 = v2 / 4 + slxBus.s16(cal, 12) * 65536
        v1 = (slxBus.s16(cal, 10) * v1 * v1 / 524288 + slxBus.s16(cal, 8) * v1) / 524288
        v1 = (1 + v1 / 32768) * slxBus.u16(cal, 6)
        if (v1 == 0) return [-127, -1]
        let pressure = ((1048576 - adcP) - v2 / 4096) * 6250 / v1
        v1 = slxBus.s16(cal, 22) * pressure * pressure / 2147483648
        v2 = pressure * slxBus.s16(cal, 20) / 32768
        pressure = (pressure + (v1 + v2 + slxBus.s16(cal, 18)) / 16) / 100
        if (!slxInternal.finite(temperature) || !slxInternal.finite(pressure) ||
            temperature < -40 || temperature > 85 || pressure < 300 || pressure > 1100) return [-127, -1]
        return [temperature, pressure]
    }
    /** i2c-006: connect BMP280 to I2C. Altitude uses your sea-level pressure setting, default 1013.25 hPa. Weather changes affect altitude. Failures: -127 °C, -1 hPa, -9999 m. */
    export function bmp280(value: SlxPressureValue): number {
        slxBus.acquire()
        if (control.millis() - bmpAt >= 100) {
            bmpTemp = -127
            bmpPressure = -1
            if (bmpAddress != 0 || bmpInit()) {
                let data = slxBus.register(bmpAddress, 0xF7, 6)
                if (data) {
                    let rawP = data[0] * 4096 + data[1] * 16 + (data[2] >> 4)
                    let rawT = data[3] * 4096 + data[4] * 16 + (data[5] >> 4)
                    if (rawT != 0x80000 && rawP != 0x80000) {
                        let pair = compensateBMP(bmpCalibration, rawT, rawP)
                        bmpTemp = pair[0]
                        bmpPressure = pair[1]
                    }
                } else bmpAddress = 0
            }
            bmpAt = control.millis()
        }
        let result = bmpPressure
        if (value == SlxPressureValue.Temperature) result = bmpTemp
        if (value == SlxPressureValue.Altitude) result = bmpPressure < 0 || bmpSeaLevel <= 0 ? -9999 : 44330 * (1 - Math.pow(bmpPressure / bmpSeaLevel, 0.1903))
        slxBus.release()
        return result
    }

    /** v0.8.0 make this place 0 m for the altitude reading (stores the current pressure as the reference, like the BrixelAI DSL micro:bit card). */
    export function zeroAltitude(): void {
        bmpAt = -1000
        let p = bmp280(SlxPressureValue.Pressure)
        if (p > 0) bmpSeaLevel = p
    }

    /** i2c-003: connect MLX90614 to I2C. Do not combine with CCS811 at address 0x5A. Failed read or PEC returns -127 °C. */
    export function infraredTemperature(source: SlxIRTemperature): number {
        slxBus.acquire()
        let register = source == SlxIRTemperature.Object ? 7 : 6
        let data = slxBus.register(0x5A, register, 3)
        let result = -127
        if (data) {
            // SMBus PEC includes both address bytes and the command, not only the data bytes.
            let frame = pins.createBufferFromArray([0xB4, register, 0xB5, data[0], data[1]])
            let raw = slxBus.u16(data, 0)
            if (slxBus.crc8(frame, 0, 5, 0, 7) == data[2] && (raw & 0x8000) == 0 && raw != 0) {
                let temperature = raw * 0.02 - 273.15
                if (temperature >= -70 && temperature <= 380) result = temperature
            }
        }
        slxBus.release()
        return result
    }
}
