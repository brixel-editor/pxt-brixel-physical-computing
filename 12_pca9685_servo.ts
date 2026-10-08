namespace Actuators05 {
    let pcaFrequencyAddresses: number[] = []
    let pcaFrequencies: number[] = []
    export function pca9685RememberFrequency(addr: number, hz: number): void {
        let i = pcaFrequencyAddresses.indexOf(addr)
        if (i < 0) { i = pcaFrequencyAddresses.length; pcaFrequencyAddresses.push(addr); pcaFrequencies.push(0) }
        pcaFrequencies[i] = hz
    }
    export function pca9685Frequency(addr: number): number {
        let i = pcaFrequencyAddresses.indexOf(addr)
        return i < 0 ? 0 : pcaFrequencies[i]
    }
    function servoAddressValid(addr: number): boolean { return addr >= 0x40 && addr <= 0x77 && addr != 0x70 && addr == Math.floor(addr) }
    /** A PCA9685 uses one frequency for all 16 channels. Use a separate address/board for DC motors. */
    //% block="PCA9685 servo driver start address $addr"
    //% group="서보 드라이버(PCA9685)" addr.defl=0x41
    export function pca9685ServoInit(addr: number): void {
        if (!servoAddressValid(addr)) return
        pins.i2cWriteNumber(addr, 0x0010, NumberFormat.UInt16BE)
        pins.i2cWriteNumber(addr, 0xFE79, NumberFormat.UInt16BE) // 25MHz / 4096 / (121+1) = 50.03Hz
        pins.i2cWriteNumber(addr, 0x0020, NumberFormat.UInt16BE)
        basic.pause(5)
        pins.i2cWriteNumber(addr, 0x00A0, NumberFormat.UInt16BE)
        pca9685RememberFrequency(addr, 50)
    }
    function servoPWM(addr: number, channel: number, off: number): void {
        if (!servoAddressValid(addr) || channel < 1 || channel > 16 || channel != Math.floor(channel)) return
        if (pca9685Frequency(addr) != 50) pca9685ServoInit(addr)
        pins.i2cWriteBuffer(addr, pins.createBufferFromArray([6 + (channel - 1) * 4, 0, 0, off & 255, (off >> 8) & 31]))
    }
    /** Standard 50Hz servo pulse. Channel numbers are 1..16 (PCB labels 0..15). Match pulse range to the servo specification. */
    //% block="PCA9685 servo address $addr channel $channel pulse $micros us"
    //% group="서보 드라이버(PCA9685)" addr.defl=0x41 channel.defl=1 channel.min=1 channel.max=16 micros.defl=1500 micros.min=500 micros.max=2500
    export function pca9685ServoPulse(addr: number, channel: number, micros: number): void {
        if (!BrixelInternal.finite(micros) || micros < 500 || micros > 2500) return
        servoPWM(addr, channel, Math.round(micros * 25000000 / (122 * 1000000)))
    }
    /** Conservative 1000..2000us range. For a servo needing another range use the pulse block. */
    //% block="PCA9685 servo address $addr channel $channel angle $angle"
    //% group="서보 드라이버(PCA9685)" addr.defl=0x41 channel.defl=1 channel.min=1 channel.max=16 angle.defl=90 angle.min=0 angle.max=180
    export function pca9685ServoAngle(addr: number, channel: number, angle: number): void {
        if (!BrixelInternal.finite(angle) || angle < 0 || angle > 180) return
        pca9685ServoPulse(addr, channel, 1000 + angle * 1000 / 180)
    }
    /** Stops pulses on the chosen channel; this is not a mechanical brake or a power disconnect. */
    //% block="PCA9685 servo address $addr channel $channel release"
    //% group="서보 드라이버(PCA9685)" addr.defl=0x41 channel.defl=1 channel.min=1 channel.max=16
    export function pca9685ServoRelease(addr: number, channel: number): void { servoPWM(addr, channel, 4096) }
}
