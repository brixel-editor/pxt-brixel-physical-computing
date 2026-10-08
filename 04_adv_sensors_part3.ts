// Continuation of 04_adv_sensors.ts. See SOURCES.md for packaging details.
namespace AdvSensors {

    //% block="Sensor ready"
    //% group="심박(MAX30102)" weight=105
    export function heartRateIsReady(): boolean {
        // ★ 이 블록은 센서를 건드리지 않아서, 이걸로 읽기 블록을 감싸면 샘플러가 영원히
        //   기동되지 않고 _hrFingerDetected 가 false 로 굳는 자기잠금 상태가 됐다.
        hrEnsureSampler()
        // ★ 아두이노와 동일하게 워밍업 시간(5초)을 조건에 포함한다.
        //   안 그러면 프로그램 시작 수십 ms 만에 '준비됨' 이 되어, DC 추정이 수렴하기 전의
        //   불안정한 BPM/SpO2 가 화면에 뜬다.
        if (control.millis() - _hrSetupMs < 5000) return false
        return _hrReady && _hrFingerDetected
    }

    //% block="Sensor temperature (°C)"
    //% group="심박(MAX30102)" weight=104
    export function heartRateGetTemperature(): number {
        // 온도 측정 트리거
        pins.i2cWriteNumber(_hrAddr, 0x2101, NumberFormat.UInt16BE)
        basic.pause(50)

        // 온도 읽기
        // ★ 아두이노 readRegister8() 은 endTransmission(false) 로 반복시작을 쓴다.
        //   여기만 STOP 으로 버스를 놓고 있었다(같은 파일의 FIFO 읽기는 true 를 쓴다).
        //   이 확장은 같은 장치에 대고 백그라운드 I2C 샘플러를 돌리므로, 두 호출 사이에
        //   다른 파이버가 끼어들면 레지스터 포인터가 FIFO 쪽으로 옮겨져 온도 대신
        //   FIFO 바이트를 읽게 된다.
        pins.i2cWriteNumber(_hrAddr, 0x1F, NumberFormat.UInt8BE, true)
        let tempInt = pins.i2cReadNumber(_hrAddr, NumberFormat.Int8BE)

        pins.i2cWriteNumber(_hrAddr, 0x20, NumberFormat.UInt8BE, true)
        let tempFrac = pins.i2cReadNumber(_hrAddr, NumberFormat.UInt8BE)

        _hrTemperature = tempInt + (tempFrac * 0.0625)
        return Math.round(_hrTemperature * 10) / 10
    }

    //% block="%stype sensor power setting %power"
    //% stype.defl=HeartRateSensorType.HeartRate
    //% power.defl=HeartRatePower.Medium
    //% group="심박(MAX30102)" weight=103
    //% inlineInputMode=inline
    export function heartRateSetPower(stype: HeartRateSensorType, power: HeartRatePower): void {
        // ★ 전력 3단계는 아두이노 생성기(12_sensors_b.js 의 max30105_setup_advanced)와 같은 값을 쓴다.
        //   LOW 0x02 = 0.4mA, MEDIUM 0x1F = 6.4mA, HIGH 0x7F = 25.4mA
        //   (MAX30105.cpp setup() 주석의 전류 표와 동일)
        //   예전 값(0x0F / 0x24 / 0x50)은 'low' 가 레퍼런스의 7.5배 밝고 'high' 는 오히려
        //   37% 어두워, 세 단계가 의도한 범위를 전혀 덮지 못했다.
        let ledCurrent = 0x1F  // 기본 6.4mA

        if (power == HeartRatePower.Low) {
            ledCurrent = 0x02  // 0.4mA — 저전력 근접/존재 감지 수준
        } else if (power == HeartRatePower.Medium) {
            ledCurrent = 0x1F  // 6.4mA — 라이브러리 기본값
        } else {
            ledCurrent = 0x7F  // 25.4mA
        }

        if (stype == HeartRateSensorType.HeartRate) {
            // ★ 아두이노의 'HEARTRATE' 프리셋은 setup(power, 4, 2, 100) 이고,
            //   ledMode=2 는 라이브러리에서 MAX30105_MODE_REDIRONLY(0x03) = RED+IR 로 매핑된다.
            //   MODE=0x02 는 RED 단독이며 아두이노에서는 'PROXIMITY' 프리셋(ledMode=1)에만 쓰인다.
            //   예전에는 여기서 0x02 를 써서 IR LED 가 꺼졌고, 그 뒤 IR 자리에 RED 를 복사해
            //   'Finger detected'/'Sensor ready' 가 IR 기준으로 잡힌 50000 문턱을 RED 로 비교했다.
            //   RED 는 헤모글로빈 흡수가 훨씬 커서 손끝 투과 DC 가 IR 보다 낮고, 그래서
            //   손가락 감지가 잘 안 되고 BPM 이 0 에 붙어 있었다. SpO2 도 영구히 0 이었다.
            pins.i2cWriteNumber(_hrAddr, 0x0903, NumberFormat.UInt16BE)  // MODE = RED+IR
            // FIFO 평균 4 + 롤오버, 샘플레이트 100sps (아두이노 HEARTRATE 프리셋과 동일)
            pins.i2cWriteNumber(_hrAddr, 0x0850, NumberFormat.UInt16BE)  // FIFO_CONFIG = SMP_AVE 4 | ROLLOVER
            pins.i2cWriteNumber(_hrAddr, 0x0A27, NumberFormat.UInt16BE)  // SPO2_CONFIG = ADC 4096 | SR 100 | PW 411us
            pins.i2cWriteNumber(_hrAddr, (0x0C << 8) | ledCurrent, NumberFormat.UInt16BE)
            pins.i2cWriteNumber(_hrAddr, (0x0D << 8) | ledCurrent, NumberFormat.UInt16BE)
            _hrMode = 3
        } else {
            // RED + IR LED 사용 (SpO2 모드)
            // ★ 아두이노의 'OXYGEN' 프리셋은 setup(power, 8, 2, 200) — 프리셋마다 FIFO 평균과
            //   샘플레이트를 다시 쓴다. 예전에는 MODE 와 LED 전류만 바꿔서 SpO2 를 골라도
            //   평균·샘플레이트가 심박용 설정 그대로였다.
            pins.i2cWriteNumber(_hrAddr, 0x0903, NumberFormat.UInt16BE)  // MODE = RED+IR
            pins.i2cWriteNumber(_hrAddr, 0x0870, NumberFormat.UInt16BE)  // FIFO_CONFIG = SMP_AVE 8 | ROLLOVER
            pins.i2cWriteNumber(_hrAddr, 0x0A2B, NumberFormat.UInt16BE)  // SPO2_CONFIG = ADC 4096 | SR 200 | PW 411us
            pins.i2cWriteNumber(_hrAddr, (0x0C << 8) | ledCurrent, NumberFormat.UInt16BE)
            pins.i2cWriteNumber(_hrAddr, (0x0D << 8) | ledCurrent, NumberFormat.UInt16BE)
            _hrMode = 3
        }

        // ★ 아두이노 setup() 은 프리셋을 적용할 때마다 마지막에 clearFIFO() 를 부른다.
        //   설정 전에 찍힌 샘플이 남아 있으면 첫 읽기가 옛 설정의 값이 된다.
        pins.i2cWriteNumber(_hrAddr, 0x0400, NumberFormat.UInt16BE)   // FIFO_WR_PTR = 0
        pins.i2cWriteNumber(_hrAddr, 0x0500, NumberFormat.UInt16BE)   // OVF_COUNTER = 0
        pins.i2cWriteNumber(_hrAddr, 0x0600, NumberFormat.UInt16BE)   // FIFO_RD_PTR = 0
    }

    //% block="Red LED raw value read"
    //% group="심박(MAX30102)" weight=102
    export function heartRateGetRedRaw(): number {
        if (!hrSafeCheck()) return 0
        return _hrRedLED
    }

    //% block="IR LED raw value read"
    //% group="심박(MAX30102)" weight=101
    export function heartRateGetIRRaw(): number {
        if (!hrSafeCheck()) return 0
        return _hrIRLED
    }

