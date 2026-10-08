// Continuation of 04_adv_sensors.ts. See SOURCES.md for packaging details.
namespace AdvSensors {

    //% block="Color sensor(TCS34725) setup"
    //% group="색상감지(TCS34725)" weight=135
    export function tcs34725Setup(): void {
        _tcs34725Addr = 0x29
        // ★ COMMAND 바이트(bit7=1)와 데이터는 한 트랜잭션으로 보내야 한다.
        //   나눠 보내면 데이터 바이트가 bit7=0 이라 유효한 COMMAND 가 아니어서 버려지고
        //   ENABLE/ATIME/CONTROL 이 하나도 기록되지 않는다(센서가 슬립에서 못 깨어남).
        // ★ 예전에는 PON 과 AEN 을 한 바이트(0x03)로 같이 켜고 나서 3ms 를 쉬었다.
        //   데이터시트는 PON 후 최소 2.4ms 가 지나야 RGBC 적분을 시작할 수 있다고 규정한다
        //   (첫 측정이 발진기가 안정되기 전 값이라 흰색 기준 보정이 엉뚱하게 잡혔다).
        // ★ 적분시간과 게인은 아두이노 Color_sensor::init() 의 값으로 맞춘다.
        //   ATIME = 0xC0 (64 사이클, 153.6ms, 풀스케일 65535)
        //   CONTROL = 0x02 (AGAIN 16x)  — 소스에서 1x 줄은 주석 처리되어 있다.
        //   예전 값(ATIME 0xD5 / CONTROL 0x01 = 4x)이면 같은 대상에서 카운트가
        //   대략 1/6 로 떨어져 어두운 색 구분이 나빠지고, 아래 검정 임계값도 어긋난다.
        pins.i2cWriteNumber(_tcs34725Addr, 0x8001, NumberFormat.UInt16BE)   // ENABLE = PON
        basic.pause(3)                                                      // 발진기 안정화 ≥ 2.4ms
        pins.i2cWriteNumber(_tcs34725Addr, 0x81C0, NumberFormat.UInt16BE)   // ATIME = 0xC0 (153.6ms)
        pins.i2cWriteNumber(_tcs34725Addr, 0x8D00, NumberFormat.UInt16BE)   // CONFIG = 0 (WLONG 12x 미사용)
        pins.i2cWriteNumber(_tcs34725Addr, 0x8F02, NumberFormat.UInt16BE)   // CONTROL = 게인 16x
        pins.i2cWriteNumber(_tcs34725Addr, 0x8003, NumberFormat.UInt16BE)   // ENABLE = PON|AEN
        basic.pause(160)                                                    // 첫 적분(약 153.6ms) 완료 대기
    }

    //% block="Color sensor reset"
    //% group="색상감지(TCS34725)" weight=134
    export function tcs34725Reset(): void {
        _tcs34725R = 0
        _tcs34725G = 0
        _tcs34725B = 0
        _tcs34725C = 0
        _tcs34725R8 = 0
        _tcs34725G8 = 0
        _tcs34725B8 = 0
        _tcs34725DetectedColor = TCS34725Color.Black
    }

    //% block="Color sensor detect %dtype"
    //% dtype.defl=AdvSensors.TCS34725DetectType.Color
    //% group="색상감지(TCS34725)" weight=133
    export function tcs34725Detect(dtype: TCS34725DetectType): number {
        // ★ 아두이노 Color_sensor 에는 읽기 경로가 triggerColorSensor() 하나뿐이라
        //   RGB 와 판정이 언제나 같은 프레임에서 나온다. 예전 micro:bit 코드는
        //   여기서만 STOP 방식으로 따로 읽고 정규화도 따로 해서, 같은 샘플에 대해
        //   tcs34725Read 와 서로 다른 결과를 낼 수 있었다.
        //   이제 두 블록 모두 tcs34725ReadRaw()/tcs34725Normalize() 를 공유한다.
        tcs34725ReadRaw()
        tcs34725Normalize()

        if (dtype == TCS34725DetectType.Raw) {
            return _tcs34725C
        }
        return _tcs34725DetectedColor
    }

    //% block="Color sensor %channel (0~255)"
    //% channel.defl=AdvSensors.TCS34725Channel.Red
    //% group="색상감지(TCS34725)" weight=132
    export function tcs34725GetChannel(channel: TCS34725Channel): number {
        if (channel == TCS34725Channel.Red) return _tcs34725R8
        if (channel == TCS34725Channel.Green) return _tcs34725G8
        if (channel == TCS34725Channel.Blue) return _tcs34725B8
        // ★ 클리어 채널의 풀스케일은 (256 − ATIME) × 1024 이고 16비트 상한 65535 로 잘린다.
        //   아두이노와 같은 ATIME=0xC0 이면 (256−0xC0)×1024 = 65536 → 65535.
        //   예전에는 256 으로 나눠 항상 실제보다 어둡게 나왔다.
        let full = Math.min(65535, (256 - 0xC0) * 1024)
        return Math.min(255, Math.round(_tcs34725C * 255 / full))
    }

    //% block="Color sensor is %color ?"
    //% color.defl=AdvSensors.TCS34725Color.Red
    //% group="색상감지(TCS34725)" weight=131
    export function tcs34725IsColor(color: TCS34725Color): boolean {
        return _tcs34725DetectedColor == color
    }

    // 색상 판별 내부 함수
    function tcs34725DetectColor(): TCS34725Color {
        let r = _tcs34725R8
        let g = _tcs34725G8
        let b = _tcs34725B8

        // ★ r/g/b 는 Clear 로 나눠 정규화한 값(0~255)이라 '밝기' 정보가 이미 제거돼 있다.
        //   예전에는 이 정규화 값의 평균에 절대 광량 임계값(30/200)을 걸어
        //   흑·백 분기가 사실상 죽은 코드였다.
        //   밝기 판정은 정규화 전의 Clear 원시 카운트로 해야 한다.
        //   ★ 이 문턱은 카운트 스케일에 매여 있다. 게인 4x→16x, ATIME 0xD5→0xC0 로
        //     같은 조명에서 카운트가 약 6배(4 × 64/43 ≈ 5.95) 커졌으므로 문턱도 함께 올린다.
        //     안 올리면 '거의 어두움' 판정이 6배 어두운 조건에서만 걸린다.
        if (_tcs34725C < 600) {
            return TCS34725Color.Black          // 광량 자체가 거의 없음
        }

        // 흰색 = 세 채널이 고르게 분포(정규화 값이 서로 비슷함)
        let mx = Math.max(r, Math.max(g, b))
        let mn = Math.min(r, Math.min(g, b))
        if (mx - mn < 30) {
            return TCS34725Color.White
        }

        // 색상 판별 (가장 높은 채널 기준)
        // ★ 예전에는 초록 성분이 더 많이 남은 쪽(g > b + 50)을 주황으로, 적게 남은 쪽을
        //   노랑으로 판정해 두 분기가 뒤집혀 있었다. 노랑은 R≈G≫B, 주황은 R>G>B 다.
        //   또 r == g 인 완전한 노랑이 어느 분기에도 걸리지 않아 흰색으로 떨어졌다(r >= g 로 보완).
        if (r >= g && r > b) {
            if (g > b + 60) {
                return TCS34725Color.Yellow  // R ≈ G ≫ B = 노랑
            }
            if (g > b + 25) {
                return TCS34725Color.Orange  // R > G > B = 주황
            }
            return TCS34725Color.Red
        }

        if (g > r && g > b) {
            return TCS34725Color.Green
        }

        if (b > r && b > g) {
            if (r > g + 30) {
                return TCS34725Color.Purple  // 파랑 + 빨강 = 보라
            }
            return TCS34725Color.Blue
        }

        return TCS34725Color.White  // 기본값
    }

