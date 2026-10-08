// Continuation of 03_sensors.ts. See SOURCES.md for packaging details.
namespace Sensors03 {

    //% block="MHZ19 status read: %status"
    //% status.defl=MHZ19Status.Range
    //% group="CO2센서(MHZ19)" weight=170
    export function mhz19GetStatus(status: MHZ19Status): number {
        // 아두이노 getRange()/getABC() 는 매번 센서에 직접 물어본다:
        //   getRange : 명령 155(0x9B) → 응답 바이트4·5 (MHZ19.cpp:229-240)
        //   getABC   : 명령 125(0x7D) → 응답 바이트7   (MHZ19.cpp:313-323)
        // 기존 구현은 시리얼을 전혀 쓰지 않고 사용자가 설정한 모듈 변수를 그대로 돌려줘서,
        // 센서를 뽑아 놔도 항상 2000ppm / 자동보정 ON 이라고 답했다.
        if (status == MHZ19Status.Range) {
            let r = mhz19Query(0x9B)
            if (r.length >= 9) _mhz19Range = (r[4] << 8) | r[5]
            return _mhz19Range
        }
        let a = mhz19Query(0x7D)
        if (a.length >= 9) _mhz19AutoCal = a[7] != 0
        return _mhz19AutoCal ? 1 : 0
    }

    // MH-Z19 질의 프레임 하나를 보내고 검증된 9바이트 응답을 받아온다 (내부 함수).
    // mhz19Read 와 같은 논블로킹 + 마감시각 방식이라 센서가 없어도 fiber 가 멈추지 않는다.
    // 실패하면 빈 배열을 돌려준다(호출부는 직전 값을 유지한다).
    function mhz19Query(cmdByte: number): number[] {
        USBSerial.uartClaim(USBSerial.UartOwner.MHZ19)
        serial.readBuffer(0)   // 앞선 명령의 잔여 응답 버리기

        let cmd = pins.createBuffer(9)
        cmd[0] = 0xFF
        cmd[1] = 0x01
        cmd[2] = cmdByte
        cmd[3] = 0x00
        cmd[4] = 0x00
        cmd[5] = 0x00
        cmd[6] = 0x00
        cmd[7] = 0x00
        cmd[8] = mhz19Checksum(cmd)
        serial.writeBuffer(cmd)

        basic.pause(100)
        let t0 = control.millis()
        let resp: number[] = []

        while (control.millis() - t0 < 500) {
            let chunk = serial.readBuffer(0)
            for (let i = 0; i < chunk.length; i++) {
                resp.push(chunk[i])
            }

            // 헤더 정렬 (0xFF + 명령 에코)
            let aligned = false
            while (!aligned) {
                if (resp.length > 0 && resp[0] != 0xFF) { resp.splice(0, 1) }
                else if (resp.length >= 2 && resp[1] != cmdByte) { resp.splice(0, 1) }
                else { aligned = true }
            }

            if (resp.length >= 9) {
                let sum = 0
                for (let i = 1; i < 8; i++) {
                    sum += resp[i]
                }
                if (((0xFF - (sum & 0xFF) + 1) & 0xFF) == resp[8]) return resp
                resp.splice(0, 1)   // 체크섬 불일치 — 한 바이트 밀고 재동기
            }
            basic.pause(10)
        }
        return []
    }

    // MHZ19 체크섬 계산 (내부 함수)
    export function mhz19Checksum(buf: Buffer): number {
        let sum = 0
        for (let i = 1; i < 8; i++) {
            sum += buf[i]
        }
        return (0xFF - (sum & 0xFF) + 1) & 0xFF
    }


    /********** TDS 수질 센서 (GravityTDS) **********/

    // TDS(Total Dissolved Solids)는 물에 녹아있는 총 용존 고형물을 측정합니다.
    // 수질 측정에 사용되며, ppm 단위로 표시됩니다.

    // TDS 데이터 타입
    export enum TDSDataType {
        //% block="TDS(ppm)"
        TDS = 0,
        //% block="voltage(V)"
        Voltage = 1,
        //% block="EC(μS/cm)"
        EC = 2
    }

    // TDS 고급 설정 타입
    export enum TDSAdvanced {
        //% block="ADC ref voltage(V)"
        RefVoltage = 0,
        //% block="ADC resolution"
        ADCResolution = 1,
        //% block="K value"
        KValue = 2
    }

    // TDS 상태 변수
    let _tdsPin: AnalogPin = AnalogPin.P0
    let _tdsTemperature: number = 25
    let _tdsRefVoltage: number = 3.3
    let _tdsADCResolution: number = 1023
    let _tdsKValue: number = 1.0
    let _tdsVoltage: number = 0
    let _tdsTDSValue: number = 0
    let _tdsECValue: number = 0

    //% block="TDS sensor(GravityTDS) setup: pin %pin"
    //% pin.defl=AnalogPin.P0
    //% group="전기전도도(TDS)" weight=165
    export function tdsInit(pin: AnalogPin): void {
        _tdsPin = pin
        _tdsTemperature = 25
        _tdsRefVoltage = 3.3
        _tdsADCResolution = 1023
        _tdsKValue = 1.0
    }

    //% block="TDS sensor temp compensation: %temperature °C"
    //% temperature.defl=25 temperature.min=0 temperature.max=50
    //% group="전기전도도(TDS)" weight=164
    export function tdsSetTemperature(temperature: number): void {
        _tdsTemperature = temperature
    }

    //% block="TDS sensor update"
    //% group="전기전도도(TDS)" weight=163
    export function tdsUpdate(): void {
        // 아날로그 값 읽기 (여러 번 읽어서 평균)
        let analogSum = 0
        for (let i = 0; i < 10; i++) {
            analogSum += pins.analogReadPin(_tdsPin)
            basic.pause(10)
        }
        let analogValue = analogSum / 10

        // 전압 계산
        _tdsVoltage = analogValue * _tdsRefVoltage / _tdsADCResolution

        // 온도 보상 계수 계산
        let compensationCoefficient = 1.0 + 0.02 * (_tdsTemperature - 25.0)

        // DFRobot GravityTDS 공식의 3차 다항식이 내놓는 값은 ppm 이 아니라 EC(μS/cm) 다.
        // 기존 코드는 이 값을 그대로 TDS(ppm) 으로 쓰고 EC 는 다시 2배 해서
        // ppm 과 EC 둘 다 정확히 2배로 부풀어 있었다. (TdsFactor = 0.5 가 빠져 있었음)
        // _tdsKValue 는 전극 상수(기본 1.0)이지 ppm/EC 변환 계수가 아니다.
        // ★ 온도 보상을 '전압'이 아니라 '결과 EC'에 적용해야 아두이노판과 같아진다.
        //   다항식이 3차라 poly(V/c) ≠ poly(V)/c 다. 25°C 에서는 c=1 이라 같지만
        //   30°C·2V 에서 약 5% 벌어진다. DFRobot_GravityTDS::update() 순서를 그대로 따른다:
        //     ecValue   = poly(voltage) * kValue
        //     ecValue25 = ecValue / (1 + 0.02*(T-25))
        //     tdsValue  = ecValue25 * TdsFactor(0.5)
        let v = _tdsVoltage
        let ec = (133.42 * v * v * v - 255.86 * v * v + 857.39 * v) * _tdsKValue
        ec = ec / compensationCoefficient

        if (ec < 0) ec = 0

        _tdsECValue = ec              // EC (μS/cm), 25°C 환산
        _tdsTDSValue = ec * 0.5       // TDS (ppm) = EC × TdsFactor(0.5)
    }

