// ⚠ 자동 생성 — 사이언스랩 clock.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxClockValue {
    Hour = 0,
    Minute = 1,
    Second = 2
}
namespace slxWeather {
    function clockBCD(value: number): number {
        if ((value & 15) > 9 || (value >> 4) > 9) return -1
        return (value >> 4) * 10 + (value & 15)
    }
    function clockDateValid(data: Buffer): boolean {
        let day = clockBCD(data[4]), month = clockBCD(data[5]), year = clockBCD(data[6])
        if (data[3] < 1 || data[3] > 7 || month < 1 || month > 12 || day < 1 || year < 0) return false
        let days = [31, year % 4 == 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return day <= days[month - 1]
    }
    function clockToBCD(value: number): number { return Math.floor(value / 10) * 16 + value % 10 }

    /** Set and start DS1307 in 24-hour mode (hour 0-23, minute/second 0-59, integers). Run only when adjusting time, not in forever. Keeps a valid calendar; initializes an invalid calendar to 2000-01-01. Needs appropriate power/I2C levels; do not connect MPU6050 at the same 0x68 address. */
    export function setClock(hour: number, minute: number, second: number): void { trySetClock(hour, minute, second) }

    /** TypeScript only: same setting operation, returning false on invalid input or I2C failure. A failed write may be partial; retry with valid inputs after checking the connection. */
    export function trySetClock(hour: number, minute: number, second: number): boolean {
        if (!slxInternal.finite(hour) || !slxInternal.finite(minute) || !slxInternal.finite(second) ||
            hour != Math.floor(hour) || minute != Math.floor(minute) || second != Math.floor(second) ||
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return false
        slxBus.acquire()
        let data = slxBus.register(0x68, 0, 7)
        let ok = false
        if (data) {
            // Clear CH, select 24h, and write all time fields in one transfer (<1s).
            let command = [0, clockToBCD(second), clockToBCD(minute), clockToBCD(hour)]
            // Preserve valid dates without writing a stale date across midnight.
            // For uninitialized calendars use Saturday, 2000-01-01 (Sunday=1).
            if (!clockDateValid(data)) command = command.concat([7, 1, 1, 0])
            ok = slxBus.write(0x68, command)
        }
        slxBus.release()
        return ok
    }

    /** Read DS1307 hour (0-23), minute or second. Use set RTC clock once to initialize or adjust it. Reading does not reset it. Needs appropriate power/I2C levels; do not share address 0x68 with MPU6050. Invalid/halted/I2C error=-1. */
    export function clock(value: SlxClockValue): number {
        if (value < 0 || value > 2 || value != Math.floor(value)) return -1
        slxBus.acquire()
        let data = slxBus.register(0x68, 0, 7)
        slxBus.release()
        if (!data || (data[0] & 128) || (data[1] & 128) || (data[2] & 128)) return -1
        let second = clockBCD(data[0]), minute = clockBCD(data[1])
        let hour = clockBCD(data[2] & (data[2] & 64 ? 31 : 63))
        if (data[2] & 64) {
            if (hour < 1 || hour > 12) return -1
            hour = hour % 12 + ((data[2] & 32) ? 12 : 0)
        }
        if (second < 0 || second > 59 || minute < 0 || minute > 59 || hour < 0 || hour > 23 ||
            !clockDateValid(data)) return -1
        return value == SlxClockValue.Hour ? hour : (value == SlxClockValue.Minute ? minute : second)
    }
}