    //% block="TCS34725 init address %addr"
    //% addr.defl=0x29
    //% group="색상감지(TCS34725)" weight=130
    export function tcs34725Init(addr: number): void {
        _tcs34725Addr = addr
        // ★ tcs34725Setup 과 동일 — COMMAND+데이터를 한 트랜잭션으로
        //   PON → 2.4ms 이상 대기 → AEN 순서를 지킨다.
        //   또한 예전에는 CONTROL(게인)을 쓰지 않아 이 블록으로 초기화하면 1x,
        //   setup 으로 초기화하면 4x 라 같은 물체가 4배 다르게 읽혔다.
        //   ★ 값은 tcs34725Setup 과 반드시 동일해야 하고, 둘 다 아두이노
        //     Color_sensor::init() 의 ATIME 0xC0 / CONTROL 0x02(16x) 를 쓴다.
        pins.i2cWriteNumber(_tcs34725Addr, 0x8001, NumberFormat.UInt16BE)   // ENABLE = PON
        basic.pause(3)                                                      // 발진기 안정화 ≥ 2.4ms
        pins.i2cWriteNumber(_tcs34725Addr, 0x81C0, NumberFormat.UInt16BE)   // ATIME = 0xC0 (153.6ms)
        pins.i2cWriteNumber(_tcs34725Addr, 0x8D00, NumberFormat.UInt16BE)   // CONFIG = 0 (WLONG 미사용)
        pins.i2cWriteNumber(_tcs34725Addr, 0x8F02, NumberFormat.UInt16BE)   // CONTROL = 게인 16x
        pins.i2cWriteNumber(_tcs34725Addr, 0x8003, NumberFormat.UInt16BE)   // ENABLE = PON|AEN
        basic.pause(160)                                                    // 첫 적분 완료 대기
    }

    //% block="TCS34725 color read %color"
    //% group="색상감지(TCS34725)" weight=129
    export function tcs34725Read(color: RGBColor): number {
        tcs34725ReadRaw()

        // ★ 예전에는 원시 R/G/B/C 만 갱신하고 8비트 정규화 값과 판정 색상은 그대로 둬서,
        //   같은 그룹의 다른 블록(GetChannel·DetectedColor)이 낡은 값을 반환했다.
        tcs34725Normalize()

        if (color == RGBColor.Red) return _tcs34725R
        if (color == RGBColor.Green) return _tcs34725G
        if (color == RGBColor.Blue) return _tcs34725B
        return _tcs34725C
    }

    // 원시 C/R/G/B 4채널 읽기 (읽기 경로 공통)
    // ★ STATUS(0x93) 의 AVALID(bit0) 로 적분 완료를 확인한 뒤 반복시작으로 읽는다.
    //   최대 약 300ms(ATIME=0xC0 의 적분 153.6ms 의 2배 남짓)까지만 기다린다.
    function tcs34725ReadRaw(): void {
        let wait = 30
        while (wait > 0) {
            pins.i2cWriteNumber(_tcs34725Addr, 0x80 | 0x13, NumberFormat.UInt8BE, true)
            let st = pins.i2cReadNumber(_tcs34725Addr, NumberFormat.UInt8BE)
            if ((st & 0x01) != 0) break
            basic.pause(10)
            wait--
        }

        // Clear 데이터 읽기 (레지스터 지정 후 반복시작 필요)
        pins.i2cWriteNumber(_tcs34725Addr, 0x80 | 0x14, NumberFormat.UInt8BE, true)
        _tcs34725C = pins.i2cReadNumber(_tcs34725Addr, NumberFormat.UInt16LE)

        // Red 데이터 읽기
        pins.i2cWriteNumber(_tcs34725Addr, 0x80 | 0x16, NumberFormat.UInt8BE, true)
        _tcs34725R = pins.i2cReadNumber(_tcs34725Addr, NumberFormat.UInt16LE)

        // Green 데이터 읽기
        pins.i2cWriteNumber(_tcs34725Addr, 0x80 | 0x18, NumberFormat.UInt8BE, true)
        _tcs34725G = pins.i2cReadNumber(_tcs34725Addr, NumberFormat.UInt16LE)

        // Blue 데이터 읽기
        pins.i2cWriteNumber(_tcs34725Addr, 0x80 | 0x1A, NumberFormat.UInt8BE, true)
        _tcs34725B = pins.i2cReadNumber(_tcs34725Addr, NumberFormat.UInt16LE)
    }

    // 원시값 → 8비트 정규화 + 색상 판정 갱신 (읽기 경로 공통)
    function tcs34725Normalize(): void {
        let c = _tcs34725C > 0 ? _tcs34725C : 1
        _tcs34725R8 = Math.min(255, Math.round(_tcs34725R * 255 / c))
        _tcs34725G8 = Math.min(255, Math.round(_tcs34725G * 255 / c))
        _tcs34725B8 = Math.min(255, Math.round(_tcs34725B * 255 / c))
        _tcs34725DetectedColor = tcs34725DetectColor()
    }


    /********** MLX90614 Infrared Temperature Sensor **********/

    // MLX90614 Temperature Source
    export enum MLX90614Source {
        //% block="Object"
        Object = 0,
        //% block="Ambient"
        Ambient = 1
    }

    // MLX90614 Temperature Unit
    export enum MLX90614TempUnit {
        //% block="Celsius (°C)"
        Celsius = 0,
        //% block="Fahrenheit (°F)"
        Fahrenheit = 1,
        //% block="Kelvin (K)"
        Kelvin = 2
    }

    // MLX90614 Data Variables
    let _mlx90614Addr: number = 0x5A
    let _mlx90614ObjTemp: number = 0
    let _mlx90614AmbTemp: number = 0

    /**
     * MLX90614 Temperature Sensor I2C Address Setup
     * @param addr I2C address (default: 90 = 0x5A)
     */
    //% block="MLX90614 Sensor Setup I2C Address $addr"
    //% addr.defl=90
    //% group="비접촉온도(MLX90614)" weight=140
    export function mlx90614Init(addr: number): void {
        _mlx90614Addr = addr
    }

    /**
     * MLX90614 Read Temperature
     * @param source Temperature source (Object/Ambient)
     * @param unit Temperature unit
     */
    //% block="$source Temperature Read as $unit"
    //% source.defl=AdvSensors.MLX90614Source.Object
    //% unit.defl=AdvSensors.MLX90614TempUnit.Celsius
    //% group="비접촉온도(MLX90614)" weight=139
    //% inlineInputMode=inline
    export function mlx90614ReadTemp(source: MLX90614Source, unit: MLX90614TempUnit): number {
        let cmd = source == MLX90614Source.Object ? 0x07 : 0x06

        // SMBus read: send register address
        // ★ repeat=true 필수. STOP 이 끼면 MLX90614 가 SMBus read 로 인식하지 않아
        //   포인터가 초기화되고 엉뚱한 바이트를 읽는다.
        pins.i2cWriteNumber(_mlx90614Addr, cmd, NumberFormat.UInt8BE, true)

        // Read 3 bytes (2 bytes data + 1 byte PEC)
        let buf = pins.i2cReadBuffer(_mlx90614Addr, 3)

        // Temperature calculation (raw value is in 0.02K units)
        let raw = (buf[1] << 8) | buf[0]
        // ★ RAM 워드의 bit15 는 에러 플래그이고, 유효 코드 범위는 0x27AD~0x7FFF 다.
        //   예전에는 검사가 없어 에러 프레임이 382°C 로, 센서 미연결(버퍼 0)이 -273.15°C 로
        //   그대로 나왔다. 범위를 벗어나면 직전 값을 요청한 단위로 돌려준다.
        if (raw < 0x27AD || raw > 0x7FFF) {
            let c = source == MLX90614Source.Object ? _mlx90614ObjTemp : _mlx90614AmbTemp
            if (unit == MLX90614TempUnit.Kelvin) return Math.round((c + 273.15) * 100) / 100
            if (unit == MLX90614TempUnit.Fahrenheit) return Math.round((c * 9 / 5 + 32) * 100) / 100
            return Math.round(c * 100) / 100
        }
        let tempK = raw * 0.02  // Kelvin temperature

        // Store
        if (source == MLX90614Source.Object) {
            _mlx90614ObjTemp = tempK - 273.15
        } else {
            _mlx90614AmbTemp = tempK - 273.15
        }

        // Unit conversion
        if (unit == MLX90614TempUnit.Kelvin) {
            return Math.round(tempK * 100) / 100
        } else if (unit == MLX90614TempUnit.Fahrenheit) {
            return Math.round(((tempK - 273.15) * 9 / 5 + 32) * 100) / 100
        } else {
            return Math.round((tempK - 273.15) * 100) / 100
        }
    }

