// ⚠ 자동 생성 — 사이언스랩 air.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxAirValue {
    ECO2 = 0,
    TVOC = 1
}
namespace slxAir {
    let sgpStarted = false
    let sgpReadyAt = 0
    let sgpValidAt = -10000
    let sgpCO2 = -1
    let sgpTVOC = -1
    let sgpInitialized = false
    let sgpHumidity = -1
    let sgpHumidityDirty = false
    let sgpEnvironmentInvalid = false
    /** Supply measured ambient temperature and relative humidity, ideally updated every 10s. Converts to absolute humidity for SGP30. Not a CO2 zero calibration. Invalid input hides readings until valid input is supplied. Lost on restart. */
    export function compensateSGP30(temperature: number, humidity: number): void {
        sgpCO2 = -1; sgpTVOC = -1; sgpValidAt = -10000
        sgpEnvironmentInvalid = true
        if (!slxInternal.finite(temperature) || !slxInternal.finite(humidity) || temperature < 5 || temperature > 55 || humidity <= 0 || humidity > 90) return
        let absolute = 216.7 * (humidity / 100 * 6.112 * Math.exp(17.62 * temperature / (243.12 + temperature))) / (273.15 + temperature)
        sgpHumidity = Math.round(absolute * 256)
        sgpHumidityDirty = true; sgpEnvironmentInvalid = false
    }
    function sgpApplyHumidity(): boolean {
        if (!sgpHumidityDirty || sgpHumidity < 0) return true
        let humidity = sgpHumidity
        let bytes = pins.createBufferFromArray([humidity >> 8, humidity & 255])
        if (!slxBus.write(0x58, [0x20, 0x61, bytes[0], bytes[1], slxBus.crc8(bytes, 0, 2, 255, 0x31)])) return false
        basic.pause(10)
        sgpHumidityDirty = sgpHumidity != humidity
        return true
    }
    function sgpSample(): void {
        if (sgpEnvironmentInvalid) { sgpCO2 = -1; sgpTVOC = -1; return }
        slxBus.acquire()
        // Keep the previous sample visible while a new conversion is in progress.
        // Commit failure markers only once the transaction actually fails.
        let nextCO2 = -1
        let nextTVOC = -1
        if (!sgpInitialized) {
            // Feature-set response with CRC identifies SGP30 before starting its IAQ algorithm.
            if (slxBus.write(0x58, [0x20, 0x2F])) {
                basic.pause(10)
                let feature = slxBus.read(0x58, 3)
                if (feature && slxBus.crc8(feature, 0, 2, 255, 0x31) == feature[2] &&
                    (slxBus.be16(feature, 0) & 0xF000) == 0 && slxBus.write(0x58, [0x20, 0x03])) {
                    basic.pause(10)
                    sgpInitialized = true
                    sgpHumidityDirty = sgpHumidity >= 0
                    sgpReadyAt = control.millis() + 15000
                }
            }
        } else if (sgpApplyHumidity() && slxBus.write(0x58, [0x20, 0x08])) {
            basic.pause(12)
            let data = slxBus.read(0x58, 6)
            if (data && slxBus.crc8(data, 0, 2, 255, 0x31) == data[2] &&
                slxBus.crc8(data, 3, 2, 255, 0x31) == data[5]) {
                if (control.millis() >= sgpReadyAt) {
                    nextCO2 = slxBus.be16(data, 0)
                    nextTVOC = slxBus.be16(data, 3)
                    sgpValidAt = control.millis()
                }
            } else sgpInitialized = false
        } else sgpInitialized = false
        // A setter may run in another fiber while a conversion is paused.
        sgpCO2 = sgpEnvironmentInvalid || sgpHumidityDirty ? -1 : nextCO2
        sgpTVOC = sgpEnvironmentInvalid || sgpHumidityDirty ? -1 : nextTVOC
        slxBus.release()
    }
    /** i2c-004: connect SGP30 to I2C. It samples once per second in the background. First 15+ seconds and errors=-1. eCO2 is an estimate, not direct CO2 measurement. */
    export function sgp30(value: SlxAirValue): number {
        if (!sgpStarted) {
            sgpStarted = true
            control.inBackground(function () {
                while (true) {
                    let start = control.millis()
                    sgpSample()
                    basic.pause(Math.max(1, 1000 - (control.millis() - start)))
                }
            })
        }
        if (control.millis() - sgpValidAt > 2000) return -1
        return value == SlxAirValue.ECO2 ? sgpCO2 : sgpTVOC
    }
}
