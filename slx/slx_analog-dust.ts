// ⚠ 자동 생성 — 사이언스랩 analog-dust.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
namespace slxAir {
    let dustBusy = false
    let dustLastAt = -100
    /** A_016/017/018 Sharp-style analog dust kit: VO to a protected ADC pin, LED control to a digital pin. Needs 5V sensor power, VO voltage scaling and a voltage-compatible LED driver. Mean of 8 pulses, raw 0..1023, not PM2.5 or ug/m3. Timing/ADC streaming conflict=-1. */
    export function analogDust(signal: SlxAnalogPin, lamp: SlxDigitalPin): number {
        if (!slxInternal.validDigital(lamp) || <number>signal == <number>lamp ||
            (signal != SlxAnalogPin.P0 && signal != SlxAnalogPin.P1 && signal != SlxAnalogPin.P2 &&
             signal != SlxAnalogPin.P3 && signal != SlxAnalogPin.P4 && signal != SlxAnalogPin.P10)) return -1
        while (dustBusy) basic.pause(1)
        dustBusy = true
        slxInternal.prepare(signal); slxInternal.prepare(lamp)
        let sum = 0
        let valid = true
        for (let i = 0; i < 8; i++) {
            let wait = 10 - (control.millis() - dustLastAt)
            if (wait > 0) basic.pause(wait)
            dustLastAt = control.millis()
            let sample = slxNative.sampleDust(signal, lamp)
            if (sample < 0 || sample > 1023) { valid = false; break }
            sum += sample
        }
        dustBusy = false
        return valid ? Math.round(sum / 8) : -1
    }
}
