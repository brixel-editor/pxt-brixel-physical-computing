// Sensor wrappers adapted from BRIXEL Science Lab v0.6.1 (MIT).

namespace Sensors03 {
    /** a-006: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="light sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function light(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-007: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="UV sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function uvRaw(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-030: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="sound sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function sound(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
}

namespace Sensors03 {
    /** a-008: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="soil moisture sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function soilMoisture(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-015: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="water sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function water(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** 2025 orders Sheet1 E26: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="rain sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function rain(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
}

namespace Sensors03 {
    /** a-019: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="vibration sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function vibration(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-021: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="magnet sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function magnet(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-023: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="force sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function force(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-025: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="rotation sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function rotation(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-026: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="continuous rotation sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function infiniteRotation(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-027: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="slider sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function slider(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
}

namespace Sensors03 {
    /** a-022: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="4-pad analog touch sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function analogTouch(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-029: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="line sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function line(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** a-031: connect a 3.3V module to G/V/S of the selected pin. Raw 0..1023; not a calibrated physical unit. P3/P4/P10 turn off the LED display. */
    //%  block="IR object sensor $pin raw value" group="아날로그 입력" pin.defl=AnalogPin.P1
    export function object(pin: AnalogPin): number { return BrixelInternal.analog(pin) }
    /** d-017~020: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="button $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function button(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-021: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="rocker switch $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function switchValue(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-022~026: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="touch sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function touch(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-013: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="human presence sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function human(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-015: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="tilt sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function tilt(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-016: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="digital vibration sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function vibrationDigital(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-010: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="water level sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function waterLevel(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-012: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="photointerrupter $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function photoGate(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
    /** d-027: connect G/V/S to the selected digital pin. Returns the electrical signal 0 or 1. Module polarity varies. */
    //%  block="flame sensor $pin signal" group="디지털 입력" pin.defl=DigitalPin.P8
    export function flame(pin: DigitalPin): number { return BrixelInternal.digital(pin) }
}