    // 원시 데이터 읽기 (내부 함수)
    // ★ 반환값 = '이번 호출에서 실제로 새 샘플을 소비했는가'.
    //   아두이노 getIR() 은 safeCheck(250) 로 FIFO 에 새 샘플이 들어올 때까지 막고 나서
    //   checkForBeat() 에 넘기므로, 필터에 같은 샘플이 두 번 들어가는 일이 없다.
    //   예전 micro:bit 코드는 새 샘플이 없으면 직전 값을 그대로 둔 채 반환했는데,
    //   호출부는 그 사실을 모르고 무조건 hrProcessSample()/hrTrackAcDc() 를 불러
    //   이동평균과 AC min/max 에 같은 값을 반복해서 밀어 넣었다.
    export function heartRateReadRaw(): boolean {
        // ★ FIFO_WR_PTR(0x04) 와 FIFO_RD_PTR(0x06) 을 비교해 새 샘플이 있을 때만 읽는다.
        //   예전에는 무조건 읽어서 같은 샘플을 반복 처리하거나 빈 FIFO 를 읽었다.
        pins.i2cWriteNumber(_hrAddr, 0x04, NumberFormat.UInt8BE, true)
        let wr = pins.i2cReadNumber(_hrAddr, NumberFormat.UInt8BE)
        pins.i2cWriteNumber(_hrAddr, 0x06, NumberFormat.UInt8BE, true)
        let rd = pins.i2cReadNumber(_hrAddr, NumberFormat.UInt8BE)
        if (wr == rd) return false                 // 새 샘플 없음 — 직전 값 유지

        // ★ 샘플 폭은 모드에 따라 다르다. HR 모드는 채널 1개(3바이트),
        //   SpO2 모드는 채널 2개(6바이트). 예전에는 항상 6바이트를 읽어
        //   HR 모드에서 FIFO 정렬이 깨졌다.
        let n = (_hrMode == 3) ? 6 : 3
        pins.i2cWriteNumber(_hrAddr, 0x07, NumberFormat.UInt8BE, true)
        let fifoData = pins.i2cReadBuffer(_hrAddr, n)

        // 첫 채널 (HR 모드=RED, SpO2 모드=RED)
        _hrRedLED = ((fifoData[0] & 0x03) << 16) | (fifoData[1] << 8) | fifoData[2]

        if (n == 6) {
            _hrIRLED = ((fifoData[3] & 0x03) << 16) | (fifoData[4] << 8) | fifoData[5]
        } else {
            // HR 모드에는 IR 채널이 없다 — 박동 검출은 RED 파형으로 한다
            _hrIRLED = _hrRedLED
        }
        _hrLastSampleMs = control.millis()
        return true
    }

    // ★ 아두이노 getRed()/getIR() = 'safeCheck(250) 가 새 샘플을 잡으면 그 값, 아니면 0'.
    //   센서가 빠졌거나 멈췄을 때 마지막 정상값이 영원히 남는 대신 0 이 나와야
    //   고장을 알아볼 수 있다. 최대 250ms 까지만 기다린다(루프를 영구히 막지 않는다).
    function hrSafeCheck(): boolean {
        // ★ 백그라운드 샘플러가 돌고 있으면 FIFO 를 두고 다투면 안 된다.
        //   FIFO 는 꺼내면 사라지는데 칩의 실효 샘플레이트는 25sps 뿐이고,
        //   이 루프는 5ms 마다 찔러 20ms 주기의 샘플러보다 4배 빠르게 가져간다.
        //   그러면 박동 검출기가 샘플의 대부분을 못 받아 이동평균 창이 의도한 640ms 를
        //   훌쩍 넘고(맥동 자체가 평균에 먹혀) BPM/SpO2 가 함께 망가진다.
        //   샘플러가 이미 신선한 값을 채워 두므로 시각만 확인하면 된다.
        if (_hrSamplerOn) return (control.millis() - _hrLastSampleMs) < 250
        let t0 = control.millis()
        while ((control.millis() - t0) < 250) {
            if (heartRateReadRaw()) return true
            basic.pause(5)
        }
        return false
    }


    /********** Si7021 Temperature & Humidity Sensor **********/

    // Si7021 Value Type
    export enum Si7021Value {
        //% block="Temperature(°C)"
        TempC = 0,
        //% block="Temperature(°F)"
        TempF = 1,
        //% block="Humidity(%)"
        Humidity = 2
    }

    // Si7021 Serial Type
    export enum Si7021Serial {
        //% block="A"
        A = 0,
        //% block="B"
        B = 1
    }

    // Si7021 Data Variables
    let _si7021Addr: number = 0x40
    let _si7021Temp: number = 0
    let _si7021Humidity: number = 0

    /**
     * Si7021 Temperature & Humidity Sensor Setup
     */
    //% block="Si7021 Sensor Setup"
    //% group="온습도(Si7021)" weight=141
    export function si7021Init(): void {
        _si7021Addr = 0x40
        // Soft Reset
        // ★ 아두이노 Adafruit_Si7021::reset() 은 0xFE 뒤에 delay(50) 이다.
        //   15ms 는 데이터시트가 말하는 소프트리셋 최대 시간과 정확히 같아 여유가 0 이라,
        //   느린 개체나 전원이 덜 안정된 상태에서는 첫 측정 명령이 리셋 중인 칩에 닿는다.
        pins.i2cWriteNumber(_si7021Addr, 0xFE, NumberFormat.UInt8BE)
        basic.pause(50)
    }

    /**
     * Si7021 Read Value
     * @param valueType Value type to read
     */
    //% block="Si7021 Read Value: $valueType"
    //% valueType.defl=Si7021Value.TempC
    //% group="온습도(Si7021)" weight=140
    export function si7021Read(valueType: Si7021Value): number {
        if (valueType == Si7021Value.Humidity) {
            // Humidity measurement command (No Hold Master Mode)
            // ★ 예전에는 Hold Master 명령(0xE5)을 보내놓고 STOP 으로 끊은 뒤 따로 읽었다.
            //   그 트랜잭션 구조는 No Hold Master 시퀀스라, 규정된 두 시퀀스 어느 쪽도 아니었다.
            pins.i2cWriteNumber(_si7021Addr, 0xF5, NumberFormat.UInt8BE)
            basic.pause(25)

            let buf = pins.i2cReadBuffer(_si7021Addr, 2)
            let raw = (buf[0] << 8) | buf[1]
            _si7021Humidity = ((125 * raw) / 65536) - 6
            _si7021Humidity = Math.max(0, Math.min(100, _si7021Humidity))
            return Math.round(_si7021Humidity * 100) / 100
        } else {
            // Temperature measurement command (No Hold Master Mode)
            // ★ 습도와 같은 이유로 0xE3(Hold) → 0xF3(No Hold) 로 맞춘다.
            pins.i2cWriteNumber(_si7021Addr, 0xF3, NumberFormat.UInt8BE)
            basic.pause(25)

            let buf = pins.i2cReadBuffer(_si7021Addr, 2)
            let raw = (buf[0] << 8) | buf[1]
            _si7021Temp = ((175.72 * raw) / 65536) - 46.85

            if (valueType == Si7021Value.TempF) {
                return Math.round((_si7021Temp * 9 / 5 + 32) * 100) / 100
            }
            return Math.round(_si7021Temp * 100) / 100
        }
    }

    /**
     * Si7021 Sensor Reset
     */
    //% block="Si7021 Sensor Reset"
    //% group="온습도(Si7021)" weight=139
    export function si7021Reset(): void {
        // ★ si7021Init 과 같은 이유로 50ms (Adafruit_Si7021::reset 의 delay(50))
        pins.i2cWriteNumber(_si7021Addr, 0xFE, NumberFormat.UInt8BE)
        basic.pause(50)
    }

