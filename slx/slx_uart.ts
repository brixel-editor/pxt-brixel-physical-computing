// ⚠ 자동 생성 — 사이언스랩 uart.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxSensorBaud {
    Baud9600 = 9600,
    Baud19200 = 19200,
    Baud38400 = 38400,
    Baud57600 = 57600,
    Baud115200 = 115200
}
namespace slxUART {
    // One independent hardware UART. Starting a different sensor invalidates the old owner's values.
    export let owner = 0
    export let session = 0
    let configuring = false
    export function start(nextOwner: number, rx: number, tx: number, baud: number = 9600): boolean {
        while (configuring) basic.pause(1)
        configuring = true
        owner = 0
        session++
        let ready = false
        if ((baud == 9600 || baud == 19200 || baud == 38400 || baud == 57600 || baud == 115200) &&
            rx != tx && slxInternal.validDigital(rx) && (tx == -1 || slxInternal.validDigital(tx))) {
            // tx == -1: receive-only sensor (3-pin, e.g. PMS3003); the micro:bit never drives a TX pin.
            slxInternal.prepare(rx)
            if (tx != -1) slxInternal.prepare(tx)
            ready = slxNative.startSensorUART(rx, tx, baud)
        }
        if (ready) owner = nextOwner
        configuring = false
        return ready
    }
    export function write(expectedOwner: number, data: Buffer, expectedSession: number = 0): boolean {
        while (configuring) basic.pause(1)
        if (owner != expectedOwner || (expectedSession > 0 && session != expectedSession)) return false
        configuring = true
        let result = slxNative.writeSensorUART(data)
        configuring = false
        return result
    }
}
