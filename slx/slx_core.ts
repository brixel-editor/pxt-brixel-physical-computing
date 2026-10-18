// ⚠ 자동 생성 — 사이언스랩 core.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxAnalogPin {
    P0 = AnalogPin.P0,
    P1 = AnalogPin.P1,
    P2 = AnalogPin.P2,
    P3 = AnalogPin.P3,
    P4 = AnalogPin.P4,
    P10 = AnalogPin.P10
}
enum SlxDigitalPin {
    P0 = DigitalPin.P0,
    P1 = DigitalPin.P1,
    P2 = DigitalPin.P2,
    P8 = DigitalPin.P8,
    P9 = DigitalPin.P9,
    P12 = DigitalPin.P12,
    P13 = DigitalPin.P13,
    P14 = DigitalPin.P14,
    P15 = DigitalPin.P15,
    P16 = DigitalPin.P16
}
/** Internal shared pin handling. Pin values are the core enum values, not connector column numbers. */
enum SlxMagnetPole {
    North = 0,
    South = 1,
    None = 2
}
enum SlxLineRef {
    White = 0,
    Black = 1
}
enum SlxJoystickDir {
    Center = 0,
    Up = 1,
    Down = 2,
    Left = 3,
    Right = 4
}
namespace slxInternal {
    // v0.9.0 해석 값 공통: 원시값을 lo..hi 사이 0..100% 로(정수, 범위 밖은 자름). 잘못된 핀 = -1
    export function percentOf(pin: number, lo: number, hi: number): number {
        let v = analog(<SlxAnalogPin>pin)
        if (v < 0) return -1
        return Math.max(0, Math.min(100, Math.round((v - lo) * 100 / (hi - lo))))
    }
    // v0.9.0 흔들림 폭: n 번 읽는 동안 최댓값 − 최솟값(gapUs 마이크로초 간격). 잘못된 핀 = -1
    export function swing(pin: number, n: number, gapUs: number): number {
        let hi = 0, lo = 1023
        for (let k = 0; k < n; k++) {
            let v = analog(<SlxAnalogPin>pin)
            if (v < 0) return -1
            if (v > hi) hi = v
            if (v < lo) lo = v
            control.waitMicros(gapUs)
        }
        return hi - lo
    }
    export function validDigital(pin: number): boolean {
        return pin == DigitalPin.P0 || pin == DigitalPin.P1 || pin == DigitalPin.P2 ||
            pin == DigitalPin.P8 || pin == DigitalPin.P9 || pin == DigitalPin.P12 ||
            pin == DigitalPin.P13 || pin == DigitalPin.P14 || pin == DigitalPin.P15 || pin == DigitalPin.P16
    }
    export function prepare(pin: number): void {
        if (pin == DigitalPin.P0) pins.setAudioPinEnabled(false)
        if (pin == DigitalPin.P3 || pin == DigitalPin.P4 || pin == DigitalPin.P10) led.enable(false)
    }
    export function analog(pin: SlxAnalogPin): number {
        if (pin != SlxAnalogPin.P0 && pin != SlxAnalogPin.P1 && pin != SlxAnalogPin.P2 &&
            pin != SlxAnalogPin.P3 && pin != SlxAnalogPin.P4 && pin != SlxAnalogPin.P10) return -1
        prepare(pin)
        return pins.analogReadPin(<AnalogPin><number>pin)
    }
    export function digital(pin: SlxDigitalPin): number {
        if (pin != SlxDigitalPin.P0 && pin != SlxDigitalPin.P1 && pin != SlxDigitalPin.P2 &&
            pin != SlxDigitalPin.P8 && pin != SlxDigitalPin.P9 && pin != SlxDigitalPin.P12 &&
            pin != SlxDigitalPin.P13 && pin != SlxDigitalPin.P14 && pin != SlxDigitalPin.P15 && pin != SlxDigitalPin.P16) return -1
        prepare(pin)
        return pins.digitalReadPin(<DigitalPin><number>pin)
    }
    // Display blocks accept text or numbers. Non-integer numbers are rounded to 2 decimals to fit a 16-character LCD line.
    export function displayText(value: any): string {
        if (typeof value == "number") {
            let n = <number>value
            if (finite(n) && n != Math.floor(n)) n = Math.round(n * 100) / 100
            return "" + n
        }
        return "" + value
    }
    export function finite(value: number): boolean {
        return value == value && value - value == 0
    }
    // A short stable capture for calibration, not an accuracy specification or a long settling wait.
    export function calibrationAnalog(pin: SlxAnalogPin): number {
        let sum = 0, low = 1023, high = 0
        for (let i = 0; i < 16; i++) {
            let raw = analog(pin)
            if (!finite(raw) || raw < 0 || raw > 1023) return -1
            sum += raw; low = Math.min(low, raw); high = Math.max(high, raw)
            basic.pause(5)
        }
        return high - low <= 20 ? sum / 16 : -1
    }
}