    //% block="TDS sensor read: %dtype"
    //% dtype.defl=TDSDataType.TDS
    //% group="전기전도도(TDS)" weight=162
    export function tdsRead(dtype: TDSDataType): number {
        if (dtype == TDSDataType.TDS) {
            return Math.round(_tdsTDSValue)
        } else if (dtype == TDSDataType.Voltage) {
            return Math.round(_tdsVoltage * 100) / 100
        }
        return Math.round(_tdsECValue)
    }

    //% block="TDS sensor advanced %setting value: %value"
    //% setting.defl=TDSAdvanced.RefVoltage
    //% value.defl=3.3
    //% group="전기전도도(TDS)" weight=161
    //% inlineInputMode=inline
    export function tdsSetAdvanced(setting: TDSAdvanced, value: number): void {
        if (setting == TDSAdvanced.RefVoltage) {
            _tdsRefVoltage = value
        } else if (setting == TDSAdvanced.ADCResolution) {
            _tdsADCResolution = value
        } else {
            _tdsKValue = value
        }
    }


    /********** pH 센서 **********/

    // pH 센서는 용액의 산성/알칼리성을 측정합니다.
    // 측정 범위: 0-14 pH

    // pH 보정 명령
    export enum PHCalibration {
        //% block="enter cal mode"
        EnterCal = 0,
        //% block="exit cal mode"
        ExitCal = 1,
        //% block="cal mid (pH 7)"
        CalMid = 2,
        //% block="cal low (pH 4)"
        CalLow = 3,
        //% block="cal high (pH 10)"
        CalHigh = 4
    }

    // pH 상태 변수
    let _phPin: AnalogPin = AnalogPin.P0
    let _phRefVoltage: number = 3.3
    let _phOffset: number = 0.0
    let _phNeutralVoltage: number = 1.5        // pH 7일 때 전압 (DFRobot_PH.cpp:33 의 1500.0mV)
    // pH 4일 때 전압. 아두이노 라이브러리 기본값은 2032.44mV 다(DFRobot_PH.cpp:33, :56).
    // 2.0V 로 두면 무보정 기울기가 (2000-1500)/3 = 166.67 이라 아두이노의 177.48 보다 6.5% 가팔라서,
    // 1.000V 인 시료가 MakeCode 10.00 / 아두이노 9.82 로 갈렸다.
    let _phAcidVoltage: number = 2.03244
    let _phAlkaliVoltage: number = 0     // pH 10일 때 전압 (0 = 아직 보정하지 않음)

    // SEN0161-V2 보드가 내놓는 표준 버퍼 용액 전압 창 (DFRobot_PH.cpp:161-184).
    // 5V ADC 가 아니라 보드 출력 자체의 성질이라 3.3V 기준 측정에도 그대로 적용된다.
    const PH7_MIN_V = 1.322
    const PH7_MAX_V = 1.678
    const PH4_MIN_V = 1.854
    const PH4_MAX_V = 2.210

    //% block="pH sensor setup pin %pin"
    //% pin.defl=AnalogPin.P0
    //% group="pH" weight=155
    export function phInit(pin: AnalogPin): void {
        _phPin = pin
        _phRefVoltage = 3.3
        _phOffset = 0.0
        _phNeutralVoltage = 1.5
        _phAcidVoltage = 2.03244   // DFRobot_PH 의 pH4.0@25°C 기본값 2032.44mV
        _phAlkaliVoltage = 0   // 셋업을 다시 하면 예전 알칼리 보정점도 지운다
    }

    //% block="pH read at %temperature °C"
    //% temperature.defl=25 temperature.min=0 temperature.max=50
    //% group="pH" weight=154
    export function phRead(temperature: number): number {
        // 아날로그 값 읽기 (여러 번 읽어서 평균)
        let analogSum = 0
        for (let i = 0; i < 10; i++) {
            analogSum += pins.analogReadPin(_phPin)
            basic.pause(10)
        }
        let analogValue = analogSum / 10

        // 전압 계산
        let voltage = analogValue * _phRefVoltage / 1023

        // pH 계산 (2~3점 보정 기반)
        // DFRobot/일반 아날로그 pH 보드는 "산성일수록 전압이 높다".
        // 기존 식은 slope = (Vn - Va)/3 로 부호가 뒤집혀 있어서, 어떤 보정값을 넣어도
        // pH 4 버퍼가 항상 정확히 10 으로, pH 10 버퍼가 4 로 뒤집혀 나왔다(구조적 오류).
        let denom = (_phAcidVoltage - _phNeutralVoltage) / 3.0   // 산성 구간(pH 7~4) 기울기
        if (voltage <= _phNeutralVoltage && _phAlkaliVoltage > 0 && _phAlkaliVoltage < _phNeutralVoltage) {
            // pH 10 보정을 한 경우에만 알칼리 구간(pH 7~10)에 별도 기울기를 쓴다
            denom = (_phNeutralVoltage - _phAlkaliVoltage) / 3.0
        }
        if (denom == 0) return -1   // 보정점이 같으면 Infinity/NaN 이 되므로 오류값 반환
        let ph = 7.0 + (_phNeutralVoltage - voltage) / denom + _phOffset

        // ★ 온도 보상은 하지 않는다. 아두이노 DFRobot_PH::readPH(voltage, temperature) 는
        //   temperature 인자를 받기만 하고 식에 전혀 쓰지 않는다(DFRobot_PH.cpp:61-71).
        //   생성기도 사용자가 넣은 온도를 그 죽은 인자에 그대로 넘긴다(11_sensors_a.js:679-683).
        //   기존의 -0.003 pH/°C 평면 보정은 25°C 를 벗어날수록 아두이노판과 값이 갈렸고
        //   (50°C 에서 0.075 pH), 실제 네른스트 오차는 pH 7 에서 멀어질수록 커지는 형태라
        //   물리적으로도 맞는 모양이 아니었다. temperature 인자는 블록 규격상 그대로 둔다.

        // 범위 제한
        if (ph < 0) ph = 0
        if (ph > 14) ph = 14

        return Math.round(ph * 100) / 100
    }

    //% block="pH sensor read voltage"
    //% group="pH" weight=153
    export function phReadVoltage(): number {
        // 아날로그 값 읽기 (여러 번 읽어서 평균)
        let analogSum = 0
        for (let i = 0; i < 10; i++) {
            analogSum += pins.analogReadPin(_phPin)
            basic.pause(10)
        }
        let analogValue = analogSum / 10

        // 전압 계산
        let voltage = analogValue * _phRefVoltage / 1023
        return Math.round(voltage * 1000) / 1000
    }