    /**
     * Si7021 Read Serial Number
     * @param serialType Serial type (A or B)
     */
    //% block="Si7021 Read Serial: Serial $serialType"
    //% serialType.defl=Si7021Serial.A
    //% group="온습도(Si7021)" weight=138
    export function si7021ReadSerial(serialType: Si7021Serial): number {
        if (serialType == Si7021Serial.A) {
            // Electronic ID 1st Byte (SNA)
            // ★ ID 읽기는 no-hold 대체 명령이 없어 반복시작(repeat=true)이 유일한 규정 시퀀스다
            // ★ 여기 있던 basic.pause(10) 은 뺐다. ID 읽기에는 변환시간이 없고
            //   (아두이노 Adafruit_Si7021::readSerialNumber 도 곧바로 requestFrom 한다),
            //   basic.pause 는 버스를 STOP 없이 붙잡은 채 스케줄러에 양보한다.
            //   같은 프로그램에서 MAX30102 백그라운드 샘플러가 돌면 그 I2C 트래픽이
            //   ID 명령과 ID 읽기 사이에 끼어들어 양쪽 다 깨진다.
            pins.i2cWriteNumber(_si7021Addr, 0xFA0F, NumberFormat.UInt16BE, true)
            let buf = pins.i2cReadBuffer(_si7021Addr, 8)
            // ★ << 24 는 int32 부호비트를 침범해 buf[0] >= 0x80 이면 음수가 된다.
            //   곱셈으로 합성해 부호 없는 값을 유지한다.
            return (buf[0] * 0x1000000) + (buf[2] << 16) + (buf[4] << 8) + buf[6]
        } else {
            // Electronic ID 2nd Byte (SNB)
            // ★ 여기 있던 basic.pause(10) 도 같은 이유로 뺐다(버스를 쥔 채 양보 금지).
            // ★ 6바이트 응답에 데이터 2바이트마다 CRC 1바이트라는 이 배치는 Si7021 데이터시트
            //   그대로다. 아두이노 Adafruit_Si7021 은 8바이트를 읽고 0/2/4/6 을 쓰는데,
            //   그쪽이 이 버전(v1.0)의 알려진 결함이므로 여기를 맞추지 않는다.
            pins.i2cWriteNumber(_si7021Addr, 0xFCC9, NumberFormat.UInt16BE, true)
            let buf = pins.i2cReadBuffer(_si7021Addr, 6)
            return (buf[0] * 0x1000000) + (buf[1] << 16) + (buf[3] << 8) + buf[4]
        }
    }


    /********** BH1750 조도 센서 **********/

    // BH1750 데이터 저장 변수
    let _bh1750Addr: number = 0x23

    //% block="BH1750 init address %addr"
    //% addr.defl=0x23
    //% group="조도(BH1750)" weight=95
    export function bh1750Init(addr: number): void {
        _bh1750Addr = addr
        // Power On
        pins.i2cWriteNumber(_bh1750Addr, 0x01, NumberFormat.UInt8BE)
        // 연속 고해상도 모드 (1 lux)
        pins.i2cWriteNumber(_bh1750Addr, 0x10, NumberFormat.UInt8BE)
        basic.pause(180)
    }

    //% block="BH1750 light intensity read (lux)"
    //% group="조도(BH1750)" weight=94
    export function bh1750Read(): number {
        let buf = pins.i2cReadBuffer(_bh1750Addr, 2)
        let raw = (buf[0] << 8) | buf[1]
        return Math.floor(raw / 1.2)
    }


    /********** TSL2561 조도 센서 **********/

    // TSL2561 데이터 저장 변수
    let _tsl2561Addr: number = 0x39
    // 현재 게인이 16x 인지(false 면 1x). 자동 레인지에 사용한다.
    let _tslGain16: boolean = true

    // TIMING(COMMAND 0x81) 쓰기 + 적분 1회분 대기
    function tslTiming(v: number): void {
        pins.i2cWriteNumber(_tsl2561Addr, 0x8100 | v, NumberFormat.UInt16BE)
        basic.pause(450)
    }

    // 채널 읽기 (0xAC = CH0, 0xAE = CH1 / COMMAND|WORD)
    function tslCh(cmd: number): number {
        pins.i2cWriteNumber(_tsl2561Addr, cmd, NumberFormat.UInt8BE, true)
        return pins.i2cReadNumber(_tsl2561Addr, NumberFormat.UInt16LE)
    }

    //% block="TSL2561 init address %addr"
    //% addr.defl=0x39
    //% group="조도(TSL2561)" weight=90
    export function tsl2561Init(addr: number): void {
        _tsl2561Addr = addr
        // ★ COMMAND(0x80|CONTROL) + POWER UP(0x03) 을 한 트랜잭션으로.
        //   나눠 보내면 전원이 켜지지 않아 ADC 적분이 시작되지 않고 조도가 항상 0 이 된다.
        pins.i2cWriteNumber(_tsl2561Addr, 0x8003, NumberFormat.UInt16BE)
        // ★ TIMING(COMMAND 0x81) = 0x12 → 게인 16x(bit4) + 적분 402ms(bits[1:0]=10).
        //   lux 근사식 상수가 이 조건을 전제한다. 밝은 곳에서는 tsl2561Read 가
        //   자동으로 1x 로 내렸다가 카운트를 16배로 환산해 같은 기준을 유지한다.
        // ★ 적분시간이 402ms 인데 예전에는 400ms 만 기다려 첫 변환이 끝나기 전에 반환했다.
        _tslGain16 = true
        tslTiming(0x12)
    }

    //% block="TSL2561 light intensity read (lux)"
    //% group="조도(TSL2561)" weight=89
    export function tsl2561Read(): number {
        // ★ 아래 lux 근사식 상수(0.0304 등)는 '적분 402ms + 게인 16x' 기준이다.
        //   예전에는 게인이 16x/402ms 로 하드웨어에 고정돼 있고 이를 바꿀 블록도 없어서,
        //   보통 교실 조도(약 450 lux 이상)만 돼도 ADC 가 포화해 -1 만 계속 나왔다.
        //   (주석은 '적분시간을 낮춰 재측정하라'고 했지만 사용자가 낮출 방법이 없었다.)
        //   이제 포화하면 1x 로 내려 다시 재고, 카운트를 16배로 환산해 같은 기준을 유지한다.
        //   게인이 바뀌는 호출에서는 재적분 대기(약 450ms)가 한 번 더 들어가 잠깐 끊겨 보인다.
        let ch0 = tslCh(0xAC)
        let ch1 = tslCh(0xAE)
        let sat = (ch0 >= 65000 || ch1 >= 65000)

        if (_tslGain16 && sat) {
            _tslGain16 = false
            tslTiming(0x02)                     // 게인 1x + 적분 402ms
            ch0 = tslCh(0xAC)
            ch1 = tslCh(0xAE)
            sat = (ch0 >= 65000 || ch1 >= 65000)
        } else if (!_tslGain16 && ch0 < 3000 && ch1 < 3000) {
            // 어두워졌으면 분해능을 되찾는다(환산 후 48000 카운트라 다시 포화하지 않는다)
            _tslGain16 = true
            tslTiming(0x12)                     // 게인 16x + 적분 402ms
            ch0 = tslCh(0xAC)
            ch1 = tslCh(0xAE)
            sat = (ch0 >= 65000 || ch1 >= 65000)
        }

        // ★ ADC 포화 검사 — 상한에 걸린 값을 lux 식에 넣으면 실제보다 훨씬 낮은 값이
        //   정상값인 것처럼 나온다. 게인을 1x 로 내리고도 포화하면 -1 로 알린다.
        if (sat) return -1

        // 1x 로 측정했으면 16x 기준으로 환산한다(상수식이 16x/402ms 를 전제하므로)
        if (!_tslGain16) { ch0 = ch0 * 16; ch1 = ch1 * 16 }

        // 간단한 Lux 계산
        if (ch0 == 0) return 0
        let ratio = ch1 / ch0
        let lux = 0
        if (ratio <= 0.5) {
            lux = 0.0304 * ch0 - 0.062 * ch0 * Math.pow(ratio, 1.4)
        } else if (ratio <= 0.61) {
            lux = 0.0224 * ch0 - 0.031 * ch1
        } else if (ratio <= 0.80) {
            lux = 0.0128 * ch0 - 0.0153 * ch1
        } else if (ratio <= 1.30) {
            lux = 0.00146 * ch0 - 0.00112 * ch1
        }
        return Math.floor(lux)
    }


    /********** ADXL345 가속도 센서 **********/

    // ADXL345 데이터 저장 변수
    let _adxl345Addr: number = 0x53

