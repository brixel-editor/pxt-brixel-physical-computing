/**
 * BRIXEL Extension - 03. Sensors
 * DHT11/DHT22, DS18B20, LM35, SHT30, HC-SR04, VL53L0X, BH1750, MQ-2, PMS, etc.
 */

//% weight=1080 color=#FF6F00 icon="\uf0e7" block="03. Sensors"
//% groups='["초음파(HC-SR04)","초음파(US-100)","온습도(DHT11/DHT22)","물온도(DS18B20)","고온센서(High Temp)","서미스터(NTC)","온도(LM35)","무게(HX711)","미세먼지(PMS)","거리센서(GP2Y0A21YK)","CO2센서(MHZ19)","가스(MQ 계열)","가스(MQ-2)","가스(MQ-135)","전기전도도(TDS)","pH","탁도(Turbidity)","UV Sensor","전류 센서(ACS712)","전압센서(Voltage Sensor)","Rotary Encoder","Joystick","Keypad","지문센서","아날로그 입력","디지털 입력","전류 센서(WCS2801)","미세먼지(GP2Y1014AU0F)"]'
namespace Sensors03 {


    /********** HC-SR04 초음파 센서 **********/

    // 거리 단위
    export enum DistanceUnit {
        //% block="cm"
        Centimeter = 0,
        //% block="inch"
        Inch = 1
    }

    // HC-SR04 핀 저장 변수
    // 주의: P3/P4/P6/P7/P9/P10은 micro:bit LED 매트릭스와 공유되는 핀이다.
    // 이 핀에 TRIG/ECHO를 연결하면 디스플레이 스캔이 트리거 펄스를 덮어써서 값이 튄다.
    // 빈 핀(P0/P1/P2/P8/P12~P16)으로 배선하거나, 직접 led.enable(false)를 호출해야 한다.
    let _hcsr04Trig: DigitalPin = DigitalPin.P14
    let _hcsr04Echo: DigitalPin = DigitalPin.P13

    //% block="HC-SR04 set trigger pin %trig echo pin %echo"
    //% trig.defl=DigitalPin.P14 echo.defl=DigitalPin.P13
    //% group="초음파(HC-SR04)" weight=230
    export function hcsr04SetPins(trig: DigitalPin, echo: DigitalPin): void {
        _hcsr04Trig = trig
        _hcsr04Echo = echo
    }