    //% block="pH calibration %cmd"
    //% cmd.defl=PHCalibration.EnterCal
    //% group="pH" weight=152
    export function phCalibrate(cmd: PHCalibration): void {
        let currentVoltage = phReadVoltage()

        // ★ 아두이노 DFRobot_PH::phCalibration(case 2) 은 저장하기 전에 측정 전압이 표준 버퍼
        //   용액의 창 안에 드는지 검사하고, 벗어나면 ">>>Buffer Solution Error Try Again<<<" 만
        //   출력하고 아무것도 쓰지 않는다(DFRobot_PH.cpp:161-184).
        //   MakeCode 는 검사 없이 곧바로 덮어써서, 프로브를 공기 중에 두거나 핀이 빠진 상태로
        //   'cal mid' 를 눌러도 기준점이 쓰레기 값으로 조용히 날아갔다(이후 모든 측정이 오염).
        if (cmd == PHCalibration.CalMid) {
            // 중성 보정 (pH 7)
            if (currentVoltage <= PH7_MIN_V || currentVoltage >= PH7_MAX_V) return
            _phNeutralVoltage = currentVoltage
        } else if (cmd == PHCalibration.CalLow) {
            // 산성 보정 (pH 4)
            if (currentVoltage <= PH4_MIN_V || currentVoltage >= PH4_MAX_V) return
            _phAcidVoltage = currentVoltage
        } else if (cmd == PHCalibration.CalHigh) {
            // 알칼리 보정 (pH 10)
            // 기존에는 _phSlope 에만 저장했는데 그 변수를 phRead 가 전혀 읽지 않아
            // 3점 보정의 마지막 단계가 완전히 무의미했다. 이제 알칼리 구간 기울기에 실제로 쓰인다.
            _phAlkaliVoltage = currentVoltage
        }
        // EnterCal, ExitCal은 상태 표시용 (실제 동작 없음)
    }


    /********** 지문 센서 (AS608/R307/FPM10A) **********/

    // 지문 센서는 시리얼 통신으로 동작합니다.
    // AS608, R307, FPM10A 등 호환 센서 지원

    // Serial type

    // Fingerprint enroll step
    export enum FingerprintEnrollStep {
        //% block="get image"
        GetImage = 1,
        //% block="image to tz"
        Image2Tz = 2,
        //% block="create model"
        CreateModel = 3,
        //% block="store"
        Store = 4
    }

    // Fingerprint search mode
    export enum FingerprintSearchMode {
        //% block="fast"
        Fast = 0,
        //% block="accurate"
        Accurate = 1
    }

    // Fingerprint result type
    export enum FingerprintResult {
        //% block="finger ID"
        FingerID = 0,
        //% block="confidence"
        Confidence = 1,
        //% block="status code"
        StatusCode = 2
    }

    // Fingerprint database action
    export enum FingerprintDBAction {
        //% block="delete ID"
        Delete = 0,
        //% block="empty all"
        Empty = 1,
        //% block="count"
        Count = 2
    }

    // LED control
    export enum FingerprintLED {
        //% block="on"
        On = 1,
        //% block="off"
        Off = 0
    }

    // 지문 센서 상태 변수
    let _fpRxPin: SerialPin = SerialPin.P2
    let _fpTxPin: SerialPin = SerialPin.P8
    let _fpBaudRate: BaudRate = BaudRate.BaudRate57600
    let _fpFingerID: number = -1
    let _fpConfidence: number = 0
    let _fpStatusCode: number = 0
    let _fpInitialized: boolean = false

    // 지문 센서 패킷 상수
    const FP_HEADER = 0xEF01
    const FP_ADDRESS = 0xFFFFFFFF
    const FP_CMD_PACKET = 0x01
    const FP_DATA_PACKET = 0x02
    const FP_ACK_PACKET = 0x07
    const FP_END_PACKET = 0x08

    /**
     * 지문 센서 설정
     * @param rx RX 핀
     * @param tx TX 핀
     * @param baudRate 통신 속도
     */
    //% block="Fingerprint Sensor setup: RX $rx, TX $tx, baud $baudRate"
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P8
    //% baudRate.defl=57600
    //% group="지문센서" weight=185
    //% inlineInputMode=inline
    export function fingerprintInit(rx: SerialPin, tx: SerialPin, baudRate: number): void {
        _fpRxPin = rx
        _fpTxPin = tx

        // BaudRate 변환
        if (baudRate == 9600) _fpBaudRate = BaudRate.BaudRate9600
        else if (baudRate == 19200) _fpBaudRate = BaudRate.BaudRate19200
        else if (baudRate == 38400) _fpBaudRate = BaudRate.BaudRate38400
        else if (baudRate == 57600) _fpBaudRate = BaudRate.BaudRate57600
        else if (baudRate == 115200) _fpBaudRate = BaudRate.BaudRate115200
        else _fpBaudRate = BaudRate.BaudRate57600

        // 즉시 전환하지 않고 중재자에 등록만 한다 (여러 UART 장치 공용)
        USBSerial.uartRegister(USBSerial.UartOwner.Fingerprint, rx, tx, _fpBaudRate)
        // 응답 프레임(최대 16바이트)이 DAL 기본 20바이트 링에 꽉 차지 않도록 여유를 둔다.
        USBSerial.uartEnsureRxBuffer()
        // 아두이노 Adafruit_Fingerprint::begin() 은 첫 줄이 delay(1000) 이다
        // ("one second delay to let the sensor 'boot up'", Adafruit_Fingerprint.cpp:123-124).
        // 100ms 로는 on start 바로 뒤의 첫 명령이 부팅 중인 모듈에 들어가 간헐적으로 실패했다.
        basic.pause(1000)

        // 아두이노 생성기는 begin(baud) 직후 반드시 finger.verifyPassword() 를 보내고
        // 실패하면 프로그램을 멈춘다(11_sensors_a.js:737 등). VfyPwd(0x13) + 4바이트 비밀번호다.
        // MakeCode 는 프로그램을 멈출 수 없으니 상태 코드만 남긴다 —
        // 'Fingerprint result: status code' 로 센서 유무를 바로 확인할 수 있다.
        _fpStatusCode = fpSendCommand([0x13, 0x00, 0x00, 0x00, 0x00])
        _fpInitialized = true
    }

    /**
     * 지문 등록 과정
     * @param step 등록 단계
     * @param id 지문 ID (1~127)
     * @returns 성공 여부
     */
    //% block="Fingerprint enroll $step, ID: $id"
    //% step.defl=FingerprintEnrollStep.GetImage
    //% id.min=1 id.max=127 id.defl=1
    //% group="지문센서" weight=184
    export function fingerprintEnroll(step: FingerprintEnrollStep, id: number): boolean {
        let cmd: number[] = []

        switch (step) {
            case FingerprintEnrollStep.GetImage:
                // 이미지 가져오기 (0x01)
                cmd = [0x01]
                break
            case FingerprintEnrollStep.Image2Tz:
                // 이미지 변환 (0x02), 버퍼 1 또는 2
                cmd = [0x02, 0x01]
                break
            case FingerprintEnrollStep.CreateModel:
                // 모델 생성 (0x05)
                cmd = [0x05]
                break
            case FingerprintEnrollStep.Store:
                // 저장 (0x06), 버퍼 1, ID
                cmd = [0x06, 0x01, (id >> 8) & 0xFF, id & 0xFF]
                break
        }

        _fpStatusCode = fpSendCommand(cmd)
        return _fpStatusCode == 0x00
    }

