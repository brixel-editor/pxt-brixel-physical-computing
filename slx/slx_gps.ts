// ⚠ 자동 생성 — 사이언스랩 gps.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
enum SlxGPSValue {
    Latitude = 0,
    Longitude = 1,
    Altitude = 2,
    Speed = 3,
    Satellites = 4
}
namespace slxMotion {
    let gpsWorker = false
    let gpsLine = ""
    let gpsByteAt = 0
    let gpsValues = [-9999, -9999, -9999, -9999, -9999]
    let gpsTimes = [-10000, -10000, -10000, -10000, -10000]
    function gpsInvalidate(): void {
        for (let i = 0; i < 4; i++) gpsTimes[i] = -10000
    }
    // Strict decimal parser; an empty or partially numeric field is never zero.
    function gpsNumber(text: string, signed: boolean = false): number {
        if (!text || text.length > 16) return -9999
        let value = 0
        let scale = 0
        let negative = signed && text.charAt(0) == "-"
        let digits = 0
        for (let i = negative ? 1 : 0; i < text.length; i++) {
            let ch = text.charCodeAt(i)
            if (ch == 46 && scale == 0) { scale = 1; continue }
            if (ch < 48 || ch > 57) return -9999
            value = value * 10 + ch - 48
            digits++
            if (scale) scale *= 10
        }
        if (!digits || text.charAt(text.length - 1) == ".") return -9999
        return (negative ? -1 : 1) * value / (scale || 1)
    }
    function gpsCoordinate(text: string, hemisphere: string, latitude: boolean): number {
        let dot = text.indexOf(".")
        let width = dot < 0 ? text.length : dot
        if (width != (latitude ? 4 : 5)) return -9999
        let raw = gpsNumber(text)
        if (raw < 0) return -9999
        let degrees = Math.floor(raw / 100)
        let minutes = raw - degrees * 100
        let limit = latitude ? 90 : 180
        if (minutes >= 60 || degrees > limit || (degrees == limit && minutes != 0)) return -9999
        let positive = latitude ? "N" : "E"
        let negative = latitude ? "S" : "W"
        if (hemisphere != positive && hemisphere != negative) return -9999
        return (degrees + minutes / 60) * (hemisphere == negative ? -1 : 1)
    }
    function gpsHex(ch: number): number {
        if (ch >= 48 && ch <= 57) return ch - 48
        if (ch >= 65 && ch <= 70) return ch - 55
        if (ch >= 97 && ch <= 102) return ch - 87
        return -1
    }
    function gpsTimeValid(text: string): boolean {
        if (!text || text.length < 6 || (text.length > 6 && text.charAt(6) != ".")) return false
        let time = gpsNumber(text)
        return time >= 0 && Math.floor(time / 10000) < 24 && Math.floor(time / 100) % 100 < 60 && time % 100 < 61
    }
    function gpsSentence(line: string): void {
        if (line.length < 10 || line.charAt(0) != "$" || line.charAt(6) != ",") return
        let talker = line.substr(1, 2)
        if (talker != "GP" && talker != "GN" && talker != "GL" && talker != "GA" && talker != "GB" && talker != "BD") return
        let type = line.substr(3, 3)
        if (type != "RMC" && type != "GGA") return
        let star = line.indexOf("*")
        let checksum = 0
        for (let i = 1; i < star; i++) checksum ^= line.charCodeAt(i)
        let hi = gpsHex(line.charCodeAt(star + 1))
        let lo = gpsHex(line.charCodeAt(star + 2))
        if (star < 7 || star != line.length - 3 || hi < 0 || lo < 0 || checksum != hi * 16 + lo) {
            gpsInvalidate(); gpsTimes[4] = -10000; return
        }
        let f = line.substr(0, star).split(",")
        let rmc = type == "RMC"
        if (f.length < (rmc ? 10 : 11) || !gpsTimeValid(f[1])) { gpsInvalidate(); gpsTimes[4] = -10000; return }
        if (!rmc) {
            let satellites = gpsNumber(f[7])
            gpsTimes[4] = -10000
            if (satellites >= 0 && satellites <= 99 && satellites == Math.floor(satellites)) {
                gpsValues[4] = satellites; gpsTimes[4] = control.millis()
            }
        }
        let quality = rmc ? 1 : gpsNumber(f[6])
        let mode = f.length > 12 ? f[12] : ""
        if ((rmc && (f[2] != "A" || (mode != "" && mode != "A" && mode != "D" && mode != "F" && mode != "R" && mode != "P"))) ||
            (!rmc && (quality < 1 || quality > 5 || quality != Math.floor(quality)))) { gpsInvalidate(); return }
        let lat = gpsCoordinate(f[rmc ? 3 : 2], f[rmc ? 4 : 3], true)
        let lon = gpsCoordinate(f[rmc ? 5 : 4], f[rmc ? 6 : 5], false)
        if (lat == -9999 || lon == -9999) { gpsInvalidate(); return }
        gpsValues[0] = lat; gpsValues[1] = lon
        gpsTimes[0] = gpsTimes[1] = control.millis()
        if (rmc) {
            let speed = gpsNumber(f[7])
            gpsTimes[3] = -10000
            if (speed >= 0 && speed <= 2000) { gpsValues[3] = speed * 1.852; gpsTimes[3] = control.millis() }
        } else {
            let altitude = gpsNumber(f[9], true)
            gpsTimes[2] = -10000
            if (f[10] == "M" && altitude >= -1000 && altitude <= 100000) {
                gpsValues[2] = altitude; gpsTimes[2] = control.millis()
            }
        }
    }
    function gpsConsume(data: Buffer): void {
        if (control.millis() - gpsByteAt > 500) gpsLine = ""
        if (data.length) gpsByteAt = control.millis()
        for (let i = 0; i < data.length; i++) {
            let ch = data[i]
            if (ch == 36) gpsLine = "$"
            else if (ch == 10) { if (gpsLine.length) gpsSentence(gpsLine); gpsLine = "" }
            else if (ch != 13 && gpsLine.length) {
                if (ch < 32 || ch > 126 || gpsLine.length >= 120) gpsLine = ""
                else gpsLine += String.fromCharCode(ch)
            }
        }
    }
    /** D_031 GPS, NMEA RMC/GGA. Match the module baud rate, normally 9600. Sensor TX to RX and RX to TX. Selects GPS instead of the other UART sensors; USB/BLE sending stays available. */
    export function startGPS(rx: SlxDigitalPin, tx: SlxDigitalPin, baud: SlxSensorBaud = SlxSensorBaud.Baud9600): void {
        gpsLine = ""; gpsInvalidate(); gpsTimes[4] = -10000
        if (!slxUART.start(3, rx, tx, baud)) return
        if (!gpsWorker) {
            gpsWorker = true
            control.inBackground(function () {
                while (true) {
                    if (slxUART.owner == 3) {
                        for (let i = 0; i < 4; i++) {
                            let data = slxNative.readSensorUART()
                            gpsConsume(data)
                            if (data.length < 64) break
                        }
                    }
                    basic.pause(10)
                }
            })
        }
    }
    /** True when GPS has a valid position less than 3 seconds old. Place the antenna where it can see the sky. */
    export function gpsReady(): boolean {
        return slxUART.owner == 3 && control.millis() - gpsTimes[0] <= 3000
    }
    /** Latitude/longitude are signed decimal degrees; speed is km/h. Missing, invalid, deselected or stale fields=-9999. Satellites can be available before a position fix. */
    export function gps(value: SlxGPSValue): number {
        if (value < 0 || value > 4 || value != Math.floor(value) || slxUART.owner != 3 || control.millis() - gpsTimes[value] > 3000) return -9999
        return gpsValues[value]
    }
}