    //% block="ADXL345 init address %addr"
    //% addr.defl=0x53
    //% group="3축 가속도(ADXL345)" weight=85
    export function adxl345Init(addr: number): void {
        _adxl345Addr = addr
        // ★ 설정 순서를 데이터시트 권고대로 바로잡았다.
        //   예전에는 측정을 먼저 켜고(POWER_CTL) 그 뒤에 DATA_FORMAT 을 바꿔
        //   측정 중에 레인지/해상도가 바뀌는 상태가 됐다.
        pins.i2cWriteNumber(_adxl345Addr, 0x2D00, NumberFormat.UInt16BE)   // POWER_CTL: 스탠바이
        pins.i2cWriteNumber(_adxl345Addr, 0x310B, NumberFormat.UInt16BE)   // DATA_FORMAT: ±16g, FULL_RES
        pins.i2cWriteNumber(_adxl345Addr, 0x2D08, NumberFormat.UInt16BE)   // POWER_CTL: 측정 시작
        basic.pause(10)
    }

    //% block="ADXL345 acceleration read axis %axis"
    //% group="3축 가속도(ADXL345)" weight=84
    export function adxl345Read(axis: Axis): number {
        // ★ 축마다 따로 읽으면 세 축이 서로 다른 시점의 샘플이 되어 벡터가 어긋난다.
        //   DATAX0(0x32)부터 6바이트를 한 번에 버스트로 읽는다(데이터시트 권고).
        pins.i2cWriteNumber(_adxl345Addr, 0x32, NumberFormat.UInt8BE, true)
        let b = pins.i2cReadBuffer(_adxl345Addr, 6)
        let raw = b.getNumber(NumberFormat.Int16LE, axis * 2)
        // ★ DATA_FORMAT 을 FULL_RES(0x0B)로 설정해 두었으므로 레인지와 무관하게
        //   3.9 mg/LSB 이다. 예전에는 원시 LSB 카운트를 그대로 '가속도'라고 반환했다.
        return raw * 0.0039   // g
    }


    /********** BME280 기압/온도/습도 센서 **********/

    // BME280 측정 타입
    export enum BME280Type {
        //% block="pressure(hPa)"
        Pressure = 0,
        //% block="temperature(°C)"
        Temperature = 1,
        //% block="humidity(%)"
        Humidity = 2
    }

    // BME280 데이터 저장 변수
    let _bme280Addr: number = 0x76
    let _bme280Pressure: number = 0
    let _bme280Temp: number = 0
    let _bme280Humidity: number = 0

    // BME280 보정계수. 온도·기압(0x88~0x9F) + 습도(0xA1, 0xE1~0xE7).
    let _bmeT1 = 0, _bmeT2 = 0, _bmeT3 = 0
    let _bmeP1 = 0, _bmeP2 = 0, _bmeP3 = 0, _bmeP4 = 0, _bmeP5 = 0
    let _bmeP6 = 0, _bmeP7 = 0, _bmeP8 = 0, _bmeP9 = 0
    let _bmeH1 = 0, _bmeH2 = 0, _bmeH3 = 0, _bmeH4 = 0, _bmeH5 = 0, _bmeH6 = 0
    let _bmeTFine = 0
    let _bmeCalOk = false

    //% block="BME280 init address %addr"
    //% addr.defl=0x76
    //% group="대기압(BME280)" weight=80
    export function bme280Init(addr: number): void {
        _bme280Addr = addr

        // ★ chip ID(0xD0) 확인 — BME280 은 0x60 (BMP280 은 0x58).
        pins.i2cWriteNumber(_bme280Addr, 0xD0, NumberFormat.UInt8BE, true)
        let chipId = pins.i2cReadNumber(_bme280Addr, NumberFormat.UInt8BE)
        if (chipId != 0x60) { _bmeCalOk = false; return }

        pins.i2cWriteNumber(_bme280Addr, 0xE0B6, NumberFormat.UInt16BE)   // 소프트 리셋
        basic.pause(5)

        // ★ 보정계수 독출 — 예전 구현에는 이 단계가 없어 온도·기압·습도 3종 전부 무의미했다.
        pins.i2cWriteNumber(_bme280Addr, 0x88, NumberFormat.UInt8BE, true)
        let c = pins.i2cReadBuffer(_bme280Addr, 26)
        _bmeT1 = c.getNumber(NumberFormat.UInt16LE, 0)
        _bmeT2 = c.getNumber(NumberFormat.Int16LE, 2)
        _bmeT3 = c.getNumber(NumberFormat.Int16LE, 4)
        _bmeP1 = c.getNumber(NumberFormat.UInt16LE, 6)
        _bmeP2 = c.getNumber(NumberFormat.Int16LE, 8)
        _bmeP3 = c.getNumber(NumberFormat.Int16LE, 10)
        _bmeP4 = c.getNumber(NumberFormat.Int16LE, 12)
        _bmeP5 = c.getNumber(NumberFormat.Int16LE, 14)
        _bmeP6 = c.getNumber(NumberFormat.Int16LE, 16)
        _bmeP7 = c.getNumber(NumberFormat.Int16LE, 18)
        _bmeP8 = c.getNumber(NumberFormat.Int16LE, 20)
        _bmeP9 = c.getNumber(NumberFormat.Int16LE, 22)
        _bmeH1 = c[25]                                  // 0xA1, uint8

        pins.i2cWriteNumber(_bme280Addr, 0xE1, NumberFormat.UInt8BE, true)
        let h = pins.i2cReadBuffer(_bme280Addr, 7)
        _bmeH2 = h.getNumber(NumberFormat.Int16LE, 0)   // 0xE1~0xE2
        _bmeH3 = h[2]                                   // 0xE3, uint8
        // 0xE4~0xE6 은 니블 단위로 H4/H5 가 겹쳐 들어있다 (둘 다 부호있는 12비트)
        _bmeH4 = (h[3] << 4) | (h[4] & 0x0F)
        if (_bmeH4 > 2047) _bmeH4 -= 4096
        _bmeH5 = (h[5] << 4) | (h[4] >> 4)
        if (_bmeH5 > 2047) _bmeH5 -= 4096
        _bmeH6 = h[6]                                   // 0xE7, int8
        if (_bmeH6 > 127) _bmeH6 -= 256
        _bmeCalOk = (_bmeT1 != 0)

        // ★ ctrl_hum(0xF2) 는 반드시 ctrl_meas(0xF4) 보다 먼저 써야 반영된다
        pins.i2cWriteNumber(_bme280Addr, 0xF201, NumberFormat.UInt16BE)
        pins.i2cWriteNumber(_bme280Addr, 0xF427, NumberFormat.UInt16BE)
        basic.pause(100)
    }

    //% block="BME280 calibration loaded?"
    //% group="대기압(BME280)" weight=87
    export function bme280Calibrated(): boolean {
        return _bmeCalOk
    }

    function bmeCompT(adcT: number): number {
        let v1 = (adcT / 16384.0 - _bmeT1 / 1024.0) * _bmeT2
        let d = adcT / 131072.0 - _bmeT1 / 8192.0
        let v2 = d * d * _bmeT3
        _bmeTFine = v1 + v2
        return (v1 + v2) / 5120.0
    }

    function bmeCompP(adcP: number): number {
        let v1 = _bmeTFine / 2.0 - 64000.0
        let v2 = v1 * v1 * _bmeP6 / 32768.0
        v2 = v2 + v1 * _bmeP5 * 2.0
        v2 = v2 / 4.0 + _bmeP4 * 65536.0
        v1 = (_bmeP3 * v1 * v1 / 524288.0 + _bmeP2 * v1) / 524288.0
        v1 = (1.0 + v1 / 32768.0) * _bmeP1
        if (v1 == 0) return 0
        let p = 1048576.0 - adcP
        p = (p - v2 / 4096.0) * 6250.0 / v1
        v1 = _bmeP9 * p * p / 2147483648.0
        v2 = p * _bmeP8 / 32768.0
        return p + (v1 + v2 + _bmeP7) / 16.0
    }

    function bmeCompH(adcH: number): number {
        let vh = _bmeTFine - 76800.0
        vh = (adcH - (_bmeH4 * 64.0 + _bmeH5 / 16384.0 * vh)) *
             (_bmeH2 / 65536.0 * (1.0 + _bmeH6 / 67108864.0 * vh *
             (1.0 + _bmeH3 / 67108864.0 * vh)))
        vh = vh * (1.0 - _bmeH1 * vh / 524288.0)
        return Math.max(0, Math.min(100, vh))
    }

