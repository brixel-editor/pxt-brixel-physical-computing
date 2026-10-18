// ⚠ 자동 생성 — 사이언스랩 communication.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Wired (USB) only. Bluetooth sending is the companion extension brixel-science-lab-ble,
// so classes that only use USB never start the BLE stack (its interrupts disturb timing-critical sensors).
namespace slxData {
    let usbStarted = false
    let sending = false

    /** Empty rows and NaN/Infinity are rejected; no fabricated measurements are sent. */
    export function encode(values: number[]): string {
        if (!values || values.length == 0) return ""
        let line = ""
        for (let i = 0; i < values.length; i++) {
            if (!slxInternal.finite(values[i])) return ""
            if (i > 0) line += ","
            line += "" + values[i]
        }
        return line
    }

    /** Send one sample as comma-separated numbers. Set Bowerbird to comma and 115200 baud. Empty or invalid samples are skipped. */
    export function sendUSB(values: number[]): void { trySendUSB(values) }

    /** Put one sensor reading in this block. Bowerbird USB settings: 115200 baud, comma delimiter. */
    export function sendValueUSB(value: number): void { trySendUSB([value]) }

    export function trySendUSB(values: number[]): boolean {
        let line = encode(values)
        if (line.length == 0 || sending) return false
        sending = true
        if (!usbStarted) {
            serial.redirectToUSB()
            serial.setBaudRate(BaudRate.BaudRate115200)
            usbStarted = true
        }
        serial.writeString(line + "\n")
        sending = false
        return true
    }
}