    /**
     * MLX90614 Object Temperature (Celsius)
     */
    //% block="MLX90614 Object Temperature (°C)"
    //% group="비접촉온도(MLX90614)" weight=138
    export function mlx90614ObjectTemp(): number {
        return mlx90614ReadTemp(MLX90614Source.Object, MLX90614TempUnit.Celsius)
    }

    /**
     * MLX90614 Ambient Temperature (Celsius)
     */
    //% block="MLX90614 Ambient Temperature (°C)"
    //% group="비접촉온도(MLX90614)" weight=137
    export function mlx90614AmbientTemp(): number {
        return mlx90614ReadTemp(MLX90614Source.Ambient, MLX90614TempUnit.Celsius)
    }


    /********** APDS9960 제스처/RGB/근접 센서 **********/

    // APDS9960 제스처 타입
    export enum APDS9960Gesture {
        //% block="none"
        None = 0,
        //% block="up"
        Up = 1,
        //% block="down"
        Down = 2,
        //% block="left"
        Left = 3,
        //% block="right"
        Right = 4
    }

    // APDS9960 제스처 타입 (한글)
    export enum APDS9960GestureKR {
        //% block="none"
        None = 0,
        //% block="up"
        Up = 1,
        //% block="down"
        Down = 2,
        //% block="left"
        Left = 3,
        //% block="right"
        Right = 4
    }

    // APDS9960 센서 타입
    export enum APDS9960SensorType {
        //% block="ambient"
        Ambient = 0,
        //% block="proximity"
        Proximity = 1,
        //% block="gesture"
        Gesture = 2,
        //% block="RGB"
        RGB = 3
    }

    // APDS9960 활성화 상태
    export enum APDS9960Enable {
        //% block="enable"
        Enable = 1,
        //% block="disable"
        Disable = 0
    }

    // APDS9960 인터럽트 사용
    export enum APDS9960Interrupt {
        //% block="enable"
        Enable = 1,
        //% block="disable"
        Disable = 0
    }

    // APDS9960 조도 타입
    export enum APDS9960AmbientType {
        //% block="ambient light"
        Ambient = 0,
        //% block="ambient"
        Lux = 1
    }

    // APDS9960 데이터 저장 변수
    let _apds9960Addr: number = 0x39
    let _apds9960R: number = 0
    let _apds9960G: number = 0
    let _apds9960B: number = 0
    let _apds9960C: number = 0
    // lux 정규화에 쓰는 현재 설정값 (apds9960Setup 에서 채운다)
    let _apds9960ATime: number = 0xFF
    let _apds9960AGain: number = 1
    let _apds9960Proximity: number = 0
    let _apds9960Gesture: APDS9960GestureKR = APDS9960GestureKR.None
    let _apds9960GestureDetected: boolean = false
    // 마지막으로 실제 손짓을 판정한 시각. 블록리 관용구인
    //   만약 <제스처가 왼쪽> ... 아니면 만약 <제스처가 오른쪽> ...
    // 처럼 같은 블록을 방향만 바꿔 여러 번 놓는 경우, 첫 호출이 FIFO 를 비우기 때문에
    // 뒤따르는 호출들은 None 을 보게 된다. 그래서 판정 결과를 잠시 붙들어 둔다.
    let _apds9960GestureLatchMs: number = 0

