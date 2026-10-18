// ⚠ 자동 생성 — 사이언스랩 distance.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// VL53L0X sequence and timing ported from Pololu (MIT) / ST (BSD-3-Clause).
// Full attribution and licenses: THIRD_PARTY_NOTICES.md; pinned source: SOURCES.md.
namespace slxDetection {
    let tofReady = false
    let tofIdentified = false
    let tofOK = true
    let tofStop = 0
    let tofAt = -1000
    let tofValue = -1
    function tofRead(reg: number, size: number = 1): Buffer {
        if (!tofOK) return null
        let data = slxBus.register(0x29, reg, size)
        if (!data) tofOK = false
        return data
    }
    function tofByte(reg: number): number { let b = tofRead(reg); return b ? b[0] : 0 }
    function tofWord(reg: number): number { let b = tofRead(reg, 2); return b ? slxBus.be16(b, 0) : 0 }
    function tofWrite(reg: number, value: number): void { if (tofOK && !slxBus.write(0x29, [reg, value])) tofOK = false }
    function tofWriteWord(reg: number, value: number): void {
        if (tofOK && !slxBus.write(0x29, [reg, (value >> 8) & 255, value & 255])) tofOK = false
    }
    function tofPairs(pairs: number[]): void { for (let i = 0; i < pairs.length; i += 2) tofWrite(pairs[i], pairs[i + 1]) }
    function tofWait(reg: number, mask: number, set: boolean): boolean {
        let started = control.millis()
        while (tofOK) {
            let value = tofByte(reg)
            if (!tofOK) return false
            if (((value & mask) != 0) == set) return true
            if (control.millis() - started >= 200) { tofOK = false; return false }
            basic.pause(1)
        }
        return false
    }
    function tofCalibrate(start: number): boolean {
        tofWrite(0, start)
        if (!tofWait(0x13, 7, true)) return false
        tofPairs([0x0B, 1, 0, 0])
        return tofOK
    }
    function tofMacro(period: number): number { return Math.floor((2304 * period * 1655 + 500) / 1000) }
    function tofInit(): boolean {
        // TCS34725 shares 0x29; never write initialization into an unidentified device.
        if (tofByte(0xC0) != 0xEE || !tofOK) return false
        tofIdentified = true
        tofWrite(0x89, tofByte(0x89) | 1)
        tofPairs([0x88, 0, 0x80, 1, 0xFF, 1, 0, 0])
        tofStop = tofByte(0x91)
        tofPairs([0, 1, 0xFF, 0, 0x80, 0])
        tofWrite(0x60, tofByte(0x60) | 0x12)
        tofWriteWord(0x44, 32)
        tofPairs([1, 0xFF, 0x80, 1, 0xFF, 1, 0, 0, 0xFF, 6])
        tofWrite(0x83, tofByte(0x83) | 4)
        tofPairs([0xFF, 7, 0x81, 1, 0x80, 1, 0x94, 0x6B, 0x83, 0])
        if (!tofWait(0x83, 255, true)) return false
        tofWrite(0x83, 1)
        let spad = tofByte(0x92), count = spad & 127
        if (!tofOK || count == 0 || count > 48) return false
        tofPairs([0x81, 0, 0xFF, 6])
        tofWrite(0x83, tofByte(0x83) & ~4)
        tofPairs([0xFF, 1, 0, 1, 0xFF, 0, 0x80, 0])
        let map = tofRead(0xB0, 6)
        if (!map) return false
        tofPairs([0xFF, 1, 0x4F, 0, 0x4E, 0x2C, 0xFF, 0, 0xB6, 0xB4])
        let enabled = 0
        for (let i = 0; i < 48; i++) {
            let index = i >> 3, mask = 1 << (i & 7)
            if (i < ((spad & 128) ? 12 : 0) || enabled == count) map[index] &= ~mask
            else if (map[index] & mask) enabled++
        }
        if (enabled != count) return false
        if (!slxBus.write(0x29, [0xB0, map[0], map[1], map[2], map[3], map[4], map[5]])) return false
        tofPairs(tofTuning)
        tofWrite(0x0A, 4)
        tofWrite(0x84, tofByte(0x84) & ~0x10)
        tofPairs([0x0B, 1, 1, 0xE8])
        // 33ms budget, sequence E8: DSS + pre-range + final-range.
        let preMacro = tofMacro((tofByte(0x50) + 1) * 2)
        let finalMacro = tofMacro((tofByte(0x70) + 1) * 2)
        let encoded = tofWord(0x51)
        let exponent = encoded >> 8
        if (!tofOK || exponent > 15) return false
        let preM = ((encoded & 255) << exponent) + 1
        let preUs = Math.floor((preM * preMacro + 500) / 1000)
        let msrcUs = Math.floor(((tofByte(0x46) + 1) * preMacro + 500) / 1000)
        let remaining = 33000 - (1910 + 960 + 2 * (msrcUs + 690) + preUs + 660 + 550)
        if (!tofOK || remaining <= 0) return false
        let finalM = Math.floor((remaining * 1000 + finalMacro / 2) / finalMacro) + preM
        let mantissa = finalM - 1, shift = 0
        while (mantissa > 255) { mantissa >>= 1; shift++ }
        tofWriteWord(0x71, (shift << 8) | mantissa)
        tofWrite(1, 1)
        if (!tofCalibrate(0x41)) return false
        tofWrite(1, 2)
        if (!tofCalibrate(1)) return false
        tofWrite(1, 0xE8)
        return tofOK
    }
    let tofOffset = 0
    let tofOffsetValid = true
    /** Place an uncovered sensor perpendicular to a matte target at a ruler-measured 100..500mm. Corrects a small output offset using 16 samples; not ST cover-glass crosstalk calibration. Failed capture disables readings until recalibrated. Lost on restart. */
    export function calibrateLaserDistance(mm: number): void {
        tofOffsetValid = false
        if (!slxInternal.finite(mm) || mm < 100 || mm > 500) return
        let sum = 0, low = 2000, high = 0
        for (let i = 0; i < 16; i++) {
            tofAt = -1000
            let value = laserDistanceRaw()
            if (value < 0) return
            sum += value; low = Math.min(low, value); high = Math.max(high, value)
            basic.pause(50)
        }
        let offset = mm - sum / 16
        if (high - low <= 20 && Math.abs(offset) <= 50) { tofOffset = offset; tofOffsetValid = true }
    }
    /** VL53L0X I2C distance in mm, address 0x29, with optional output offset correction. Do not share the address with TCS34725. Timeout, invalid range status, failed calibration or range over 2000mm=-1. */
    export function laserDistance(): number {
        if (!tofOffsetValid) return -1
        let raw = laserDistanceRaw()
        if (raw < 0) return -1
        let result = raw + tofOffset
        return result >= 0 && result <= 2000 ? result : -1
    }
    function laserDistanceRaw(): number {
        slxBus.acquire()
        if (control.millis() - tofAt >= 50) {
            tofOK = true
            if (!tofReady) tofReady = tofInit()
            let result = -1
            if (tofReady) {
                tofPairs([0x80, 1, 0xFF, 1, 0, 0, 0x91, tofStop, 0, 1, 0xFF, 0, 0x80, 0, 0, 1])
                if (tofWait(0, 1, false) && tofWait(0x13, 7, true)) {
                    let data = tofRead(0x14, 12)
                    tofWrite(0x0B, 1)
                    if (data && tofOK && ((data[0] >> 3) & 15) == 11) {
                        let mm = slxBus.be16(data, 10)
                        if (mm <= 2000) result = mm
                    }
                }
            }
            if (!tofReady || !tofOK) {
                // Restore register page after a failed initialization; next call can retry.
                // Only write cleanup if a VL53L0X was identified in this session.
                if (tofIdentified) {
                    slxBus.write(0x29, [0xFF, 0])
                    slxBus.write(0x29, [0x80, 0])
                    slxBus.write(0x29, [0, 0])
                }
                tofReady = false
            }
            tofValue = result; tofAt = control.millis()
        }
        let result = tofValue
        slxBus.release()
        return result
    }
    const tofTuning = [
        0xFF, 0x01, 0x00, 0x00, 0xFF, 0x00, 0x09, 0x00, 0x10, 0x00, 0x11, 0x00
       , 0x24, 0x01, 0x25, 0xFF, 0x75, 0x00, 0xFF, 0x01, 0x4E, 0x2C, 0x48, 0x00
       , 0x30, 0x20, 0xFF, 0x00, 0x30, 0x09, 0x54, 0x00, 0x31, 0x04, 0x32, 0x03
       , 0x40, 0x83, 0x46, 0x25, 0x60, 0x00, 0x27, 0x00, 0x50, 0x06, 0x51, 0x00
       , 0x52, 0x96, 0x56, 0x08, 0x57, 0x30, 0x61, 0x00, 0x62, 0x00, 0x64, 0x00
       , 0x65, 0x00, 0x66, 0xA0, 0xFF, 0x01, 0x22, 0x32, 0x47, 0x14, 0x49, 0xFF
       , 0x4A, 0x00, 0xFF, 0x00, 0x7A, 0x0A, 0x7B, 0x00, 0x78, 0x21, 0xFF, 0x01
       , 0x23, 0x34, 0x42, 0x00, 0x44, 0xFF, 0x45, 0x26, 0x46, 0x05, 0x40, 0x40
       , 0x0E, 0x06, 0x20, 0x1A, 0x43, 0x40, 0xFF, 0x00, 0x34, 0x03, 0x35, 0x44
       , 0xFF, 0x01, 0x31, 0x04, 0x4B, 0x09, 0x4C, 0x05, 0x4D, 0x04, 0xFF, 0x00
       , 0x44, 0x00, 0x45, 0x20, 0x47, 0x08, 0x48, 0x28, 0x67, 0x00, 0x70, 0x04
       , 0x71, 0x01, 0x72, 0xFE, 0x76, 0x00, 0x77, 0x00, 0xFF, 0x01, 0x0D, 0x01
       , 0xFF, 0x00, 0x80, 0x01, 0x01, 0xF8, 0xFF, 0x01, 0x8E, 0x01, 0x00, 0x01
       , 0xFF, 0x00, 0x80, 0x00
    ]
}
