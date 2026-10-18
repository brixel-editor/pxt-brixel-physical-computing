// ⚠ 자동 생성 — 사이언스랩 pulse.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxPulseChannel {
    Red = 0,
    Infrared = 1
}
namespace slxBio {
    let pulseReady = false
    let pulseAt = -1000
    let pulsePollAt = -1000
    let pulseRed = -1
    let pulseIR = -1
    function pulseInit(): boolean {
        let id = slxBus.register(0x57, 0xFF, 1)
        if (!id || id[0] != 0x15 || !slxBus.write(0x57, [9, 0x40])) return false
        let start = control.millis()
        while (true) {
            let mode = slxBus.register(0x57, 9, 1)
            if (!mode) return false
            if (!(mode[0] & 0x40)) break
            if (control.millis() - start >= 100) return false
            basic.pause(2)
        }
        // MAX30102 mode 0x03: red+IR, 100 SPS, 18-bit/411us, 4096nA, 6.4mA LEDs; no FIFO averaging/rollover.
        let settings = [0x02, 0, 0x03, 0, 0x04, 0, 0x05, 0, 0x06, 0, 0x08, 0x0F,
            0x0A, 0x27, 0x0C, 0x1F, 0x0D, 0x1F, 0x09, 0x03]
        for (let i = 0; i < settings.length; i += 2)
            if (!slxBus.write(0x57, [settings[i], settings[i + 1]])) return false
        // Clear reset's latched PWR_RDY before checking for later brownouts.
        if (!slxBus.register(0x57, 0, 2)) return false
        basic.pause(12)
        return true
    }
    function pulseFail(): void { pulseRed = -1; pulseIR = -1; pulseAt = -1000; pulseReady = false }
    /** MAX30102 I2C optical pulse waveform. Raw 18-bit counts, read every 20..100ms. Not heart rate or SpO2. Missing/stale data or FIFO overflow=-1. */
    // MakeCode hides headings when a category has only one group, so keep the model in the block label too.
    export function pulseRaw(channel: SlxPulseChannel): number {
        if (channel != SlxPulseChannel.Red && channel != SlxPulseChannel.Infrared) return -1
        slxBus.acquire()
        if (control.millis() - pulsePollAt >= 10) {
            if (!pulseReady) pulseReady = pulseInit()
            if (pulseReady) {
                let pointers = slxBus.register(0x57, 4, 3)
                let status = slxBus.register(0x57, 0, 1)
                if (!pointers || !status || (status[0] & 1) || pointers[1] != 0) pulseFail()
                else {
                    let count = (pointers[0] - pointers[2] + 32) & 31
                    // Equal pointers + almost-full means all 32 entries, not an empty FIFO.
                    if (count == 0 && (status[0] & 0x80)) count = 32
                    while (count > 0 && pulseReady) {
                        let batch = Math.min(8, count)
                        let data = slxBus.register(0x57, 7, batch * 6)
                        if (!data) { pulseFail(); break }
                        let offset = (batch - 1) * 6
                        pulseRed = ((data[offset] & 3) << 16) | (data[offset + 1] << 8) | data[offset + 2]
                        pulseIR = ((data[offset + 3] & 3) << 16) | (data[offset + 4] << 8) | data[offset + 5]
                        pulseAt = control.millis()
                        count -= batch
                    }
                }
            } else pulseFail()
            pulsePollAt = control.millis()
        }
        let result = control.millis() - pulseAt > 300 ? -1 : (channel == SlxPulseChannel.Red ? pulseRed : pulseIR)
        slxBus.release()
        return result
    }
    // ── v0.9.1 심박수(bpm) — DSL마빗 펌웨어 v6.2 와 같은 계산: 0.02초마다 적외선을 읽어 느린 평균을 빼고, 맥박이 위로 솟았다
    //   평균 아래로 내려올 때 한 번, 간격 0.3~2초만 인정, 최근 4번 평균. 손가락 없음(적외선 < 50000) = -1. ✅ DSL마빗 실기 통과(같은 계산, 10-18).
    let hrStarted = false, hrIR = -1, hrDC = 0, hrPeak = 0, hrArmed = false, hrLastBeat = 0, hrBpm = -1
    let hrIntervals: number[] = []
    function hrSample(): void {
        let ir = pulseRaw(SlxPulseChannel.Infrared)
        hrIR = ir
        if (ir < 50000) { hrBpm = -1; hrIntervals = []; hrDC = ir; hrArmed = false; return }
        if (hrDC == 0) hrDC = ir
        hrDC = hrDC * 0.95 + ir * 0.05
        let ac = ir - hrDC
        if (ac > hrPeak) hrPeak = ac
        hrPeak = hrPeak * 0.995
        if (!hrArmed && ac > hrPeak * 0.5 && ac > 30) hrArmed = true
        else if (hrArmed && ac < 0) {
            hrArmed = false
            let now = control.millis()
            let iv = now - hrLastBeat
            hrLastBeat = now
            if (iv >= 300 && iv <= 2000) {
                hrIntervals.push(iv)
                if (hrIntervals.length > 4) hrIntervals.shift()
                if (hrIntervals.length >= 2) {
                    let s = 0
                    for (let i = 0; i < hrIntervals.length; i++) s += hrIntervals[i]
                    hrBpm = Math.round(60000 * hrIntervals.length / s)
                }
            }
        }
    }
    function hrStart(): void {
        if (hrStarted) return
        hrStarted = true
        control.inBackground(function () { while (true) { hrSample(); basic.pause(20) } })
    }
    /** v0.9.1 heart rate in beats per minute (not a medical device). Rest a fingertip lightly on the sensor and keep still; pressing hard stops the blood flow. The first 5~10 seconds and no finger = -1. Checked on hardware with the DSL micro:bit firmware (same calculation, 2026-10-18). */
    export function heartRate(): number { hrStart(); return hrBpm }
    /** v0.9.1 true when a fingertip covers the sensor (infrared ≥ 50000). */
    export function fingerOn(): boolean { hrStart(); return hrIR >= 50000 }
}
