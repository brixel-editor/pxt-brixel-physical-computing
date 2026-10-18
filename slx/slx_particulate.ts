// ⚠ 자동 생성 — 사이언스랩 particulate.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxPMValue {
    PM1 = 0,
    PM25 = 1,
    PM10 = 2
}
namespace slxAir {
    let pmStarted = false
    let pmReady = false
    let pmWarmAt = 0
    let pmAt = -10000
    let pmValues = [-1, -1, -1]
    let pmBytes: number[] = []
    let pmByteAt = 0
    // Bounded stream parser: handles fragmented frames, corrupt lengths and resynchronization.
    function pmConsume(data: Buffer): void {
        if (control.millis() - pmByteAt > 500) pmBytes = []
        if (data.length) pmByteAt = control.millis()
        for (let b = 0; b < data.length; b++) {
            pmBytes.push(data[b])
            while (pmBytes.length >= 2) {
                if (pmBytes[0] != 0x42 || pmBytes[1] != 0x4D) { pmBytes.shift(); continue }
                if (pmBytes.length < 4) break
                let length = pmBytes[2] * 256 + pmBytes[3]
                if (length != 20 && length != 28) { pmBytes.shift(); continue }
                let total = length + 4
                if (pmBytes.length < total) break
                let sum = 0
                for (let i = 0; i < total - 2; i++) sum += pmBytes[i]
                if ((sum & 65535) != pmBytes[total - 2] * 256 + pmBytes[total - 1]) {
                    pmAt = -10000; pmBytes.shift(); continue
                }
                // Remaining payload bytes are reserved in the cited PMS3003/7003 manuals.
                for (let i = 0; i < 3; i++) pmValues[i] = pmBytes[10 + i * 2] * 256 + pmBytes[11 + i * 2]
                pmAt = control.millis()
                pmBytes = pmBytes.slice(total)
            }
        }
    }
    /** PMS3003 (3-pin: G, V, TX). Connect the sensor TX signal to the selected pin. Factory active mode, 9600 baud, 5V power, 3.3V signal. Only the last started PMS/CO2/GPS/fingerprint sensor is read; USB stays available. */
    export function startPMS3003(pin: SlxDigitalPin): void { beginPMS(pin, -1) }
    /** PMS7003 (4-pin: G, V, TX, RX). Sensor TX to micro:bit RX, sensor RX to micro:bit TX. Factory active mode, 9600 baud, 5V power, 3.3V signal. Only the last started PMS/CO2/GPS/fingerprint sensor is read; USB stays available. */
    export function startPMS(rx: SlxDigitalPin, tx: SlxDigitalPin): void { beginPMS(rx, tx) }
    function beginPMS(rx: number, tx: number): void {
        pmReady = false; pmAt = -10000; pmBytes = []
        pmReady = slxUART.start(1, rx, tx)
        pmWarmAt = control.millis() + 30000
        if (pmReady && !pmStarted) {
            pmStarted = true
            control.inBackground(function () {
                while (true) {
                    if (pmReady && slxUART.owner == 1) {
                        // Drain at most 256 bytes per tick so corrupt/noisy input cannot monopolize a fiber.
                        for (let i = 0; i < 4; i++) {
                            let data = slxNative.readSensorUART()
                            pmConsume(data)
                            if (data.length < 64) break
                        }
                    }
                    basic.pause(20)
                }
            })
        }
    }
    /** Atmospheric PM mass concentration. Call start once. First 30 seconds, checksum errors, deselected sensor, or no fresh frame for 3 seconds=-1. */
    export function particulate(value: SlxPMValue): number {
        if (value < 0 || value > 2 || value != Math.floor(value) || !pmReady || slxUART.owner != 1 || control.millis() < pmWarmAt || control.millis() - pmAt > 3000) return -1
        return pmValues[value]
    }
}
