/**
 * BRIXEL Extension - 04. Advanced Sensors
 * RTC, BMP280, MPU6050, SGP30, VL53L0X, SHT30, TCS34725, CCS811, I2C Weight Sensor, etc.
 */

//% weight=1070 color=#4D68EC icon="\uf0e7" block="04. Adv Sensors"
//% groups='["실시간(RTC)","대기압(BMP280)","6축 가속도(MPU6050)","CO2센서(SGP30)","거리센서(VL53L0X)","온습도(I2C-SHT30)","색상감지(TCS34725)","비접촉온도(MLX90614)","제스처(APDS9960)","심박(MAX30102)","온습도(Si7021)","조도(BH1750)","조도(TSL2561)","CO2센서(CCS811)","3축 가속도(ADXL345)","대기압(BME280)","Fingerprint","전류/전압/전력 측정(INA219)","I2C 무게센서"]'
namespace AdvSensors {


    /********** RTC 모듈 (DS1302, DS1307, DS3231) **********/

    // RTC(Real Time Clock)는 전원이 꺼져도 시간을 유지하는 모듈입니다.
    // DS1307, DS3231: I2C 통신 (주소 0x68)
    // DS1302: 3선 통신 (CLK, DAT, RST)

    // RTC 시간 데이터
    export enum RTCData {
        //% block="year"
        Year = 0,
        //% block="month"
        Month = 1,
        //% block="day"
        Day = 2,
        //% block="hour"
        Hour = 3,
        //% block="minute"
        Minute = 4,
        //% block="second"
        Second = 5,
        //% block="day of week"
        DayOfWeek = 6
    }

    // RTC 시간 문자열 형식
    export enum RTCFormat {
        //% block="year/month/day hour:minute:second"
        Full = 0,
        //% block="year/month/day"
        DateOnly = 1,
        //% block="hour:minute:second"
        TimeOnly = 2,
        //% block="hour:minute"
        HourMinute = 3
    }

    // RTC SQW 출력 주파수
    export enum RTCSqwFreq {
        //% block="none"
        Off = 0,
        //% block="1Hz"
        Freq1Hz = 1,
        //% block="4.096kHz"
        Freq4kHz = 2,
        //% block="8.192kHz"
        Freq8kHz = 3,
        //% block="32.768kHz"
        Freq32kHz = 4
    }

    // RTC 상태 변수
    let _rtcAddr: number = 0x68  // DS1307/DS3231 I2C 주소
    let _rtcYear: number = 2024
    let _rtcMonth: number = 1
    let _rtcDay: number = 1
    let _rtcHour: number = 0
    let _rtcMinute: number = 0
    let _rtcSecond: number = 0
    let _rtcDayOfWeek: number = 1
    let _rtcHalted: boolean = false      // CH(발진 정지) 플래그
    let _rtcValid: boolean = false       // 읽은 시각이 유효 범위인지

    // 블록이 받은 addr 를 실제로 사용한다.
    // 다만 예전 블록들의 기본값이 1(장치번호처럼 쓰임)이라 그대로 I2C 주소로 보내면
    // 기존 프로젝트가 깨진다. 유효한 7비트 주소일 때만 쓰고, 아니면 rtcInit 값으로 폴백.
    function rtcAddrOf(addr: number): number {
        if (addr >= 0x08 && addr <= 0x77) return addr
        return _rtcAddr
    }

    // 날짜로 요일 계산 (Sakamoto). 반환 0=일 … 6=토
    function rtcDayOfWeek(y: number, m: number, d: number): number {
        const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
        let yy = y
        if (m < 3) yy = yy - 1
        return (yy + Math.idiv(yy, 4) - Math.idiv(yy, 100) + Math.idiv(yy, 400) + t[m - 1] + d) % 7
    }

    //% block="RTC(DS1307) set %addr"
    //% addr.defl=0x68
    //% group="실시간(RTC)" weight=180
    export function rtcInit(addr: number): void {
        _rtcAddr = rtcAddrOf(addr)
        // 오실레이터 활성화 = 초 레지스터의 CH(bit7) 만 0 으로.
        // ★ 예전에는 0x00 을 통째로 덮어써서 현재 '초' 값을 파괴했다(시계가 0초로 리셋).
        //   read-modify-write 로 CH 비트만 건드린다.
        pins.i2cWriteNumber(_rtcAddr, 0x00, NumberFormat.UInt8BE, true)
        let sec = pins.i2cReadNumber(_rtcAddr, NumberFormat.UInt8BE)
        let buf = pins.createBuffer(2)
        buf[0] = 0x00                 // 초 레지스터
        buf[1] = sec & 0x7F           // CH=0, 나머지 비트(초 BCD) 보존
        pins.i2cWriteBuffer(_rtcAddr, buf)
    }

    //% block="RTC %addr|time set year %year|month %month|day %day|hour %hour|minute %minute|second %second"
    //% addr.defl=1
    //% year.defl=2024 year.min=2000 year.max=2099
    //% month.defl=1 month.min=1 month.max=12
    //% day.defl=1 day.min=1 day.max=31
    //% hour.defl=12 hour.min=0 hour.max=23
    //% minute.defl=0 minute.min=0 minute.max=59
    //% second.defl=0 second.min=0 second.max=59
    //% group="실시간(RTC)" weight=179
    //% inlineInputMode=inline
    export function rtcSetTime(addr: number, year: number, month: number, day: number, hour: number, minute: number, second: number): void {
        let a = rtcAddrOf(addr)
        let buf = pins.createBuffer(8)
        buf[0] = 0x00  // 시작 레지스터
        // ★ 아두이노 DFRobot_DS1307::setTime() 은 stop() → 7개 필드 쓰기 → start() 순서로,
        //   발진기를 멈춘 상태에서 시각을 갱신한다. 예전에는 CH=0 인 채로 8바이트를 통째로
        //   써서 카운터가 도는 동안 갱신이 이뤄졌고, 페이지 쓰기가 초(분 경계에서는 분)
        //   경계를 걸치면 설정한 시각이 1 어긋날 수 있었다.
        //   여기서는 초 바이트의 CH(bit7)=1 로 보내 정지시킨 채 쓰고, 마지막에 CH=0 으로 재시동한다.
        buf[1] = decToBcd(second) | 0x80             // CH=1 → 발진 정지
        buf[2] = decToBcd(minute)
        buf[3] = decToBcd(hour)
        // 요일은 날짜에서 계산한다 (예전에는 0x01 고정이라 항상 같은 요일이 기록됐다)
        // ★ DS1307 의 DAY 카운터는 데이터시트상 01~07 이고 7 다음에 1 로 넘어간다.
        //   아두이노 DFRobot_DS1307 은 0~6 을 그대로 넣지만 그쪽이 데이터시트 위반이다.
        buf[4] = rtcDayOfWeek(year, month, day) + 1   // DS1307 은 1~7 (1 = 일요일)
        buf[5] = decToBcd(day)
        buf[6] = decToBcd(month)
        buf[7] = decToBcd(year - 2000)

        pins.i2cWriteBuffer(a, buf)

        // 발진기 재시동 — 초 레지스터를 CH=0 으로 다시 쓴다
        let runBuf = pins.createBuffer(2)
        runBuf[0] = 0x00
        runBuf[1] = decToBcd(second)                 // CH=0
        pins.i2cWriteBuffer(a, runBuf)

        // 내부 변수 업데이트
        _rtcYear = year
        _rtcMonth = month
        _rtcDay = day
        _rtcHour = hour
        _rtcMinute = minute
        _rtcSecond = second
    }

    //% block="RTC %addr|get %data"
    //% addr.defl=1
    //% group="실시간(RTC)" weight=178
    export function rtcGet(addr: number, data: RTCData): number {
        rtcReadAll(addr)

        switch (data) {
            case RTCData.Year: return _rtcYear
            case RTCData.Month: return _rtcMonth
            case RTCData.Day: return _rtcDay
            case RTCData.Hour: return _rtcHour
            case RTCData.Minute: return _rtcMinute
            case RTCData.Second: return _rtcSecond
            case RTCData.DayOfWeek: return _rtcDayOfWeek
            default: return 0
        }
    }