    /**
     * 지문 인식 모드 검색
     * @param mode 검색 모드
     * @returns 성공 여부
     */
    //% block="Fingerprint search mode: $mode"
    //% mode.defl=FingerprintSearchMode.Fast
    //% group="지문센서" weight=183
    export function fingerprintSearch(mode: FingerprintSearchMode): boolean {
        // 1. 이미지 가져오기
        _fpStatusCode = fpSendCommand([0x01])
        if (_fpStatusCode != 0x00) {
            _fpFingerID = -1
            _fpConfidence = 0
            return false
        }

        // 2. 이미지 변환
        _fpStatusCode = fpSendCommand([0x02, 0x01])
        if (_fpStatusCode != 0x00) {
            _fpFingerID = -1
            _fpConfidence = 0
            return false
        }

        // 3. 검색 — mode 에 따라 AS608 의 두 명령을 나눠 쓴다
        //    Fast     : 0x1B HighSpeedSearch — 라이브러리에 등록된 지문을 빠르게 찾는다
        //    Accurate : 0x04 Search         — 전체 라이브러리를 정밀 탐색한다
        //    (이전에는 mode 를 무시하고 항상 0x04 만 보냈다)
        //    페이지 수는 아두이노 fingerFastSearch 와 같은 0x00A3(163)을 쓴다
        //    (Adafruit_Fingerprint.cpp:307-309). 기존 0x007F(127)로는 127번 이상의 ID 로
        //    등록된 지문이 저장은 되면서 검색에서는 영원히 안 잡혔다.
        let searchOp = (mode == FingerprintSearchMode.Fast) ? 0x1B : 0x04
        let searchCmd = [searchOp, 0x01, 0x00, 0x00, 0x00, 0xA3]
        let response = fpSendCommandWithResponse(searchCmd)

        if (response.length >= 4 && response[0] == 0x00) {
            _fpFingerID = (response[1] << 8) | response[2]
            _fpConfidence = (response[3] << 8) | (response.length > 4 ? response[4] : 0)
            _fpStatusCode = 0x00
            return true
        }

        _fpFingerID = -1
        _fpConfidence = 0
        _fpStatusCode = response.length > 0 ? response[0] : 0xFF
        return false
    }

    /**
     * 지문 인식 결과
     * @param resultType 결과 타입
     * @returns 결과 값
     */
    //% block="Fingerprint result: $resultType"
    //% resultType.defl=FingerprintResult.FingerID
    //% group="지문센서" weight=182
    export function fingerprintGetResult(resultType: FingerprintResult): number {
        switch (resultType) {
            case FingerprintResult.FingerID:
                return _fpFingerID
            case FingerprintResult.Confidence:
                return _fpConfidence
            case FingerprintResult.StatusCode:
                return _fpStatusCode
            default:
                return -1
        }
    }

    /**
     * 지문 데이터베이스 관리
     * @param action 동작
     * @param id ID 번호 (삭제 시 사용)
     * @returns 결과 값
     */
    //% block="Fingerprint database $action, ID: $id"
    //% action.defl=FingerprintDBAction.Delete
    //% id.min=1 id.max=127 id.defl=1
    //% group="지문센서" weight=181
    export function fingerprintDatabase(action: FingerprintDBAction, id: number): number {
        let cmd: number[] = []

        switch (action) {
            case FingerprintDBAction.Delete:
                // 삭제 (0x0C), ID, 개수(1)
                cmd = [0x0C, (id >> 8) & 0xFF, id & 0xFF, 0x00, 0x01]
                _fpStatusCode = fpSendCommand(cmd)
                return _fpStatusCode == 0x00 ? 1 : 0

            case FingerprintDBAction.Empty:
                // 전체 삭제 (0x0D)
                cmd = [0x0D]
                _fpStatusCode = fpSendCommand(cmd)
                return _fpStatusCode == 0x00 ? 1 : 0

            case FingerprintDBAction.Count:
                // 개수 확인 (0x1D)
                cmd = [0x1D]
                let response = fpSendCommandWithResponse(cmd)
                if (response.length >= 3 && response[0] == 0x00) {
                    return (response[1] << 8) | response[2]
                }
                return 0
        }
        return 0
    }

    /**
     * 지문 센서 LED 제어
     * @param state LED 상태
     */
    //% block="Fingerprint Sensor LED $state"
    //% state.defl=FingerprintLED.On
    //% group="지문센서" weight=180
    export function fingerprintLED(state: FingerprintLED): void {
        // ★ 아두이노 fingerprint_led_control 의 ON/OFF 는 finger.LEDcontrol(true/false) 이고,
        //   그것은 전용 1바이트 명령 LEDON(0x50) / LEDOFF(0x51) 을 보낸다
        //   (11_sensors_a.js:829-833, Adafruit_Fingerprint.cpp:331-337, .h:78-79).
        //   AuraLedConfig(0x35)는 BREATHING/FLASHING 항목에서만 쓴다.
        //   기존 코드는 항상 0x35 를 보내면서 제어코드 0x01(=숨쉬기) / 0x00(정의되지 않은 값),
        //   색 인덱스 0x00(정의되지 않은 색)을 실었다. 그래서 'off' 는 아무 일도 하지 않았고,
        //   아우라 링이 없는 FPM10A·구형 AS608/R305 에서는 on 마저 오류로 거부됐다.
        let cmd = [state == FingerprintLED.On ? 0x50 : 0x51]
        fpSendCommand(cmd)
    }

    // 지문 센서 명령 전송 (내부 함수)
    function fpSendCommand(cmd: number[]): number {
        let response = fpSendCommandWithResponse(cmd)
        return response.length > 0 ? response[0] : 0xFF
    }

    // 지문 센서 명령 전송 및 응답 수신 (내부 함수)
    function fpSendCommandWithResponse(cmd: number[]): number[] {
        USBSerial.uartClaim(USBSerial.UartOwner.Fingerprint)
        serial.readBuffer(0)   // 앞선 명령이 남긴 묵은 응답 버리기 (논블로킹)
        // 패킷 구성
        let packet: number[] = []

        // 헤더 (2바이트)
        packet.push((FP_HEADER >> 8) & 0xFF)
        packet.push(FP_HEADER & 0xFF)

        // 주소 (4바이트)
        packet.push((FP_ADDRESS >> 24) & 0xFF)
        packet.push((FP_ADDRESS >> 16) & 0xFF)
        packet.push((FP_ADDRESS >> 8) & 0xFF)
        packet.push(FP_ADDRESS & 0xFF)

        // 패킷 타입
        packet.push(FP_CMD_PACKET)

        // 길이 (명령 + 체크섬 2바이트)
        let length = cmd.length + 2
        packet.push((length >> 8) & 0xFF)
        packet.push(length & 0xFF)

        // 명령 데이터
        for (let b of cmd) {
            packet.push(b)
        }

        // 체크섬 계산
        let checksum = FP_CMD_PACKET + ((length >> 8) & 0xFF) + (length & 0xFF)
        for (let b of cmd) {
            checksum += b
        }
        packet.push((checksum >> 8) & 0xFF)
        packet.push(checksum & 0xFF)

        // 패킷 전송
        let buf = Buffer.fromArray(packet)
        serial.writeBuffer(buf)

        // 응답 대기
        basic.pause(200)

        // 응답 수신
        // ★ 기존 serial.readBuffer(32) 는 (1) 이 명령들 중 어느 것도 32바이트를 보내지 않고
        //   (평범한 ack 12바이트, 검색 ack 16바이트) (2) DAL 수신 링이 20바이트라
        //   32바이트가 절대 채워지지 않아 fiber 를 블로킹으로 멈추거나 짧은 버퍼를 돌려줬다.
        //   짧은 버퍼일 때는 검색 응답이 12바이트만 와서 추출 결과가 3바이트가 되고,
        //   fingerprintSearch 의 length>=4 검사를 절대 통과하지 못해 등록된 지문인데도
        //   finger ID 가 계속 -1 이었다.
        //   아두이노 getStructuredPacket 처럼 모듈이 알려 주는 길이만큼만 읽고,
        //   DEFAULTTIMEOUT(1000ms, Adafruit_Fingerprint.h:126) 이 지나면 포기한다.
        let response: number[] = []
        let rx: number[] = []
        let t0 = control.millis()

        while (control.millis() - t0 < 1000) {
            let chunk = serial.readBuffer(0)
            for (let i = 0; i < chunk.length; i++) {
                rx.push(chunk[i])
            }

            // 헤더(0xEF 0x01) 정렬 — 앞쪽의 잔여 바이트를 버린다
            let aligned = false
            while (!aligned) {
                if (rx.length > 0 && rx[0] != 0xEF) { rx.splice(0, 1) }
                else if (rx.length >= 2 && rx[1] != 0x01) { rx.splice(0, 1) }
                else { aligned = true }
            }

            if (rx.length >= 9) {
                let respLen = (rx[7] << 8) | rx[8]
                if (respLen < 3 || respLen > 64) {
                    rx.splice(0, 1)           // 길이 필드가 말이 안 됨 — 한 바이트 밀고 재동기
                } else if (rx.length >= 9 + respLen) {
                    // 데이터 추출 (상태 코드부터, 끝의 체크섬 2바이트 제외)
                    for (let i = 9; i < 9 + respLen - 2; i++) {
                        response.push(rx[i])
                    }
                    return response
                }
            }
            basic.pause(5)
        }

        return response
    }


