// ⚠ 자동 생성 — 사이언스랩 ccs811.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Register sequence checked against SparkFun CCS811 (MIT); see SOURCES.md.
namespace slxAir {
    let ccsAddress = 0
    let ccsWarmAt = 0
    let ccsAt = -10000
    let ccsPollAt = -1000
    let ccsCO2 = -1
    let ccsVOC = -1
    let ccsEnvironment: number[] = []
    let ccsEnvironmentDirty = false
    let ccsEnvironmentInvalid = false
    /** Supply measured ambient temperature and humidity for CCS811 compensation, ideally every 10s. Does not skip burn-in or calibrate eCO2 to real CO2. Invalid input hides readings until valid input is supplied. Lost on restart. */
    export function compensateCCS811(temperature: number, humidity: number): void {
        ccsCO2 = -1; ccsVOC = -1; ccsAt = -10000
        ccsEnvironmentInvalid = true
        if (!slxInternal.finite(temperature) || !slxInternal.finite(humidity) || temperature < -25 || temperature > 50 || humidity < 0 || humidity > 100) return
        ccsEnvironment = [0x05, Math.round(humidity * 2), 0, Math.round((temperature + 25) * 2), 0]
        ccsEnvironmentDirty = true; ccsEnvironmentInvalid = false
    }
    function ccsInvalidate(): void { ccsCO2 = -1; ccsVOC = -1; ccsAt = -10000; ccsAddress = 0 }
    function ccsInit(): boolean {
        for (let addr = 0x5A; addr <= 0x5B; addr++) {
            let id = slxBus.register(addr, 0x20, 1)
            if (!id || id[0] != 0x81) continue
            // nWAKE must already be held LOW by the module/wiring.
            let status = slxBus.register(addr, 0x00, 1)
            if (!status || !(status[0] & 0x10) || (status[0] & 1)) continue
            if (!(status[0] & 0x80)) {
                if (!slxBus.write(addr, [0xF4])) continue
                basic.pause(10)
                status = slxBus.register(addr, 0x00, 1)
                if (!status || !(status[0] & 0x80) || (status[0] & 1)) continue
            }
            if (!slxBus.write(addr, [0x01, 0x10])) continue // IAQ drive mode 1, 1 second
            ccsEnvironmentDirty = ccsEnvironment.length > 0
            ccsAddress = addr
            ccsWarmAt = control.millis() + 1200000 // manufacturer run-in: 20 minutes after start
            return true
        }
        return false
    }
    /** CCS811 I2C air quality, address 0x5A/0x5B. Keep nWAKE LOW. First 20 minutes/errors=-1; eCO2 is an estimate. First-use burn-in is additional. */
    export function ccs811(value: SlxAirValue): number {
        if (value != SlxAirValue.ECO2 && value != SlxAirValue.TVOC) return -1
        if (ccsEnvironmentInvalid) return -1
        slxBus.acquire()
        if (control.millis() - ccsPollAt >= 100) {
            if (ccsAddress != 0 || ccsInit()) {
                let environment = ccsEnvironment
                let environmentOK = !ccsEnvironmentDirty || slxBus.write(ccsAddress, environment)
                if (environmentOK) ccsEnvironmentDirty = ccsEnvironment != environment
                let status = environmentOK ? slxBus.register(ccsAddress, 0, 1) : null
                if (!status || !(status[0] & 0x80) || (status[0] & 1)) {
                    if (status && (status[0] & 1)) slxBus.register(ccsAddress, 0xE0, 1)
                    ccsInvalidate()
                } else if (status[0] & 8) {
                    let data = slxBus.register(ccsAddress, 2, 8)
                    if (!data || (data[4] & 1) || data[5] != 0 || !(data[4] & 0x80)) ccsInvalidate()
                    else {
                        let co2 = slxBus.be16(data, 0)
                        let voc = slxBus.be16(data, 2)
                        if (co2 < 400 || co2 > 32768 || voc > 32768) ccsInvalidate()
                        else { ccsCO2 = co2; ccsVOC = voc; ccsAt = control.millis() }
                    }
                }
            }
            ccsPollAt = control.millis()
        }
        let result = -1
        if (!ccsEnvironmentInvalid && !ccsEnvironmentDirty && ccsAddress != 0 && control.millis() >= ccsWarmAt && control.millis() - ccsAt <= 2500)
            result = value == SlxAirValue.ECO2 ? ccsCO2 : ccsVOC
        slxBus.release()
        return result
    }
}