    //% block="RTC %addr|clock %action"
    //% addr.defl=1
    //% action.shadow="toggleOnOff" action.defl=true
    //% group="실시간(RTC)" weight=177
    export function rtcStart(addr: number, action: boolean): void {
        let a = rtcAddrOf(addr)
        // 초 레지스터의 CH 비트로 시계 시작/정지
        pins.i2cWriteNumber(a, 0x00, NumberFormat.UInt8BE)
        let seconds = pins.i2cReadNumber(a, NumberFormat.UInt8BE)

        if (action) {
            seconds &= 0x7F  // CH = 0 (시작)
        } else {
            seconds |= 0x80  // CH = 1 (정지)
        }

        let buf = pins.createBuffer(2)
        buf[0] = 0x00
        buf[1] = seconds
        pins.i2cWriteBuffer(a, buf)
    }

    //% block="RTC %addr|SQW output %freq"
    //% addr.defl=1
    //% group="실시간(RTC)" weight=176
    export function rtcSetSqw(addr: number, freq: RTCSqwFreq): void {
        let a = rtcAddrOf(addr)
        let control = 0x00

        switch (freq) {
            case RTCSqwFreq.Off:
                control = 0x00
                break
            case RTCSqwFreq.Freq1Hz:
                control = 0x10
                break
            case RTCSqwFreq.Freq4kHz:
                control = 0x11
                break
            case RTCSqwFreq.Freq8kHz:
                control = 0x12
                break
            case RTCSqwFreq.Freq32kHz:
                control = 0x13
                break
        }

        let buf = pins.createBuffer(2)
        buf[0] = 0x07  // 컨트롤 레지스터
        buf[1] = control
        pins.i2cWriteBuffer(a, buf)
    }

    //% block="RTC %addr|time string get format %format"
    //% addr.defl=1
    //% group="실시간(RTC)" weight=175
    export function rtcGetString(addr: number, format: RTCFormat): string {
        rtcReadAll(addr)

        let dateStr = _rtcYear + "/" + padZero(_rtcMonth) + "/" + padZero(_rtcDay)
        let timeStr = padZero(_rtcHour) + ":" + padZero(_rtcMinute) + ":" + padZero(_rtcSecond)

        switch (format) {
            case RTCFormat.Full:
                return dateStr + " " + timeStr
            case RTCFormat.DateOnly:
                return dateStr
            case RTCFormat.TimeOnly:
                return timeStr
            case RTCFormat.HourMinute:
                return padZero(_rtcHour) + ":" + padZero(_rtcMinute)
            default:
                return dateStr + " " + timeStr
        }
    }

    // RTC 전체 읽기 (내부 함수)
    function rtcReadAll(addr: number): void {
        let a = rtcAddrOf(addr)
        pins.i2cWriteNumber(a, 0x00, NumberFormat.UInt8BE, true)
        let buf = pins.i2cReadBuffer(a, 7)

        // CH(발진 정지) 플래그 — 백업 전원이 끊겼거나 시계가 선 적이 있으면 1
        _rtcHalted = (buf[0] & 0x80) != 0

        _rtcSecond = bcdToDec(buf[0] & 0x7F)
        _rtcMinute = bcdToDec(buf[1] & 0x7F)

        // ★ 시(hour) 레지스터의 bit6 은 12/24시 모드 선택이다.
        //   예전에는 0x3F 로 마스킹만 해서, 12시간 모드일 때 AM/PM 비트(bit5)가
        //   BCD 십의 자리에 섞여 들어가 엉뚱한 시각이 나왔다.
        if ((buf[2] & 0x40) != 0) {
            // 12시간 모드
            let h = bcdToDec(buf[2] & 0x1F)
            if ((buf[2] & 0x20) != 0) { if (h != 12) h += 12 }   // PM
            else { if (h == 12) h = 0 }                           // AM 12시 = 0시
            _rtcHour = h
        } else {
            _rtcHour = bcdToDec(buf[2] & 0x3F)                    // 24시간 모드
        }

        _rtcDayOfWeek = buf[3] & 0x07
        _rtcDay = bcdToDec(buf[4] & 0x3F)
        _rtcMonth = bcdToDec(buf[5] & 0x1F)
        _rtcYear = 2000 + bcdToDec(buf[6])

        // 범위 검증 — I2C 응답이 없거나 깨지면 0/255 같은 값이 들어온다
        _rtcValid = !_rtcHalted &&
            _rtcMonth >= 1 && _rtcMonth <= 12 &&
            _rtcDay >= 1 && _rtcDay <= 31 &&
            _rtcHour <= 23 && _rtcMinute <= 59 && _rtcSecond <= 59
    }

    //% block="RTC time valid?"
    //% group="실시간(RTC)" weight=174
    export function rtcTimeValid(): boolean {
        // ★ 예전에는 캐시(_rtcValid)만 읽어서, rtcGet/rtcGetString 을 한 번도 호출하지 않은
        //   "먼저 검사 → 그 다음 읽기" 패턴에서 영원히 false 로 굳어 있었다.
        //   여기서 직접 한 번 읽어 플래그를 갱신한다.
        rtcReadAll(_rtcAddr)
        return _rtcValid
    }

    // BCD ↔ 10진수 변환 (내부 함수)
    function decToBcd(dec: number): number {
        return Math.floor(dec / 10) * 16 + (dec % 10)
    }

    function bcdToDec(bcd: number): number {
        return Math.floor(bcd / 16) * 10 + (bcd % 16)
    }

    function padZero(num: number): string {
        return num < 10 ? "0" + num : "" + num
    }


    /********** BMP280 기압/온도 센서 **********/

    // BMP280 측정 타입
    export enum BMP280Type {
        //% block="pressure(hPa)"
        Pressure = 0,
        //% block="temperature(°C)"
        Temperature = 1
    }

    // BMP280 데이터 저장 변수
    let _bmp280Addr: number = 0x76
    let _bmp280Pressure: number = 0
    let _bmp280Temp: number = 0

    // BMP280 NVM 보정계수 (0x88~0x9F). 이걸 읽지 않으면 어떤 계산도 무의미하다.
    let _bmpT1 = 0, _bmpT2 = 0, _bmpT3 = 0
    let _bmpP1 = 0, _bmpP2 = 0, _bmpP3 = 0, _bmpP4 = 0, _bmpP5 = 0
    let _bmpP6 = 0, _bmpP7 = 0, _bmpP8 = 0, _bmpP9 = 0
    let _bmpTFine = 0
    let _bmpCalOk = false