    //% block="BME280 read %btype"
    //% group="대기압(BME280)" weight=79
    export function bme280Read(btype: BME280Type): number {
        // 모든 데이터 읽기 (0xF7~0xFE)
        pins.i2cWriteNumber(_bme280Addr, 0xF7, NumberFormat.UInt8BE)
        let buf = pins.i2cReadBuffer(_bme280Addr, 8)

        let pressRaw = (buf[0] << 12) | (buf[1] << 4) | (buf[2] >> 4)
        let tempRaw = (buf[3] << 12) | (buf[4] << 4) | (buf[5] >> 4)
        let humRaw = (buf[6] << 8) | buf[7]

        if (!_bmeCalOk) {
            _bme280Temp = 0
            _bme280Pressure = 0
            _bme280Humidity = 0
        } else {
            // ★ 온도 먼저 — 기압·습도 보상이 t_fine 을 쓴다
            _bme280Temp = bmeCompT(tempRaw)
            _bme280Pressure = bmeCompP(pressRaw) / 100.0   // Pa → hPa
            _bme280Humidity = bmeCompH(humRaw)             // %RH
        }

        if (btype == BME280Type.Temperature) {
            return _bme280Temp
        } else if (btype == BME280Type.Humidity) {
            return _bme280Humidity
        }
        return _bme280Pressure
    }


    /********** 지문 센서 (AS608/R307) **********/

    // 지문 센서는 광학식 지문 인식 모듈입니다.
    // AS608, R307, R305 등 호환 모듈 지원

    // 지문 시리얼 타입

    // 지문 등록 과정
    export enum FPEnroll {
        //% block="get image"
        GetImage = 1,
        //% block="image to tz"
        Image2Tz = 2,
        //% block="create model"
        CreateModel = 3,
        //% block="store"
        Store = 4
    }

    // 지문 인식 모드
    export enum FPSearchMode {
        //% block="fast"
        Fast = 0,
        //% block="accurate"
        Accurate = 1
    }

    // 지문 인식 결과 타입
    export enum FPResult {
        //% block="finger ID"
        FingerID = 0,
        //% block="confidence"
        Confidence = 1,
        //% block="status"
        Status = 2
    }

    // 지문 데이터베이스 명령
    export enum FPDatabase {
        //% block="delete ID"
        DeleteID = 0,
        //% block="delete all"
        DeleteAll = 1,
        //% block="count"
        Count = 2
    }

    // 지문 LED 상태
    export enum FPLED {
        //% block="on"
        On = 1,
        //% block="off"
        Off = 0,
        //% block="blink"
        Blink = 2
    }

    // 지문 센서 상태 변수
    let _fpTx: SerialPin = SerialPin.P1
    let _fpRx: SerialPin = SerialPin.P2
    let _fpFingerID: number = -1
    let _fpConfidence: number = 0
    let _fpStatus: number = 0
    let _fpTemplateCount: number = 0

    /*
     * 지문 모듈 응답 패킷 1개를 '시간 제한 안에서' 읽고 프레임을 검증한다.
     *
     * ★ 예전에는 serial.readBuffer(12/14/16) 로 고정 길이를 읽고 곧바로 9번 바이트를
     *   상태코드라고 믿었다. 두 가지가 문제였다.
     *   (1) length>0 인 serial.readBuffer 는 타임아웃이 없는 블로킹(SYNC_SLEEP) 읽기다.
     *       모듈이 없거나 RX/TX 가 뒤바뀌어 있으면 그 자리에서 파이버가 영원히 잠들어
     *       프로그램이 멈춘 것처럼 보이고 리셋해야 복구된다.
     *       아두이노 Adafruit_Fingerprint 는 DEFAULTTIMEOUT(1000ms) 이 지나면
     *       FINGERPRINT_TIMEOUT 을 돌려주고 스케치는 계속 돈다.
     *   (2) 헤더(0xEF 0x01)와 패킷 종류(6번 바이트 = 확인응답 0x07)를 확인하지 않아,
     *       스트림이 한 바이트만 밀려도 아무 페이로드 바이트나 상태코드로 보고했다.
     *       아두이노 getStructuredPacket 은 0xEF 가 나올 때까지 앞 바이트를 버리며
     *       재동기하고, GET_CMD_PACKET 은 종류가 0x07 이 아니면 거부한다.
     *
     * 03_sensors.ts 의 MH-Z19 응답 수집(mhz19Query)과 같은 비블로킹 누적 방식이다.
     * 반환: 정렬·검증된 응답 바이트 배열. 실패하면 빈 배열.
     */
    function fpReadPacket(minLen: number, timeoutMs: number): number[] {
        let t0 = control.millis()
        let resp: number[] = []

        while (control.millis() - t0 < timeoutMs) {
            let chunk = serial.readBuffer(0)          // 비블로킹(ASYNC)
            for (let i = 0; i < chunk.length; i++) {
                resp.push(chunk[i])
            }

            // 헤더 재동기 — 0xEF 0x01 이 앞에 올 때까지 한 바이트씩 버린다
            let aligned = false
            while (!aligned) {
                if (resp.length > 0 && resp[0] != 0xEF) { resp.splice(0, 1) }
                else if (resp.length >= 2 && resp[1] != 0x01) { resp.splice(0, 1) }
                else { aligned = true }
            }

            if (resp.length >= minLen) {
                if (resp[6] == 0x07) return resp      // 확인응답 패킷
                resp.splice(0, 1)                     // 종류가 다르다 — 밀고 재동기
            }
            basic.pause(5)                            // 협조적 파이버 — 반드시 양보
        }
        return []
    }

    //% block="Fingerprint sensor setup: RX %rx, TX %tx, baud %baud"
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P1
    //% baud.defl=57600
    //% group="Fingerprint" weight=75
    //% inlineInputMode=inline
    export function fpInit(rx: SerialPin, tx: SerialPin, baud: number): void {
        _fpRx = rx
        _fpTx = tx
        // 즉시 전환하지 않고 중재자에 등록만 한다 (여러 UART 장치 공용)
        USBSerial.uartRegister(USBSerial.UartOwner.Fingerprint, rx, tx, baud)
        _fpFingerID = -1
        _fpConfidence = 0
        _fpStatus = 0
        basic.pause(500)
    }