    //% block="Gesture sensor(APDS9960) setup"
    //% group="제스처(APDS9960)" weight=125
    export function apds9960Setup(): void {
        _apds9960Addr = 0x39

        // ★ 아두이노 init() 은 설정을 쓰기 전에 ENABLE(0x80)=0x00 으로 모든 기능을 끈다
        //   (SparkFun_APDS9960.cpp init() 의 setMode(ALL, OFF)).
        //   이전 프로그램이 남긴 ENABLE 상태가 그대로 살아 있는 것을 막는다.
        pins.i2cWriteNumber(_apds9960Addr, 0x8000, NumberFormat.UInt16BE)
        basic.pause(5)

        // Power ON
        pins.i2cWriteNumber(_apds9960Addr, 0x8001, NumberFormat.UInt16BE)
        basic.pause(10)

        // ADC 통합 시간 설정
        // ★ 아두이노 DEFAULT_ATIME 은 219(0xDB) = 103ms 적분이다.
        //   예전 값 0xF6 은 DEFAULT_WTIME 상수로, 두 값이 서로 뒤바뀌어 들어가 있었다.
        //   0xF6(27.8ms)이면 같은 조명에서 ALS/RGB 카운트가 약 3.7배 낮게 나온다.
        pins.i2cWriteNumber(_apds9960Addr, 0x81DB, NumberFormat.UInt16BE)

        // 대기 시간 설정 (아두이노 enableGestureSensor 가 쓰는 WTIME = 0xFF)
        pins.i2cWriteNumber(_apds9960Addr, 0x83FF, NumberFormat.UInt16BE)

        // 근접 펄스 수 설정 (DEFAULT_PROX_PPULSE = 0x87)
        // 제스처 엔진을 켤 때는 apds9960EnableSensor 에서 0x89(10펄스)로 다시 쓴다.
        pins.i2cWriteNumber(_apds9960Addr, 0x8E87, NumberFormat.UInt16BE)

        // ★ 아두이노 init() 이 명시적으로 쓰는데 예전에는 통째로 빠져 있던 레지스터들.
        //   대부분 리셋값과 같지만, 다른 프로그램이 남긴 값이 살아 있으면 동작이 달라진다.
        pins.i2cWriteNumber(_apds9960Addr, 0x9D00, NumberFormat.UInt16BE)   // POFFSET_UR = 0
        pins.i2cWriteNumber(_apds9960Addr, 0x9E00, NumberFormat.UInt16BE)   // POFFSET_DL = 0
        pins.i2cWriteNumber(_apds9960Addr, 0x8D60, NumberFormat.UInt16BE)   // CONFIG1 = 0x60 (WLONG 12x 미사용)

        // 제스처 설정
        // ★ 예전에는 진입/이탈 임계값을 0xA4(GOFFSET_U)·0xA5(GOFFSET_D) 에 써서
        //   주소가 4칸 밀려 있었다. GPENTH/GEXTH 는 리셋값 0 으로 남고 UP/DOWN 채널에는
        //   엉뚱한 오프셋이 걸려 상하 판정이 구조적으로 편향됐다.
        pins.i2cWriteNumber(_apds9960Addr, 0xA028, NumberFormat.UInt16BE)   // GPENTH = 40 (제스처 진입)
        pins.i2cWriteNumber(_apds9960Addr, 0xA11E, NumberFormat.UInt16BE)   // GEXTH  = 30 (제스처 이탈)
        // ★ 아두이노 DEFAULT_GCONF1 = 0x40 → GFIFOTH=01, 즉 FIFO 에 데이터셋이 4개보다
        //   많이 쌓여야 GVALID 가 선다. 0x00 이면 1개만 들어와도 GVALID 가 서서
        //   궤적이라 부를 수 없는 조각으로 방향을 판정하게 된다.
        pins.i2cWriteNumber(_apds9960Addr, 0xA240, NumberFormat.UInt16BE)   // GCONF1 = 0x40
        // ★ 예전에는 GWTIME=000(대기 0ms)이라 32개짜리 제스처 FIFO 가 10~20ms 만에 가득 차
        //   넘치고, 200~500ms 짜리 손짓의 앞부분 조각만 남았다.
        //   대기값은 아두이노판과 맞춘다 — SparkFun_APDS9960 의 DEFAULT_GWTIME 은
        //   GWTIME_2_8MS(=001) 이고 GGAIN 4x / GLDRIVE 100mA 와 합쳐 GCONF2 = 0x41 이다.
        //   (8.4ms 로 늘리면 FIFO 가 더 긴 시간을 담지만 아두이노판과 반응 속도가 달라진다)
        pins.i2cWriteNumber(_apds9960Addr, 0xA341, NumberFormat.UInt16BE)   // GCONF2 = GGAIN 4x | GLDRIVE 100mA | GWTIME 2.8ms
        pins.i2cWriteNumber(_apds9960Addr, 0xA400, NumberFormat.UInt16BE)   // GOFFSET_U = 0 (보정 미사용)
        pins.i2cWriteNumber(_apds9960Addr, 0xA500, NumberFormat.UInt16BE)   // GOFFSET_D = 0
        // ★ 아두이노 DEFAULT_GPULSE 는 0xC9(32us, 10펄스)다. 0xC8 은 9펄스라 한 펄스 모자란다.
        pins.i2cWriteNumber(_apds9960Addr, 0xA6C9, NumberFormat.UInt16BE)   // GPULSE = 0xC9

        // 게인 설정
        // ★ 아두이노 init() 은 LDRIVE=100mA(00), PGAIN=4x(10), AGAIN=4x(01) 을 쓰므로
        //   CONTROL(0x8F) = 0b00001001 = 0x09 이다.
        //   예전 값 0x44 는 LDRIVE=50mA, PGAIN=2x, AGAIN=1x 로 IR LED 전류는 절반,
        //   근접 게인은 절반, ALS 게인은 1/4 이라 검출 거리와 조도 카운트가 함께 낮아졌다.
        pins.i2cWriteNumber(_apds9960Addr, 0x8F09, NumberFormat.UInt16BE)
        // ★ 예전에는 WTIME(0x83FF)의 0xFF 를 ATIME 이라고 캐시해서 적분시간이 27.8ms 대신
        //   2.78ms 로 계산됐고, lux 가 정확히 10배 크게 나왔다.
        _apds9960ATime = 0xDB        // 위 0x81DB(ATIME) 과 일치 — lux 정규화용
        _apds9960AGain = 4           // AGAIN=01 → 4x

        // ★ 근접 인터럽트 임계값/지속조건. 아두이노 init() 은 PILT=0, PIHT=50, PERS=0x11 을
        //   반드시 먼저 프로그램한다. 이 값이 리셋값 0 이면 근접값이 0 만 넘어도 상한을
        //   넘은 것이 되어 INT 가 계속 걸리고, 인터럽트 기능 자체가 무의미해진다.
        pins.i2cWriteNumber(_apds9960Addr, 0x8900, NumberFormat.UInt16BE)   // PILT = 0
        pins.i2cWriteNumber(_apds9960Addr, 0x8B32, NumberFormat.UInt16BE)   // PIHT = 50
        pins.i2cWriteNumber(_apds9960Addr, 0x8C11, NumberFormat.UInt16BE)   // PERS = 0x11 (연속 2회)
        pins.i2cWriteNumber(_apds9960Addr, 0x9001, NumberFormat.UInt16BE)   // CONFIG2 = DEFAULT_CONFIG2
        pins.i2cWriteNumber(_apds9960Addr, 0x9F00, NumberFormat.UInt16BE)   // CONFIG3 = 0 (전 포토다이오드 사용)

        // ★ 예전에는 '게인 설정' 주석 아래에서 0xA9(GOFFSET_R)에 0x20 을 썼다.
        //   제스처 오프셋 4채널 중 R 만 값이 달라져 좌우 판정이 편향됐다.
        //   오프셋 보정을 쓰지 않으므로 0 으로 둔다.
        //   ★ 또 0xAA 는 GOFFSET_L 이 아니라 GCONF3 이다. 진짜 GOFFSET_L(0xA7)은
        //     한 번도 초기화되지 않아, 이전 프로그램이 남긴 값이 그대로 좌우 판정에 실렸다.
        pins.i2cWriteNumber(_apds9960Addr, 0xA700, NumberFormat.UInt16BE)   // GOFFSET_L = 0
        pins.i2cWriteNumber(_apds9960Addr, 0xA900, NumberFormat.UInt16BE)   // GOFFSET_R = 0
        pins.i2cWriteNumber(_apds9960Addr, 0xAA00, NumberFormat.UInt16BE)   // GCONF3 = 0 (GDIMS: 두 쌍 모두 사용)

        basic.pause(10)
    }

    //% block="APDS9960 clear interrupt"
    //% group="제스처(APDS9960)" weight=115
    export function apds9960ClearInterrupt(): void {
        // ★ 예전에는 AIEN/PIEN 으로 인터럽트를 켤 수는 있어도 지우는 경로가
        //   드라이버 어디에도 없었다(0xE4~0xE7 이 파일 전체에 등장하지 않았다).
        //   한 번 걸린 인터럽트가 계속 유지되어 이후 판정이 막힌다.
        //   0xE7 = AICLEAR (ALS·근접 인터럽트 모두 클리어)
        pins.i2cWriteNumber(_apds9960Addr, 0xE7, NumberFormat.UInt8BE)
    }

    //% block="APDS9960 %sensor sensor %enable, interrupt %interrupt"
    //% sensor.defl=AdvSensors.APDS9960SensorType.Ambient
    //% enable.defl=AdvSensors.APDS9960Enable.Enable
    //% interrupt.defl=AdvSensors.APDS9960Interrupt.Disable
    //% group="제스처(APDS9960)" weight=124
    //% inlineInputMode=inline
    export function apds9960EnableSensor(sensor: APDS9960SensorType, enable: APDS9960Enable, interrupt: APDS9960Interrupt): void {
        // Enable 레지스터 읽기 (레지스터 지정 후 반복시작 필요)
        pins.i2cWriteNumber(_apds9960Addr, 0x80, NumberFormat.UInt8BE, true)
        let enableReg = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)

        let bit = 0
        let clearBit = 0
        let intBit = 0

        if (sensor == APDS9960SensorType.Ambient) {
            bit = 0x02  // AEN
            clearBit = 0x02
            intBit = 0x10  // AIEN
        } else if (sensor == APDS9960SensorType.Proximity) {
            bit = 0x04  // PEN
            clearBit = 0x04
            intBit = 0x20  // PIEN
        } else if (sensor == APDS9960SensorType.Gesture) {
            // ★ 제스처 엔진은 근접 검출을 기반으로 동작하므로 PEN(0x04) 도 함께 켜야 한다.
            //   예전에는 GEN 만 켜서 제스처가 진입 조건을 못 만들었다.
            // ★ 아두이노 enableGestureSensor 는 WAIT(WEN, 0x08) 도 함께 켠다.
            //   WEN 이 없으면 앞서 쓴 WTIME=0xFF 가 아무 효과를 내지 못한다.
            bit = 0x40 | 0x08 | 0x04  // GEN | WEN | PEN
            // ★ 아두이노 disableGestureSensor 는 GEN 만 끈다. PEN 까지 끄면
            //   제스처를 끈 순간 근접 센서도 같이 죽는다.
            clearBit = 0x40           // GEN 만
            intBit = 0x00      // GIEN 은 ENABLE 이 아니라 GCONF4(0xAB) 에 있다
        } else {
            bit = 0x02  // AEN (RGB도 ALS 사용)
            clearBit = 0x02
            intBit = 0x10
        }