    //% block="BMP280 init address %addr"
    //% addr.defl=0x76
    //% group="대기압(BMP280)" weight=170
    export function bmp280Init(addr: number): void {
        _bmp280Addr = addr

        // ★ chip ID(0xD0) 확인 — BMP280 은 0x58. 예전에는 검증이 없어 센서가 없거나
        //   주소가 틀려도 실패를 알 수 없었다.
        pins.i2cWriteNumber(_bmp280Addr, 0xD0, NumberFormat.UInt8BE, true)
        let chipId = pins.i2cReadNumber(_bmp280Addr, NumberFormat.UInt8BE)
        // ★ 아두이노 DFrobot_BMP280::config() 은 요청 주소에서 chip ID 가 안 맞으면
        //   말없이 BMP280_ADDRESS1(0x77) 로 바꿔 한 번 더 읽고, 그것도 틀려야 실패로 본다.
        //   SDO=HIGH 로 스트랩된 브레이크아웃(0x77)이 아두이노에서는 그냥 되는데
        //   여기서는 영원히 0 만 나오던 원인.
        if (chipId != 0x58 && _bmp280Addr != 0x77) {
            _bmp280Addr = 0x77
            pins.i2cWriteNumber(_bmp280Addr, 0xD0, NumberFormat.UInt8BE, true)
            chipId = pins.i2cReadNumber(_bmp280Addr, NumberFormat.UInt8BE)
        }
        if (chipId != 0x58) { _bmpCalOk = false; return }

        // 소프트 리셋 후 안정화 대기
        pins.i2cWriteNumber(_bmp280Addr, 0xE0B6, NumberFormat.UInt16BE)
        basic.pause(5)

        // ★ 보정계수 24바이트(0x88~0x9F) 독출 — 예전 구현에는 이 단계가 통째로 없었다.
        //   계수 없이 원시값에 상수만 나누면 온도·기압이 물리적으로 무의미한 숫자가 된다.
        pins.i2cWriteNumber(_bmp280Addr, 0x88, NumberFormat.UInt8BE, true)
        let cal = pins.i2cReadBuffer(_bmp280Addr, 24)
        _bmpT1 = cal.getNumber(NumberFormat.UInt16LE, 0)
        _bmpT2 = cal.getNumber(NumberFormat.Int16LE, 2)
        _bmpT3 = cal.getNumber(NumberFormat.Int16LE, 4)
        _bmpP1 = cal.getNumber(NumberFormat.UInt16LE, 6)
        _bmpP2 = cal.getNumber(NumberFormat.Int16LE, 8)
        _bmpP3 = cal.getNumber(NumberFormat.Int16LE, 10)
        _bmpP4 = cal.getNumber(NumberFormat.Int16LE, 12)
        _bmpP5 = cal.getNumber(NumberFormat.Int16LE, 14)
        _bmpP6 = cal.getNumber(NumberFormat.Int16LE, 16)
        _bmpP7 = cal.getNumber(NumberFormat.Int16LE, 18)
        _bmpP8 = cal.getNumber(NumberFormat.Int16LE, 20)
        _bmpP9 = cal.getNumber(NumberFormat.Int16LE, 22)
        _bmpCalOk = (_bmpT1 != 0)

        // 컨트롤 레지스터 설정
        // ★ 아두이노 DFrobot_BMP280::config() 은 CTRL_MEAS(0xF4) = 0x3F 를 쓴다.
        //   osrs_t=001(온도 x1), osrs_p=111(기압 x16), mode=11(normal).
        //   예전 값 0x27 은 기압 오버샘플링이 x1 이라 같은 모듈인데도 기압 잡음이
        //   약 6배(≈2.6Pa → ≈16Pa RMS) 커져 마지막 자리가 눈에 띄게 흔들렸다.
        //   변환시간은 약 5.5ms → 약 40ms 로 늘지만 아래 basic.pause(100) 안쪽이다.
        pins.i2cWriteNumber(_bmp280Addr, 0xF43F, NumberFormat.UInt16BE)
        basic.pause(100)
    }

    //% block="BMP280 calibration loaded?"
    //% group="대기압(BMP280)" weight=97
    export function bmp280Calibrated(): boolean {
        return _bmpCalOk
    }

    // 데이터시트 4.2.3 부동소수점 보상식.
    // (정수판은 기압 계산에 64비트가 필요한데 MakeCode 에는 없으므로 double 판을 쓴다)
    function bmpCompensateT(adcT: number): number {
        let v1 = (adcT / 16384.0 - _bmpT1 / 1024.0) * _bmpT2
        let d = adcT / 131072.0 - _bmpT1 / 8192.0
        let v2 = d * d * _bmpT3
        _bmpTFine = v1 + v2
        return (v1 + v2) / 5120.0            // °C
    }

    function bmpCompensateP(adcP: number): number {
        let v1 = _bmpTFine / 2.0 - 64000.0
        let v2 = v1 * v1 * _bmpP6 / 32768.0
        v2 = v2 + v1 * _bmpP5 * 2.0
        v2 = v2 / 4.0 + _bmpP4 * 65536.0
        v1 = (_bmpP3 * v1 * v1 / 524288.0 + _bmpP2 * v1) / 524288.0
        v1 = (1.0 + v1 / 32768.0) * _bmpP1
        if (v1 == 0) return 0
        let p = 1048576.0 - adcP
        p = (p - v2 / 4096.0) * 6250.0 / v1
        v1 = _bmpP9 * p * p / 2147483648.0
        v2 = p * _bmpP8 / 32768.0
        return p + (v1 + v2 + _bmpP7) / 16.0  // Pa
    }

    //% block="BMP280 read %btype"
    //% group="대기압(BMP280)" weight=169
    export function bmp280Read(btype: BMP280Type): number {
        // 기압 데이터 읽기 (0xF7~0xF9)
        pins.i2cWriteNumber(_bmp280Addr, 0xF7, NumberFormat.UInt8BE)
        let buf = pins.i2cReadBuffer(_bmp280Addr, 6)

        let pressRaw = (buf[0] << 12) | (buf[1] << 4) | (buf[2] >> 4)
        let tempRaw = (buf[3] << 12) | (buf[4] << 4) | (buf[5] >> 4)

        // 보정계수를 못 읽었으면 가짜 숫자를 내지 않는다 (bmp280Init 을 먼저 호출해야 함)
        if (!_bmpCalOk) {
            _bmp280Temp = 0
            _bmp280Pressure = 0
        } else {
            // ★ 반드시 온도를 먼저 — 기압 보상이 t_fine 을 쓴다
            _bmp280Temp = bmpCompensateT(tempRaw)
            _bmp280Pressure = bmpCompensateP(pressRaw) / 100.0   // Pa → hPa
        }

        if (btype == BMP280Type.Temperature) {
            return _bmp280Temp
        }
        return _bmp280Pressure
    }


    /********** MPU6050 가속도/자이로 센서 **********/

    // 축 선택
    export enum Axis {
        //% block="X"
        X = 0,
        //% block="Y"
        Y = 1,
        //% block="Z"
        Z = 2
    }

    // MPU6050 측정 타입
    export enum MPU6050Type {
        //% block="acceleration"
        Accel = 0,
        //% block="gyro"
        Gyro = 1,
        //% block="temperature"
        Temp = 2
    }

    // MPU6050 데이터 타입 (한글)
    export enum MPU6050DataType {
        //% block="temperature(°C)"
        Temperature = 0,
        //% block="accel X"
        AccelX = 1,
        //% block="accel Y"
        AccelY = 2,
        //% block="accel Z"
        AccelZ = 3,
        //% block="gyro X"
        GyroX = 4,
        //% block="gyro Y"
        GyroY = 5,
        //% block="gyro Z"
        GyroZ = 6
    }

    // MPU6050 데이터 저장 변수
    let _mpu6050Addr: number = 0x68
    let _mpu6050Present: boolean = false
    let _mpu6050GyroOffsetX: number = 0
    let _mpu6050GyroOffsetY: number = 0
    let _mpu6050GyroOffsetZ: number = 0
    let _mpu6050AccelX: number = 0
    let _mpu6050AccelY: number = 0
    let _mpu6050AccelZ: number = 0
    let _mpu6050GyroX: number = 0
    let _mpu6050GyroY: number = 0
    let _mpu6050GyroZ: number = 0
    let _mpu6050Temp: number = 0