    //% block="Fingerprint enroll %step, ID: %id"
    //% step.defl=FPEnroll.GetImage
    //% id.defl=1 id.min=1 id.max=162
    //% group="Fingerprint" weight=74
    //% inlineInputMode=inline
    export function fpEnroll(step: FPEnroll, id: number): number {
        USBSerial.uartClaim(USBSerial.UartOwner.Fingerprint)
        serial.readBuffer(0)   // 이전 명령이 남긴 묵은 응답 버리기(비블로킹)
        let cmd: Buffer

        if (step == FPEnroll.GetImage) {
            // 이미지 가져오기: EF 01 FF FF FF FF 01 00 03 01 00 05
            cmd = pins.createBuffer(12)
            cmd[0] = 0xEF; cmd[1] = 0x01
            cmd[2] = 0xFF; cmd[3] = 0xFF; cmd[4] = 0xFF; cmd[5] = 0xFF
            cmd[6] = 0x01; cmd[7] = 0x00; cmd[8] = 0x03
            cmd[9] = 0x01  // GenImg
            cmd[10] = 0x00; cmd[11] = 0x05
        } else if (step == FPEnroll.Image2Tz) {
            // 이미지 변환: EF 01 FF FF FF FF 01 00 04 02 01 00 08
            cmd = pins.createBuffer(13)
            cmd[0] = 0xEF; cmd[1] = 0x01
            cmd[2] = 0xFF; cmd[3] = 0xFF; cmd[4] = 0xFF; cmd[5] = 0xFF
            cmd[6] = 0x01; cmd[7] = 0x00; cmd[8] = 0x04
            cmd[9] = 0x02  // Img2Tz
            cmd[10] = 0x01  // Buffer 1
            cmd[11] = 0x00; cmd[12] = 0x08
        } else if (step == FPEnroll.CreateModel) {
            // 템플릿 생성: EF 01 FF FF FF FF 01 00 03 05 00 09
            cmd = pins.createBuffer(12)
            cmd[0] = 0xEF; cmd[1] = 0x01
            cmd[2] = 0xFF; cmd[3] = 0xFF; cmd[4] = 0xFF; cmd[5] = 0xFF
            cmd[6] = 0x01; cmd[7] = 0x00; cmd[8] = 0x03
            cmd[9] = 0x05  // RegModel
            cmd[10] = 0x00; cmd[11] = 0x09
        } else {
            // 템플릿 저장: EF 01 FF FF FF FF 01 00 06 06 01 00 [ID_H] [ID_L] [CHK_H] [CHK_L]
            cmd = pins.createBuffer(15)
            cmd[0] = 0xEF; cmd[1] = 0x01
            cmd[2] = 0xFF; cmd[3] = 0xFF; cmd[4] = 0xFF; cmd[5] = 0xFF
            cmd[6] = 0x01; cmd[7] = 0x00; cmd[8] = 0x06
            cmd[9] = 0x06  // Store
            cmd[10] = 0x01  // Buffer 1
            cmd[11] = (id >> 8) & 0xFF
            cmd[12] = id & 0xFF
            let sum = 0x01 + 0x00 + 0x06 + 0x06 + 0x01 + cmd[11] + cmd[12]
            cmd[13] = (sum >> 8) & 0xFF
            cmd[14] = sum & 0xFF
        }

        serial.writeBuffer(cmd)
        basic.pause(200)

        // 응답 읽기 (프레임 검증 + 시간 제한)
        let response = fpReadPacket(12, 1000)
        if (response.length >= 10) {
            _fpStatus = response[9]
            return _fpStatus
        }
        return -1
    }

    //% block="Fingerprint search mode: %mode"
    //% mode.defl=FPSearchMode.Fast
    //% group="Fingerprint" weight=73
    export function fpSearch(mode: FPSearchMode): number {
        USBSerial.uartClaim(USBSerial.UartOwner.Fingerprint)
        serial.readBuffer(0)   // 이전 명령이 남긴 묵은 응답 버리기(비블로킹)
        // 이미지 가져오기
        let imgCmd = pins.createBuffer(12)
        imgCmd[0] = 0xEF; imgCmd[1] = 0x01
        imgCmd[2] = 0xFF; imgCmd[3] = 0xFF; imgCmd[4] = 0xFF; imgCmd[5] = 0xFF
        imgCmd[6] = 0x01; imgCmd[7] = 0x00; imgCmd[8] = 0x03
        imgCmd[9] = 0x01
        imgCmd[10] = 0x00; imgCmd[11] = 0x05
        serial.writeBuffer(imgCmd)
        basic.pause(200)

        let imgResp = fpReadPacket(12, 1000)
        if (imgResp.length < 10 || imgResp[9] != 0x00) {
            _fpStatus = imgResp.length >= 10 ? imgResp[9] : -1
            _fpFingerID = -1
            return -1
        }

        // 이미지 변환
        let tzCmd = pins.createBuffer(13)
        tzCmd[0] = 0xEF; tzCmd[1] = 0x01
        tzCmd[2] = 0xFF; tzCmd[3] = 0xFF; tzCmd[4] = 0xFF; tzCmd[5] = 0xFF
        tzCmd[6] = 0x01; tzCmd[7] = 0x00; tzCmd[8] = 0x04
        tzCmd[9] = 0x02; tzCmd[10] = 0x01
        tzCmd[11] = 0x00; tzCmd[12] = 0x08
        serial.writeBuffer(tzCmd)
        basic.pause(200)

        let tzResp = fpReadPacket(12, 1000)
        if (tzResp.length < 10 || tzResp[9] != 0x00) {
            _fpStatus = tzResp.length >= 10 ? tzResp[9] : -1
            _fpFingerID = -1
            return -1
        }

        // 검색: EF 01 FF FF FF FF 01 00 08 04 01 00 00 00 A3 [CHK]
        let searchCmd = pins.createBuffer(17)
        searchCmd[0] = 0xEF; searchCmd[1] = 0x01
        searchCmd[2] = 0xFF; searchCmd[3] = 0xFF; searchCmd[4] = 0xFF; searchCmd[5] = 0xFF
        searchCmd[6] = 0x01; searchCmd[7] = 0x00; searchCmd[8] = 0x08
        // ★ 예전에는 mode 가 pause 길이만 바꿨고(그 다음 줄이 블로킹 읽기라 그마저도 무의미),
        //   명령은 항상 0x04(전체 검색)였다. 빠름은 고속검색(0x1B)으로 실제 분기시킨다.
        //   두 명령은 인자(버퍼/시작페이지/페이지수)와 16바이트 응답 형식이 동일하다.
        searchCmd[9] = (mode == FPSearchMode.Fast) ? 0x1B : 0x04  // HighSpeedSearch / Search
        searchCmd[10] = 0x01  // Buffer 1
        searchCmd[11] = 0x00; searchCmd[12] = 0x00  // Start page
        searchCmd[13] = 0x00; searchCmd[14] = 0xA3  // Page count (163)
        let sum = 0x01 + 0x00 + 0x08 + searchCmd[9] + 0x01 + 0x00 + 0x00 + 0x00 + 0xA3
        searchCmd[15] = (sum >> 8) & 0xFF
        searchCmd[16] = sum & 0xFF
        serial.writeBuffer(searchCmd)
        basic.pause(mode == FPSearchMode.Fast ? 200 : 500)

        // 검색 결과 읽기
        // 전체 검색(0x04)은 163 페이지를 훑으므로 아두이노 기본 1000ms 보다 넉넉히 준다.
        let searchResp = fpReadPacket(16, 2000)
        if (searchResp.length >= 14) {
            _fpStatus = searchResp[9]
            if (_fpStatus == 0x00) {
                _fpFingerID = (searchResp[10] << 8) | searchResp[11]
                _fpConfidence = (searchResp[12] << 8) | searchResp[13]
            } else {
                _fpFingerID = -1
                _fpConfidence = 0
            }
        }

        return _fpFingerID
    }

    //% block="Fingerprint result: %result"
    //% result.defl=FPResult.FingerID
    //% group="Fingerprint" weight=72
    export function fpGetResult(result: FPResult): number {
        if (result == FPResult.FingerID) {
            return _fpFingerID
        } else if (result == FPResult.Confidence) {
            return _fpConfidence
        }
        return _fpStatus
    }

