// Adapted from BRIXEL Science Lab v0.6.1 (MIT). See SOURCES.md.
namespace BrixelInternal {
    export function validDigital(pin: number): boolean {
        return pin == DigitalPin.P0 || pin == DigitalPin.P1 || pin == DigitalPin.P2 ||
            pin == DigitalPin.P8 || pin == DigitalPin.P9 || pin == DigitalPin.P12 ||
            pin == DigitalPin.P13 || pin == DigitalPin.P14 || pin == DigitalPin.P15 || pin == DigitalPin.P16
    }
    export function prepare(pin: number): void {
        if (pin == DigitalPin.P0) pins.setAudioPinEnabled(false)
        if (pin == DigitalPin.P3 || pin == DigitalPin.P4 || pin == DigitalPin.P10) led.enable(false)
    }
    export function analog(pin: AnalogPin): number {
        if (pin != AnalogPin.P0 && pin != AnalogPin.P1 && pin != AnalogPin.P2 &&
            pin != AnalogPin.P3 && pin != AnalogPin.P4 && pin != AnalogPin.P10) return -1
        prepare(pin)
        return pins.analogReadPin(<AnalogPin><number>pin)
    }
    export function digital(pin: DigitalPin): number {
        if (pin != DigitalPin.P0 && pin != DigitalPin.P1 && pin != DigitalPin.P2 &&
            pin != DigitalPin.P8 && pin != DigitalPin.P9 && pin != DigitalPin.P12 &&
            pin != DigitalPin.P13 && pin != DigitalPin.P14 && pin != DigitalPin.P15 && pin != DigitalPin.P16) return -1
        prepare(pin)
        return pins.digitalReadPin(<DigitalPin><number>pin)
    }
    // v0.4.0: I2C 장치가 응답(ACK)하는지 — 레지스터 포인터 1바이트를 쓰고 상태값을 본다.
    //   센서가 없으면 i2cWriteBuffer 가 0 이 아닌 오류 코드를 돌려준다(멈추지 않는다).
    //   읽기 경로가 어차피 쓰는 «레지스터 지정» 쓰기를 대신하므로 추가 트랜잭션이 없다.
    export function i2cSelect(addr: number, reg: number, repeated: boolean): boolean {
        let b = pins.createBuffer(1)
        b[0] = reg & 0xFF
        return (pins.i2cWriteBuffer(addr, b, repeated) | 0) == 0
    }
    export function finite(value: number): boolean {
        return value == value && value - value == 0
    }
    // A short stable capture for calibration, not an accuracy specification or a long settling wait.
    export function calibrationAnalog(pin: AnalogPin): number {
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