    //% block="Gyro sensor(MPU6050) setup"
    //% group="6축 가속도(MPU6050)" weight=165
    export function mpu6050Setup(): void {
        // ★ 예전에는 0x68 을 무조건 덮어써서, mpu6050Init(0x69) 로 지정한 AD0=HIGH 보드의
        //   주소를 조용히 되돌렸다. 유효 범위를 벗어난 경우에만 기본값으로 폴백한다.
        if (_mpu6050Addr < 0x08 || _mpu6050Addr > 0x77) _mpu6050Addr = 0x68
        // ★ WHO_AM_I(0x75) 로 장치 존재를 확인한다. MPU-6050 은 0x68 을 돌려준다.
        //   예전에는 확인이 전혀 없어 센서 미연결이 '정상값 0' 으로 조용히 통과했다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x75, NumberFormat.UInt8BE, true)
        let who = pins.i2cReadNumber(_mpu6050Addr, NumberFormat.UInt8BE)
        _mpu6050Present = (who == 0x68 || who == 0x69 || who == 0x70 || who == 0x71)

        // 슬립 모드 해제
        // ★ PWR_MGMT_1 = 0x01 : 슬립 해제 + CLKSEL=1(자이로 X축 PLL).
        //   0x00 은 데이터시트가 비권장하는 내부 8MHz RC 오실레이터를 쓴다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x6B01, NumberFormat.UInt16BE)
        basic.pause(100)
        // ★ 아두이노 MPU6050_tockn::begin() 은 SMPLRT_DIV(0x19)=0x00, CONFIG(0x1A)=0x00 도
        //   명시적으로 쓴다. 안 쓰면 이전 프로그램이 남긴 DLPF/분주비가 그대로 살아 있어
        //   대역폭과 출력 주기가 아두이노판과 달라진다(재실행해도 남고 전원을 껐다 켜야 사라짐).
        pins.i2cWriteNumber(_mpu6050Addr, 0x1900, NumberFormat.UInt16BE)   // SMPLRT_DIV = 0
        pins.i2cWriteNumber(_mpu6050Addr, 0x1A00, NumberFormat.UInt16BE)   // CONFIG = 0 (DLPF off)
        // 자이로 범위 설정 (±500°/s)
        // ★ 아두이노는 GYRO_CONFIG = 0x08 (FS_SEL=1, ±500°/s, 65.5 LSB/(°/s)) 이다.
        //   0x00(±250°/s)이면 손을 한 번 휙 젓거나 로봇이 제자리 회전하는 정도에서
        //   포화 후 부호가 뒤집힌다. 아래 MPU_GYRO_LSB_PER_DPS 와 반드시 함께 바뀐다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x1B08, NumberFormat.UInt16BE)
        // 가속도 범위 설정 (±2g)
        pins.i2cWriteNumber(_mpu6050Addr, 0x1C00, NumberFormat.UInt16BE)
        basic.pause(10)
    }

    // MPU-6050 감도 (setup 에서 ACCEL_CONFIG=0x00, GYRO_CONFIG=0x08 으로 고정하므로 상수)
    //   AFS_SEL=0 (±2g)      → 16384 LSB/g
    //   FS_SEL =1 (±500°/s)  →  65.5 LSB/(°/s)   ← 아두이노 MPU6050_tockn 과 동일
    // ★ 예전에는 이 나눗셈이 드라이버 전체에 하나도 없어 16비트 원시 카운트를
    //   그대로 '가속도(g)'·'자이로(°/s)' 라고 반환했다(책상 위 정지 시 Z 가 1 이 아니라 16384).
    // ★ 이 상수와 GYRO_CONFIG 레지스터 값은 반드시 같이 바뀌어야 한다.
    //   한쪽만 바꾸면 모든 자이로 값이 정확히 2배 틀어진다.
    const MPU_ACCEL_LSB_PER_G = 16384
    const MPU_GYRO_LSB_PER_DPS = 65.5

    //% block="MPU6050 update values"
    //% group="6축 가속도(MPU6050)" weight=164
    export function mpu6050Update(): void {
        // ★ 아두이노 MPU6050_tockn::update() 는 0x3B 부터 14바이트를 반복시작으로 한 번에
        //   읽는다(가속도 6 + 온도 2 + 자이로 6). 예전처럼 세 번 나눠 읽으면 가속도와
        //   자이로가 서로 다른 샘플 시점의 값이 되어 같은 순간을 설명하지 못하고,
        //   버스 트래픽도 3배가 된다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x3B, NumberFormat.UInt8BE, true)
        let buf14 = pins.i2cReadBuffer(_mpu6050Addr, 14)

        let rawAccelX = (buf14[0] << 8) | buf14[1]
        if (rawAccelX > 32767) rawAccelX -= 65536
        let rawAccelY = (buf14[2] << 8) | buf14[3]
        if (rawAccelY > 32767) rawAccelY -= 65536
        let rawAccelZ = (buf14[4] << 8) | buf14[5]
        if (rawAccelZ > 32767) rawAccelZ -= 65536
        _mpu6050AccelX = rawAccelX / MPU_ACCEL_LSB_PER_G
        _mpu6050AccelY = rawAccelY / MPU_ACCEL_LSB_PER_G
        _mpu6050AccelZ = rawAccelZ / MPU_ACCEL_LSB_PER_G

        // 온도 (0x41~0x42)
        let tempVal = (buf14[6] << 8) | buf14[7]
        if (tempVal > 32767) tempVal -= 65536
        // ★ Math.floor 는 분해능을 1°C 로 떨어뜨리고 영하에서 항상 내림된다.
        //   0.1°C 분해능을 유지한다.
        _mpu6050Temp = Math.round((tempVal / 340 + 36.53) * 10) / 10

        // 자이로 (0x43~0x48, 오프셋 적용)
        let rawGyroX = (buf14[8] << 8) | buf14[9]
        if (rawGyroX > 32767) rawGyroX -= 65536
        let rawGyroY = (buf14[10] << 8) | buf14[11]
        if (rawGyroY > 32767) rawGyroY -= 65536
        let rawGyroZ = (buf14[12] << 8) | buf14[13]
        if (rawGyroZ > 32767) rawGyroZ -= 65536

        // 오프셋은 원시 카운트 단위이므로 뺀 뒤에 감도로 나눈다
        _mpu6050GyroX = (rawGyroX - _mpu6050GyroOffsetX) / MPU_GYRO_LSB_PER_DPS
        _mpu6050GyroY = (rawGyroY - _mpu6050GyroOffsetY) / MPU_GYRO_LSB_PER_DPS
        _mpu6050GyroZ = (rawGyroZ - _mpu6050GyroOffsetZ) / MPU_GYRO_LSB_PER_DPS
    }

    //% block="MPU6050 connected?"
    //% group="6축 가속도(MPU6050)" weight=118
    export function mpu6050Connected(): boolean {
        return _mpu6050Present
    }

    //% block="MPU6050 read: %dtype"
    //% dtype.defl=MPU6050DataType.Temperature
    //% group="6축 가속도(MPU6050)" weight=163
    export function mpu6050ReadValue(dtype: MPU6050DataType): number {
        if (dtype == MPU6050DataType.Temperature) return _mpu6050Temp
        if (dtype == MPU6050DataType.AccelX) return _mpu6050AccelX
        if (dtype == MPU6050DataType.AccelY) return _mpu6050AccelY
        if (dtype == MPU6050DataType.AccelZ) return _mpu6050AccelZ
        if (dtype == MPU6050DataType.GyroX) return _mpu6050GyroX
        if (dtype == MPU6050DataType.GyroY) return _mpu6050GyroY
        return _mpu6050GyroZ
    }

    //% block="Gyro offset set X: %x Y: %y Z: %z"
    //% x.defl=0 y.defl=0 z.defl=0
    //% group="6축 가속도(MPU6050)" weight=162
    //% inlineInputMode=inline
    export function mpu6050SetGyroOffset(x: number, y: number, z: number): void {
        // ★ 내부 오프셋은 원시 카운트 단위인데, 사용자가 볼 수 있는 자이로 값은 모두
        //   °/s(131 LSB 로 나눈 값)뿐이라 예전에는 입력한 값이 131배 작게 적용됐다.
        //   읽기 블록이 보여준 °/s 값을 그대로 넣으면 되도록 카운트로 환산한다.
        _mpu6050GyroOffsetX = x * MPU_GYRO_LSB_PER_DPS
        _mpu6050GyroOffsetY = y * MPU_GYRO_LSB_PER_DPS
        _mpu6050GyroOffsetZ = z * MPU_GYRO_LSB_PER_DPS
    }

