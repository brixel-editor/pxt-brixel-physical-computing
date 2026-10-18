// ⚠ 자동 생성 — 사이언스랩 digital-sensors.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxDHTModel {
    DHT11 = 11,
    DHT22 = 22
}
namespace slxWeather {
    class DHTCache {
        pin: number
        model: number
        at: number
        temperature: number
        humidity: number
        failures: number
        constructor(pin: number, model: number) {
            this.pin = pin; this.model = model; this.at = -2000
            this.temperature = -127; this.humidity = -1; this.failures = 0
        }
    }
    let dhtCache: DHTCache[] = []
    let dhtBusy = false
    /** d-001/002: connect G/V/S to a 3.3V port. Each sensor is sampled at most once per 2 seconds. A single bad frame keeps the last good value; after 3 failed reads in a row (or before the first good read) temperature=-127, humidity=-1. */
    export function dht(model: SlxDHTModel, pin: SlxDigitalPin, value: SlxClimateValue): number {
        let failure = value == SlxClimateValue.Temperature ? -127 : -1
        if (!slxInternal.validDigital(pin) || (model != SlxDHTModel.DHT11 && model != SlxDHTModel.DHT22)) return failure
        while (dhtBusy) basic.pause(1)
        dhtBusy = true
        let cache: DHTCache = null
        for (let i = 0; i < dhtCache.length; i++) if (dhtCache[i].pin == pin) cache = dhtCache[i]
        if (!cache) { cache = new DHTCache(pin, model); dhtCache.push(cache) }
        if (cache.model != model) { cache.model = model; cache.at = -2000; cache.temperature = -127; cache.humidity = -1; cache.failures = 0 }
        if (control.millis() - cache.at >= 2000) {
            slxInternal.prepare(pin)
            let p = <DigitalPin><number>pin
            pins.setPull(p, PinPullMode.PullUp)
            pins.digitalReadPin(p)
            basic.pause(250)
            // Bit timing is measured natively. No global interrupt masking (BLE remains enabled), so a
            // frame can still be corrupted now and then; the checksum rejects it and the last value is kept.
            let bytes = slxNative.readDHT(pin)
            let good = false
            if (bytes.length == 5 && ((bytes[0] + bytes[1] + bytes[2] + bytes[3]) & 255) == bytes[4]) {
                let humidity = model == SlxDHTModel.DHT11 ? bytes[0] + bytes[1] / 10 : (bytes[0] * 256 + bytes[1]) / 10
                let temp = model == SlxDHTModel.DHT11 ? bytes[2] + (bytes[3] & 127) / 10 : ((bytes[2] & 127) * 256 + bytes[3]) / 10
                if (model == SlxDHTModel.DHT22 && (bytes[2] & 128)) temp = -temp
                if (model == SlxDHTModel.DHT11 && (bytes[3] & 128)) temp = -temp
                if (humidity >= 0 && humidity <= 100 && temp >= -40 && temp <= 80) { cache.temperature = temp; cache.humidity = humidity; good = true }
            }
            if (good) cache.failures = 0
            else if (++cache.failures >= 3) { cache.temperature = -127; cache.humidity = -1 }
            // After a bad frame try again in 1s (DHT11 minimum) instead of waiting the full 2s.
            cache.at = good ? control.millis() : control.millis() - 1000
        }
        let result = value == SlxClimateValue.Temperature ? cache.temperature : cache.humidity
        dhtBusy = false
        return result
    }
}
namespace slxWater {
    let waterPin = -1
    let waterAt = -1000
    let waterBusy = false
    let waterValues: number[] = [-127, -127, -127]
    /** a-003/004 DS18B20: use a 3.3V digital port with module pull-up. Up to three probes on one pin, ordered by ROM search, not socket position. Failure=-127 °C. */
    export function temperature(pin: SlxDigitalPin, probe: number): number {
        if (!slxInternal.validDigital(pin) || probe < 1 || probe > 3 || probe != Math.floor(probe)) return -127
        while (waterBusy) basic.pause(1)
        waterBusy = true
        if (waterPin != pin || control.millis() - waterAt >= 1000) {
            slxInternal.prepare(pin)
            waterValues = [-127, -127, -127]
            // Re-scan each cycle to recover from disconnects. Read all probes from one conversion.
            slxWaterDriver.ds18b20SetPin(<DigitalPin><number>pin)
            if (slxWaterDriver.ds18b20StartConversion()) {
                for (let i = 0; i < 3; i++) {
                    // v0.8.0: a CRC error (often a BLE interrupt during a 1-Wire slot) re-reads the scratchpad only,
                    // up to 3 times, without a new conversion. Missing probes return -127 at once (no ROM).
                    let reading = -127
                    for (let attempt = 0; attempt < 3 && !(reading >= -55 && reading <= 125); attempt++)
                        reading = slxWaterDriver.ds18b20ReadTemp(i, slxWaterDriver.DS18B20Unit.Celsius)
                    if (reading >= -55 && reading <= 125) waterValues[i] = reading
                }
            }
            waterPin = pin
            waterAt = control.millis()
        }
        let result = waterValues[probe - 1]
        waterBusy = false
        return result
    }
}