    //% block="Fingerprint database %cmd, ID: %id"
    //% cmd.defl=FPDatabase.DeleteID
    //% id.defl=1 id.min=1 id.max=162
    //% group="Fingerprint" weight=71
    //% inlineInputMode=inline
    export function fpDatabase(cmd: FPDatabase, id: number): number {
        USBSerial.uartClaim(USBSerial.UartOwner.Fingerprint)
        serial.readBuffer(0)   // 이전 명령이 남긴 묵은 응답 버리기(비블로킹)
        let cmdBuf: Buffer

        if (cmd == FPDatabase.DeleteID) {
            // ID 삭제: EF 01 FF FF FF FF 01 00 07 0C [ID_H] [ID_L] 00 01 [CHK]
            cmdBuf = pins.createBuffer(16)
            cmdBuf[0] = 0xEF; cmdBuf[1] = 0x01
            cmdBuf[2] = 0xFF; cmdBuf[3] = 0xFF; cmdBuf[4] = 0xFF; cmdBuf[5] = 0xFF
            cmdBuf[6] = 0x01; cmdBuf[7] = 0x00; cmdBuf[8] = 0x07
            cmdBuf[9] = 0x0C  // DeletChar
            cmdBuf[10] = (id >> 8) & 0xFF
            cmdBuf[11] = id & 0xFF
            cmdBuf[12] = 0x00; cmdBuf[13] = 0x01
            let sum = 0x01 + 0x00 + 0x07 + 0x0C + cmdBuf[10] + cmdBuf[11] + 0x00 + 0x01
            cmdBuf[14] = (sum >> 8) & 0xFF
            cmdBuf[15] = sum & 0xFF
        } else if (cmd == FPDatabase.DeleteAll) {
            // 전체 삭제: EF 01 FF FF FF FF 01 00 03 0D 00 11
            cmdBuf = pins.createBuffer(12)
            cmdBuf[0] = 0xEF; cmdBuf[1] = 0x01
            cmdBuf[2] = 0xFF; cmdBuf[3] = 0xFF; cmdBuf[4] = 0xFF; cmdBuf[5] = 0xFF
            cmdBuf[6] = 0x01; cmdBuf[7] = 0x00; cmdBuf[8] = 0x03
            cmdBuf[9] = 0x0D  // Empty
            cmdBuf[10] = 0x00; cmdBuf[11] = 0x11
        } else {
            // 등록 개수: EF 01 FF FF FF FF 01 00 03 1D 00 21
            cmdBuf = pins.createBuffer(12)
            cmdBuf[0] = 0xEF; cmdBuf[1] = 0x01
            cmdBuf[2] = 0xFF; cmdBuf[3] = 0xFF; cmdBuf[4] = 0xFF; cmdBuf[5] = 0xFF
            cmdBuf[6] = 0x01; cmdBuf[7] = 0x00; cmdBuf[8] = 0x03
            cmdBuf[9] = 0x1D  // TemplateNum
            cmdBuf[10] = 0x00; cmdBuf[11] = 0x21
        }

        serial.writeBuffer(cmdBuf)
        basic.pause(200)

        // ★ DeletChar(0x0C)·Empty(0x0D) 의 응답은 12바이트뿐이다. 예전에는 무조건 14바이트를
        //   기다렸는데 serial.readBuffer 는 타임아웃 없는 블로킹 읽기라, 오지 않을 2바이트를
        //   기다리며 프로그램이 그대로 멈췄다(리셋해야 복구). 14바이트는 Count(0x1D)뿐이다.
        //   ★ 이제 fpReadPacket 이 시간 제한까지 걸어주므로, 길이를 잘못 잡아도 멈추지 않는다.
        //     전체 삭제(0x0D)는 플래시를 지우느라 오래 걸릴 수 있어 여유를 더 준다.
        let respLen = (cmd == FPDatabase.Count) ? 14 : 12
        let response = fpReadPacket(respLen, cmd == FPDatabase.DeleteAll ? 3000 : 1000)
        if (response.length >= 10) {
            _fpStatus = response[9]
            if (cmd == FPDatabase.Count && response.length >= 14) {
                _fpTemplateCount = (response[10] << 8) | response[11]
                return _fpTemplateCount
            }
            return _fpStatus
        }
        return -1
    }

    //% block="Fingerprint LED control %state"
    //% state.defl=FPLED.On
    //% group="Fingerprint" weight=70
    export function fpLED(state: FPLED): void {
        USBSerial.uartClaim(USBSerial.UartOwner.Fingerprint)
        // LED 제어: EF 01 FF FF FF FF 01 00 07 35 [ctrl] [speed] [color] [count] [CHK]
        let cmd = pins.createBuffer(16)
        cmd[0] = 0xEF; cmd[1] = 0x01
        cmd[2] = 0xFF; cmd[3] = 0xFF; cmd[4] = 0xFF; cmd[5] = 0xFF
        cmd[6] = 0x01; cmd[7] = 0x00; cmd[8] = 0x07
        cmd[9] = 0x35  // AuraLedConfig

        // ★ AuraLedConfig 의 제어코드와 색 인덱스는 Adafruit_Fingerprint.h 의 상수 그대로다.
        //   제어: BREATHING 0x01 / FLASHING 0x02 / ON(항상 켜짐) 0x03 / OFF 0x04
        //   색  : RED 0x01 / BLUE 0x02 / PURPLE 0x03
        //   예전에는 '켜기'에 0x01(호흡)을 보내면서 주석은 '켜기'라고 적어, 사용자가 기대한
        //   상시 점등 대신 최고 속도로 계속 맥동했다. 색도 두 경우 모두 0x01(빨강)을 보내면서
        //   주석만 '파란색'이었다.
        if (state == FPLED.On) {
            cmd[10] = 0x03  // 항상 켜짐 (FINGERPRINT_LED_ON)
            cmd[11] = 0x00  // 속도 (상시 점등에서는 무시)
            cmd[12] = 0x02  // 파란색 (FINGERPRINT_LED_BLUE)
            cmd[13] = 0x00  // 횟수 (상시 점등에서는 무시)
        } else if (state == FPLED.Off) {
            cmd[10] = 0x04  // 끄기 (FINGERPRINT_LED_OFF)
            cmd[11] = 0x00
            cmd[12] = 0x00
            cmd[13] = 0x00
        } else {
            // 아두이노 생성기의 FLASHING: LEDcontrol(FLASHING, 25, BLUE, 10)
            cmd[10] = 0x02  // 깜빡임 (FINGERPRINT_LED_FLASHING)
            cmd[11] = 0x19  // 속도 25
            cmd[12] = 0x02  // 파란색
            cmd[13] = 0x0A  // 횟수 10
        }

        let sum = 0x01 + 0x00 + 0x07 + 0x35 + cmd[10] + cmd[11] + cmd[12] + cmd[13]
        cmd[14] = (sum >> 8) & 0xFF
        cmd[15] = sum & 0xFF

        serial.writeBuffer(cmd)
        basic.pause(100)
        // ★ 모듈은 0x35 에도 12바이트 확인응답을 보낸다. 예전에는 이걸 읽지 않고 버퍼에 남겨서
        //   다음 지문 블록이 그 묵은 응답을 자기 응답이라고 읽어(패킷이 한 칸씩 밀려)
        //   손가락이 없어도 '이미지 획득 성공' 같은 엉뚱한 상태를 보고했다.
        //   length<=0 은 비블로킹(ASYNC)이라 응답하지 않는 구형 펌웨어에서도 멈추지 않는다.
        serial.readBuffer(0)
    }


    /********** INA219 전류/전압 센서 **********/

    // INA219는 I2C 전류/전압/전력 측정 센서입니다.
    // 최대 26V, ±3.2A 측정 가능

    // INA219 데이터 타입
    export enum INA219Data {
        //% block="current (mA)"
        Current = 0,
        //% block="voltage (V)"
        Voltage = 1,
        //% block="power (mW)"
        Power = 2,
        //% block="shunt voltage (mV)"
        ShuntVoltage = 3
    }

    // INA219 상태 변수
    let _ina219Addr: number = 0x40
    let _ina219Configured: boolean = false

    // CONFIG(0x00) + CALIBRATION(0x05) 프로그래밍 (내부 함수)
    // ★ 교정 레지스터가 0 이면 데이터시트대로 전류·전력 레지스터가 계속 0 이다.
    //   예전에는 이 쓰기가 'INA219 set I2C address' 블록 안에만 있어서, 그 블록을
    //   끌어오지 않은 사용자는 전압만 정상이고 전류/전력이 영원히 0.00 이었다.
    function ina219Configure(): void {
        let config = 0x399F
        let buf = pins.createBuffer(3)
        buf[0] = 0x00  // 설정 레지스터
        buf[1] = (config >> 8) & 0xFF
        buf[2] = config & 0xFF
        pins.i2cWriteBuffer(_ina219Addr, buf)

        // 교정 레지스터 설정
        let calibration = 4096
        buf[0] = 0x05
        buf[1] = (calibration >> 8) & 0xFF
        buf[2] = calibration & 0xFF
        pins.i2cWriteBuffer(_ina219Addr, buf)

        _ina219Configured = true
    }

    //% block="INA219 set I2C address %addr"
    //% addr.defl=0x40
    //% group="전류/전압/전력 측정(INA219)" weight=65
    export function ina219Init(addr: number): void {
        _ina219Addr = addr
        _ina219Configured = false   // 주소가 바뀌면 새 장치에 다시 프로그래밍해야 한다
        ina219Configure()
    }

