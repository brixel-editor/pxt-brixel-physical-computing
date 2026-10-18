// ⚠ 자동 생성 — 사이언스랩 gesture.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// APDS9960 configuration/ratio method based on Shawn Hymel / SparkFun (public domain).
namespace slxDetection {
    let apdsStarted = false
    let apdsReady = false
    let apdsAt = -10000
    let apdsProximityAt = -10000
    let apdsColorAt = -10000
    let apdsProximity = -1
    let apdsColors = [-1, -1, -1, -1]
    let apdsGesture = 0
    let apdsGestureAt = -10000
    let apdsSamples = 0
    let apdsFirstUD = 0
    let apdsFirstLR = 0
    let apdsLastUD = 0
    let apdsLastLR = 0
    let apdsGestureStart = 0
    function apdsInit(): boolean {
        let id = slxBus.register(0x39, 0x92, 1)
        // 0xAB = APDS9960 정품, 0x9C·0xA8 = 호환 칩(브릭셀 모듈 실측 0xA8, 2026-10-18)
        if (!id || (id[0] != 0xAB && id[0] != 0x9C && id[0] != 0xA8)) return false
        // 4x gains; LED 100mA without boost. ALS 103ms. No interrupt pin needed.
        // GCONF2 0xA3 = 0x43: gesture wait 8.4ms (was 2.8ms) so the 32-entry FIFO does not overflow between 50ms polls.
        let settings = [0x80, 0, 0x81, 219, 0x83, 0xFF, 0x8E, 0x89, 0x9D, 0, 0x9E, 0,
            0x8D, 0x60, 0x8F, 0x09, 0x89, 0, 0x8B, 50, 0x8C, 0x11, 0x90, 1, 0x9F, 0,
            0xA0, 40, 0xA1, 30, 0xA2, 0x40, 0xA3, 0x43, 0xA4, 0, 0xA5, 0, 0xA7, 0, 0xA9, 0,
            0xA6, 0xC9, 0xAA, 0, 0xAB, 4, 0xAB, 0, 0x80, 0x4F]
        for (let i = 0; i < settings.length; i += 2)
            if (!slxBus.write(0x39, [settings[i], settings[i + 1]])) return false
        apdsSamples = 0
        return true
    }
    function apdsFail(): void {
        apdsReady = false; apdsAt = -10000; apdsProximityAt = -10000; apdsColorAt = -10000
        apdsGesture = 0; apdsSamples = 0
    }
    function apdsSample(): void {
        slxBus.acquire()
        if (!apdsReady) apdsReady = apdsInit()
        let ok = apdsReady
        if (ok) {
            let status = slxBus.register(0x39, 0x93, 1)
            if (!status) ok = false
            else {
                if (status[0] & 1) {
                    let color = slxBus.register(0x39, 0x94, 8)
                    if (!color) ok = false
                    else {
                        apdsColors = [slxBus.u16(color, 2), slxBus.u16(color, 4), slxBus.u16(color, 6), slxBus.u16(color, 0)]
                        apdsColorAt = control.millis()
                    }
                }
                if (status[0] & 2) {
                    let proximity = slxBus.register(0x39, 0x9C, 1)
                    if (!proximity) ok = false
                    else { apdsProximity = proximity[0]; apdsProximityAt = control.millis() }
                }
            }
            let gesture = slxBus.register(0x39, 0xAF, 1)
            let level = slxBus.register(0x39, 0xAE, 1)
            // 넘침(GFOV, bit1)은 실패로 보지 않고 남은 FIFO 를 읽어 이어 간다 — 예전엔 넘침마다 다시 초기화해 손짓을 잃었다(2026-10-18 실기: 손짓 8번 중 3번만)
            if (!gesture || !level || level[0] > 32) ok = false
            else {
                let remaining = level[0]
                while (remaining > 0 && ok) {
                    let batch = Math.min(16, remaining)
                    let fifo = slxBus.register(0x39, 0xFC, batch * 4)
                    if (!fifo) { ok = false; break }
                    for (let i = 0; i < fifo.length; i += 4) {
                        let u = fifo[i], d = fifo[i + 1], l = fifo[i + 2], r = fifo[i + 3]
                        if (u <= 10 || d <= 10 || l <= 10 || r <= 10) continue
                        apdsLastUD = 100 * (u - d) / (u + d)
                        apdsLastLR = 100 * (l - r) / (l + r)
                        if (apdsSamples == 0) {
                            apdsFirstUD = apdsLastUD; apdsFirstLR = apdsLastLR; apdsGestureStart = control.millis()
                        }
                        apdsSamples++
                    }
                    remaining -= batch
                }
                if (!(gesture[0] & 1)) {
                    if (apdsSamples >= 5) {
                        let ud = apdsLastUD - apdsFirstUD, lr = apdsLastLR - apdsFirstLR
                        if (Math.abs(ud) >= 50 || Math.abs(lr) >= 50) {
                            apdsGesture = Math.abs(ud) >= Math.abs(lr) ? (ud < 0 ? 1 : 2) : (lr < 0 ? 3 : 4)
                            apdsGestureAt = control.millis()
                        }
                    }
                    apdsSamples = 0
                } else if (apdsSamples && control.millis() - apdsGestureStart > 1000) ok = false
            }
        }
        if (ok) apdsAt = control.millis()
        else apdsFail()
        slxBus.release()
    }
    function apdsStart(): void {
        if (apdsStarted) return
        apdsStarted = true
        control.inBackground(function () { while (true) { apdsSample(); basic.pause(50) } })
    }
    /** APDS9960 proximity raw 0..255, not centimetres. Uses background sampling; first sample, disconnected or stale=-1. */
    export function gestureProximity(): number {
        apdsStart()
        return !apdsReady || control.millis() - apdsProximityAt > 500 ? -1 : apdsProximity
    }
    /** APDS9960 color raw 0..65535. Uses the same background sampler as gesture/proximity. First sample, disconnected or stale=-1. */
    export function gestureColor(channel: SlxColorChannel): number {
        apdsStart()
        if (channel < 0 || channel > 3 || channel != Math.floor(channel) || !apdsReady || control.millis() - apdsColorAt > 500) return -1
        return apdsColors[channel]
    }
    /** APDS9960 completed gesture: 0 none, 1 up, 2 down, 3 left, 4 right. Consumed once; expires after 1 second. Sensor orientation matters. Error=-1. */
    export function gestureDirection(): number {
        apdsStart()
        if (!apdsReady || control.millis() - apdsAt > 500) return -1
        let result = control.millis() - apdsGestureAt <= 1000 ? apdsGesture : 0
        apdsGesture = 0
        return result
    }
    /** v0.9.1 gesture as a word: 없음·위·아래·왼쪽·오른쪽 («연결 안 됨» when not connected). Pass the hand once, 5~15 cm above. On the BRIXEL module only left/right are reliable — up and down are not told apart. */
    export function gestureName(): string {
        let d = gestureDirection()
        if (d < 0) return "연결 안 됨"
        return ["없음", "위", "아래", "왼쪽", "오른쪽"][d]
    }
}
