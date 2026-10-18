// ⚠ 자동 생성 — 사이언스랩 encoder.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
namespace slxMotion {
    let encoderA = -1
    let encoderB = -1
    let encoderPrevious = 0
    let encoderPartial = 0
    let encoderCount = 0
    let encoderStarted = false
    const encoderSteps = [0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0]
    function encoderBits(): number { return pins.digitalReadPin(<DigitalPin>encoderA) * 2 + pins.digitalReadPin(<DigitalPin>encoderB) }
    /** BRIXEL rotary encoder SA → A, SB → B (pins P0·P1·P2·P8·P9·P12~P16; the 5-pin header P6·P7 is not available in this extension). One click = 1; clockwise counts up with SA P6 · SB P7, swap the pins to reverse. The module pulls the lines up itself (no internal pull-up). */
    export function startEncoder(a: SlxDigitalPin, b: SlxDigitalPin): void {
        encoderA = -1; encoderB = -1; encoderCount = 0; encoderPartial = 0
        if (a == b || !slxInternal.validDigital(a) || !slxInternal.validDigital(b)) return
        slxInternal.prepare(a); slxInternal.prepare(b)
        // v0.9.0: 풀 없음 — 브릭셀 로터리 엔코더는 내부 풀업을 걸면 LOW 가 내려가지 않았다(DSL마빗 실기 E31: 풀업 0번 / 풀 없음 420번 변화)
        pins.setPull(<DigitalPin><number>a, PinPullMode.PullNone)
        pins.setPull(<DigitalPin><number>b, PinPullMode.PullNone)
        encoderA = a; encoderB = b; encoderPrevious = encoderBits()
        if (!encoderStarted) {
            encoderStarted = true
            control.inBackground(function () {
                while (true) {
                    if (encoderA >= 0) {
                        let bits = encoderBits()
                        if (bits != encoderPrevious) {
                            // v0.9.0 (DSL마빗 실기 E31): 건너뛴 단계(두 신호가 한꺼번에 바뀜)는 쌓지만 않고 버리지 않는다.
                            //   멈춤 자리(A·B 둘 다 1)로 돌아올 때 반 걸음이 ±2 이상이면 한 딸깍. 튐(3→1→3)은 +1−1 = 0.
                            if ((bits ^ encoderPrevious) != 3) encoderPartial += encoderSteps[encoderPrevious * 4 + bits]
                            if (bits == 3) {
                                if (encoderPartial >= 2) encoderCount++
                                else if (encoderPartial <= -2) encoderCount--
                                encoderPartial = 0
                            }
                            encoderPrevious = bits
                        }
                    }
                    basic.pause(1)
                }
            })
        }
    }
    /** Signed EC11 quadrature cycles since start/zero. Direction reverses when A and B are swapped. Not a high-speed rotation counter. Invalid setup=-9999. */
    export function encoderPosition(): number { return encoderA < 0 ? -9999 : encoderCount }
    /** Reset the EC11 count and incomplete cycle to zero. */
    export function zeroEncoder(): void { encoderCount = 0; encoderPartial = 0; encoderLastDir = 0 }
    let encoderLastDir = 0
    /** v0.8.0 direction since the last time this block was used: 1 = clockwise, -1 = counter-clockwise, 0 = still (BrixelAI DSL micro:bit card: 1 = clockwise, 0 = still). */
    export function encoderDirection(): number {
        if (encoderA < 0) return 0
        let d = encoderCount - encoderLastDir
        encoderLastDir = encoderCount
        return d > 0 ? 1 : d < 0 ? -1 : 0
    }
}
