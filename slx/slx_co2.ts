// ⚠ 자동 생성 — 사이언스랩 co2.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// MH-Z19 read protocol (0x86); no calibration/range commands are sent.
namespace slxAir {
    let co2Started = false
    let co2WarmAt = 0
    let co2RequestAt = -10000
    let co2At = -10000
    let co2Value = -1
    let co2Bytes: number[] = []
    let co2ByteAt = 0
    let co2Waiting = false
    function co2Consume(data: Buffer): void {
        if (control.millis() - co2ByteAt > 500) co2Bytes = []
        if (data.length) co2ByteAt = control.millis()
        for (let i = 0; i < data.length; i++) {
            co2Bytes.push(data[i])
            while (co2Bytes.length >= 2) {
                if (co2Bytes[0] != 255 || co2Bytes[1] != 0x86) { co2Bytes.shift(); continue }
                if (co2Bytes.length < 9) break
                let sum = 0
                for (let j = 1; j <= 8; j++) sum += co2Bytes[j]
                if ((sum & 255) != 0) { co2At = -10000; co2Bytes.shift(); continue }
                let value = co2Bytes[2] * 256 + co2Bytes[3]
                if (co2Waiting && control.millis() - co2RequestAt <= 1000 && value >= 400 && value <= 10000) {
                    co2Value = value; co2At = control.millis(); co2Waiting = false
                } else co2At = -10000
                co2Bytes = co2Bytes.slice(9)
            }
        }
    }
    /** MH-Z19D 5.0±0.1V power, 3.3V UART. Sensor TX to RX, RX to TX. Only the last started PMS/CO2/GPS/fingerprint sensor uses UARTE1. USB remains available. */
    export function startCO2(rx: SlxDigitalPin, tx: SlxDigitalPin): void {
        co2At = -10000; co2RequestAt = -10000; co2Bytes = []; co2Waiting = false
        if (!slxUART.start(2, rx, tx)) return
        co2WarmAt = control.millis() + 60000
        if (!co2Started) {
            co2Started = true
            control.inBackground(function () {
                while (true) {
                    if (slxUART.owner == 2) {
                        for (let i = 0; i < 4; i++) {
                            let bytes = slxNative.readSensorUART()
                            co2Consume(bytes)
                            if (bytes.length < 64) break
                        }
                        if (co2Waiting && control.millis() - co2RequestAt > 1000) {
                            co2Waiting = false; co2At = -10000; co2Bytes = []
                        }
                        if (control.millis() - co2RequestAt >= 2000) {
                            co2Bytes = []
                            co2RequestAt = control.millis()
                            co2Waiting = slxUART.write(2, pins.createBufferFromArray([255, 1, 0x86, 0, 0, 0, 0, 0, 0x79]))
                            if (!co2Waiting) co2At = -10000
                        }
                    }
                    basic.pause(20)
                }
            })
        }
    }
    /** MH-Z19D measured CO2 ppm. First 60 seconds, not selected, bad checksum, response timeout or data older than 3 seconds=-1. Sensor's configured measurement range still applies. */
    export function co2(): number {
        return slxUART.owner != 2 || control.millis() < co2WarmAt || control.millis() - co2At > 3000 ? -1 : co2Value
    }
}