    //% block="HC-SR04 read distance unit %unit"
    //% group="초음파(HC-SR04)" weight=229
    export function hcsr04Read(unit: DistanceUnit): number {
        pins.digitalWritePin(_hcsr04Trig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(_hcsr04Trig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(_hcsr04Trig, 0)
        let d = pins.pulseIn(_hcsr04Echo, PulseValue.High, 30000)
        if (d <= 0) return -1 // no echo is not a distance of zero
        // 아두이노판 ultrasonic_distance 는 duration_us * (0.0343/2) 을 실수로 돌려준다
        // (= duration/58.31, 20°C 음속 343m/s). 기존 코드는 (1) 58 로 나눠 0.5% 크게 나왔고
        // (2) cm 를 정수로 자른 뒤 다시 2.54 로 나눠 inch 를 또 잘라서
        //     10cm 에서 3in(실제 3.94in) 처럼 최대 24% 낮게 나왔다. 두 절삭을 모두 없앤다.
        let cm = d / 58.31

        if (unit == DistanceUnit.Inch) {
            return Math.round(cm / 2.54 * 100) / 100
        }
        return Math.round(cm * 100) / 100
    }


    /********** DHT11/DHT22 센서 **********/

    // DHT 센서 타입
    export enum DHTType {
        //% block="DHT11"
        DHT11 = 11,
        //% block="DHT22"
        DHT22 = 22
    }

    // DHT 읽기 타입
    export enum DHTReadType {
        //% block="humidity"
        Humidity = 0,
        //% block="temperature"
        Temperature = 1
    }

    // 온도 단위
    export enum TempUnit {
        //% block="Celsius (°C)"
        Celsius = 0,
        //% block="Fahrenheit (°F)"
        Fahrenheit = 1
    }

    // DHT 데이터 저장 변수
    let _dhtTemperature: number = 0
    let _dhtHumidity: number = 0
    let _dhtLastQuery: boolean = false
    let _dhtSensorResponding: boolean = false
    let _dhtTempUnit: TempUnit = TempUnit.Celsius
    // 아두이노 DHT.cpp:9 의 MIN_INTERVAL(2000ms) 과 같은 역할. 음수로 시작해 첫 호출은 통과한다.
    let _dhtLastReadTime: number = -2000

    // 핀이 지정한 레벨에서 벗어날 때까지 대기. 타임아웃이면 false.
    // 기존 코드는 while(...); 형태의 무한 busy-wait이라 센서가 없으면 fiber가 영원히 멈췄다.
    // control.micros()는 32비트 순환 카운터라 랩어라운드에 대비해 guard 카운터도 같이 둔다.
    function dhtWaitLevel(pin: DigitalPin, level: number, maxUs: number): boolean {
        let t0 = control.micros()
        let guard = 0
        while (pins.digitalReadPin(pin) == level) {
            guard++
            if (guard > 20000 || control.micros() - t0 > maxUs) return false
        }
        return true
    }

    //% block="Last query successful?"
    //% group="온습도(DHT11/DHT22)" weight=225
    export function dhtLastQuerySuccessful(): boolean {
        return _dhtLastQuery
    }

    //% block="Read %readType"
    //% group="온습도(DHT11/DHT22)" weight=224
    export function dhtRead(readType: DHTReadType): number {
        if (readType == DHTReadType.Temperature) {
            if (_dhtTempUnit == TempUnit.Fahrenheit) {
                return _dhtTemperature * 9 / 5 + 32
            }
            return _dhtTemperature
        } else {
            return _dhtHumidity
        }
    }

    //% block="Query %dhtType|Data pin %pin|Pin pull up %pullUp|Serial output %serialOut|Wait 2 sec after query %wait"
    //% pullUp.shadow="toggleYesNo" pullUp.defl=true
    //% serialOut.shadow="toggleYesNo" serialOut.defl=false
    //% wait.shadow="toggleYesNo" wait.defl=true
    //% group="온습도(DHT11/DHT22)" weight=223
    //% inlineInputMode=inline
    export function dhtQuery(dhtType: DHTType, pin: DigitalPin, pullUp: boolean, serialOut: boolean, wait: boolean): void {
        // 아두이노 DHT::read() 는 버스를 건드리기 전에 MIN_INTERVAL(2000ms) 을 스스로 강제하고
        // 너무 빨리 부르면 직전 결과를 그대로 돌려준다(DHT.cpp:123-130). MakeCode 는 이걸
        // 'Wait 2 sec after query' 토글로만 두고 질의 뒤에 쉬게 해서, 토글을 끄거나 두 곳에서
        // 부르면 센서 변환 주기보다 빨리 폴링해 체크섬이 계속 깨졌다. 라이브러리와 동일하게 막는다.
        if (control.millis() - _dhtLastReadTime < 2000) {
            return   // _dhtTemperature/_dhtHumidity/_dhtLastQuery 를 그대로 유지 (아두이노의 _lastresult 반환과 동일)
        }
        _dhtLastReadTime = control.millis()

        _dhtLastQuery = false
        _dhtSensorResponding = false

        // 아두이노 DHT.cpp:138-141 은 매 읽기마다 라인을 HIGH 로 올리고 250ms 안정화한 뒤에
        // 시작 신호를 낸다. 이 구간이 없으면 전원 인가 직후 첫 질의가 자주 실패한다.
        pins.digitalWritePin(pin, 1)
        basic.pause(250)

        // DHT 센서 읽기 시작 신호 — 아두이노는 DHT11/DHT22 구분 없이 20ms 다(DHT.cpp:143-146).
        // (기존 18ms/1ms 는 각 데이터시트의 '최소값' 이라 여유가 없었다)
        pins.digitalWritePin(pin, 0)
        basic.pause(20)
        pins.digitalWritePin(pin, 1)
        control.waitMicros(40)

        // 아두이노는 항상 INPUT_PULLUP 이다(DHT.cpp:26, :159). DHT 데이터 라인은 오픈드레인이라
        // pullUp 을 false 로 두면 외부 풀업 저항이 반드시 있어야 한다.
        if (pullUp) {
            pins.setPull(pin, PinPullMode.PullUp)
        }
        pins.digitalReadPin(pin)

        // 응답 신호(80us LOW + 80us HIGH)를 실제로 소비한다.
        // 기존의 고정 control.waitMicros(80)은 응답 HIGH 구간 안에서 끝나버려서
        // 그 HIGH를 데이터 비트0으로 잘못 측정 -> 40비트 전체가 한 칸씩 밀려 체크섬이 항상 실패했다.
        let ok = dhtWaitLevel(pin, 1, 300)      // 라인이 LOW로 떨어질 때까지
        if (ok) ok = dhtWaitLevel(pin, 0, 300)  // 80us 응답 LOW가 끝날 때까지
        if (ok) ok = dhtWaitLevel(pin, 1, 300)  // 80us 응답 HIGH가 끝날 때까지 (여기서 비트0 시작)

        // 데이터 읽기 (40비트)
        // ★ 아두이노 DHT.cpp:183-204 는 절대 시간 문턱값을 쓰지 않는다. 같은 비트의 앞쪽 LOW(약 50us)와
        //   뒤쪽 HIGH 를 같은 단위로 재고 high > low 인지로 판정한다. 측정 오버헤드가 양쪽에 똑같이
        //   실려 상쇄되므로 플랫폼 속도와 무관하다. 기존의 'elapsed > 40us' 는 HIGH 만 재면서
        //   control.micros() 호출과 폴링 루프 오버헤드가 더해지기만 해서, 그 오버헤드가 12~14us 를
        //   넘는 빌드에서는 '0' 비트가 전부 '1' 로 읽혀 체크섬이 영구히 실패한다.
        let data: number[] = [0, 0, 0, 0, 0]
        for (let i = 0; ok && i < 40; i++) {
            let tLowStart = control.micros()
            if (!dhtWaitLevel(pin, 0, 300)) { ok = false; break }
            let tHighStart = control.micros()
            if (!dhtWaitLevel(pin, 1, 300)) { ok = false; break }
            let tHighEnd = control.micros()

            let lowDuration = tHighStart - tLowStart
            let highDuration = tHighEnd - tHighStart

            let byteIndex = Math.idiv(i, 8)
            data[byteIndex] = data[byteIndex] << 1
            if (highDuration > lowDuration) {
                data[byteIndex] = data[byteIndex] | 1
            }
        }

        // 체크섬 확인 (타임아웃으로 중단된 경우엔 값을 갱신하지 않는다)
        let checksum = (data[0] + data[1] + data[2] + data[3]) & 0xFF
        if (ok && checksum == data[4]) {
            _dhtLastQuery = true
            _dhtSensorResponding = true

            if (dhtType == DHTType.DHT11) {
                _dhtHumidity = data[0]
                _dhtTemperature = data[2]
            } else {
                _dhtHumidity = ((data[0] << 8) + data[1]) / 10
                _dhtTemperature = (((data[2] & 0x7F) << 8) + data[3]) / 10
                if (data[2] & 0x80) {
                    _dhtTemperature = -_dhtTemperature
                }
            }

            if (serialOut) {
                serial.writeLine("Humidity: " + _dhtHumidity + "%")
                serial.writeLine("Temperature: " + _dhtTemperature + "C")
            }
        }

        if (wait) {
            basic.pause(2000)
        }
    }

    //% block="Last query sensor responding?"
    //% group="온습도(DHT11/DHT22)" weight=222
    export function dhtSensorResponding(): boolean {
        return _dhtSensorResponding
    }

    //% block="Temperature type: %unit"
    //% group="온습도(DHT11/DHT22)" weight=221
    export function dhtSetTempUnit(unit: TempUnit): void {
        _dhtTempUnit = unit
    }


    /********** DS18B20 센서 **********/

    // 온도 단위 (DS18B20용)
    export enum DS18B20Unit {
        //% block="Celsius (°C)"
        Celsius = 0,
        //% block="Fahrenheit (°F)"
        Fahrenheit = 1
    }

    // DS18B20 데이터 저장 변수
    let _ds18b20Pin: DigitalPin = DigitalPin.P2
    let _ds18b20Temps: number[] = []
    let _ds18b20Count: number = 0

    //% block="DS18B20 set data pin %pin"
    //% group="물온도(DS18B20)" weight=215
    export function ds18b20SetPin(pin: DigitalPin): void {
        _ds18b20Pin = pin
        // 1-Wire 는 오픈드레인이다. 라인을 놓을 때 외부 4.7k 풀업이 올려 주지만,
        // 모듈에 풀업이 없거나 약할 때를 대비해 내부 풀업도 켜 둔다.
        pins.setPull(pin, PinPullMode.PullUp)
        // 아두이노 dallas_temp_setup 은 setup() 에 sensors.begin() 을 넣고, begin() 은
        // SEARCH ROM 으로 버스를 전부 열거해 실제 센서 개수와 ROM 을 저장한다
        // (DallasTemperature.cpp:84-108). 여기서도 같은 일을 해야 'connected sensor count' 가
        // 진짜 개수를 말하고, 'read sensor 1' 이 두 번째 프로브를 실제로 지목할 수 있다.
        ds18b20Search()
    }

    //% block="DS18B20 start conversion"
    //% group="물온도(DS18B20)" weight=214
    export function ds18b20StartConversion(): void {
        // 셋업 블록을 쓰지 않은 프로그램을 위해, 아직 열거 전이면 여기서 한 번 훑는다.
        // (예전에는 프레즌스만 보고 _ds18b20Count 를 1 로 조작해서, 프로브가 2개여도
        //  항상 1개라고 보고했다)
        if (_ds18b20Count == 0) ds18b20Search()

        // 1-Wire 리셋 (버스 유휴 확인 + 프레즌스 검출은 ds18b20Reset 이 담당)
        if (!ds18b20Reset()) return

        // Skip ROM (0xCC) - 모든 센서에 명령
        ds18b20WriteByte(0xCC)
        // Convert T (0x44) - 온도 변환 시작
        ds18b20WriteByte(0x44)

        // 변환 대기 (750ms for 12-bit)
        basic.pause(750)
    }

    /********** DS18B20 — 여러 개 구분하기 위한 ROM 검색 **********/
    /*
     * 이전 구현은 Skip ROM(0xCC) 브로드캐스트만 썼다. 버스에 센서가 하나뿐일 때는 동작하지만
     * 두 개 이상이면 여러 장치가 동시에 응답해 데이터가 충돌한다(= index 인자가 무의미했다).
     * Maxim APP NOTE 187 의 1-Wire SEARCH ROM(0xF0) 을 구현해 각 센서의 64비트 ROM 을 찾고,
     * 읽을 때 Match ROM(0x55) 으로 지정한 센서만 지목한다.
     */
    let _ds18b20Roms: number[] = []          // 8바이트 × N 평면 배열
    let _dsLastDiscrepancy = 0
    let _dsLastDeviceFlag = false
    let _dsSearchCrcError = false

    // Maxim 1-Wire CRC8 (반사 다항식 0x8C, 초기값 0).
    // CRC 바이트까지 포함해 계산한 결과가 0이면 정상.
    function ds18b20Crc8(data: number[], len: number): number {
        let crc = 0
        for (let i = 0; i < len; i++) {
            let inbyte = data[i]
            for (let b = 0; b < 8; b++) {
                let mix = (crc ^ inbyte) & 0x01
                crc = crc >> 1
                if (mix) crc = crc ^ 0x8C
                inbyte = inbyte >> 1
            }
        }
        return crc & 0xFF
    }

    // 리셋 + 프레즌스 검출 (장치 있으면 true)
    //
    // ★ 1-Wire 는 오픈드레인이다. 마스터는 LOW 로만 구동하고, 놓을 때는 핀을 입력으로 돌려
    //   외부 풀업이 라인을 올리게 한다(OneWire.cpp:186 "allow it to float").
    //   pins.digitalReadPin() 이 그 '입력으로 전환' 역할을 한다.
    //   기존 코드는 digitalWritePin(pin, 1) 로 슬레이브가 라인을 가져야 하는 구간을
    //   그대로 HIGH 로 구동해서, 프레즌스 펄스/읽기 슬롯마다 마이크로비트 출력단과
    //   DS18B20 풀다운이 서로 싸웠다(간헐적 CRC 실패·유령 ROM 의 고전적 원인).
    function ds18b20Reset(): boolean {
        // OneWire.cpp:171-178 — 리셋 펄스를 내기 전에 버스가 실제로 HIGH 인지 최대 250us 확인한다.
        // GND 단락·죽은 센서로 라인이 계속 LOW 면 '장치 없음' 으로 즉시 보고한다
        // (이걸 빼면 단락된 버스에서 presence==0 이 나와 '센서 있음' 으로 오판했다).
        pins.digitalReadPin(_ds18b20Pin)
        let retries = 125
        while (pins.digitalReadPin(_ds18b20Pin) == 0) {
            retries--
            if (retries <= 0) return false
            control.waitMicros(2)
        }

        pins.digitalWritePin(_ds18b20Pin, 0)
        control.waitMicros(480)
        pins.digitalReadPin(_ds18b20Pin)      // 라인 해제 (풀업이 올린다)
        control.waitMicros(70)
        let presence = pins.digitalReadPin(_ds18b20Pin)
        control.waitMicros(410)
        return presence == 0
    }

    function ds18b20WriteBit(b: number): void {
        if (b) {
            pins.digitalWritePin(_ds18b20Pin, 0)
            control.waitMicros(6)
            pins.digitalWritePin(_ds18b20Pin, 1)
            control.waitMicros(64)
        } else {
            pins.digitalWritePin(_ds18b20Pin, 0)
            control.waitMicros(60)
            pins.digitalWritePin(_ds18b20Pin, 1)
            control.waitMicros(10)
        }
    }

    // 읽기 슬롯에서는 슬레이브가 라인을 가진다 → 구동하지 않고 놓는다(OneWire.cpp:236).
    function ds18b20ReadBit(): number {
        pins.digitalWritePin(_ds18b20Pin, 0)
        control.waitMicros(6)
        pins.digitalReadPin(_ds18b20Pin)      // 라인 해제
        control.waitMicros(9)
        let v = pins.digitalReadPin(_ds18b20Pin)
        control.waitMicros(55)
        return v
    }

    // SEARCH ROM 1회 — 다음 장치의 ROM 을 rom[] 에 채운다
    function ds18b20SearchStep(rom: number[]): boolean {
        let idBitNumber = 1
        let lastZero = 0
        let romByteNumber = 0
        let romByteMask = 1
        let searchResult = false

        if (!_dsLastDeviceFlag) {
            if (!ds18b20Reset()) {
                _dsLastDiscrepancy = 0
                _dsLastDeviceFlag = false
                return false
            }
            ds18b20WriteByte(0xF0)

            while (romByteNumber < 8) {
                let idBit = ds18b20ReadBit()
                let cmpIdBit = ds18b20ReadBit()
                if (idBit == 1 && cmpIdBit == 1) break   // 응답 장치 없음

                let dir = 0
                if (idBit != cmpIdBit) {
                    dir = idBit                          // 충돌 없음 — 비트 확정
                } else {
                    // 충돌 — 이전 탐색 경로를 따르거나 새 분기를 선택
                    if (idBitNumber < _dsLastDiscrepancy) {
                        dir = (rom[romByteNumber] & romByteMask) > 0 ? 1 : 0
                    } else {
                        dir = (idBitNumber == _dsLastDiscrepancy) ? 1 : 0
                    }
                    if (dir == 0) lastZero = idBitNumber
                }

                if (dir == 1) rom[romByteNumber] |= romByteMask
                else rom[romByteNumber] &= ~romByteMask

                ds18b20WriteBit(dir)
                idBitNumber++
                romByteMask = romByteMask << 1
                if (romByteMask > 0x80) { romByteNumber++; romByteMask = 1 }
            }

            if (idBitNumber >= 65) {
                // AN187 의 수락 조건은 (id_bit_number >= 65 && crc8 == 0) 인데 CRC 쪽이 빠져 있었다.
                // ROM 8번째 바이트가 장치 자신의 CRC8 이므로 이걸 검사하지 않으면
                // 버스 잡음으로 뒤집힌 비트가 그대로 유령 센서 주소로 저장된다.
                if (ds18b20Crc8(rom, 8) == 0) {
                    _dsLastDiscrepancy = lastZero
                    if (_dsLastDiscrepancy == 0) _dsLastDeviceFlag = true
                    searchResult = true
                } else {
                    _dsSearchCrcError = true
                }
            }
        }

        if (!searchResult || rom[0] == 0) {
            _dsLastDiscrepancy = 0
            _dsLastDeviceFlag = false
            return false
        }
        return true
    }

    //% block="DS18B20 search sensors on bus"
    //% group="물온도(DS18B20)" weight=213.5
    export function ds18b20Search(): number {
        let found = 0

        // CRC 실패로 열거가 중간에 끊기면 실제보다 적은 개수를 보고하게 되므로
        // CRC 오류가 있었던 경우에만 처음부터 최대 3회까지 다시 훑는다.
        for (let attempt = 0; attempt < 3; attempt++) {
            _ds18b20Roms = []
            _dsLastDiscrepancy = 0
            _dsLastDeviceFlag = false
            _dsSearchCrcError = false
            found = 0
            let rom = [0, 0, 0, 0, 0, 0, 0, 0]

            while (found < 8) {
                if (!ds18b20SearchStep(rom)) break
                for (let k = 0; k < 8; k++) _ds18b20Roms.push(rom[k])
                found++
                if (_dsLastDeviceFlag) break
            }
            if (!_dsSearchCrcError) break

            // 재시도 전에 다른 파이버에 CPU 를 양보한다. 열거 1회는 전부 control.waitMicros 라
            // 최대 ~120ms 동안 스케줄러를 붙잡고, 3회면 ~360ms 라 디스플레이/시리얼 파이버가 굶는다.
            // 이 시점의 1-Wire 버스는 유휴(풀업으로 HIGH) 상태라 일시정지해도 프로토콜이 깨지지 않는다.
            basic.pause(1)
        }
        _ds18b20Count = found
        return found
    }

    //% block="DS18B20 read sensor %index temperature (unit %unit)"
    //% index.min=0 index.max=7 index.defl=0
    //% group="물온도(DS18B20)" weight=213
    export function ds18b20ReadTemp(index: number, unit: DS18B20Unit): number {
        // 프레즌스 결과를 버리면 안 된다. 센서가 없을 때 0xFF/0xFF 를 읽어
        // -0.06°C 라는 그럴듯한 가짜 값이 나오기 때문.
        // ★ 실패값으로 0 을 쓰면 안 된다 — 이건 '물온도' 블록이고 0°C(얼음물)는 교실에서
        //   실제로 나올 수 있는 값이라 학생이 진짜 측정값으로 믿는다. 아두이노판
        //   DallasTemperature 와 동일하게 측정 범위(-55~125) 밖의 표식값을 돌려준다.
        //   DEVICE_DISCONNECTED_C = -127, DEVICE_DISCONNECTED_F = -196.6
        if (!ds18b20Reset()) return unit == DS18B20Unit.Fahrenheit ? -196.6 : -127

        // 개수(_ds18b20Count)가 아니라 해당 index 의 ROM 존재 여부로 주소 지정 방식을 고른다.
        if (index >= 0 && _ds18b20Roms.length >= (index + 1) * 8) {
            // 검색된 ROM 이 있는 상태 — Match ROM 으로 해당 센서만 지목
            ds18b20WriteByte(0x55)
            for (let k = 0; k < 8; k++) ds18b20WriteByte(_ds18b20Roms[index * 8 + k])
        } else if (index == 0 && _ds18b20Count <= 1) {
            // 아직 검색 전이고 센서가 많아야 하나인 경우에만 Skip ROM 브로드캐스트를 허용한다.
            ds18b20WriteByte(0xCC)
        } else {
            // 아두이노 getTempCByIndex 는 getAddress(index) 가 실패하면 버스를 건드리지 않고
            // 곧바로 DEVICE_DISCONNECTED_C(-127) 를 돌려준다(DallasTemperature.cpp:442-451).
            // 예전에는 index 를 버리고 Skip ROM 을 뿌려서 버스의 모든 센서가 동시에 응답했고,
            // 그 깨진 스크래치패드가 CRC 에서 걸려 'read sensor 0' 과 'read sensor 1' 이
            // 둘 다 같은 값(얼음물로 오해하기 쉬운 0°C)을 내놓았다.
            return unit == DS18B20Unit.Fahrenheit ? -196.6 : -127
        }
        // Read Scratchpad (0xBE)
        ds18b20WriteByte(0xBE)

        // 스크래치패드 9바이트를 모두 읽어 CRC 로 검증 (9번째 바이트가 바이트0~7 의 CRC8)
        let sp: number[] = []
        for (let k = 0; k < 9; k++) sp.push(ds18b20ReadByte())
        if (ds18b20Crc8(sp, 9) != 0) return unit == DS18B20Unit.Fahrenheit ? -196.6 : -127

        // 온도 계산
        let temp = (sp[1] << 8) | sp[0]
        if (temp & 0x8000) {
            temp = ((~temp) + 1) & 0xFFFF
            temp = -temp
        }
        let tempC = temp / 16.0

        if (unit == DS18B20Unit.Fahrenheit) {
            return tempC * 9 / 5 + 32
        }
        return tempC
    }

    //% block="DS18B20 connected sensor count"
    //% group="물온도(DS18B20)" weight=212
    export function ds18b20GetCount(): number {
        return _ds18b20Count
    }

    // 1-Wire 바이트 쓰기 (내부 함수)
    function ds18b20WriteByte(byte: number): void {
        for (let i = 0; i < 8; i++) {
            if (byte & (1 << i)) {
                // Write 1
                pins.digitalWritePin(_ds18b20Pin, 0)
                control.waitMicros(6)
                pins.digitalWritePin(_ds18b20Pin, 1)
                control.waitMicros(64)
            } else {
                // Write 0
                pins.digitalWritePin(_ds18b20Pin, 0)
                control.waitMicros(60)
                pins.digitalWritePin(_ds18b20Pin, 1)
                control.waitMicros(10)
            }
        }
    }

    // 1-Wire 바이트 읽기 (내부 함수) — ds18b20ReadBit 과 같은 이유로 읽기 슬롯에서는 라인을 놓는다
    function ds18b20ReadByte(): number {
        let byte = 0
        for (let i = 0; i < 8; i++) {
            pins.digitalWritePin(_ds18b20Pin, 0)
            control.waitMicros(6)
            pins.digitalReadPin(_ds18b20Pin)      // 라인 해제 (풀업이 올린다)
            control.waitMicros(9)
            if (pins.digitalReadPin(_ds18b20Pin)) {
                byte |= (1 << i)
            }
            control.waitMicros(55)
        }
        return byte
    }


    /********** HX711 무게 센서 (로드셀) **********/

    // HX711은 24비트 ADC로 로드셀과 함께 사용하는 무게 센서입니다.
    // 게인: 128(채널A), 64(채널A), 32(채널B)

    // HX711 게인 설정
    export enum HX711Gain {
        //% block="128 (ch A)"
        Gain128 = 1,
        //% block="64 (ch A)"
        Gain64 = 3,
        //% block="32 (ch B)"
        Gain32 = 2
    }

    // HX711 데이터 타입
    export enum HX711DataType {
        //% block="raw"
        Raw = 0,
        //% block="weight"
        Weight = 1
    }

    // HX711 상태 변수
    let _hx711Dout: DigitalPin = DigitalPin.P0
    let _hx711Clk: DigitalPin = DigitalPin.P1
    let _hx711Gain: HX711Gain = HX711Gain.Gain128
    let _hx711Offset: number = 0
    let _hx711Scale: number = 1
    let _hx711Ok: boolean = false      // 마지막 원본 읽기 성공 여부
    let _hx711LastRaw: number = 0      // 마지막 정상 샘플 (타임아웃 시 이 값을 돌려준다)

    //% block="Weight sensor(HX711): DOUT %dout, CLK %clk, gain %gain setup"
    //% dout.defl=DigitalPin.P0
    //% clk.defl=DigitalPin.P1
    //% gain.defl=Sensors03.HX711Gain.Gain128
    //% group="무게(HX711)" weight=205
    //% inlineInputMode=inline
    export function hx711Init(dout: DigitalPin, clk: DigitalPin, gain: HX711Gain): void {
        _hx711Dout = dout
        _hx711Clk = clk
        _hx711Gain = gain
        _hx711Offset = 0
        _hx711Scale = 1

        pins.digitalWritePin(_hx711Clk, 0)
        // 아두이노 HX711 생성자는 pinMode(DOUT, INPUT) 만 하고 풀 저항을 켜지 않는다(HX711.cpp:8-11).
        // 이 풀업은 마이크로비트 전용 추가분이다 — HX711 의 DOUT 은 푸시풀이라 정상 동작에는
        // 영향이 없고, 모듈이 빠졌을 때 DOUT 이 확정적으로 HIGH 로 읽혀 아래 500ms 타임아웃이
        // 제때 걸리게 하는 목적이다(플로팅이면 준비완료로 오인할 수 있다).
        pins.setPull(_hx711Dout, PinPullMode.PullUp)

        // 첫 번째 읽기로 게인 설정
        hx711ReadRaw()
    }

    //% block="HX711 weight sensor read weight"
    //% group="무게(HX711)" weight=204
    export function hx711ReadWeight(): number {
        let raw = hx711ReadRaw()
        return (raw - _hx711Offset) / _hx711Scale
    }

    //% block="HX711 weight sensor tare %times times"
    //% times.defl=10 times.min=1 times.max=50
    //% group="무게(HX711)" weight=203
    export function hx711Tare(times: number): void {
        let sum = 0
        let n = 0
        for (let i = 0; i < times; i++) {
            let raw = hx711ReadRaw()
            // 읽기 실패(타임아웃) 샘플은 평균에서 제외 — 죽은 센서가 영점을 오염시키지 않도록
            if (_hx711Ok) { sum += raw; n++ }
            basic.pause(10)
        }
        if (n > 0) _hx711Offset = sum / n
    }

    //% block="HX711 weight sensor set scale %scale"
    //% scale.defl=1
    //% group="무게(HX711)" weight=202
    export function hx711SetScale(scale: number): void {
        if (scale != 0) {
            _hx711Scale = scale
        }
    }

    //% block="HX711 weight sensor is ready"
    //% group="무게(HX711)" weight=201
    export function hx711IsReady(): boolean {
        return pins.digitalReadPin(_hx711Dout) == 0
    }

    //% block="HX711 weight sensor power %state"
    //% state.shadow="toggleOnOff"
    //% group="무게(HX711)" weight=200
    export function hx711Power(state: boolean): void {
        if (state) {
            // 전원 켜기
            pins.digitalWritePin(_hx711Clk, 0)
        } else {
            // 전원 끄기 (CLK를 60us 이상 HIGH)
            // 아두이노 power_down() 은 LOW 를 먼저 쓰고 HIGH 를 쓴다(HX711.cpp:120-123).
            // 데이터시트가 요구하는 LOW→HIGH 에지를 명시적으로 만들기 위한 것이라,
            // HIGH 만 쓰면 이미 CLK 가 HIGH 인 상태(전원끄기 연속 호출 등)에서 아무 일도 안 한다.
            pins.digitalWritePin(_hx711Clk, 0)
            pins.digitalWritePin(_hx711Clk, 1)
            control.waitMicros(100)
        }
    }

    //% block="HX711 weight sensor read %dtype"
    //% dtype.defl=Sensors03.HX711DataType.Weight
    //% group="무게(HX711)" weight=199
    export function hx711Read(dtype: HX711DataType): number {
        if (dtype == HX711DataType.Raw) {
            return hx711ReadRaw()
        }
        return hx711ReadWeight()
    }

    // HX711 원본 데이터 읽기 (내부 함수)
    function hx711ReadRaw(): number {
        // 데이터 준비 대기 — 기존에는 타임아웃이 없어서 센서가 없거나 DOUT/CLK 를 바꿔 꽂으면
        // hx711Init() 이 on start 에서 영원히 멈췄다(전원 off 상태에서도 동일).
        // HX711 은 10SPS 이므로 500ms 면 5주기, 충분하면서도 on start 를 막지 않는다.
        let t0 = control.millis()
        let guard = 0
        while (pins.digitalReadPin(_hx711Dout) == 1) {
            basic.pause(1)
            guard++
            if (guard > 1000 || control.millis() - t0 > 500) {
                _hx711Ok = false
                return _hx711LastRaw
            }
        }

        let value: number = 0

        // 24비트 데이터 읽기
        for (let i = 0; i < 24; i++) {
            pins.digitalWritePin(_hx711Clk, 1)
            control.waitMicros(1)
            value = value << 1
            if (pins.digitalReadPin(_hx711Dout) == 1) {
                value++
            }
            pins.digitalWritePin(_hx711Clk, 0)
            control.waitMicros(1)
        }

        // 게인 설정을 위한 추가 펄스
        for (let i = 0; i < _hx711Gain; i++) {
            pins.digitalWritePin(_hx711Clk, 1)
            control.waitMicros(1)
            pins.digitalWritePin(_hx711Clk, 0)
            control.waitMicros(1)
        }

        // 24비트 2의 보수 처리
        if (value & 0x800000) {
            value = value - 0x1000000
        }

        // ★ BRIXEL 이 실제로 컴파일해 배포하는 HX711.cpp:58-80 은 세 바이트를 모두 반전한 뒤
        //   1을 더해서 돌려준다(= 참값의 부호 반전). 즉 아두이노판 'read raw' 는 항상 -(참값) 이다.
        //   MakeCode 가 수학적으로 옳은 부호를 쓰면 같은 로드셀·같은 보정계수인데도 무게 부호가
        //   반대로 나와서, 아두이노 교재에 인쇄된 scale 값(예: -2280)이 마이크로비트에서 통하지 않는다.
        //   두 제품이 같은 숫자를 내도록 배포 라이브러리 쪽에 맞춘다.
        value = -value

        _hx711Ok = true
        _hx711LastRaw = value
        return value
    }


    /********** PMS 미세먼지 센서 (PMS5003, PMS7003 등) **********/

    // PMS-X003 시리즈는 레이저 산란 방식의 미세먼지 센서입니다.
    // PM1.0, PM2.5, PM10 농도를 측정합니다.

    // PMS 시리얼 포트 타입

    // PMS 데이터 타입
    export enum PMSDataType {
        //% block="PM1.0 (std)"
        PM1_0_STD = 0,
        //% block="PM2.5 (std)"
        PM2_5_STD = 1,
        //% block="PM10 (std)"
        PM10_STD = 2,
        //% block="PM1.0 (atm)"
        PM1_0_ATM = 3,
        //% block="PM2.5 (atm)"
        PM2_5_ATM = 4,
        //% block="PM10 (atm)"
        PM10_ATM = 5
    }

    // PMS 모드
    export enum PMSMode {
        //% block="active"
        Active = 0,
        //% block="passive"
        Passive = 1
    }

    // PMS 전원 상태
    export enum PMSPower {
        //% block="wakeup"
        Wakeup = 0,
        //% block="sleep"
        Sleep = 1
    }

    // PMS 상태 변수
    let _pmsTx: SerialPin = SerialPin.P1
    let _pmsRx: SerialPin = SerialPin.P2
    let _pmsData: number[] = [0, 0, 0, 0, 0, 0]  // PM1.0_STD, PM2.5_STD, PM10_STD, PM1.0_ATM, PM2.5_ATM, PM10_ATM
    let _pmsReady: boolean = false
    let _pmsBuffer: number[] = []
    // 아두이노 PMS 라이브러리는 _mode 를 들고 있고 requestRead() 는 패시브 모드에서만 동작한다
    // (PMS.cpp:40-47). 전원 투입 직후의 기본값은 액티브 모드다.
    let _pmsMode: PMSMode = PMSMode.Active

    //% block="PM sensor(PMS-X003): RX %rx, TX %tx, baud %baud setup"
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P1
    //% baud.defl=9600
    //% group="미세먼지(PMS)" weight=185
    //% inlineInputMode=inline
    export function pmsInit(rx: SerialPin, tx: SerialPin, baud: number): void {
        _pmsRx = rx
        _pmsTx = tx
        // 즉시 전환하지 않고 중재자에 등록만 한다 (여러 UART 장치 공용)
        USBSerial.uartRegister(USBSerial.UartOwner.PMS, rx, tx, baud)
        // micro:bit UART 수신 링버퍼 기본값은 20바이트라 32바이트 프레임이 절대 다 들어오지 못한다.
        // 링은 UART 전체가 공유하므로 반드시 중재자의 1회성 헬퍼로 키운다(254바이트).
        // serial.setRxBufferSize 를 직접 부르면 (1) 이미 254로 키워 둔 WiFi/GPS 링을 도로 줄이고
        // (2) USB 폴러가 읽는 도중 링을 free/realloc 해서 수신 중인 데이터를 날린다.
        USBSerial.uartEnsureRxBuffer()
        _pmsReady = false
        _pmsBuffer = []
        _pmsMode = PMSMode.Active
        basic.pause(1000)  // 센서 안정화 대기
    }

    //% block="PMS PM sensor power %power"
    //% power.defl=Sensors03.PMSPower.Wakeup
    //% group="미세먼지(PMS)" weight=184
    export function pmsPower(power: PMSPower): void {
        USBSerial.uartClaim(USBSerial.UartOwner.PMS)
        if (power == PMSPower.Sleep) {
            // 슬립 명령: 42 4D E4 00 00 01 73
            let cmd = pins.createBuffer(7)
            cmd[0] = 0x42
            cmd[1] = 0x4D
            cmd[2] = 0xE4
            cmd[3] = 0x00
            cmd[4] = 0x00
            cmd[5] = 0x01
            cmd[6] = 0x73
            serial.writeBuffer(cmd)
        } else {
            // 깨우기 명령: 42 4D E4 00 01 01 74
            let cmd = pins.createBuffer(7)
            cmd[0] = 0x42
            cmd[1] = 0x4D
            cmd[2] = 0xE4
            cmd[3] = 0x00
            cmd[4] = 0x01
            cmd[5] = 0x01
            cmd[6] = 0x74
            serial.writeBuffer(cmd)
            basic.pause(1000)  // 깨우기 후 안정화
        }
    }

    //% block="PMS PM sensor mode %mode"
    //% mode.defl=Sensors03.PMSMode.Active
    //% group="미세먼지(PMS)" weight=183
    export function pmsSetMode(mode: PMSMode): void {
        USBSerial.uartClaim(USBSerial.UartOwner.PMS)
        _pmsMode = mode
        if (mode == PMSMode.Passive) {
            // 패시브 모드: 42 4D E1 00 00 01 70
            let cmd = pins.createBuffer(7)
            cmd[0] = 0x42
            cmd[1] = 0x4D
            cmd[2] = 0xE1
            cmd[3] = 0x00
            cmd[4] = 0x00
            cmd[5] = 0x01
            cmd[6] = 0x70
            serial.writeBuffer(cmd)
        } else {
            // 활성 모드: 42 4D E1 00 01 01 71
            let cmd = pins.createBuffer(7)
            cmd[0] = 0x42
            cmd[1] = 0x4D
            cmd[2] = 0xE1
            cmd[3] = 0x00
            cmd[4] = 0x01
            cmd[5] = 0x01
            cmd[6] = 0x71
            serial.writeBuffer(cmd)
        }
    }

    //% block="PMS PM sensor read %dtype"
    //% dtype.defl=Sensors03.PMSDataType.PM2_5_STD
    //% group="미세먼지(PMS)" weight=182
    export function pmsRead(dtype: PMSDataType): number {
        // 아두이노 PMS::readUntil() 은 체크섬까지 맞는 완전한 프레임이 올 때까지 최대
        // SINGLE_RESPONSE_TIME(1000ms) 기다리고, 생성기(getPmsData)는 실패하면 -1 을 돌려준다
        // (11_sensors_a.js:458-480, PMS.h:9). 기존 구현은 링버퍼에 '이미 들어와 있는' 바이트만
        // 훑어서, 셋업/깨우기 직후 첫 읽기는 항상 0 이고 그 뒤로는 언제 받은 값인지 알 수 없는
        // 캐시를 조용히 되풀이했다(센서를 뽑아도 마지막 값이 계속 나온다).
        let t0 = control.millis()
        while (control.millis() - t0 < 1000) {
            pmsParseData()
            if (_pmsReady) return _pmsData[dtype]
            basic.pause(10)
        }
        return -1   // 아두이노 getPmsData 와 같은 실패 표식
    }

    //% block="PMS PM sensor request read"
    //% group="미세먼지(PMS)" weight=181
    export function pmsRequestRead(): void {
        // PMS.cpp:42 — requestRead() 는 패시브 모드일 때만 프레임을 보낸다.
        if (_pmsMode != PMSMode.Passive) return
        USBSerial.uartClaim(USBSerial.UartOwner.PMS)
        // 수동 읽기 요청: 42 4D E2 00 00 01 71
        let cmd = pins.createBuffer(7)
        cmd[0] = 0x42
        cmd[1] = 0x4D
        cmd[2] = 0xE2
        cmd[3] = 0x00
        cmd[4] = 0x00
        cmd[5] = 0x01
        cmd[6] = 0x71
        serial.writeBuffer(cmd)
    }

    //% block="PMS PM sensor data ready"
    //% group="미세먼지(PMS)" weight=180
    export function pmsDataReady(): boolean {
        pmsParseData()
        return _pmsReady
    }

    // _pmsBuffer 앞쪽을 한 프레임으로 해석 (호출 전에 0x42 0x4D 헤더 확인 필요)
    // 반환값:  >0 = 소비할 프레임 전체 길이,  0 = 잘못된 프레임(재동기 필요),  -1 = 아직 덜 옴
    //
    // 아두이노 PMS.cpp:106 은 프레임 길이 20(PMS1003/3003) 과 28(PMS5003/7003) 을 모두 받아준다.
    // 두 경우 모두 앞쪽 12바이트 페이로드만 쓰기 때문에 추출 위치는 같다.
    // 기존 구현은 28 만 인정하고 32바이트 고정창을 가정해서, PMS3003 계열은 영원히 0 만 나왔다.
    function pmsParseFrame(): number {
        if (_pmsBuffer.length < 4) return -1

        // 프레임 길이 확인
        let frameLen = (_pmsBuffer[2] << 8) | _pmsBuffer[3]
        if (frameLen != 20 && frameLen != 28) return 0

        let total = frameLen + 4                 // 헤더2 + 길이2 + 페이로드
        if (_pmsBuffer.length < total) return -1

        // 체크섬 계산 (마지막 2바이트를 뺀 전부의 합)
        let checksum = 0
        for (let i = 0; i < total - 2; i++) {
            checksum += _pmsBuffer[i]
        }
        let receivedChecksum = (_pmsBuffer[total - 2] << 8) | _pmsBuffer[total - 1]
        if (checksum != receivedChecksum) return 0

        // 데이터 추출
        _pmsData[0] = (_pmsBuffer[4] << 8) | _pmsBuffer[5]     // PM1.0 표준
        _pmsData[1] = (_pmsBuffer[6] << 8) | _pmsBuffer[7]     // PM2.5 표준
        _pmsData[2] = (_pmsBuffer[8] << 8) | _pmsBuffer[9]     // PM10 표준
        _pmsData[3] = (_pmsBuffer[10] << 8) | _pmsBuffer[11]   // PM1.0 대기
        _pmsData[4] = (_pmsBuffer[12] << 8) | _pmsBuffer[13]   // PM2.5 대기
        _pmsData[5] = (_pmsBuffer[14] << 8) | _pmsBuffer[15]   // PM10 대기
        return total
    }

    // PMS 데이터 파싱 (내부 함수)
    function pmsParseData(): void {
        USBSerial.uartClaim(USBSerial.UartOwner.PMS)
        _pmsReady = false

        // 논블로킹으로 들어온 바이트만 읽어 _pmsBuffer 에 누적한다.
        // 기존 serial.readBuffer(32) 는 수신 링버퍼(기본 20바이트)보다 큰 길이를 요구해
        // 항상 32바이트 미만이 돌아왔고, 그 바이트를 버려서 값이 영원히 나오지 않았다.
        // 게다가 센서가 슬립 중이면 블로킹 읽기가 fiber 를 영구히 멈춘다.
        let chunk = serial.readBuffer(0)
        for (let i = 0; i < chunk.length; i++) {
            _pmsBuffer.push(chunk[i])
        }

        // 쓰레기 데이터가 계속 들어와도 힙이 무한히 커지지 않도록 상한
        if (_pmsBuffer.length > 256) {
            _pmsBuffer.splice(0, _pmsBuffer.length - 128)
        }

        // 헤더(0x42 0x4D)를 바이트 단위로 재동기화하며 쌓인 프레임을 모두 소비한다.
        // 기존에는 헤더가 0번 위치가 아니면 32바이트를 통째로 버려서 어긋남이 영구히 유지됐다.
        // 최소 프레임은 20+4 = 24바이트다.
        let scanning = true
        while (scanning && _pmsBuffer.length >= 24) {
            if (_pmsBuffer[0] != 0x42 || _pmsBuffer[1] != 0x4D) {
                _pmsBuffer.splice(0, 1)
            } else {
                let size = pmsParseFrame()
                if (size > 0) {
                    _pmsBuffer.splice(0, size)   // 정상 프레임 소비
                    _pmsReady = true
                } else if (size < 0) {
                    scanning = false             // 28바이트 프레임이 아직 다 안 옴 — 다음 호출에서 이어받는다
                } else {
                    _pmsBuffer.splice(0, 2)      // 페이로드 안의 가짜 헤더 — 2바이트만 버리고 재탐색
                }
            }
        }
    }


    /********** 로터리 엔코더 **********/

    // 로터리 엔코더 (KY-040 등)
    // 회전 방향 감지, 누적 카운터 지원

    // 회전 방향
    export enum RotaryDir {
        //% block="stop"
        None = 0,
        //% block="clockwise"
        CW = 1,
        //% block="counter-clockwise"
        CCW = -1
    }

    // 로터리 엔코더 상태 변수
    let _rotaryDT: DigitalPin = DigitalPin.P2
    let _rotaryCLK: DigitalPin = DigitalPin.P8
    let _rotaryCounter: number = 0
    let _rotaryLastCLK: number = 1
    let _rotaryLastDT: number = 1        // 아두이노 Rotary 생성자와 같은 초기값(oldA/oldB = HIGH)
    let _rotaryDirection: RotaryDir = RotaryDir.None
    let _rotaryChange: number = 0        // 아직 소비되지 않은 회전 스텝 누적
    let _rotaryStarted: boolean = false  // 백그라운드 샘플러 중복 실행 방지

    // P3/P4/P6/P7/P9/P10 은 micro:bit LED 매트릭스와 공유되는 핀이다.
    // 이 핀들은 디스플레이 드라이버가 6ms 주기로 계속 출력으로 되돌려 놓기 때문에
    // 그대로 읽거나 쓰면 매트릭스 구동 신호를 읽게 된다.
    export function isDisplaySharedPin(p: DigitalPin): boolean {
        return p == DigitalPin.P3 || p == DigitalPin.P4 || p == DigitalPin.P6
            || p == DigitalPin.P7 || p == DigitalPin.P9 || p == DigitalPin.P10
    }

    // 에지를 실제로 잡아내는 내부 샘플러 (블록 호출 시점에만 읽으면 대부분의 에지를 놓친다)
    //
    // ★ 아두이노 Rotary::getValue() (Rotary.cpp:11-25) 는 **DT 의 하강 에지**에서 판정하고,
    //   방향은 **직전 CLK 레벨**로 정한다: result = (oldB * 2 - 1) → 직전 CLK HIGH 면 +1(시계방향),
    //   LOW 면 -1(반시계방향). 기존 MakeCode 는 CLK 하강 에지 + 현재 DT 레벨을 써서 두 신호의
    //   역할이 뒤바뀌어 있었고, 그 결과 같은 배선/같은 회전에서 방향과 카운터 부호가 아두이노판과
    //   정반대로 나왔다(_locales 의 '시계방향' 라벨은 두 편집기가 같아서 차이가 그대로 보인다).
    function rotarySample(): void {
        let newDT = pins.digitalReadPin(_rotaryDT)
        let newCLK = pins.digitalReadPin(_rotaryCLK)

        if (newDT != _rotaryLastDT || newCLK != _rotaryLastCLK) {
            // DT 하강 에지에서만 한 스텝
            if (_rotaryLastDT == 1 && newDT == 0) {
                if (_rotaryLastCLK == 1) {
                    _rotaryCounter++
                    _rotaryDirection = RotaryDir.CW
                    _rotaryChange++
                } else {
                    _rotaryCounter--
                    _rotaryDirection = RotaryDir.CCW
                    _rotaryChange--
                }
            }
        }

        _rotaryLastDT = newDT
        _rotaryLastCLK = newCLK
    }

    //% block="rotary encoder: DT pin %dt|CLK pin %clk|set"
    //% dt.defl=DigitalPin.P2
    //% clk.defl=DigitalPin.P8
    //% group="Rotary Encoder" weight=195
    //% inlineInputMode=inline
    export function rotaryInit(dt: DigitalPin, clk: DigitalPin): void {
        _rotaryDT = dt
        _rotaryCLK = clk
        _rotaryCounter = 0
        _rotaryDirection = RotaryDir.None
        _rotaryChange = 0

        // LED 매트릭스 공유 핀을 골랐을 때만 디스플레이를 끈다 (무조건 끄면 showNumber 등이 죽는다)
        if (isDisplaySharedPin(dt) || isDisplaySharedPin(clk)) {
            led.enable(false)
        }
        // 모듈 기판의 풀업이 없는 맨 KY-040 대비
        pins.setPull(clk, PinPullMode.PullUp)
        pins.setPull(dt, PinPullMode.PullUp)

        _rotaryLastCLK = pins.digitalReadPin(clk)
        _rotaryLastDT = pins.digitalReadPin(dt)

        // 백그라운드에서 주기적으로 샘플링해야 손으로 돌리는 속도의 에지를 놓치지 않는다
        if (!_rotaryStarted) {
            _rotaryStarted = true
            control.inBackground(() => {
                while (true) {
                    rotarySample()
                    basic.pause(2)
                }
            })
        }
    }

    //% block="rotary encoder rotate value"
    //% group="Rotary Encoder" weight=194
    export function rotaryRead(): number {
        // 샘플러가 쌓아 둔 스텝을 한 칸씩 소비한다 (반환값 범위는 기존과 동일하게 -1/0/1)
        if (_rotaryChange > 0) { _rotaryChange--; return 1 }
        if (_rotaryChange < 0) { _rotaryChange++; return -1 }
        return 0
    }

    //% block="rotary encoder rotate direction"
    //% group="Rotary Encoder" weight=193
    export function rotaryDirection(): RotaryDir {
        // 샘플링은 백그라운드가 담당하므로 여기서 rotaryRead()를 부르면 회전값을 삼켜버린다
        let dir = _rotaryDirection
        _rotaryDirection = RotaryDir.None  // 읽은 후 리셋
        return dir
    }

    //% block="rotary encoder counter"
    //% group="Rotary Encoder" weight=192
    export function rotaryCounter(): number {
        return _rotaryCounter
    }

    //% block="rotary encoder counter reset"
    //% group="Rotary Encoder" weight=191
    export function rotaryReset(): void {
        _rotaryCounter = 0
        _rotaryDirection = RotaryDir.None
        _rotaryChange = 0   // 큐에 남은 스텝도 같이 버린다 (안 버리면 리셋 후에도 조금씩 흘러나온다)
    }


    /********** MHZ19 이산화탄소 센서 **********/

    // MHZ19는 NDIR(비분산 적외선) 방식의 CO2 센서입니다.
    // 측정 범위: 0-2000ppm, 0-5000ppm, 0-10000ppm

    // MHZ19 시리얼 포트 타입

    // MHZ19 데이터 타입
    export enum MHZ19DataType {
        //% block="CO2(ppm)"
        CO2 = 0,
        //% block="temperature(°C)"
        Temperature = 1
    }

    // MHZ19 측정 범위
    export enum MHZ19Range {
        //% block="2000 ppm"
        Range2000 = 2000,
        //% block="5000 ppm"
        Range5000 = 5000,
        //% block="10000 ppm"
        Range10000 = 10000
    }

    // MHZ19 필터 모드
    export enum MHZ19Filter {
        //% block="on"
        On = 1,
        //% block="off"
        Off = 0
    }

    // MHZ19 필터 타입
    export enum MHZ19FilterType {
        //% block="clear"
        Clear = 0,
        //% block="kalman"
        Kalman = 1
    }

    // MHZ19 자동 보정
    export enum MHZ19AutoCal {
        //% block="auto cal on"
        On = 1,
        //% block="auto cal off"
        Off = 0
    }

    // MHZ19 상태 타입
    export enum MHZ19Status {
        //% block="range"
        Range = 0,
        //% block="auto cal"
        AutoCal = 1
    }

    // MHZ19 상태 변수
    let _mhz19Tx: SerialPin = SerialPin.P1
    let _mhz19Rx: SerialPin = SerialPin.P2
    let _mhz19CO2: number = -1
    let _mhz19InitAt: number = -1
    let _mhz19Temp: number = -9999
    export let _mhz19Range: number = 2000
    export let _mhz19AutoCal: boolean = true

    //% block="MHZ19 CO2 sensor setup: RX %rx, TX %tx, baud %baud"
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P1
    //% baud.defl=9600
    //% group="CO2센서(MHZ19)" weight=175
    //% inlineInputMode=inline
    export function mhz19Init(rx: SerialPin, tx: SerialPin, baud: number): void {
        _mhz19Rx = rx
        _mhz19Tx = tx
        // 즉시 전환하지 않고 중재자에 등록만 한다 (여러 UART 장치 공용)
        USBSerial.uartRegister(USBSerial.UartOwner.MHZ19, rx, tx, baud)
        _mhz19InitAt = control.millis()
        _mhz19CO2 = -1
        _mhz19Temp = -9999
        // MH-Z19D needs 60 seconds of warm-up. Do not change the sensor's
        // persistent automatic calibration setting merely by starting UART.
    }

    //% block="MHZ19 set range: %range ppm"
    //% range.defl=Sensors03.MHZ19Range.Range2000
    //% group="CO2센서(MHZ19)" weight=174
    export function mhz19SetRange(range: MHZ19Range): void {
        if (range != MHZ19Range.Range2000 && range != MHZ19Range.Range5000 && range != MHZ19Range.Range10000) return
        USBSerial.uartClaim(USBSerial.UartOwner.MHZ19)
        if (!USBSerial.uartIsOwner(USBSerial.UartOwner.MHZ19)) return
        _mhz19Range = range
        // 범위 설정 명령: FF 01 99 00 00 00 [범위H] [범위L] [체크섬]
        let cmd = pins.createBuffer(9)
        cmd[0] = 0xFF
        cmd[1] = 0x01
        cmd[2] = 0x99
        cmd[3] = 0x00
        cmd[4] = 0x00
        cmd[5] = 0x00
        cmd[6] = (range >> 8) & 0xFF
        cmd[7] = range & 0xFF
        cmd[8] = mhz19Checksum(cmd)
        serial.writeBuffer(cmd)
        basic.pause(100)
    }


    //% block="MHZ19 read: %dtype"
    //% dtype.defl=Sensors03.MHZ19DataType.CO2
    //% group="CO2센서(MHZ19)" weight=172
    export function mhz19Read(dtype: MHZ19DataType): number {
        // Invalidate previous results before each request (Science Lab failure policy).
        _mhz19CO2 = -1
        _mhz19Temp = -9999
        if (_mhz19InitAt < 0 || control.millis() - _mhz19InitAt < 60000) return dtype == MHZ19DataType.CO2 ? -1 : -9999
        USBSerial.uartClaim(USBSerial.UartOwner.MHZ19)

        // 명령 전에 수신 버퍼를 비운다 (앞선 설정 명령의 응답이 남아 있으면 프레임이 어긋난다)
        serial.readBuffer(0)

        // CO2 읽기 명령: FF 01 86 00 00 00 00 00 79
        let cmd = pins.createBuffer(9)
        cmd[0] = 0xFF
        cmd[1] = 0x01
        cmd[2] = 0x86
        cmd[3] = 0x00
        cmd[4] = 0x00
        cmd[5] = 0x00
        cmd[6] = 0x00
        cmd[7] = 0x00
        cmd[8] = 0x79
        serial.writeBuffer(cmd)

        basic.pause(100)
        // ★ 마감시각은 안정화 대기가 끝난 뒤부터 잰다. 예전처럼 pause 앞에서 재면
        //   실제 폴링 창이 200ms 로 줄어든다. 아두이노판 MHZ19 는 TIMEOUT_PERIOD 500ms 다.
        let t0 = control.millis()

        // 응답 읽기 (9바이트)
        // 기존 serial.readBuffer(9)는 블로킹(SYNC_SLEEP)이라 센서가 없거나 TX/RX를 바꿔 꽂으면
        // fiber 가 영원히 멈춘다. 논블로킹으로 모으면서 0xFF 0x86 헤더로 재동기화하고 500ms 에 포기한다.
        let resp: number[] = []
        let got = false
        while (control.millis() - t0 < 500) {
            let chunk = serial.readBuffer(0)
            for (let i = 0; i < chunk.length; i++) {
                resp.push(chunk[i])
            }

            // 헤더 정렬 (앞쪽의 잔여 바이트를 버린다)
            let aligned = false
            while (!aligned) {
                if (resp.length > 0 && resp[0] != 0xFF) { resp.splice(0, 1) }
                else if (resp.length >= 2 && resp[1] != 0x86) { resp.splice(0, 1) }
                else { aligned = true }
            }

            if (resp.length >= 9) { got = true; break }
            basic.pause(10)
        }

        if (got) {
            // 체크섬 확인 (바이트 1~7 합의 2의 보수) — mhz19Checksum 과 동일한 계산
            let sum = 0
            for (let i = 1; i < 8; i++) {
                sum += resp[i]
            }
            let checksum = (0xFF - (sum & 0xFF) + 1) & 0xFF
            if (checksum == resp[8]) {
                _mhz19CO2 = (resp[2] << 8) | resp[3]
                _mhz19Temp = resp[4] - 40 // Legacy family diagnostic only; not a documented MH-Z19D air-temperature measurement.
            }
        }

        if (dtype == MHZ19DataType.CO2) {
            return _mhz19CO2
        }
        return _mhz19Temp
    }

    // ABC 명령(0x79)의 3번 바이트는 실제로는 '보정 주기' 필드다. 아두이노 MHZ19::autoCalibration()
    // 은 시간값을 24시간으로 클램프한 뒤 6.7 을 곱해 그 자리에 넣는다(MHZ19.cpp:388-415):
    //   24h → 160(0xA0), 12h → 80(0x50), 6h → 40(0x28), OFF → 0x00.
    // 아두이노 생성기의 기본값도 24h(=0xA0)라 여기서 0xA0/0x00 을 고정으로 쓰는 것은
    // 기본 사용에서 바이트 단위로 동일하다. (주기를 고르는 인자는 블록 목록을 바꾸지 않기 위해 두지 않는다)
    //% block="MHZ19 auto calibration %autoCal"
    //% autoCal.defl=Sensors03.MHZ19AutoCal.On
    //% group="CO2센서(MHZ19)" weight=171
    //% inlineInputMode=inline
    export function mhz19SetAutoCal(autoCal: MHZ19AutoCal): void {
        USBSerial.uartClaim(USBSerial.UartOwner.MHZ19)
        if (!USBSerial.uartIsOwner(USBSerial.UartOwner.MHZ19)) return
        _mhz19AutoCal = (autoCal == MHZ19AutoCal.On)
        // 자동 보정 ON: FF 01 79 A0 00 00 00 00 E6
        // 자동 보정 OFF: FF 01 79 00 00 00 00 00 86
        let cmd = pins.createBuffer(9)
        cmd[0] = 0xFF
        cmd[1] = 0x01
        cmd[2] = 0x79
        cmd[3] = _mhz19AutoCal ? 0xA0 : 0x00
        cmd[4] = 0x00
        cmd[5] = 0x00
        cmd[6] = 0x00
        cmd[7] = 0x00
        cmd[8] = mhz19Checksum(cmd)
        serial.writeBuffer(cmd)
        basic.pause(100)
    }
}