    /********** 서미스터 온도 센서 (NTC Thermistor) **********/

    // NTC 서미스터는 온도에 따라 저항이 변하는 센서입니다.
    // Steinhart-Hart 방정식 또는 Beta 파라미터 방정식을 사용하여 온도를 계산합니다.

    // 서미스터 상태 변수
    let _thermistorPin: AnalogPin = AnalogPin.P0
    let _thermistorNominal: number = 10000      // 공칭 저항 (25°C에서의 저항값)
    let _thermistorBeta: number = 3950          // 베타 계수
    let _thermistorSeriesR: number = 10000      // 직렬 저항값

    /**
     * 서미스터 온도 센서 설정
     * @param pin 아날로그 핀
     * @param nominalR 공칭 저항 (25°C에서의 저항, 보통 10000Ω)
     * @param beta 베타 계수 (보통 3950)
     * @param seriesR 직렬 저항 (보통 10000Ω)
     */
    //% block="Thermistor sensor: pin $pin, nominal $nominalR Ω, beta $beta, series $seriesR Ω setup"
    //% pin.defl=AnalogPin.P0
    //% nominalR.defl=10000
    //% beta.defl=3950
    //% seriesR.defl=10000
    //% group="서미스터(NTC)" weight=189
    //% inlineInputMode=inline
    export function thermistorInit(pin: AnalogPin, nominalR: number, beta: number, seriesR: number): void {
        _thermistorPin = pin
        _thermistorNominal = nominalR
        _thermistorBeta = beta
        _thermistorSeriesR = seriesR
    }

    /**
     * 서미스터 온도 센서 온도 측정
     * @param unit 온도 단위
     * @returns 온도 값
     */
    //% block="Thermistor read temperature ($unit)"
    //% unit.defl=TempUnit.Celsius
    //% group="서미스터(NTC)" weight=188
    export function thermistorReadTemp(unit: TempUnit): number {
        // 아두이노 THERMISTOR::read() 는 10ms 간격으로 5회(NUMSAMPLES) 샘플링해 평균한 뒤 변환한다
        // (thermistor.cpp:42, :86-93). 25°C·10k/10k 에서 ADC 1카운트가 약 0.1°C 라
        // 단일 샘플이면 마이크로비트 ADC 잡음이 ±0.2~0.3°C 흔들림으로 그대로 보인다.
        let adcSum = 0
        for (let i = 0; i < 5; i++) {
            adcSum += pins.analogReadPin(_thermistorPin)
            basic.pause(10)
        }
        let adcValue = adcSum / 5

        // 회로: Vcc -- [서미스터(NTC)] -- [ADC] -- [직렬저항] -- GND
        //   (thermistor.cpp:31-33 이 명시하는 유일한 지원 배선이다)
        // 프로브 단선이면 ADC 가 0 으로 떨어져 분모가 0(저항 무한대), 단락이면 1023 이라
        // 저항 0 → log(0) 이 되므로 양쪽 다 오류값 -999 로 알린다.
        if (adcValue <= 0 || adcValue >= 1023) return -999

        // ADC 값으로부터 저항 계산 — 아두이노와 동일하게 R = Rs * (1023/adc - 1)
        // ★ 기존 식 Rs*adc/(1023-adc) 는 이 배선의 역수라서, Rs = R25 = 10k 인 기본 설정에서는
        //   결과가 25°C 를 중심으로 거울처럼 뒤집혔다(실제 40°C 가 약 11.4°C 로, 10°C 가 약 41°C 로
        //   나오고 온도를 올리면 숫자가 내려갔다).
        let resistance = _thermistorSeriesR * (1023 - adcValue) / adcValue

        // Steinhart-Hart Beta 파라미터 방정식
        // 1/T = 1/T0 + (1/B) * ln(R/R0)
        // T0 = 298.15K (25°C), R0 = 공칭 저항
        let steinhart = Math.log(resistance / _thermistorNominal)
        steinhart = steinhart / _thermistorBeta
        steinhart = steinhart + (1.0 / 298.15)
        let tempK = 1.0 / steinhart
        let tempC = tempK - 273.15

        if (unit == TempUnit.Fahrenheit) {
            return tempC * 9 / 5 + 32
        }
        return tempC
    }

    /**
     * 서미스터 온도 센서 원본 값 (ADC 값)
     * @returns ADC 원본 값 (0~1023)
     */
    //% block="Thermistor read raw value"
    //% group="서미스터(NTC)" weight=187
    export function thermistorReadRaw(): number {
        return pins.analogReadPin(_thermistorPin)
    }

    /**
     * 서미스터 온도 센서 저항 값
     * @returns 계산된 저항 값 (Ω)
     */
    //% block="Thermistor read resistance"
    //% group="서미스터(NTC)" weight=186
    export function thermistorReadResistance(): number {
        // 아두이노의 독립 저항 함수(11_sensors_a.js:369-378)는 일부러 단일 샘플만 쓴다 — 그대로 맞춘다.
        let adcValue = pins.analogReadPin(_thermistorPin)
        if (adcValue >= 1023) return 0        // 서미스터 단락 → 저항 0
        if (adcValue <= 0) return 999999      // 서미스터 단선 → 저항 무한대

        // R = Rs * (1023/adc - 1). 아두이노 getThermistorResistance() 와 같은 식이다.
        let resistance = _thermistorSeriesR * (1023 - adcValue) / adcValue
        return Math.round(resistance)
    }


    /********** 탁도 센서 (Turbidity Sensor) **********/

    // 탁도 센서는 물의 혼탁도를 측정합니다.
    // 단위: NTU (Nephelometric Turbidity Units)

    // 탁도 데이터 타입
    export enum TurbidityDataType {
        //% block="turbidity(NTU)"
        NTU = 0,
        //% block="voltage(V)"
        Voltage = 1
    }