    //% block="INA219 read %data"
    //% group="전류/전압/전력 측정(INA219)" weight=64
    export function ina219Read(data: INA219Data): number {
        // 초기화 블록을 끌어오지 않아도 첫 읽기에서 한 번 프로그래밍한다
        if (!_ina219Configured) ina219Configure()

        let reg = 0
        switch (data) {
            case INA219Data.ShuntVoltage: reg = 0x01; break
            case INA219Data.Voltage: reg = 0x02; break
            case INA219Data.Power: reg = 0x03; break
            case INA219Data.Current: reg = 0x04; break
        }

        pins.i2cWriteNumber(_ina219Addr, reg, NumberFormat.UInt8BE, true)
        // ★ BUS VOLTAGE(0x02) 는 부호 없는 레지스터다. Int16BE 로 읽으면
        //   버스 전압이 16.384V 이상일 때 bit15 가 서서 음수로 해석된다.
        //   션트전압·전류·전력은 부호가 있으므로 Int16BE 가 맞다.
        //   POWER(0x03) 도 부호 없는 레지스터라 65.5W 를 넘으면 음수가 된다.
        let raw = (data == INA219Data.Voltage || data == INA219Data.Power)
            ? pins.i2cReadNumber(_ina219Addr, NumberFormat.UInt16BE)
            : pins.i2cReadNumber(_ina219Addr, NumberFormat.Int16BE)

        switch (data) {
            case INA219Data.ShuntVoltage:
                return raw * 0.01  // mV
            case INA219Data.Voltage:
                return (raw >> 3) * 0.004  // V
            case INA219Data.Power:
                return raw * 2  // mW
            case INA219Data.Current:
                // ★ CALIBRATION=4096(0.1Ω 션트, 32V/2A 프리셋)에서 Current_LSB = 100µA = 0.1mA.
                //   원시값을 그대로 mA 로 쓰면 10배 크게 나온다.
                return raw * 0.1  // mA
            default:
                return 0
        }
    }


    /********** CCS811 CO2/VOC 센서 **********/

    // CCS811 측정 타입
    export enum CCS811Type {
        //% block="CO2(ppm)"
        CO2 = 0,
        //% block="TVOC(ppb)"
        TVOC = 1
    }

    // CCS811 데이터 저장 변수
    let _ccs811Addr: number = 0x5A
    let _ccs811CO2: number = 0
    let _ccs811TVOC: number = 0
    let _ccs811Error: number = 0     // 마지막 ERROR_ID(0xE0) 값

    //% block="CCS811 init"
    //% group="CO2센서(CCS811)" weight=88
    export function ccs811Init(): void {
        // 앱 시작 명령
        pins.i2cWriteNumber(_ccs811Addr, 0xF4, NumberFormat.UInt8BE)
        basic.pause(100)
        // 측정 모드 설정 (1초 간격)
        pins.i2cWriteNumber(_ccs811Addr, 0x0110, NumberFormat.UInt16BE)
        basic.pause(100)
    }

    //% block="CCS811 read %ctype"
    //% group="CO2센서(CCS811)" weight=87
    export function ccs811Read(ctype: CCS811Type): number {
        // ★ STATUS(0x00) 의 DATA_READY(bit3) 확인 — 예전에는 무조건 읽어서
        //   아직 갱신되지 않은 이전 측정값이나 초기값을 새 값처럼 반환했다.
        //   ERROR(bit0) 도 함께 확인한다.
        pins.i2cWriteNumber(_ccs811Addr, 0x00, NumberFormat.UInt8BE, true)
        let status = pins.i2cReadNumber(_ccs811Addr, NumberFormat.UInt8BE)
        if ((status & 0x01) != 0) {            // ERROR
            // ★ CCS811 의 ERROR 플래그는 ERROR_ID(0xE0)를 읽어야만 지워진다.
            //   예전에는 이 레지스터를 한 번도 읽지 않아, 순간적인 오류 한 번에
            //   이후 모든 읽기가 캐시값만 돌려주는 상태로 굳었다(전원 재투입 전까지 복구 불가).
            pins.i2cWriteNumber(_ccs811Addr, 0xE0, NumberFormat.UInt8BE, true)
            _ccs811Error = pins.i2cReadNumber(_ccs811Addr, NumberFormat.UInt8BE)
            return ctype == CCS811Type.CO2 ? _ccs811CO2 : _ccs811TVOC
        }
        if ((status & 0x08) == 0) {            // DATA_READY 아님 → 직전 값 유지
            return ctype == CCS811Type.CO2 ? _ccs811CO2 : _ccs811TVOC
        }

        // 결과 레지스터 읽기
        pins.i2cWriteNumber(_ccs811Addr, 0x02, NumberFormat.UInt8BE, true)
        let buf = pins.i2cReadBuffer(_ccs811Addr, 4)

        _ccs811CO2 = (buf[0] << 8) | buf[1]
        _ccs811TVOC = (buf[2] << 8) | buf[3]

        if (ctype == CCS811Type.CO2) {
            return _ccs811CO2
        }
        return _ccs811TVOC
    }


    /********** I2C 무게 센서 (0x63 스트리밍 모듈) **********/

    // ★ 이 그룹은 NAU7802 드라이버였다가 실물에 맞춰 전면 교체했다.
    //   브릭셀 아두이노판(generators/12_sensors_b.js 의 i2c_weight_*)이 실제로 대화하는 모듈은
    //   레지스터가 없는 스트리밍 방식이고 주소도 0x63 이다. NAU7802(0x2A) 레지스터 시퀀스로는
    //   이 모듈과 대화 자체가 되지 않았다.
    //
    //   프로토콜 전부:
    //     3바이트를 그냥 읽는다 → [0]=0xFF(유효 표식), [1]=상위, [2]=하위
    //     무게 = ([1] << 8) | [2]      (부호 없는 16비트)
    //   레지스터도, 게인도, 24비트도 없다. 그래서 "게인 설정"과 "24비트 원시값" 블록은 제거했다.

    // I2C Weight Sensor data byte type
    export enum I2CWeightByte {
        //% block="0 (status)"
        Status = 0,
        //% block="1 (data High)"
        DataHigh = 1,
        //% block="2 (data Low)"
        DataLow = 2
    }

    // I2C 무게센서 상태 변수
    export let _i2cWeightAddr: number = 0x63          // 스트리밍 모듈 기본 주소
    export let _i2cWeightOffset: number = 0           // 영점(tare) 원시값
    export let _i2cWeightScale: number = 1            // 원시값 → 사용자 단위 배율
    export let _i2cWeightBad: boolean = false         // 마지막 읽기가 유효하지 않았는가
    let _i2cWeightLastRaw: number = 0          // 마지막으로 성공한 원시값

    // 3바이트 프레임을 읽어 유효성까지 판정한다.
    // 모듈이 없으면 I2C 라인이 풀업으로 떠서 FF FF FF 가 읽히는데, 그것도 [0]==0xFF 라
    // 표식만으로는 구분되지 않는다. 그래서 세 바이트가 모두 FF 인 경우를 따로 걸러낸다.
    export function i2cWeightRaw(): number {
        let b = pins.i2cReadBuffer(_i2cWeightAddr, 3)
        if (b.length < 3 || b[0] != 0xFF || (b[1] == 0xFF && b[2] == 0xFF)) {
            _i2cWeightBad = true
            return _i2cWeightLastRaw
        }
        _i2cWeightBad = false
        _i2cWeightLastRaw = (b[1] << 8) | b[2]
        return _i2cWeightLastRaw
    }

    /**
     * I2C 무게센서 주소 설정
     * @param addr I2C 주소, eg: 0x63
     */
    //% block="I2C Weight Sensor set address $addr"
    //% addr.defl=99
    //% group="I2C 무게센서" weight=58
    export function i2cWeightSetAddress(addr: number): void {
        _i2cWeightAddr = addr
        _i2cWeightOffset = 0
        _i2cWeightScale = 1
        _i2cWeightLastRaw = 0
        // 레지스터가 없는 모듈이라 초기화 시퀀스가 없다. 한 번 읽어 응답만 확인한다.
        i2cWeightRaw()
    }

    /**
     * I2C 무게센서 무게 읽기 (영점·배율 적용)
     */
    //% block="I2C Weight Sensor read weight"
    //% group="I2C 무게센서" weight=57
    export function i2cWeightRead(): number {
        let raw = i2cWeightRaw()
        if (_i2cWeightScale == 0) return 0
        return (raw - _i2cWeightOffset) / _i2cWeightScale
    }
}