    //% block="Gyro auto calibrate stabilize: %stabilizeTime ms measure: %measureTime ms"
    //% stabilizeTime.defl=1000 stabilizeTime.min=100 stabilizeTime.max=5000
    //% measureTime.defl=3000 measureTime.min=500 measureTime.max=10000
    //% group="6축 가속도(MPU6050)" weight=161
    //% inlineInputMode=inline
    export function mpu6050AutoCalibrate(stabilizeTime: number, measureTime: number): void {
        // 안정화 대기
        basic.pause(stabilizeTime)

        // ★ 아두이노 MPU6050_tockn::calcGyroOffsets() 는 사이 지연 없이 3000회를 연달아
        //   읽어 평균낸다. 예전에는 10ms 씩 쉬어 measureTime=3000 에서 300회밖에 못 모았고,
        //   영점 잡음이 약 √10 배 컸다. 블록의 의미(measureTime = 측정 창)와 소요 시간은
        //   그대로 두고, 같은 창 안에서 최대한 많이 모으도록만 바꾼다.
        //   상한 3000회는 아두이노의 반복 횟수와 같고, 무한 루프도 막는다.
        const MAX_CAL_SAMPLES = 3000
        let deadline = control.millis() + measureTime
        let samples = 0
        let sumX = 0
        let sumY = 0
        let sumZ = 0

        // 최소 1회는 반드시 측정한다 (samples=0 이면 아래 나눗셈이 NaN 이 되고
        // 자이로 오프셋 3개가 영구히 오염된다)
        while (samples < MAX_CAL_SAMPLES) {
            pins.i2cWriteNumber(_mpu6050Addr, 0x43, NumberFormat.UInt8BE, true)
            let gyroBuf = pins.i2cReadBuffer(_mpu6050Addr, 6)

            let rawX = (gyroBuf[0] << 8) | gyroBuf[1]
            if (rawX > 32767) rawX -= 65536
            let rawY = (gyroBuf[2] << 8) | gyroBuf[3]
            if (rawY > 32767) rawY -= 65536
            let rawZ = (gyroBuf[4] << 8) | gyroBuf[5]
            if (rawZ > 32767) rawZ -= 65536

            sumX += rawX
            sumY += rawY
            sumZ += rawZ
            samples++

            if (control.millis() >= deadline) break
            // 협조적 파이버라 반드시 양보해야 다른 코드가 굶지 않는다
            basic.pause(1)
        }

        // 오프셋 설정
        _mpu6050GyroOffsetX = Math.round(sumX / samples)
        _mpu6050GyroOffsetY = Math.round(sumY / samples)
        _mpu6050GyroOffsetZ = Math.round(sumZ / samples)
    }

    //% block="MPU6050 init address %addr"
    //% addr.defl=0x68
    //% group="6축 가속도(MPU6050)" weight=160
    export function mpu6050Init(addr: number): void {
        // 블록 인자는 어떤 수든 들어올 수 있으므로 유효한 7비트 주소일 때만 사용한다
        _mpu6050Addr = (addr >= 0x08 && addr <= 0x77) ? addr : 0x68
        // ★ 예전에는 WHO_AM_I 확인이 없어 이 블록으로 초기화하면 _mpu6050Present 가
        //   영원히 false 였고, "MPU6050 connected?" 로 감싼 프로그램이 통째로 죽었다.
        //   (슬립 상태에서도 I2C 는 살아 있으므로 깨우기 전에 읽어도 된다)
        pins.i2cWriteNumber(_mpu6050Addr, 0x75, NumberFormat.UInt8BE, true)
        let who = pins.i2cReadNumber(_mpu6050Addr, NumberFormat.UInt8BE)
        _mpu6050Present = (who == 0x68 || who == 0x69 || who == 0x70 || who == 0x71)

        // 슬립 모드 해제
        // ★ PWR_MGMT_1 = 0x01 : 슬립 해제 + CLKSEL=1(자이로 X축 PLL).
        //   0x00 은 데이터시트가 비권장하는 내부 8MHz RC 오실레이터를 쓴다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x6B01, NumberFormat.UInt16BE)
        basic.pause(100)
        // ★ 아두이노 MPU6050_tockn::begin() 과 동일하게 SMPLRT_DIV/CONFIG 도 명시적으로 쓴다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x1900, NumberFormat.UInt16BE)   // SMPLRT_DIV = 0
        pins.i2cWriteNumber(_mpu6050Addr, 0x1A00, NumberFormat.UInt16BE)   // CONFIG = 0 (DLPF off)
        // ★ 감도 상수(16384 LSB/g, 65.5 LSB/(°/s))가 성립하려면 범위 레지스터도 함께 맞춰야 한다.
        //   자이로는 아두이노와 같은 FS_SEL=1(±500°/s) 로 쓴다. mpu6050Setup 과 동일해야 한다.
        pins.i2cWriteNumber(_mpu6050Addr, 0x1B08, NumberFormat.UInt16BE)   // GYRO_CONFIG  ±500°/s
        pins.i2cWriteNumber(_mpu6050Addr, 0x1C00, NumberFormat.UInt16BE)   // ACCEL_CONFIG ±2g
        basic.pause(10)
    }

    //% block="MPU6050 read %mtype axis %axis"
    //% group="6축 가속도(MPU6050)" weight=159
    export function mpu6050Read(mtype: MPU6050Type, axis: Axis): number {
        let reg = 0x3B  // 가속도 X 시작 레지스터

        if (mtype == MPU6050Type.Accel) {
            reg = 0x3B + (axis * 2)
        } else if (mtype == MPU6050Type.Gyro) {
            reg = 0x43 + (axis * 2)
        } else {
            // 온도
            reg = 0x41
        }

        pins.i2cWriteNumber(_mpu6050Addr, reg, NumberFormat.UInt8BE)
        let val = pins.i2cReadNumber(_mpu6050Addr, NumberFormat.Int16BE)

        if (mtype == MPU6050Type.Temp) {
            return val / 340 + 36.53
        }
        // ★ mpu6050Update 와 동일하게 감도로 나눠 물리단위로 반환한다
        if (mtype == MPU6050Type.Accel) {
            return val / MPU_ACCEL_LSB_PER_G        // g
        }
        // ★ 자이로는 오프셋 보정도 적용한다. 예전에는 mpu6050Update 에만 있어서
        //   이 경로로 읽으면 캘리브레이션 결과가 통째로 무시됐다.
        let off = axis == Axis.X ? _mpu6050GyroOffsetX
                : axis == Axis.Y ? _mpu6050GyroOffsetY
                : _mpu6050GyroOffsetZ
        return (val - off) / MPU_GYRO_LSB_PER_DPS   // °/s
    }


    /********** SGP30 TVOC 센서 **********/

    // SGP30 측정 타입
    export enum SGP30Type {
        //% block="eCO2(ppm)"
        eCO2 = 0,
        //% block="TVOC(ppb)"
        TVOC = 1
    }

    // SGP30 데이터 저장 변수
    let _sgp30Addr: number = 0x58
    let _sgp30eCO2: number = 0
    let _sgp30TVOC: number = 0

    /*
     * Sensirion CRC-8 (다항식 0x31, 초기값 0xFF).
     * ★ SGP30·SHT30 응답에는 2바이트마다 CRC 가 붙는데 예전 구현은 읽어놓고 버렸다.
     *   I2C 잡음이 낀 프레임이 그대로 측정값으로 나가던 원인.
     */
    function crc8Sensirion(b0: number, b1: number): number {
        let crc = 0xFF
        const d = [b0, b1]
        for (let i = 0; i < 2; i++) {
            crc = crc ^ d[i]
            for (let bit = 0; bit < 8; bit++) {
                if (crc & 0x80) crc = ((crc << 1) ^ 0x31) & 0xFF
                else crc = (crc << 1) & 0xFF
            }
        }
        return crc
    }

    let _sgp30InitAt = 0        // Init_air_quality 시각
    let _sgp30LastMs = 0        // 마지막 측정 시각 (1초 스로틀용)

    //% block="SGP30 warmed up? (15s)"
    //% group="CO2센서(SGP30)" weight=77
    export function sgp30Ready(): boolean {
        return _sgp30InitAt > 0 && (control.millis() - _sgp30InitAt) >= 15000
    }