        if (sensor == APDS9960SensorType.Gesture) {
            // 아두이노 enableGestureSensor/disableGestureSensor 가 ENABLE 을 건드리기 전에
            // 하는 준비 작업을 그대로 옮긴다.
            if (enable == APDS9960Enable.Enable) {
                // 제스처 경로 전용 근접 펄스 (DEFAULT_GESTURE_PPULSE = 0x89, 16us 10펄스)
                pins.i2cWriteNumber(_apds9960Addr, 0x8E89, NumberFormat.UInt16BE)
                // CONFIG2(0x90) 의 LED_BOOST(bit5:4) = 11 → LED 전류 300%
                pins.i2cWriteNumber(_apds9960Addr, 0x90, NumberFormat.UInt8BE, true)
                let cfg2 = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
                cfg2 = (cfg2 & 0xCF) | 0x30
                pins.i2cWriteNumber(_apds9960Addr, (0x90 << 8) | cfg2, NumberFormat.UInt16BE)
            }
            // GCONF4(0xAB): bit1 = GIEN(제스처 인터럽트), bit0 = GMODE(제스처 상태기 진입)
            // ★ 예전에는 0xAB 가 파일 어디에도 없어 인터럽트 드롭다운이 제스처에서 무동작이었다.
            pins.i2cWriteNumber(_apds9960Addr, 0xAB, NumberFormat.UInt8BE, true)
            let gconf4 = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
            gconf4 = gconf4 & 0xFC
            if (enable == APDS9960Enable.Enable) {
                gconf4 |= 0x01                                        // GMODE = 1
                if (interrupt == APDS9960Interrupt.Enable) gconf4 |= 0x02   // GIEN = 1
            }
            pins.i2cWriteNumber(_apds9960Addr, (0xAB << 8) | gconf4, NumberFormat.UInt16BE)
        }

        if (enable == APDS9960Enable.Enable) {
            enableReg |= bit | 0x01  // PON 포함
        } else {
            enableReg &= ~clearBit
        }

        if (interrupt == APDS9960Interrupt.Enable) {
            enableReg |= intBit
        } else {
            enableReg &= ~intBit
        }