    // 탁도 센서 상태 변수
    let _turbidityPin: AnalogPin = AnalogPin.P0
    let _turbidityRefVoltage: number = 3.3
    // 맑은 물일 때 전압 (보정용). 0 = 아직 보정 안 함.
    // 예전 기본값 2.5V 는 근거 없는 추측값이라, 보정을 건너뛰면 2.5V 이상 구간이
    // 전부 0 NTU 로 뭉개져 눈에 보이게 탁한 물도 0 으로 나왔다.
    // 'Turbidity sensor calibrate (clear water)' 를 먼저 실행해야 값이 나온다.
    let _turbidityClearVoltage: number = 0

    //% block="Turbidity sensor setup: analog pin %pin"
    //% pin.defl=AnalogPin.P0
    //% group="탁도(Turbidity)" weight=145
    export function turbidityInit(pin: AnalogPin): void {
        _turbidityPin = pin
        _turbidityRefVoltage = 3.3
        _turbidityClearVoltage = 0   // 셋업 시 보정값 초기화 (보정 전에는 NTU 를 내지 않는다)
    }

    //% block="Turbidity sensor calibrate (clear water)"
    //% group="탁도(Turbidity)" weight=144
    export function turbidityCalibrate(): void {
        // 맑은 물에서 전압 측정하여 보정값 저장.
        // 아두이노 turbidity_calibrate 는 20ms 간격으로 50회 평균한다(11_sensors_a.js:877-881).
        // 이 값이 이후 모든 NTU 계산의 기준점이라, 10회로는 기준점 자체가 흔들렸다.
        let analogSum = 0
        for (let i = 0; i < 50; i++) {
            analogSum += pins.analogReadPin(_turbidityPin)
            basic.pause(20)
        }
        let analogValue = analogSum / 50
        _turbidityClearVoltage = analogValue * _turbidityRefVoltage / 1023
    }

    // 아두이노 getTurbidityMedian(11_sensors_a.js:849-869)과 같은 절사평균:
    // 정렬한 뒤 최소·최대 1개씩을 버리고 나머지를 평균한다.
    // 탁도 센서는 IR LED 를 펄스 구동해서 단발 스파이크가 잦은데, 단순 산술평균은 그 스파이크가
    // 그대로 결과를 흔든다. (아두이노는 30샘플 링버퍼, 여기서는 파이버 구조상 인라인 10샘플)
    function turbidityTrimmedMean(samples: number[]): number {
        let n = samples.length
        if (n < 3) return 0
        // 삽입 정렬 (n = 10 수준이라 충분)
        for (let i = 1; i < n; i++) {
            let key = samples[i]
            let j = i - 1
            while (j >= 0 && samples[j] > key) {
                samples[j + 1] = samples[j]
                j--
            }
            samples[j + 1] = key
        }
        let sum = 0
        for (let i = 1; i < n - 1; i++) {
            sum += samples[i]
        }
        return sum / (n - 2)
    }


    //% block="Turbidity sensor read: %dtype"
    //% dtype.defl=TurbidityDataType.NTU
    //% group="탁도(Turbidity)" weight=142
    export function turbidityRead(dtype: TurbidityDataType): number {
        // 아날로그 값 읽기 (여러 번 읽어서 절사평균 — turbidityTrimmedMean 주석 참조)
        let samples: number[] = []
        for (let i = 0; i < 10; i++) {
            samples.push(pins.analogReadPin(_turbidityPin))
            basic.pause(10)
        }
        let analogValue = turbidityTrimmedMean(samples)

        // 전압 계산
        let voltage = analogValue * _turbidityRefVoltage / 1023

        if (dtype == TurbidityDataType.Voltage) {
            return Math.round(voltage * 1000) / 1000
        }

        // NTU 계산 — 전압이 낮을수록 탁도가 높다.
        // ※ 아두이노판 getTurbidityNTU 의 절대 곡선(800 - 1900*(V-2.5), 맑은 물 4.15V)은
        //   5V 전압 영역에 묶여 있어 3.3V 기준 마이크로비트 ADC 로는 그대로 옮길 수 없다.
        //   그래서 여기서는 보정한 맑은 물 전압에 대한 상대 램프를 쓴다.
        //   (예전 주석에 적혀 있던 'NTU = -1120.4*V^2 + 5742.3*V - 4353.8' 은 이 코드에도,
        //    아두이노 쪽에도 존재하지 않는 식이라 지웠다.)
        let ntu: number

        // 보정 전에는 기준 전압이 없어 상대값조차 계산할 수 없다 (0 으로 나눔 방지).
        // 데드밴드(0.5V)보다 기준 전압이 낮으면 애초에 의미 있는 측정이 아니다.
        if (_turbidityClearVoltage <= 0.5) return 0

        // 아두이노의 0.5V 데드밴드(11_sensors_a.js:917): 맑은 물 기준에서 0.5V 넘게 떨어지기
        // 전까지는 0 NTU 다. 기준점 근처의 ADC 잡음이 수십 NTU 로 보이는 것을 막는 장치다.
        // ★ 아두이노 곡선은 데드밴드 경계에서 이미 음수라 클램프되어 값이 연속이다.
        //   그래서 여기서도 램프의 시작점을 '기준전압 - 0.5V' 로 옮겨 연속으로 만든다.
        //   예전 코드는 0.5V 미만을 통째로 3000 으로 치환해서 그 경계에서 값이 뚝 튀었다
        //   (기준 2.0V 면 0.5V 에서 2250 → 3000).
        let deficit = _turbidityClearVoltage - voltage
        if (deficit <= 0.5) {
            ntu = 0
        } else {
            ntu = (deficit - 0.5) / (_turbidityClearVoltage - 0.5) * 3000
        }

        if (ntu < 0) ntu = 0
        if (ntu > 3000) ntu = 3000

        return Math.round(ntu)
    }


    /********** 자외선(UV) 센서 **********/

    // 자외선 센서는 UV 지수를 측정합니다.
    // ML8511, GUVA-S12SD 등 아날로그 UV 센서 지원

    // UV 데이터 타입
    export enum UVDataType {
        //% block="UV index"
        UVIndex = 0,
        //% block="voltage(mV)"
        Voltage = 1,
        //% block="intensity(mW/cm²)"
        Intensity = 2
    }

    // UV 보정 타입
    export enum UVCalibration {
        //% block="indoor (zero adjust)"
        Indoor = 0,
        //% block="outdoor (sunlight)"
        Outdoor = 1
    }

    // UV 센서 상태 변수
    let _uvPin: AnalogPin = AnalogPin.P0
    let _uvRefVoltage: number = 3300  // mV
    let _uvOffsetVoltage: number = 990  // 실내 기준 전압 (mV)
    // 1 단위(mW/cm² ≒ UV 지수 1)당 전압(mV).
    // 아두이노판과 같은 기준: (2800 - 990) / 15 = 120.667 mV
    let _uvSpanMvPerUnit: number = 120.667