    //% block="SGP30 init"
    //% group="CO2센서(SGP30)" weight=155
    export function sgp30Init(): void {
        // IAQ 초기화 명령
        pins.i2cWriteNumber(_sgp30Addr, 0x2003, NumberFormat.UInt16BE)
        // ★ 데이터시트상 초기화 후 15초 동안은 고정값(eCO2 400 / TVOC 0)만 나온다.
        //   예전에는 10ms 만 기다리고 바로 유효값처럼 읽었다. sgp30Ready() 로 확인할 것.
        _sgp30InitAt = control.millis()
        basic.pause(10)
    }

    //% block="SGP30 measure run"
    //% group="CO2센서(SGP30)" weight=154
    export function sgp30Measure(): void {
        // ★ SGP30 의 동적 베이스라인 알고리즘은 1초 주기 호출을 전제로 한다.
        //   forever 루프에서 수십 ms 간격으로 부르면 베이스라인이 망가진다. 내부에서 스로틀.
        let now = control.millis()
        if (_sgp30LastMs > 0 && (now - _sgp30LastMs) < 1000) return
        _sgp30LastMs = now

        // IAQ 측정 명령
        pins.i2cWriteNumber(_sgp30Addr, 0x2008, NumberFormat.UInt16BE)
        basic.pause(12)

        // 결과 읽기 (6바이트: eCO2 + CRC + TVOC + CRC)
        let buf = pins.i2cReadBuffer(_sgp30Addr, 6)

        // ★ CRC 검증 — 깨진 프레임은 버리고 직전 값을 유지한다
        if (crc8Sensirion(buf[0], buf[1]) != buf[2] || crc8Sensirion(buf[3], buf[4]) != buf[5]) return

        _sgp30eCO2 = (buf[0] << 8) | buf[1]
        _sgp30TVOC = (buf[3] << 8) | buf[4]
    }

    //% block="SGP30 read %stype"
    //% group="CO2센서(SGP30)" weight=153
    export function sgp30Read(stype: SGP30Type): number {
        if (stype == SGP30Type.eCO2) {
            return _sgp30eCO2
        }
        return _sgp30TVOC
    }


    /********** VL53L0X 레이저 거리 센서 **********/

    // VL53L0X 측정 모드
    export enum VL53L0XMode {
        //% block="Single (eSingle)"
        Single = 0,
        //% block="Continuous (eContinuous)"
        Continuous = 1
    }

    // VL53L0X 정밀도
    export enum VL53L0XPrecision {
        //% block="High precision (eHigh)"
        High = 0,
        //% block="Low precision (eLow)"
        Low = 1
    }

    // VL53L0X 제어
    export enum VL53L0XControl {
        //% block="Start"
        Start = 0,
        //% block="Stop"
        Stop = 1
    }

    // VL53L0X 읽기 타입
    export enum VL53L0XReadType {
        //% block="Distance (mm)"
        Distance = 0,
        //% block="Ambient (count rate)"
        Ambient = 1
    }

    // VL53L0X 데이터 저장 변수
    let _vl53l0xAddr: number = 0x29
    let _vl53l0xDistance: number = 0
    let _vl53l0xEverValid: boolean = false   // 상태 11 인 유효 프레임을 한 번이라도 받았는가
    let _vl53l0xAmbient: number = 0
    let _vl53l0xMode: VL53L0XMode = VL53L0XMode.Single
    let _vl53l0xPrecision: VL53L0XPrecision = VL53L0XPrecision.High
    // ★ 0x91 의 stop variable 은 다이(die)마다 공장에서 정해진 값이다. 초기화 때 읽어 두었다가
    //   측정 시작 시퀀스에서 그대로 되써야 한다(예전에는 읽고 버린 뒤 0x3C 를 하드코딩했다).
    let _vl53l0xStopVar: number = 0x3C
    // ★ SYSTEM_RANGE_CONFIG(0x09) 의 RANGE_FRACTIONAL_ENABLE 을 실제로 켰는지.
    //   켜면 거리 레지스터가 11.2 고정소수점이 되어 4로 나눠야 mm 가 된다
    //   (DFRobot_VL53L0X::getDistance 의 distance/4.0).
    //   레지스터를 쓰는 곳과 4로 나누는 곳은 반드시 이 플래그 하나로 묶여 있어야 한다.
    //   초기값 false — 레지스터 리셋값이 0(비활성)이고 vl53l0xInit 은 0x09 를 쓰지 않는다.
    let _vl53l0xFractional: boolean = false

    // micro:bit 에는 pins.i2cWriteRegister 가 없어 직접 만든다.
    // (레지스터 주소 + 값을 반드시 한 트랜잭션으로 보내야 한다)
    function vlWrite(reg: number, val: number): void {
        pins.i2cWriteNumber(_vl53l0xAddr, (reg << 8) | (val & 0xFF), NumberFormat.UInt16BE)
    }
    function vlRead(reg: number): number {
        pins.i2cWriteNumber(_vl53l0xAddr, reg, NumberFormat.UInt8BE, true)
        return pins.i2cReadNumber(_vl53l0xAddr, NumberFormat.UInt8BE)
    }

    // ★ 아두이노 DFRobot_VL53L0X::start() 는 SYSRANGE_START 를 쓰기 전에 이 7회 쓰기
    //   웨이크 프리앰블을 '매번' 실행한다(ST 의 VL53L0X_StartMeasurement 도 동일).
    //   여기서 stop variable(0x91)을 되살리는 것이 핵심이다. 예전에는 이 시퀀스가
    //   vl53l0xInit 안에 한 번만 있어서, 정지 시퀀스나 순간적인 리셋으로 stop variable 이
    //   지워지면 Start 를 다시 눌러도 영원히 측정이 재개되지 않았다.
    function vlStartPreamble(): void {
        vlWrite(0x80, 0x01)
        vlWrite(0xFF, 0x01)
        vlWrite(0x00, 0x00)
        vlWrite(0x91, _vl53l0xStopVar)
        vlWrite(0x00, 0x01)
        vlWrite(0xFF, 0x00)
        vlWrite(0x80, 0x00)
    }