        pins.i2cWriteNumber(_apds9960Addr, (0x80 << 8) | enableReg, NumberFormat.UInt16BE)
    }

    //% block="APDS9960 %atype light"
    //% atype.defl=AdvSensors.APDS9960AmbientType.Ambient
    //% group="제스처(APDS9960)" weight=123
    export function apds9960ReadAmbient(atype: APDS9960AmbientType): number {
        // ★ STATUS(0x93) 의 AVALID(bit0) 로 적분 완료 확인 — 예전에는 확인 없이 읽었다.
        //   파일 전체에 0x93 이 한 번도 등장하지 않았다.
        let wait = 20
        while (wait > 0) {
            pins.i2cWriteNumber(_apds9960Addr, 0x93, NumberFormat.UInt8BE, true)
            let st = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
            if ((st & 0x01) != 0) break
            basic.pause(5)
            wait--
        }

        // CDATA/RDATA/GDATA/BDATA 8바이트를 한 번에 (0x94~0x9B, LSB first)
        pins.i2cWriteNumber(_apds9960Addr, 0x94, NumberFormat.UInt8BE, true)
        let buf = pins.i2cReadBuffer(_apds9960Addr, 8)
        _apds9960C = (buf[1] << 8) | buf[0]
        let r = (buf[3] << 8) | buf[2]
        let g = (buf[5] << 8) | buf[4]
        let b = (buf[7] << 8) | buf[6]

        if (atype == APDS9960AmbientType.Lux) {
            // ★ 예전에는 클리어 카운트를 10 으로 나눈 값을 'lux' 라 반환했다(정규화·계수 없음).
            //   Avago 앱노트 방식: 적분시간·게인으로 counts-per-lux 를 구해 나눈다.
            //     ALSIT = 2.78 × (256 − ATIME) [ms],  CPL = ALSIT × AGAIN / (GA × DF)
            //     Lux   = (−0.32466·R + 1.57837·G − 0.73191·B) / CPL
            //   GA=1.0(개방형), DF=52.
            let alsit = 2.78 * (256 - _apds9960ATime)
            let cpl = alsit * _apds9960AGain / 52.0
            if (cpl <= 0) return 0
            let lux = (-0.32466 * r + 1.57837 * g - 0.73191 * b) / cpl
            return Math.round(Math.max(0, lux))
        }
        return _apds9960C
    }

    //% block="APDS9960 proximity sensor value"
    //% group="제스처(APDS9960)" weight=122
    export function apds9960GetProximity(): number {
        // ★ STATUS(0x93) 의 PVALID(bit1) 로 근접 변환 완료를 확인한다
        let wait = 20
        while (wait > 0) {
            pins.i2cWriteNumber(_apds9960Addr, 0x93, NumberFormat.UInt8BE, true)
            let st = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
            if ((st & 0x02) != 0) break
            basic.pause(5)
            wait--
        }
        pins.i2cWriteNumber(_apds9960Addr, 0x9C, NumberFormat.UInt8BE, true)
        _apds9960Proximity = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
        return _apds9960Proximity
    }

    //% block="APDS9960 gesture detected"
    //% group="제스처(APDS9960)" weight=121
    export function apds9960GestureAvailable(): boolean {
        // 제스처 상태 확인 (레지스터 지정 후 반복시작 필요 — 예전에는 STOP 이 끼어 있었다)
        pins.i2cWriteNumber(_apds9960Addr, 0xAF, NumberFormat.UInt8BE, true)
        let status = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
        _apds9960GestureDetected = (status & 0x01) != 0
        return _apds9960GestureDetected
    }

    //% block="APDS9960 gesture read %gesture"
    //% gesture.defl=AdvSensors.APDS9960GestureKR.Left
    //% group="제스처(APDS9960)" weight=120
    export function apds9960GetGesture(gesture: APDS9960GestureKR): boolean {
        // Both reporter styles share the same 400ms cache and expiry time.
        let g = apds9960ReadGesture()
        let selected = APDS9960GestureKR.None
        if (g == APDS9960Gesture.Up) selected = APDS9960GestureKR.Up
        else if (g == APDS9960Gesture.Down) selected = APDS9960GestureKR.Down
        else if (g == APDS9960Gesture.Left) selected = APDS9960GestureKR.Left
        else if (g == APDS9960Gesture.Right) selected = APDS9960GestureKR.Right
        return selected == gesture
    }

    //% block="APDS9960 init"
    //% group="제스처(APDS9960)" weight=119
    export function apds9960Init(): void {
        gestureCachedAt = -1000
        _apds9960GestureLatchMs = -1000
        // ENABLE(0x80) = PON|AEN|PEN|WEN|GEN (0x4F)
        // ★ 레지스터 주소와 데이터는 반드시 한 트랜잭션으로 보내야 한다.
        //   i2cWriteNumber 를 두 번 부르면 각각 START…STOP 으로 끝나서
        //   두 번째 바이트가 데이터가 아니라 '다음 레지스터 주소'로 해석된다(= 설정이 안 실림).
        pins.i2cWriteNumber(_apds9960Addr, 0x804F, NumberFormat.UInt16BE)
        basic.pause(10)
    }

    /*
     * ★ 제스처 판정 재작성
     * 예전 구현은 FIFO 에서 데이터셋 1개(4바이트)만 읽고 그 순간의 채널 차이를
     * 곧바로 '방향'이라고 단정했다. GFLVL(0xAE)을 읽지 않아 FIFO 에 몇 개가 쌓였는지
     * 알지 못했고 FIFO 를 비우지도 않아, 손을 지나간 뒤에도 남은 데이터로 오판했다.
     *
     * 제스처는 '시간에 따른 변화'다. FIFO 에 쌓인 궤적 전체를 읽어
     * 처음과 끝의 채널 비율 변화로 방향을 정한다.
     */
    //% block="APDS9960 gesture read"
    //% group="제스처(APDS9960)" weight=118
    export function apds9960ReadGesture(): APDS9960Gesture {
        let value = apds9960ReadGestureRaw()
        if (value != APDS9960Gesture.None) { gestureCached = value; gestureCachedAt = control.millis() }
        return control.millis() - gestureCachedAt <= 400 ? gestureCached : APDS9960Gesture.None
    }
    let gestureCached = APDS9960Gesture.None
    let gestureCachedAt = -1000
    function apds9960ReadGestureRaw(): APDS9960Gesture {
        // GSTATUS(0xAF) 의 GVALID(bit0)
        pins.i2cWriteNumber(_apds9960Addr, 0xAF, NumberFormat.UInt8BE, true)
        let status = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
        if ((status & 0x01) == 0) return APDS9960Gesture.None

        // GFLVL(0xAE) — FIFO 에 쌓인 데이터셋 개수
        pins.i2cWriteNumber(_apds9960Addr, 0xAE, NumberFormat.UInt8BE, true)
        let level = pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
        // ★ 아두이노 processGestureData 는 total_gestures <= 4 면 판정 자체를 포기한다.
        //   1~4개짜리 조각에는 쓸 만한 궤적이 없다. GCONF1=0x40 덕분에 GVALID 가 서는
        //   시점이면 이미 4개보다 많이 쌓여 있다.
        if (level <= 4) return APDS9960Gesture.None      // 궤적이라 부를 수 없음

        if (level > 32) level = 32                      // FIFO 최대 32 데이터셋
        let firstU = 0, firstD = 0, firstL = 0, firstR = 0
        let lastU = 0, lastD = 0, lastL = 0, lastR = 0
        let got = 0

        // ★ 아두이노 GESTURE_THRESHOLD_OUT = 10.
        //   네 채널이 모두 10 을 넘는 샘플만 first/last 후보로 쓴다.
        //   예전에는 '네 바이트가 전부 0 만 아니면' 통과라서 3/2/1/0 같은 잡음도
        //   궤적의 시작·끝으로 쓰였다.
        const THRESHOLD_OUT = 10
        for (let i = 0; i < level; i++) {
            pins.i2cWriteNumber(_apds9960Addr, 0xFC, NumberFormat.UInt8BE, true)
            let b = pins.i2cReadBuffer(_apds9960Addr, 4)
            // FIFO 는 남김없이 읽어 비운다. 다만 판정에는 문턱을 넘는 샘플만 쓴다.
            if (b[0] <= THRESHOLD_OUT || b[1] <= THRESHOLD_OUT || b[2] <= THRESHOLD_OUT || b[3] <= THRESHOLD_OUT) continue
            if (got == 0) { firstU = b[0]; firstD = b[1]; firstL = b[2]; firstR = b[3] }
            lastU = b[0]; lastD = b[1]; lastL = b[2]; lastR = b[3]
            got++
        }
        if (got < 2) return APDS9960Gesture.None

        // 채널 비율의 시작→끝 변화량으로 방향을 정한다(절대값이 아니라 추세)
        // ★ 분모의 +1 은 뺐다. 위 문턱 덕분에 네 채널 모두 10 초과가 보장되므로
        //   0 나눗셈이 날 수 없고, +1 은 아두이노 공식 (u-d)*100/(u+d) 대비
        //   작은 값에서 비율을 과소평가하는 편향만 만든다.
        let udFirst = ((firstU - firstD) * 100) / (firstU + firstD)
        let udLast = ((lastU - lastD) * 100) / (lastU + lastD)
        let lrFirst = ((firstL - firstR) * 100) / (firstL + firstR)
        let lrLast = ((lastL - lastR) * 100) / (lastL + lastR)

        let udDelta = udLast - udFirst
        let lrDelta = lrLast - lrFirst
        // 판정 문턱. 아두이노의 GESTURE_SENSITIVITY_1 은 50 이지만, 그 값은 FIFO 를
        // 여러 번 나눠 읽으며 배치마다의 델타를 누적한 합에 적용된다. 여기서는 FIFO 를
        // 한 번에 통째로 읽어 한 번의 시작→끝 델타만 보므로 같은 숫자를 그대로 쓸 수 없다.
        const TH = 30

        // ★ 부호 대응이 네 방향 모두 반대였다(위↔아래, 왼쪽↔오른쪽).
        //   아두이노판 SparkFun_APDS9960 의 판정은 다음과 같다:
        //     ud_delta >= +50 -> ud_count = +1 -> DIR_DOWN
        //     ud_delta <= -50 -> ud_count = -1 -> DIR_UP
        //     lr_delta >= +50 -> lr_count = +1 -> DIR_RIGHT
        //     lr_delta <= -50 -> lr_count = -1 -> DIR_LEFT
        //   (U-D 비율이 커진다 = 손이 D 쪽에서 U 쪽으로 간 것이 아니라 그 반대다)
        if (Math.abs(udDelta) > Math.abs(lrDelta)) {
            if (udDelta > TH) return APDS9960Gesture.Down
            if (udDelta < -TH) return APDS9960Gesture.Up
        } else {
            if (lrDelta > TH) return APDS9960Gesture.Right
            if (lrDelta < -TH) return APDS9960Gesture.Left
        }
        return APDS9960Gesture.None
    }

    //% block="APDS9960 proximity read"
    //% group="제스처(APDS9960)" weight=117
    export function apds9960ReadProximity(): number {
        pins.i2cWriteNumber(_apds9960Addr, 0x9C, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(_apds9960Addr, NumberFormat.UInt8BE)
    }

    //% block="APDS9960 color read %color"
    //% group="제스처(APDS9960)" weight=116
    export function apds9960ReadColor(color: RGBColor): number {
        // RGBC 데이터 읽기
        pins.i2cWriteNumber(_apds9960Addr, 0x94, NumberFormat.UInt8BE)
        let buf = pins.i2cReadBuffer(_apds9960Addr, 8)

        _apds9960C = (buf[1] << 8) | buf[0]
        _apds9960R = (buf[3] << 8) | buf[2]
        _apds9960G = (buf[5] << 8) | buf[4]
        _apds9960B = (buf[7] << 8) | buf[6]

        if (color == RGBColor.Red) return _apds9960R
        if (color == RGBColor.Green) return _apds9960G
        if (color == RGBColor.Blue) return _apds9960B
        return _apds9960C
    }


    /********** 심박 센서 (MAX30102/MAX30105) **********/

    // MAX30102/MAX30105는 심박수와 혈중산소포화도(SpO2)를 측정하는 센서입니다.
    // I2C 주소: 0x57

    // 심박 센서 측정 타입
    export enum HeartRateSensorType {
        //% block="heart rate"
        HeartRate = 0,
        //% block="SpO2"
        SpO2 = 1
    }

    // 심박 센서 전력 설정
    export enum HeartRatePower {
        //% block="low"
        Low = 0,
        //% block="medium"
        Medium = 1,
        //% block="high"
        High = 2
    }

    // 심박 센서 상태 변수
    export let _hrAddr: number = 0x57
    export let _hrMode: number = 3          // 2=HR(RED 1채널) / 3=SpO2(RED+IR 2채널)
    export let _hrRedLED: number = 0
    export let _hrIRLED: number = 0
    let _hrHeartRate: number = 0
    let _hrSpO2: number = 0
    export let _hrTemperature: number = 0
    export let _hrFingerDetected: boolean = false
    let _hrBeatDetected: boolean = false
    export let _hrReady: boolean = false
    // ★ 아두이노 max30105_sensor_ready 는 '(IR > 50000 && millis() > 5000)' 로,
    //   부팅 후 5초가 지나야 준비됐다고 본다(LED 구동과 DC 추정이 안정될 시간).
    //   micro:bit 는 setup 블록을 늦게 부를 수도 있으므로 setup 시각을 기준으로 잰다.
    export let _hrSetupMs: number = 0
    // ★ 마지막으로 FIFO 에서 '새' 샘플을 실제로 꺼낸 시각(누가 꺼냈든).
    //   FIFO 는 한 번 읽으면 사라지는 공유 자원이라 소비자가 여럿이면 서로 굶긴다.
    //   이 시각을 보면 다시 꺼내지 않고도 _hrRedLED/_hrIRLED 가 신선한지 알 수 있다.
    export let _hrLastSampleMs: number = 0
    let _hrLastBeat: number = 0
    let _hrBeatCount: number = 0
    let _hrBeatTimes: number[] = []

    //% block="Heart rate sensor setup"
    //% group="심박(MAX30102)" weight=110
    export function heartRateSetup(): void {
        _hrLastSampleMs = 0
        _hrFingerDetected = false
        _hrIRLED = 0
        _hrRedLED = 0
        _hrHeartRate = 0
        _hrSpO2 = 0
        _hrAddr = 0x57

        // 소프트 리셋
        pins.i2cWriteNumber(_hrAddr, 0x0940, NumberFormat.UInt16BE)
        basic.pause(100)

        // FIFO 설정 (샘플 평균 4, FIFO 롤오버 활성화)
        pins.i2cWriteNumber(_hrAddr, 0x0850, NumberFormat.UInt16BE)

        // 모드 설정 (SpO2 모드)
        pins.i2cWriteNumber(_hrAddr, 0x0903, NumberFormat.UInt16BE)
        // ★ 레지스터만 바꾸고 캐시(_hrMode)를 갱신하지 않아서, setPower(심박)로 HR 모드를
        //   쓴 뒤 다시 setup 을 부르면 칩은 6바이트/샘플인데 드라이버는 3바이트만 읽어
        //   FIFO 경계가 어긋났다.
        _hrMode = 3

        // SpO2 설정 (ADC 범위 4096, 샘플 레이트 100, 펄스 폭 411us)
        // (아두이노 setup() 기본값은 400sps 다. micro:bit 는 I2C 처리량과 파이버 주기를 고려해
        //  100sps 로 낮춰 쓴다 — 유효 샘플레이트는 평균 4 를 거쳐 25sps.
        //  ADC 범위 4096 과 펄스폭 411us(18비트)는 아두이노와 동일하다.)
        pins.i2cWriteNumber(_hrAddr, 0x0A27, NumberFormat.UInt16BE)

        // LED 전류 설정
        // ★ 아두이노 setup() 은 powerLevel 기본값 0x1F(6.4mA)를 RED/IR/GREEN/PROX 전부에 건다.
        //   0x24 는 근거 없는 값이었고, 'Finger detected' 가 쓰는 50000 문턱은 IR=0x1F 로
        //   측정된 아두이노 쪽에서 온 숫자라 IR 구동 전류가 같아야 의미가 맞는다.
        //   (아두이노 스케치는 그 뒤 RED 를 0x0A 로 더 낮추지만, 그 스케치는 IR 만 읽는다.
        //    micro:bit 의 SpO2 경로는 RED 의 맥동 성분을 실제로 쓰므로 RED 도 0x1F 로 둔다.)
        pins.i2cWriteNumber(_hrAddr, 0x0C1F, NumberFormat.UInt16BE)
        pins.i2cWriteNumber(_hrAddr, 0x0D1F, NumberFormat.UInt16BE)

        // ★ 아두이노 setup() 의 마지막 문장은 clearFIFO() 다(MAX30105.cpp).
        //   MODE 를 쓰는 순간 변환이 시작되므로, 설정이 끝나기 전에 찍힌 샘플들은
        //   LED 가 꺼져 있고 ADC 설정도 다른 '깜깜한 프레임'이다. 포인터 3개를 0 으로
        //   되돌려 첫 읽기가 반드시 설정 이후 샘플이 되도록 한다.
        pins.i2cWriteNumber(_hrAddr, 0x0400, NumberFormat.UInt16BE)   // FIFO_WR_PTR = 0
        pins.i2cWriteNumber(_hrAddr, 0x0500, NumberFormat.UInt16BE)   // OVF_COUNTER = 0
        pins.i2cWriteNumber(_hrAddr, 0x0600, NumberFormat.UInt16BE)   // FIFO_RD_PTR = 0

        _hrReady = true
        _hrSetupMs = control.millis()
        _hrBeatTimes = []
        _hrBeatCount = 0
        basic.pause(100)
    }

    //% block="Finger detected"
    //% group="심박(MAX30102)" weight=109
    export function heartRateFingerDetected(): boolean {
        // ★ 이 블록은 'forever' 안에서 BPM/SpO2 블록을 감싸는 데 거의 항상 쓰인다.
        //   그런데 FIFO 는 꺼내면 사라지는 공유 자원이라, 샘플러가 도는 동안 여기서
        //   또 꺼내면 박동 검출기가 받는 샘플이 절반으로 줄어든다.
        //   샘플러가 20ms 마다 _hrFingerDetected 를 갱신하므로 그 값을 읽기만 한다.
        if (_hrSamplerOn) return hrFresh() && _hrFingerDetected
        heartRateReadRaw()
        // IR 값이 일정 수준 이상이면 손가락 감지
        _hrFingerDetected = hrFresh() && _hrIRLED > 50000
        return _hrFingerDetected
    }

    /*
     * ★ 심박 검출 재작성
     * 예전 구현은 IR 의 DC 절대 문턱값(>50000 / <45000)으로 박동을 잡으려 했다.
     * 그런데 손가락을 대고 있는 동안 IR 은 계속 50000 위에 머무르므로
     * _hrBeatDetected 가 true 로 굳고 45000 아래로 내려가지 않아 리셋되지 않는다.
     * 결과적으로 박동이 딱 1회만 등록되고 BPM 은 영원히 0 이었다
     * (실제로는 손가락을 뗐다 붙이는 속도를 재고 있었다).
     *
     * PPG 에서 심박은 DC 의 약 0.5~2% 에 불과한 맥동(AC) 성분이다.
     * 이동평균으로 DC 를 빼고 적응형 문턱값 + 상승엣지로 피크를 잡는다.
     */
    const HR_WIN = 16                 // 이동평균 창(샘플)
    let _hrBuf: number[] = []
    let _hrBufSum = 0
    let _hrPrevAC = 0
    let _hrRising = false
    let _hrAcPeak = 0
    export let _hrSamplerOn = false
    // ★ 박동 1회당 정확히 한 번만 true 를 돌려주기 위한 래치(읽는 순간 소비된다)
    let _hrBeatPulse = false

    // SpO2 용 — 최근 창의 AC(진폭)·DC(평균)를 RED/IR 각각 추적
    let _hrRedSum = 0, _hrRedN = 0, _hrRedMin = 0, _hrRedMax = 0
    let _hrIrSum = 0, _hrIrN = 0, _hrIrMin = 0, _hrIrMax = 0

    function hrTrackAcDc(red: number, ir: number): void {
        if (_hrRedN == 0) { _hrRedMin = red; _hrRedMax = red; _hrIrMin = ir; _hrIrMax = ir }
        if (red < _hrRedMin) _hrRedMin = red
        if (red > _hrRedMax) _hrRedMax = red
        if (ir < _hrIrMin) _hrIrMin = ir
        if (ir > _hrIrMax) _hrIrMax = ir
        _hrRedSum += red; _hrRedN++
        _hrIrSum += ir; _hrIrN++
        // 창이 차면 리셋해 최근 구간만 반영한다
        if (_hrIrN >= HR_WIN * 4) {
            _hrRedSum = _hrRedSum / _hrRedN; _hrRedN = 1
            _hrIrSum = _hrIrSum / _hrIrN; _hrIrN = 1
            _hrRedMin = red; _hrRedMax = red; _hrIrMin = ir; _hrIrMax = ir
        }
    }

    function hrResetAcDc(): void {
        _hrRedSum = 0; _hrRedN = 0; _hrIrSum = 0; _hrIrN = 0
        _hrRedMin = 0; _hrRedMax = 0; _hrIrMin = 0; _hrIrMax = 0
    }

    function hrProcessSample(ir: number, now: number): void {
        _hrBuf.push(ir)
        _hrBufSum += ir
        if (_hrBuf.length > HR_WIN) _hrBufSum -= _hrBuf.shift()
        if (_hrBuf.length < HR_WIN) return               // 워밍업 중

        let dc = _hrBufSum / _hrBuf.length
        let ac = ir - dc

        // 적응형 문턱값 — 최근 진폭의 절반, 서서히 감쇠시켜 진폭 변화를 따라간다
        let mag = Math.abs(ac)
        if (mag > _hrAcPeak) _hrAcPeak = mag
        else _hrAcPeak = _hrAcPeak * 0.995
        let thr = _hrAcPeak * 0.5
        if (thr < 20) thr = 20                            // 잡음 바닥

        if (!_hrRising && _hrPrevAC <= thr && ac > thr) {
            _hrRising = true
            if (_hrLastBeat > 0) {
                let iv = now - _hrLastBeat
                if (iv > 300 && iv < 2000) {              // 30~200 BPM 범위만 채택
                    _hrBeatTimes.push(iv)
                    if (_hrBeatTimes.length > 10) _hrBeatTimes.shift()
                }
            }
            _hrBeatPulse = true                           // 박동 1회 래치
            _hrLastBeat = now
        } else if (ac < thr * 0.5) {
            _hrRising = false                             // 히스테리시스
        }
        _hrPrevAC = ac
    }

    // 백그라운드 연속 샘플러 (최초 BPM 읽기 때 1회 기동)
    export function hrEnsureSampler(): void {
        if (_hrSamplerOn) return
        _hrSamplerOn = true
        control.inBackground(() => {
            while (true) {
                // ★ 새 샘플을 실제로 소비했을 때만 필터에 넣는다.
                //   칩은 100sps / 평균4 = 실효 25sps 인데 이 루프는 50Hz 로 돌아,
                //   예전에는 두 번에 한 번꼴로 같은 값이 이동평균과 AC min/max 에 또 들어갔다.
                //   그러면 DC 창이 의도한 640ms 가 아니라 320ms 분량의 실신호만 덮고
                //   AC 파형이 계단처럼 뭉개진다(BPM 안정성·SpO2 R 값이 함께 나빠진다).
                let fresh = heartRateReadRaw()
                _hrFingerDetected = hrFresh() && _hrIRLED > 50000
                if (_hrFingerDetected) {
                    if (fresh) {
                        hrProcessSample(_hrIRLED, control.millis())
                        hrTrackAcDc(_hrRedLED, _hrIRLED)
                    }
                } else {
                    // 손가락을 떼면 상태 초기화
                    _hrBuf = []
                    _hrBufSum = 0
                    _hrAcPeak = 0
                    _hrRising = false
                    _hrLastBeat = 0
                    _hrBeatPulse = false
                    _hrBeatTimes = []
                    _hrHeartRate = 0
                    _hrSpO2 = 0
                    hrResetAcDc()
                }
                basic.pause(20)                            // 약 50Hz
            }
        })
    }

    //% block="Heart rate read (BPM)"
    //% group="심박(MAX30102)" weight=108
    export function heartRateGetBPM(): number {
        hrEnsureSampler()
        if (!hrFresh() || !_hrFingerDetected) return 0

        if (_hrBeatTimes.length >= 3) {                    // 최소 3박 모여야 값을 낸다
            let sum = 0
            for (let i = 0; i < _hrBeatTimes.length; i++) sum += _hrBeatTimes[i]
            let avg = sum / _hrBeatTimes.length
            let bpm = Math.round(60000 / avg)
            // ★ 위 hrProcessSample 이 이미 300~2000ms(=30~200 BPM) 간격만 채택하므로
            //   여기서 40 미만을 다시 버리면, 30~40 BPM 은 어차피 나올 수 없는데도
            //   한 번 더 잘라내는 셈이었다(두 문턱이 서로 어긋나 있었다).
            //   아두이노의 최종 게이트는 20~255 BPM 이라 훨씬 넓다 — 여기서는 채택 창과
            //   같은 30~200 으로만 맞춘다.
            _hrHeartRate = (bpm < 30 || bpm > 200) ? 0 : bpm
        }
        return _hrHeartRate
    }

    //% block="SpO2 read (\\%)"
    //% group="심박(MAX30102)" weight=107
    export function heartRateGetSpO2(): number {
        hrEnsureSampler()          // BPM 블록 없이 SpO2 만 써도 표본이 쌓이도록
        // ★ 방어용 가드. RED 1채널 모드(_hrMode == 2)에서는 heartRateReadRaw 가
        //   IR 자리에 RED 를 복사하므로 R 비율이 항상 정확히 1.0 이 되어
        //   85% 라는 그럴듯한 가짜 값이 나온다. 측정 근거가 없으므로 보고하지 않는다.
        //   (아두이노의 HEARTRATE/OXYGEN 프리셋은 둘 다 RED+IR 이라, 이제 전력 설정
        //    블록으로는 이 상태에 들어가지 않는다.)
        if (_hrMode != 3) return 0
        if (!hrFresh() || !_hrFingerDetected) return 0

        // ★ R = (AC_red / DC_red) / (AC_ir / DC_ir)
        //   예전에는 주석에 이 식을 써놓고 실제로는 원시 DC 카운트의 단순 비율을
        //   R 자리에 넣었다(맥동 성분을 전혀 뽑지 않음) → SpO2 가 의미 없는 값이었다.
        //   백그라운드 샘플러가 모은 최근 창의 진폭(max−min)을 AC, 평균을 DC 로 쓴다.
        // ★ 창(HR_WIN*4)이 찰 때마다 표본 수가 1 로 리셋되는데 예전에는 그동안 0 을 돌려줘,
        //   손가락을 계속 대고 있어도 1.3초마다 약 300ms 동안 값이 0 으로 떨어졌다.
        //   롤오버 구간에서는 직전 값을 유지한다(_hrSpO2 는 손가락을 떼면 0 으로 초기화된다).
        if (_hrRedN < HR_WIN || _hrIrN < HR_WIN) return _hrSpO2   // 아직 표본 부족

        let dcRed = _hrRedSum / _hrRedN
        let dcIr = _hrIrSum / _hrIrN
        let acRed = _hrRedMax - _hrRedMin
        let acIr = _hrIrMax - _hrIrMin
        // 롤오버 직후에는 min==max 라 진폭이 0 이다 — 여기서도 직전 값을 유지한다
        if (dcRed <= 0 || dcIr <= 0 || acIr <= 0) return _hrSpO2

        let r = (acRed / dcRed) / (acIr / dcIr)
        let v = Math.round(110 - 25 * r)
        if (v > 100) v = 100
        if (v < 80) v = 0                                     // 신뢰 못 할 범위는 0
        _hrSpO2 = v
        return _hrSpO2
    }

    //% block="Heartbeat detected"
    //% group="심박(MAX30102)" weight=106
    export function heartRateBeatDetected(): boolean {
        // ★ 예전에는 여기서 heartRateReadRaw() 를 불러 FIFO 를 소비하면서도
        //   _hrBeatDetected 를 갱신하는 코드가 어디에도 없어 항상 같은 값만 나왔다.
        //   이제 박동 판정은 백그라운드 샘플러가 하고, 이 블록은 결과만 읽는다.
        //   ★ 예전에는 '직전 피크 이후 250ms 이내' 라는 레벨 판정이라, 20ms 마다 도는
        //     forever 루프에서 한 박동당 12번쯤 true 가 되어 박동수를 세면 10배 넘게 셌다.
        //     샘플러가 걸어둔 래치를 읽는 순간 소비해 진짜 1회성 펄스로 만든다.
        hrEnsureSampler()
        if (!hrFresh() || !_hrBeatPulse) return false
        _hrBeatPulse = false
        return true
    }
}