    //% block="UV sensor setup: analog pin %pin"
    //% pin.defl=AnalogPin.P0
    //% group="UV Sensor" weight=135
    export function uvInit(pin: AnalogPin): void {
        _uvPin = pin
        _uvRefVoltage = 3300
        _uvOffsetVoltage = 990
        // 셋업을 다시 하면 감도 보정도 기본값으로 되돌린다.
        // ★ 선언부의 초기값과 반드시 같은 수여야 한다 — 예전에는 여기만 120 이라
        //   'UV sensor setup' 을 한 번 부르는 것만으로 감도가 0.55% 달라졌고,
        //   uvRead 주석이 말하는 (2800-990)/15 = 120.667 기준과도 어긋났다.
        _uvSpanMvPerUnit = 120.667
    }

    // ★ 기본값을 990 에서 0 으로 바꿨다. 아두이노 uv_sensor_calibrate 의 INDOOR/OUTDOOR 는
    //   '항상 측정' 하는 항목이고, 숫자를 직접 넣는 것은 별도의 CUSTOM 항목이다
    //   (11_sensors_a.js:955-980). MakeCode 는 드롭다운 항목을 늘릴 수 없어 두 경우를 한 인자로
    //   합쳐 뒀는데, 기본값이 990 이라 팔레트에서 그냥 끌어다 놓으면 uvInit 이 이미 넣어 둔
    //   990 을 다시 990 으로 대입할 뿐 아무 측정도 하지 않는 무동작 블록이었다.
    //   0 = 자동 측정(아두이노 INDOOR/OUTDOOR), 0 보다 큰 값 = 그 값을 그대로 사용(CUSTOM).
    //% block="UV sensor calibrate %calType, ref voltage: %voltage mV"
    //% calType.defl=UVCalibration.Indoor
    //% voltage.defl=0 voltage.min=0 voltage.max=3300
    //% group="UV Sensor" weight=134
    //% inlineInputMode=inline
    export function uvCalibrate(calType: UVCalibration, voltage: number): void {
        if (calType == UVCalibration.Indoor) {
            // 실내에서 현재 전압을 영점으로 설정
            if (voltage > 0) {
                _uvOffsetVoltage = voltage
            } else {
                // 자동 측정
                let analogSum = 0
                for (let i = 0; i < 10; i++) {
                    analogSum += pins.analogReadPin(_uvPin)
                    basic.pause(10)
                }
                _uvOffsetVoltage = (analogSum / 10) * _uvRefVoltage / 1023
            }
        } else {
            // 실외(햇빛) 보정 — 예전에는 이 분기 자체가 없어서 드롭다운의 절반이 무동작이었다.
            // 햇빛에서 측정한 전압을 전체 스케일(15 mW/cm²)로 보고 감도(span)를 잡는다.
            let v = voltage
            if (v <= 0) {
                // 자동 측정
                let analogSum = 0
                for (let i = 0; i < 10; i++) {
                    analogSum += pins.analogReadPin(_uvPin)
                    basic.pause(10)
                }
                v = (analogSum / 10) * _uvRefVoltage / 1023
            }
            // 영점보다 높을 때만 반영 (0 이나 음수 감도가 되는 것을 막는다)
            if (v > _uvOffsetVoltage) {
                _uvSpanMvPerUnit = (v - _uvOffsetVoltage) / 15
            }
        }
    }

    //% block="UV sensor read: %dtype"
    //% dtype.defl=UVDataType.UVIndex
    //% group="UV Sensor" weight=133
    export function uvRead(dtype: UVDataType): number {
        // 아날로그 값 읽기 (여러 번 읽어서 평균)
        let analogSum = 0
        for (let i = 0; i < 10; i++) {
            analogSum += pins.analogReadPin(_uvPin)
            basic.pause(10)
        }
        let analogValue = analogSum / 10

        // 전압 계산 (mV)
        let voltage = analogValue * _uvRefVoltage / 1023

        if (dtype == UVDataType.Voltage) {
            return Math.round(voltage)
        }

        // UV 강도 계산 (mW/cm²)
        // ML8511 기준: 출력 전압 1V = 0 mW/cm², 2.8V = 15 mW/cm² (기본 120mV per mW/cm²)
        // 실외 보정을 하면 _uvSpanMvPerUnit 이 그 감도로 대체된다.
        let intensity = (voltage - _uvOffsetVoltage) / _uvSpanMvPerUnit
        if (intensity < 0) intensity = 0

        if (dtype == UVDataType.Intensity) {
            return Math.round(intensity * 100) / 100
        }

        // UV 지수 계산 (0~15)
        // 예전 식은 intensity/0.25 (4배 증폭) 후 15 로 잘라서, 강도 3.75 이상이면
        // 즉 모든 실외 측정값이 항상 15 로 붙박이가 됐다.
        // ★ 아두이노판 getUVIndex 와 같은 스케일을 쓴다: 990mV~2800mV 를 0~15 로 선형 대응.
        //   여기서 intensity 는 (voltage-990)/120.667 이라 그 값 자체가 곧 UV 지수다.
        //   (11 로 다시 줄이면 아두이노판보다 26% 낮게 나온다 — 상한도 15 이지 11 이 아니다)
        // 주의: ML8511 은 280~390nm 광대역 포토다이오드라 정식 UV Index 계측기가 아니다(교육용 근사값).
        let uvIndex = intensity
        if (uvIndex < 0) uvIndex = 0
        if (uvIndex > 15) uvIndex = 15

        return Math.round(uvIndex * 10) / 10
    }


    /********** LM35 센서 **********/

    //% block="LM35 read temperature pin %pin unit %unit"
    //% group="온도(LM35)" weight=125
    export function lm35Read(pin: AnalogPin, unit: TempUnit): number {
        // 0.48828125 = (5000mV / 1024) / 10mV 로 아두이노(5V 기준) 상수였다.
        // micro:bit ADC 는 3.3V 기준 0~1023 이라 모든 값이 1.515배 높게 나왔다.
        // LM35 는 10mV/°C 이고 0~100°C 에서 0~1V 라 분압기 없이 바로 연결한다.
        // 다만 LM35 자체는 4V 이상 전원이 필요하므로 5V 헤더에 물려야 한다.
        // (ADC 기준 전압이 USB/전지에 따라 흔들리므로 절대 정확도는 수 % 오차)
        let tempC = pins.analogReadPin(pin) * 3300 / 1023 / 10
        if (unit == TempUnit.Fahrenheit) {
            return tempC * 9 / 5 + 32
        }
        return tempC
    }


    /********** GP2Y0A21YK 적외선 거리 센서 **********/

    //% block="GP2Y0A21YK read distance pin %pin unit %unit"
    //% group="미세먼지(GP2Y0A21YK)" weight=120
    export function gp2y0a21ykRead(pin: AnalogPin, unit: DistanceUnit): number {
        // 예전 식 12343.85/(v-0.42) 은 5V/10bit 용 상수 12343.85 를 지수 -1.15 의 멱함수가 아니라
        // 단순 역수에 쓴 것이라 거리가 1.7~3배 크게 나왔고, 센서 전원이 없으면 v=0 → -29390cm 가 나왔다.
        let v = pins.analogReadPin(pin)
        if (v < 30) return -1   // 무신호/측정 범위 밖

        let volts = v * 3.3 / 1023
        let cm = Math.round(27.86 * Math.pow(volts, -1.15))

        // 이 센서는 약 7cm 아래에서 응답이 접히므로(같은 전압이 두 거리를 뜻함)
        // 규격 측정 범위인 10~80cm 로 제한한다.
        if (cm < 10) cm = 10
        if (cm > 80) cm = 80

        if (unit == DistanceUnit.Inch) {
            return Math.floor(cm / 2.54)
        }
        return cm
    }