    //% block="VL53L0X init I2C address %addr"
    //% addr.defl=41
    //% group="거리센서(VL53L0X)" weight=150
    export function vl53l0xInit(addr: number): void {
        // ★ 아두이노 DFRobot_VL53L0X::begin(addr) 은 먼저 내부 주소를 기본값 0x29 로 되돌리고
        //   0x29 에 대고 dataInit() 을 돌린 뒤, setDeviceAddress(addr) 로
        //   I2C_SLAVE_DEVICE_ADDRESS(0x8A) 에 새 주소를 써서 센서를 '재프로그램' 한다.
        //   예전 구현은 파라미터를 그대로 _vl53l0xAddr 에 넣고 바로 초기화를 시작해서,
        //   0x29 가 아닌 값을 넣으면 아무도 응답하지 않는 주소로 전부 날아갔다
        //   (0x8A 는 파일 전체에 한 번도 등장하지 않았다).
        //   VL53L0X 는 전원을 껐다 켜면 0x29 로 돌아오므로 매번 0x29 에서 시작하면 된다.
        _vl53l0xAddr = 0x29

        // ★ 아두이노 begin() 은 첫 문장이 delay(1500) 이다. 전원 인가 직후 모듈이 부팅을
        //   끝내기 전에 레지스터를 쓰면 시퀀스 전체가 NACK 된다.
        //   micro:bit 에서 1.5초를 무조건 멈추는 대신, MODEL_ID(0xC0)=0xEE 가 읽힐 때까지만
        //   기다린다(최대 1500ms). 준비가 끝나면 즉시 진행한다.
        let t0 = control.millis()
        while ((control.millis() - t0) < 1500) {
            if (vlRead(0xC0) == 0xEE) break
            basic.pause(20)
        }

        // ★ 아두이노 dataInit() 의 첫 동작(ESD_2V8 는 소스에서 무조건 정의되어 있다):
        //   VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV(0x89) 를 읽어 (v & 0xFE) | 0x01 로 되쓴다.
        //   I2C 패드를 2.8V 모드로 올리는 설정으로, 예전에는 통째로 빠져 있었다.
        //   빠지면 패드가 1.8V 기본값으로 남아 3.3V 버스에서 신호 여유가 아슬아슬해진다.
        let vhv = vlRead(0x89)
        vlWrite(0x89, (vhv & 0xFE) | 0x01)

        // ★ 예전 구현은 본문이 주소 대입 한 줄뿐이라 I2C 트랜잭션이 0건이었다.
        //   센서가 초기화되지 않아 거리값이 나올 수 없었다.
        //   아래는 MakeCode 공식 드라이버(pxt-common-packages/libs/proximity/vl53l0x.ts)의
        //   검증된 최소 초기화 시퀀스를 그대로 옮긴 것이다.
        vlWrite(0x88, 0x00)
        vlWrite(0x80, 0x01)
        vlWrite(0xFF, 0x01)
        vlWrite(0x00, 0x00)
        // ST DataInit: 0x91 을 읽어 stop variable 로 보관만 하고, 여기서는 쓰지 않는다
        _vl53l0xStopVar = vlRead(0x91)
        vlWrite(0x00, 0x01)
        vlWrite(0xFF, 0x00)
        vlWrite(0x80, 0x00)

        // ★ setDeviceAddress() 대응 — 아직 0x29 로 말하는 동안 0x8A 에 새 7비트 주소를 쓰고
        //   그 다음부터 새 주소로 말한다. 블록 기본값 41(=0x29)이면 아무것도 바뀌지 않는다.
        //   유효한 7비트 주소가 아니면 재프로그램하지 않고 0x29 를 유지한다
        //   (예전 블록에 아무 숫자나 들어가 있어도 센서를 잃지 않도록).
        let newAddr = (addr >= 0x08 && addr <= 0x77) ? (addr & 0x7F) : 0x29
        if (newAddr != 0x29) {
            vlWrite(0x8A, newAddr)
            _vl53l0xAddr = newAddr
            basic.pause(2)
        }

        vlStartPreamble()

        // ★ '새 샘플 준비됨' 인터럽트를 켠다. 이 설정이 없으면 RESULT_INTERRUPT_STATUS(0x13)가
        //   항상 0 이라 측정 완료를 확인할 방법이 없다(ST/Pololu 레퍼런스와 동일한 설정).
        vlWrite(0x0A, 0x04)   // SYSTEM_INTERRUPT_CONFIG_GPIO = new sample ready
        vlWrite(0x0B, 0x01)   // SYSTEM_INTERRUPT_CLEAR

        // SYSRANGE_START = 0x02 (back-to-back 연속 측정)
        vlWrite(0x00, 0x02)
        basic.pause(50)
    }

    // RESULT_RANGE_STATUS(0x14) 에서 12바이트를 읽어 [10..11] 이 거리(mm)
    function vlReadDistanceMm(): number {
        // ★ 예전에는 변환이 끝났는지 확인하지 않고 바로 읽어서 직전 샘플을 가져오는 일이 있었다.
        //   RESULT_INTERRUPT_STATUS(0x13) 로 데이터 준비를 기다린다(최대 300ms).
        let t0 = control.millis()
        while ((vlRead(0x13) & 0x07) == 0 && (control.millis() - t0) < 300) basic.pause(2)

        pins.i2cWriteNumber(_vl53l0xAddr, 0x14, NumberFormat.UInt8BE, true)
        let b = pins.i2cReadBuffer(_vl53l0xAddr, 12)
        // ★ b[0] 은 RESULT_RANGE_STATUS — bits[6:3] 이 11 일 때만 유효한 측정이다.
        //   예전의 'd != 20 && d != 0' 임시 필터는 무효 프레임(예: 상태 4 / 8190mm)을 통과시키고
        //   정상적인 20mm 측정은 버렸다.
        let status = (b[0] & 0x78) >> 3
        let d = ((b[10] & 0xFF) << 8) | (b[11] & 0xFF)
        // ST 기준으로 상태 11 이 '유효 측정'이다. 다만 아두이노판(DFRobot_VL53L0X::getDistance)은
        // 상태를 아예 보지 않고 "원시값이 20(무표적 표식)이 아니면 채택, 20 이면 직전값 유지"만 한다.
        // 상태 검사만 남기면 어떤 개체가 다른 코드를 낸 순간 거리가 영영 갱신되지 않는 위험이 있어,
        // 아직 한 번도 유효 프레임을 못 받았을 때는 아두이노판 규칙으로 대체한다.
        if (status == 11 && d != 0) {
            _vl53l0xDistance = d
            _vl53l0xEverValid = true
        } else if (!_vl53l0xEverValid && d != 20 && d != 0) {
            _vl53l0xDistance = d
        }
        // ★ 주변광 계수율(ambient count rate, MCPS 고정소수점) — 예전에는 이 변수가
        //   선언과 반환만 있고 어디서도 대입되지 않아 항상 0 이었다.
        //   ToF 센서라 lux 로 환산할 근거가 없으므로 계수율 그대로 둔다(블록명도 그렇게 표기).
        //   ★ 오프셋 6/7 은 신호(signal) 계수율이고 주변광은 8/9 이다(ST 디코딩 순서).
        _vl53l0xAmbient = ((b[8] & 0xFF) << 8) | (b[9] & 0xFF)
        vlWrite(0x0B, 0x01)   // SYSTEM_INTERRUPT_CLEAR — 다음 샘플을 받을 수 있게 플래그 해제
        return _vl53l0xDistance
    }

    //% block="VL53L0X set mode | mode %mode | precision %precision"
    //% group="거리센서(VL53L0X)" weight=149
    export function vl53l0xSetMode(mode: VL53L0XMode, precision: VL53L0XPrecision): void {
        _vl53l0xMode = mode
        _vl53l0xPrecision = precision

        // ★ 아두이노 DFRobot_VL53L0X::setMode 의 precision 인자는 highPrecisionEnable() 로 가서
        //   SYSTEM_RANGE_CONFIG(0x09) 의 RANGE_FRACTIONAL_ENABLE 을 1/0 으로 쓴다.
        //   예전에는 0x09 를 아예 쓰지 않아 '고정밀' 선택이 대기시간만 늘리고
        //   센서의 0.25mm 분해능 모드는 못 쓰는 상태였다.
        //   ★ 함정: 0x09 만 켜고 거리를 4로 나누지 않으면 모든 값이 정확히 4배가 된다.
        //     그래서 레지스터 쓰기와 _vl53l0xFractional 플래그를 반드시 붙여서 갱신한다.
        let frac = _vl53l0xPrecision == VL53L0XPrecision.High
        vlWrite(0x09, frac ? 0x01 : 0x00)
        _vl53l0xFractional = frac

        // ★ 예전에는 timingBudget 을 계산해놓고 버리고, 의미 없는 1바이트 0x01 만 보냈다.
        //   연속 모드의 측정 간격은 SYSTEM_INTERMEASUREMENT_PERIOD(0x04, 32비트 ms)에 쓴다.
        //   단발 모드에서는 이 값이 쓰이지 않으므로 대기시간(vl53l0xControl)으로만 반영한다.
        //   (아두이노판에는 대응 코드가 없는, micro:bit 쪽에서 추가한 설정이다)
        let periodMs = _vl53l0xPrecision == VL53L0XPrecision.High ? 200 : 30
        let b = pins.createBuffer(5)
        b[0] = 0x04
        b[1] = (periodMs >> 24) & 0xFF
        b[2] = (periodMs >> 16) & 0xFF
        b[3] = (periodMs >> 8) & 0xFF
        b[4] = periodMs & 0xFF
        pins.i2cWriteBuffer(_vl53l0xAddr, b)
    }

