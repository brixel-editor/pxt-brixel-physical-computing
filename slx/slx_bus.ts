// ⚠ 자동 생성 — 사이언스랩 bus.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Simulator fallbacks report unavailable hardware rather than fabricated sensor readings.
namespace slxNative {
    //% shim=slxNative::micOff
    export function micOff(): void { }
    //% shim=slxNative::micEvents
    export function micEvents(): void { }
    //% shim=slxNative::startSensorUART
    export function startSensorUART(rx: number, tx: number, baud: number): boolean { return false }
    //% shim=slxNative::sampleDust
    export function sampleDust(analog: number, lamp: number): number { return -1 }
    //% shim=slxNative::readSensorUART
    export function readSensorUART(): Buffer { return pins.createBuffer(0) }
    //% shim=slxNative::writeSensorUART
    export function writeSensorUART(data: Buffer): boolean { return false }
    //% shim=slxNative::readI2C
    export function readI2C(address: number, size: number): Buffer { return pins.createBuffer(size + 1) }
    //% shim=slxNative::readDHT
    export function readDHT(pin: number): Buffer { return pins.createBuffer(0) }
    //% shim=slxNative::echoPulse
    export function echoPulse(trigger: number, echo: number, timeout: number): number { return 0 }
    //% shim=slxNative::showPixels
    export function showPixels(pin: number, data: Buffer): boolean { return false }
}
namespace slxBus {
    // Cooperative lock spans measurement waits so two fibers cannot overlap commands.
    let busy = false
    export function acquire(): void { while (busy) basic.pause(1); busy = true }
    export function release(): void { busy = false }
    export function write(address: number, data: number[], repeated: boolean = false): boolean {
        return pins.i2cWriteBuffer(address, pins.createBufferFromArray(data), repeated) == 0
    }
    export function read(address: number, size: number): Buffer {
        let result = slxNative.readI2C(address, size)
        if (result.length != size + 1 || result[0] != 1) return null
        return result.slice(1, size)
    }
    export function register(address: number, register: number, size: number): Buffer {
        if (!write(address, [register], true)) return null
        return read(address, size)
    }
    export function u16(data: Buffer, offset: number): number { return data[offset] | data[offset + 1] << 8 }
    export function s16(data: Buffer, offset: number): number {
        let value = u16(data, offset)
        return value & 0x8000 ? value - 65536 : value
    }
    export function be16(data: Buffer, offset: number): number { return data[offset] << 8 | data[offset + 1] }
    export function signedBE(data: Buffer, offset: number): number {
        let value = be16(data, offset)
        return value & 0x8000 ? value - 65536 : value
    }
    export function crc8(data: Buffer, start: number, length: number, initial: number, polynomial: number): number {
        let crc = initial
        for (let i = start; i < start + length; i++) {
            crc ^= data[i]
            for (let bit = 0; bit < 8; bit++) crc = ((crc & 128) ? (crc << 1) ^ polynomial : crc << 1) & 255
        }
        return crc
    }
}