    /********** US-100 초음파 센서 **********/

    // US-100 핀 저장 변수
    let _us100Trig: DigitalPin = DigitalPin.P1
    let _us100Echo: DigitalPin = DigitalPin.P2

    //% block="US-100 set trigger pin %trig echo pin %echo"
    //% trig.defl=DigitalPin.P1 echo.defl=DigitalPin.P2
    //% group="초음파(US-100)" weight=115
    export function us100SetPins(trig: DigitalPin, echo: DigitalPin): void {
        _us100Trig = trig
        _us100Echo = echo
    }

    //% block="US-100 distance measure unit %unit"
    //% group="초음파(US-100)" weight=114
    export function us100Read(unit: DistanceUnit): number {
        pins.digitalWritePin(_us100Trig, 0)
        control.waitMicros(2)
        pins.digitalWritePin(_us100Trig, 1)
        control.waitMicros(10)
        pins.digitalWritePin(_us100Trig, 0)
        let d = pins.pulseIn(_us100Echo, PulseValue.High, 30000)
        // HC-SR04 와 같은 이유로 58.31 (= 2 / 0.0343) 을 쓰고 절삭하지 않는다.
        let cm = d / 58.31

        if (unit == DistanceUnit.Inch) {
            return Math.round(cm / 2.54 * 100) / 100
        }
        return Math.round(cm * 100) / 100
    }


    /********** TEMT6000 조도 센서 **********/



    /********** 고온센서 (a-001 모듈 + a-002 프로브) **********/
    /*
     * 모듈은 3핀 GVS 아날로그 출력(실물 상면에 IC 표기 없음, 프로브는 3선식).
     * 소자·온보드 회로·공급레일(5V / 3V3)에 따라 ADC→온도 전달함수가 전부 달라지므로
     * 변환식을 임의로 고정하지 않는다. 대신 **2점 실측 보정**으로 계수를 채운다.
     *   → 소자를 몰라도 정확하고, 마빗실드에서 5V 헤더에 물리든 3V3 에 물리든 그대로 흡수된다.
     *   → 개체차(모듈·프로브 편차)도 같이 보정된다.
     *
     * 사용 순서
     *   ① 상온(예: 25℃)에서  고온센서 보정점 1 기록
     *   ② 끓는 물(100℃) 등 다른 온도에서  고온센서 보정점 2 기록
     *   ③ 이후 "고온센서 온도 읽기" 사용
     * 보정 전에 읽으면 0 을 반환하고 hiTempCalibrated() 가 false 를 준다(가짜 값 금지).
     *
     * NTC 프로브인 것이 확인되면 HiTempMode.NTC 로 바꾸고 hiTempSetNTC() 로 파라미터를 준다.
     * PT100 계열은 모듈의 증폭률을 모르면 계산이 불가능하므로 2점 보정을 쓸 것.
     */

    export enum HiTempMode {
        //% block="2-point calibration"
        TwoPoint = 0,
        //% block="NTC thermistor (Beta)"
        NTC = 1
    }

    let _hiTempPin: AnalogPin = AnalogPin.P0
    let _hiTempMode: HiTempMode = HiTempMode.TwoPoint
    let _hiTempA1 = -1, _hiTempT1 = 0        // 보정점 1 (ADC, ℃)
    let _hiTempA2 = -1, _hiTempT2 = 0        // 보정점 2
    let _hiTempNominal = 10000               // NTC 25℃ 공칭저항 Ω
    let _hiTempBeta = 3950                   // NTC 베타계수
    let _hiTempSeriesR = 10000               // 직렬저항 Ω

    //% block="High temp sensor: pin %pin mode %mode setup"
    //% pin.defl=AnalogPin.P0
    //% group="고온센서(High Temp)" weight=199
    //% inlineInputMode=inline
    export function hiTempInit(pin: AnalogPin, mode: HiTempMode): void {
        _hiTempPin = pin
        _hiTempMode = mode
    }

    //% block="High temp calibrate point %point at %refTemp °C (measure now)"
    //% point.min=1 point.max=2 point.defl=1
    //% refTemp.defl=25
    //% group="고온센서(High Temp)" weight=198
    //% inlineInputMode=inline
    export function hiTempCalibrate(point: number, refTemp: number): number {
        // 노이즈 억제를 위해 여러 번 평균
        let sum = 0
        for (let i = 0; i < 16; i++) {
            sum += pins.analogReadPin(_hiTempPin)
            basic.pause(20)
        }
        let adc = Math.round(sum / 16)
        if (point <= 1) { _hiTempA1 = adc; _hiTempT1 = refTemp }
        else { _hiTempA2 = adc; _hiTempT2 = refTemp }
        return adc
    }

    //% block="High temp set calibration: ADC %adc1 = %t1 °C, ADC %adc2 = %t2 °C"
    //% group="고온센서(High Temp)" weight=197
    //% inlineInputMode=inline
    export function hiTempSetCalibration(adc1: number, t1: number, adc2: number, t2: number): void {
        _hiTempA1 = adc1; _hiTempT1 = t1
        _hiTempA2 = adc2; _hiTempT2 = t2
    }

    //% block="High temp calibrated?"
    //% group="고온센서(High Temp)" weight=196
    export function hiTempCalibrated(): boolean {
        if (_hiTempMode == HiTempMode.NTC) return true
        return _hiTempA1 >= 0 && _hiTempA2 >= 0 && _hiTempA1 != _hiTempA2
    }

    //% block="High temp NTC params: nominal %nominalR Ω, beta %beta, series %seriesR Ω"
    //% nominalR.defl=10000 beta.defl=3950 seriesR.defl=10000
    //% group="고온센서(High Temp)" weight=195
    //% inlineInputMode=inline
    export function hiTempSetNTC(nominalR: number, beta: number, seriesR: number): void {
        _hiTempNominal = nominalR
        _hiTempBeta = beta
        _hiTempSeriesR = seriesR
    }

    //% block="High temp read temperature (%unit)"
    //% unit.defl=TempUnit.Celsius
    //% group="고온센서(High Temp)" weight=194
    export function hiTempRead(unit: TempUnit): number {
        let adc = pins.analogReadPin(_hiTempPin)
        let c = 0

        if (_hiTempMode == HiTempMode.NTC) {
            // 회로: Vcc -- [직렬저항] -- [ADC] -- [서미스터] -- GND
            if (adc >= 1023) adc = 1022
            if (adc < 1) adc = 1
            let r = _hiTempSeriesR * adc / (1023 - adc)
            // 1/T = 1/T0 + (1/B)·ln(R/R0),  T0 = 298.15K
            let inv = 1 / 298.15 + (1 / _hiTempBeta) * Math.log(r / _hiTempNominal)
            c = 1 / inv - 273.15
        } else {
            if (!hiTempCalibrated()) return 0      // 보정 전에는 가짜 값을 내지 않는다
            c = _hiTempT1 + (adc - _hiTempA1) * (_hiTempT2 - _hiTempT1) / (_hiTempA2 - _hiTempA1)
        }

        if (unit == TempUnit.Fahrenheit) return c * 9 / 5 + 32
        return c
    }

    //% block="High temp read raw ADC"
    //% group="고온센서(High Temp)" weight=193
    export function hiTempReadRaw(): number {
        return pins.analogReadPin(_hiTempPin)
    }
}