    //% block="VL53L0X control %control"
    //% group="거리센서(VL53L0X)" weight=148
    export function vl53l0xControl(control: VL53L0XControl): void {
        if (control == VL53L0XControl.Start) {
            // ★ 예전에는 레지스터 주소 0x00 만 보내고(값 없음) 포인터가 어디 있든 2바이트를 읽었다.
            //   SYSRANGE_START 에 실제 값을 써야 측정이 시작되고, 결과는 0x14 에서 읽어야 한다.
            // ★ init 의 SYSRANGE_START=0x02 로 이미 걸려 있는 묵은 인터럽트를 먼저 지운다.
            //   안 지우면 아래 데이터 준비 대기가 즉시 통과해 이전 프레임을 읽는다.
            vlWrite(0x0B, 0x01)
            // ★ 아두이노 start() 는 SYSRANGE_START 를 쓰기 전에 웨이크 프리앰블을 매번 돌린다.
            //   아래 Stop 이 stop variable 을 0 으로 지우므로, 이게 없으면 Stop→Start 후
            //   거리가 영영 갱신되지 않는다. 두 가지는 반드시 한 쌍으로 유지할 것.
            vlStartPreamble()
            vlWrite(0x00, _vl53l0xMode == VL53L0XMode.Continuous ? 0x02 : 0x01)
            basic.pause(_vl53l0xPrecision == VL53L0XPrecision.High ? 200 : 30)
            vlReadDistanceMm()
        } else {
            // 정지 — 연속 모드 해제
            // ★ 아두이노 stop() 은 SYSRANGE_START=0x00 뒤에 stop variable 을 지우는
            //   5회 페이지 시퀀스를 반드시 함께 보낸다(ST 의 VL53L0X_StopMeasurement 와 동일).
            //   예전에는 0x00 한 줄뿐이라 VCSEL 상태기가 무장된 채 남아 측정 전류가 계속 흘렀다.
            vlWrite(0x00, 0x00)
            vlWrite(0xFF, 0x01)
            vlWrite(0x00, 0x00)
            vlWrite(0x91, 0x00)
            vlWrite(0x00, 0x01)
            vlWrite(0xFF, 0x00)
        }
    }

    //% block="VL53L0X read %readType"
    //% group="거리센서(VL53L0X)" weight=147
    export function vl53l0xRead(readType: VL53L0XReadType): number {
        // ★ 연속 모드에서는 센서가 계속 측정하는데 예전에는 아무도 다시 읽지 않아
        //   control(Start) 때 잡힌 첫 샘플에 값이 굳어 있었다.
        //   새 샘플이 준비돼 있을 때만 수확한다(대기하지 않으므로 루프를 막지 않는다).
        if (_vl53l0xMode == VL53L0XMode.Continuous && (vlRead(0x13) & 0x07) != 0) {
            vlReadDistanceMm()
        }
        if (readType == VL53L0XReadType.Distance) {
            // ★ RANGE_FRACTIONAL_ENABLE 을 켠 상태에서는 거리 레지스터가 11.2 고정소수점이다.
            //   아두이노 getDistance() 도 eHigh 일 때만 /4.0 한다. 이 나눗셈과
            //   vl53l0xSetMode 의 0x09 쓰기는 반드시 함께 살아 있어야 한다.
            if (_vl53l0xFractional) return _vl53l0xDistance / 4
            return _vl53l0xDistance
        }
        return _vl53l0xAmbient
    }


    /********** SHT30 센서 **********/

    // 온도 단위
    export enum TempUnit {
        //% block="Celsius (°C)"
        Celsius = 0,
        //% block="Fahrenheit (°F)"
        Fahrenheit = 1
    }

    // SHT30 데이터 저장 변수
    let _sht30Temperature: number = 0
    let _sht30Humidity: number = 0
    let _sht30Addr: number = 0x44

    //% block="SHT30 init address %addr"
    //% addr.defl=0x44
    //% group="온습도(I2C-SHT30)" weight=145
    export function sht30Init(addr: number): void {
        // ★ 아두이노 SHT31::begin(address) 은 0x44/0x45 가 아니면 false 로 거부한 뒤
        //   reset() 을 호출한다. 예전에는 본문이 주소 대입 한 줄뿐이라 I2C 트랜잭션이 0건이고,
        //   센서를 알려진 상태로 되돌리는 단계가 아예 없었다. micro:bit 는 재플래시해도
        //   모듈 전원이 끊기지 않으므로, 이전 프로그램이 명령 도중에 남겨둔 센서가
        //   그대로 살아 있는 채로 시작된다.
        _sht30Addr = (addr == 0x45) ? 0x45 : 0x44

        // 소프트 리셋 (SHT31_SOFT_RESET = 0x30A2), 데이터시트 table 4 의 1ms 대기
        pins.i2cWriteNumber(_sht30Addr, 0x30A2, NumberFormat.UInt16BE)
        basic.pause(1)
    }

    //% block="SHT30 start measurement"
    //% group="온습도(I2C-SHT30)" weight=144
    export function sht30Query(): void {
        // 측정 명령 전송 (Single Shot, High Repeatability)
        pins.i2cWriteNumber(_sht30Addr, 0x2400, NumberFormat.UInt16BE)

        // 측정 대기 (15ms)
        basic.pause(15)

        // 6바이트 읽기 (온도2 + CRC + 습도2 + CRC)
        let buf = pins.i2cReadBuffer(_sht30Addr, 6)

        // ★ CRC 검증 — 예전에는 CRC 바이트를 읽고도 버렸다.
        //   변환이 아직 안 끝났거나 잡음이 끼면 엉뚱한 온습도가 그대로 나갔다.
        if (crc8Sensirion(buf[0], buf[1]) != buf[2] || crc8Sensirion(buf[3], buf[4]) != buf[5]) return

        // 온도 계산
        let tempRaw = (buf[0] << 8) | buf[1]
        _sht30Temperature = -45 + (175 * tempRaw / 65535)

        // 습도 계산
        let humRaw = (buf[3] << 8) | buf[4]
        _sht30Humidity = 100 * humRaw / 65535
    }

    //% block="SHT30 read temperature (unit %unit)"
    //% group="온습도(I2C-SHT30)" weight=143
    export function sht30ReadTemp(unit: TempUnit): number {
        if (unit == TempUnit.Fahrenheit) {
            return _sht30Temperature * 9 / 5 + 32
        }
        return _sht30Temperature
    }

    //% block="SHT30 read humidity"
    //% group="온습도(I2C-SHT30)" weight=142
    export function sht30ReadHumidity(): number {
        return _sht30Humidity
    }


    /********** TCS34725 RGB 컬러 센서 **********/

    // TCS34725 감지 색상 타입
    export enum TCS34725DetectType {
        //% block="raw"
        Raw = 0,
        //% block="color"
        Color = 1
    }

    // TCS34725 색상 채널
    export enum TCS34725Channel {
        //% block="red"
        Red = 0,
        //% block="green"
        Green = 1,
        //% block="blue"
        Blue = 2,
        //% block="clear"
        Clear = 3
    }

    // TCS34725 감지 색상
    export enum TCS34725Color {
        //% block="red"
        Red = 0,
        //% block="orange"
        Orange = 1,
        //% block="yellow"
        Yellow = 2,
        //% block="green"
        Green = 3,
        //% block="blue"
        Blue = 4,
        //% block="purple"
        Purple = 5,
        //% block="white"
        White = 6,
        //% block="black"
        Black = 7
    }

    // RGB 색상
    export enum RGBColor {
        //% block="red(R)"
        Red = 0,
        //% block="green(G)"
        Green = 1,
        //% block="blue(B)"
        Blue = 2,
        //% block="clear(C)"
        Clear = 3
    }

    // TCS34725 데이터 저장 변수
    export let _tcs34725Addr: number = 0x29
    export let _tcs34725R: number = 0
    export let _tcs34725G: number = 0
    export let _tcs34725B: number = 0
    export let _tcs34725C: number = 0
    export let _tcs34725R8: number = 0
    export let _tcs34725G8: number = 0
    export let _tcs34725B8: number = 0
    export let _tcs34725DetectedColor: TCS34725Color = TCS34725Color.Black
}
