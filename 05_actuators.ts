/**
 * BRIXEL Extension - 05. Actuators
 * Servo, DC Motor, Stepper Motor
 *
 * 2026-07-26: 릴레이·솔레노이드·팬·펌프 블록 제거.
 *   단순 디지털/PWM 출력이라 범용 핀 블록으로 충분하며, 전용 블록을 두면
 *   그 장치가 특별한 제어를 받는 것처럼 오해를 준다.
 *   팬 모터(m-002)는 실제로 L9110 구동이므로 아래 L9110 블록이 대체한다.
 */

//% weight=1060 color=#50B91A icon="\uf013" block="05. Actuators"
//% groups='["DC모터(L9110)","Servo Motors","5Kg GeekServo","Green GeekServo","Stepper Motors","DC모터(L298N)","DC모터(L293D)","듀얼 H-브리지 모터(TB6612FNG)","듀얼 H-브리지 DC 모터(DRV8833)","DC모터 드라이버(PCA9685)","서보 드라이버(PCA9685)"]'
namespace Actuators05 {


    /********** L298N 모터 드라이버 **********/

    // 아두이노 쪽 DC 모터 PWM 주파수(우노 analogWrite 약 490~980Hz, PCA9685 드라이버는
    // 명시적으로 setPWMFreq(1000))와 달리 여기 analogWritePin 은 micro:bit 기본 주기
    // 20ms(=50Hz)로 나간다. pins.analogSetPeriod 로 1kHz 를 맞출 수는 있지만
    // micro:bit 는 PWM 주기가 채널 단위로 공유돼서 같은 채널에 걸린 서보(20ms 필요)가
    // 통째로 망가진다. 그래서 의도적으로 손대지 않는다. 저속에서 모터가 우는 소리는
    // 이 차이 때문이며 드라이버 칩 자체는 아두이노판과 동일하다.

    // L298N 핀 저장 변수
    let _l298nENA: AnalogPin = AnalogPin.P0
    let _l298nIN1: DigitalPin = DigitalPin.P1
    let _l298nIN2: DigitalPin = DigitalPin.P2
    // 기본값을 P3/P4/P5 에서 옮겼다. P3/P4/P6/P7/P9/P10 은 LED 매트릭스가,
    // P5/P11 은 버튼 A/B 가 쓰는 핀이라 핀 설정 블록을 빼먹으면 디스플레이·버튼과 충돌한다.
    let _l298nENB: AnalogPin = AnalogPin.P8
    let _l298nIN3: DigitalPin = DigitalPin.P12
    let _l298nIN4: DigitalPin = DigitalPin.P16

    //% block="L298N motorA pin set ENA %ena IN1 %in1 IN2 %in2"
    //% group="DC모터(L298N)" weight=100
    export function l298nSetPinsA(ena: AnalogPin, in1: DigitalPin, in2: DigitalPin): void {
        _l298nENA = ena
        _l298nIN1 = in1
        _l298nIN2 = in2
    }

    //% block="L298N motorB pin set ENB %enb IN3 %in3 IN4 %in4"
    //% group="DC모터(L298N)" weight=99
    export function l298nSetPinsB(enb: AnalogPin, in3: DigitalPin, in4: DigitalPin): void {
        _l298nENB = enb
        _l298nIN3 = in3
        _l298nIN4 = in4
    }

    //% block="L298N motorA speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="DC모터(L298N)" weight=98
    export function l298nMotorA(speed: number): void {
        // speed 에 변수를 꽂으면 min/max 슬라이더 제한이 통하지 않는다.
        // 1023 을 넘는 값은 analogWritePin 이 통째로 무시하므로 여기서 잘라준다.
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_l298nIN1, 1)
            pins.digitalWritePin(_l298nIN2, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_l298nIN1, 0)
            pins.digitalWritePin(_l298nIN2, 1)
        } else {
            pins.digitalWritePin(_l298nIN1, 0)
            pins.digitalWritePin(_l298nIN2, 0)
        }
        pins.analogWritePin(_l298nENA, pwm)
    }

    //% block="L298N motorB speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="DC모터(L298N)" weight=97
    export function l298nMotorB(speed: number): void {
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_l298nIN3, 1)
            pins.digitalWritePin(_l298nIN4, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_l298nIN3, 0)
            pins.digitalWritePin(_l298nIN4, 1)
        } else {
            pins.digitalWritePin(_l298nIN3, 0)
            pins.digitalWritePin(_l298nIN4, 0)
        }
        pins.analogWritePin(_l298nENB, pwm)
    }


    /********** L293D 모터 드라이버 **********/

    // L293D 핀 저장 변수
    let _l293dEN1: AnalogPin = AnalogPin.P0
    let _l293dIN1: DigitalPin = DigitalPin.P1
    let _l293dIN2: DigitalPin = DigitalPin.P2
    // 기본값을 LED 매트릭스(P3/P4)·버튼 A(P5) 와 겹치지 않는 자유 핀으로 옮겼다.
    let _l293dEN2: AnalogPin = AnalogPin.P8
    let _l293dIN3: DigitalPin = DigitalPin.P12
    let _l293dIN4: DigitalPin = DigitalPin.P16

    //% block="L293D motor1 pin set EN1 %en1 IN1 %in1 IN2 %in2"
    //% group="DC모터(L293D)" weight=96
    export function l293dSetPins1(en1: AnalogPin, in1: DigitalPin, in2: DigitalPin): void {
        _l293dEN1 = en1
        _l293dIN1 = in1
        _l293dIN2 = in2
    }

    //% block="L293D motor2 pin set EN2 %en2 IN3 %in3 IN4 %in4"
    //% group="DC모터(L293D)" weight=95
    export function l293dSetPins2(en2: AnalogPin, in3: DigitalPin, in4: DigitalPin): void {
        _l293dEN2 = en2
        _l293dIN3 = in3
        _l293dIN4 = in4
    }

    //% block="L293D motor1 speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="DC모터(L293D)" weight=94
    export function l293dMotor1(speed: number): void {
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_l293dIN1, 1)
            pins.digitalWritePin(_l293dIN2, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_l293dIN1, 0)
            pins.digitalWritePin(_l293dIN2, 1)
        } else {
            pins.digitalWritePin(_l293dIN1, 0)
            pins.digitalWritePin(_l293dIN2, 0)
        }
        pins.analogWritePin(_l293dEN1, pwm)
    }

    //% block="L293D motor2 speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="DC모터(L293D)" weight=93
    export function l293dMotor2(speed: number): void {
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_l293dIN3, 1)
            pins.digitalWritePin(_l293dIN4, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_l293dIN3, 0)
            pins.digitalWritePin(_l293dIN4, 1)
        } else {
            pins.digitalWritePin(_l293dIN3, 0)
            pins.digitalWritePin(_l293dIN4, 0)
        }
        pins.analogWritePin(_l293dEN2, pwm)
    }


    /********** TB6612FNG 모터 드라이버 **********/

    // TB6612FNG 핀 저장 변수
    let _tb6612PWMA: AnalogPin = AnalogPin.P0
    let _tb6612AIN1: DigitalPin = DigitalPin.P1
    let _tb6612AIN2: DigitalPin = DigitalPin.P2
    // 기본값을 LED 매트릭스(P3/P4/P6)·버튼 A(P5) 와 겹치지 않는 자유 핀으로 옮겼다.
    // STBY 는 P9 도 LED 매트릭스라 쓸 수 없어 P13 으로 둔다(SPI 미사용 시 자유).
    let _tb6612PWMB: AnalogPin = AnalogPin.P8
    let _tb6612BIN1: DigitalPin = DigitalPin.P12
    let _tb6612BIN2: DigitalPin = DigitalPin.P16
    let _tb6612STBY: DigitalPin = DigitalPin.P13

    //% block="TB6612FNG pin set PWMA %pwma AIN1 %ain1 AIN2 %ain2 STBY %stby"
    //% group="듀얼 H-브리지 모터(TB6612FNG)" weight=92
    export function tb6612SetPinsA(pwma: AnalogPin, ain1: DigitalPin, ain2: DigitalPin, stby: DigitalPin): void {
        _tb6612PWMA = pwma
        _tb6612AIN1 = ain1
        _tb6612AIN2 = ain2
        _tb6612STBY = stby
        pins.digitalWritePin(_tb6612STBY, 1)
    }

    //% block="TB6612FNG motorB pin set PWMB %pwmb BIN1 %bin1 BIN2 %bin2"
    //% group="듀얼 H-브리지 모터(TB6612FNG)" weight=91
    export function tb6612SetPinsB(pwmb: AnalogPin, bin1: DigitalPin, bin2: DigitalPin): void {
        _tb6612PWMB = pwmb
        _tb6612BIN1 = bin1
        _tb6612BIN2 = bin2
    }

    //% block="TB6612FNG motorA speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="듀얼 H-브리지 모터(TB6612FNG)" weight=90
    export function tb6612MotorA(speed: number): void {
        // STBY 를 매번 풀어준다. 예전에는 A핀 설정 블록에서만 HIGH 로 만들어서
        // 그 블록을 쓰지 않으면 칩이 스탠바이(Hi-Z)에 머물러 모터가 전혀 돌지 않았다.
        pins.digitalWritePin(_tb6612STBY, 1)
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_tb6612AIN1, 1)
            pins.digitalWritePin(_tb6612AIN2, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_tb6612AIN1, 0)
            pins.digitalWritePin(_tb6612AIN2, 1)
        } else {
            pins.digitalWritePin(_tb6612AIN1, 0)
            pins.digitalWritePin(_tb6612AIN2, 0)
        }
        pins.analogWritePin(_tb6612PWMA, pwm)
    }

    //% block="TB6612FNG motorB speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="듀얼 H-브리지 모터(TB6612FNG)" weight=89
    export function tb6612MotorB(speed: number): void {
        // B 모터만 쓰는 프로그램도 스탠바이가 풀리도록 여기서도 STBY 를 HIGH 로
        pins.digitalWritePin(_tb6612STBY, 1)
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(_tb6612BIN1, 1)
            pins.digitalWritePin(_tb6612BIN2, 0)
        } else if (speed < 0) {
            pins.digitalWritePin(_tb6612BIN1, 0)
            pins.digitalWritePin(_tb6612BIN2, 1)
        } else {
            pins.digitalWritePin(_tb6612BIN1, 0)
            pins.digitalWritePin(_tb6612BIN2, 0)
        }
        pins.analogWritePin(_tb6612PWMB, pwm)
    }


    /********** DRV8833 모터 드라이버 **********/

    // DRV8833 핀 저장 변수
    let _drv8833AIN1: AnalogPin = AnalogPin.P0
    let _drv8833AIN2: AnalogPin = AnalogPin.P1
    let _drv8833BIN1: AnalogPin = AnalogPin.P2
    // P3 은 LED 매트릭스 핀이라 기본값을 자유 핀 P8 로 옮겼다.
    let _drv8833BIN2: AnalogPin = AnalogPin.P8

    //% block="DRV8833 motorA pin set AIN1 %ain1 AIN2 %ain2"
    //% group="듀얼 H-브리지 DC 모터(DRV8833)" weight=88
    export function drv8833SetPinsA(ain1: AnalogPin, ain2: AnalogPin): void {
        _drv8833AIN1 = ain1
        _drv8833AIN2 = ain2
    }

    //% block="DRV8833 motorB pin set BIN1 %bin1 BIN2 %bin2"
    //% group="듀얼 H-브리지 DC 모터(DRV8833)" weight=87
    export function drv8833SetPinsB(bin1: AnalogPin, bin2: AnalogPin): void {
        _drv8833BIN1 = bin1
        _drv8833BIN2 = bin2
    }

    //% block="DRV8833 motorA speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="듀얼 H-브리지 DC 모터(DRV8833)" weight=86
    export function drv8833MotorA(speed: number): void {
        // 쓰지 않는 쪽은 analogWritePin(…,0) 대신 digitalWritePin 으로 내린다.
        // 값이 0 이어도 PWM 채널을 잡아먹어(동시 3개 제한) 2모터 구성에서 채널이 모자란다.
        let dA1 = <DigitalPin><number>_drv8833AIN1
        let dA2 = <DigitalPin><number>_drv8833AIN2
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(dA2, 0)
            pins.analogWritePin(_drv8833AIN1, pwm)
        } else if (speed < 0) {
            pins.digitalWritePin(dA1, 0)
            pins.analogWritePin(_drv8833AIN2, pwm)
        } else {
            pins.digitalWritePin(dA1, 0)
            pins.digitalWritePin(dA2, 0)
        }
    }

    //% block="DRV8833 motorB speed %speed"
    //% speed.min=-100 speed.max=100 speed.defl=0
    //% group="듀얼 H-브리지 DC 모터(DRV8833)" weight=85
    export function drv8833MotorB(speed: number): void {
        // 쉬는 쪽은 digitalWritePin 으로 내려 PWM 채널을 반납한다(위 A 모터와 동일 이유)
        let dB1 = <DigitalPin><number>_drv8833BIN1
        let dB2 = <DigitalPin><number>_drv8833BIN2
        // 범위를 벗어난 speed 변수는 pwm > 1023 이 되어 무시된다 — 미리 제한
        let pwm = Math.constrain(Math.abs(speed), 0, 100) * 10.23
        if (speed > 0) {
            pins.digitalWritePin(dB2, 0)
            pins.analogWritePin(_drv8833BIN1, pwm)
        } else if (speed < 0) {
            pins.digitalWritePin(dB1, 0)
            pins.analogWritePin(_drv8833BIN2, pwm)
        } else {
            pins.digitalWritePin(dB1, 0)
            pins.digitalWritePin(dB2, 0)
        }
    }

    /********** NEMA17 스테퍼 모터 **********/

    // 스테퍼 드라이버 타입
    export enum StepperDriver {
        //% block="driver(2pin)"
        Driver2Pin = 0,
        //% block="ULN2003(4pin)"
        ULN2003 = 1
    }

    // 스테퍼 이동 타입
    export enum StepperMoveType {
        //% block="move to absolute position"
        Absolute = 0,
        //% block="move to relative position"
        Relative = 1
    }

    // 스테퍼 동작
    export enum StepperAction {
        //% block="run"
        Run = 0,
        //% block="stop"
        Stop = 1
    }

    // 스테퍼 상태
    export enum StepperStatus {
        //% block="current position"
        Position = 0,
        //% block="running"
        Running = 1
    }

    // 스테퍼 모터 데이터 (최대 4개)
    let _stepperDirPin: DigitalPin[] = [DigitalPin.P0, DigitalPin.P0, DigitalPin.P0, DigitalPin.P0]
    let _stepperStepPin: DigitalPin[] = [DigitalPin.P1, DigitalPin.P1, DigitalPin.P1, DigitalPin.P1]
    let _stepperMaxSpeed: number[] = [1000, 1000, 1000, 1000]
    let _stepperAccel: number[] = [50, 50, 50, 50]
    let _stepperSpeed: number[] = [200, 200, 200, 200]
    let _stepperSteps: number[] = [200, 200, 200, 200]
    let _stepperPosition: number[] = [0, 0, 0, 0]
    let _stepperTarget: number[] = [0, 0, 0, 0]
    let _stepperRunning: boolean[] = [false, false, false, false]
    // 실행 세대 번호. 정지 직후 곧바로 다시 run 하면 이전 이동 루프가 아직
    // basic.pause 안에 살아 있어(이제 양보하므로) 두 루프가 같은 STEP 핀을
    // 동시에 두드릴 수 있다. 세대가 바뀌면 예전 루프는 스스로 빠져나간다.
    let _stepperGen: number[] = [0, 0, 0, 0]

    // 드라이버 종류 (이전에는 stepperSetup 의 driver 인자가 저장조차 되지 않았다)
    let _stepperDriver: number[] = [StepperDriver.Driver2Pin, StepperDriver.Driver2Pin,
                                    StepperDriver.Driver2Pin, StepperDriver.Driver2Pin]
    // ULN2003(4핀 유니폴라)용 코일 핀 + 현재 상(phase)
    let _stepperIn1: DigitalPin[] = [DigitalPin.P0, DigitalPin.P0, DigitalPin.P0, DigitalPin.P0]
    let _stepperIn2: DigitalPin[] = [DigitalPin.P0, DigitalPin.P0, DigitalPin.P0, DigitalPin.P0]
    let _stepperIn3: DigitalPin[] = [DigitalPin.P0, DigitalPin.P0, DigitalPin.P0, DigitalPin.P0]
    let _stepperIn4: DigitalPin[] = [DigitalPin.P0, DigitalPin.P0, DigitalPin.P0, DigitalPin.P0]
    let _stepperPhase: number[] = [0, 0, 0, 0]
    let _stepper4PinReady: boolean[] = [false, false, false, false]
    let _stepperErr: string = ""

    //% block="step motor(A4988) driver( %index ) driver %driver : DIRpin %dirPin . Steppin %stepPin set"
    //% index.min=1 index.max=4 index.defl=1
    //% group="Stepper Motors" weight=76
    //% inlineInputMode=inline
    export function stepperSetup(index: number, driver: StepperDriver, dirPin: DigitalPin, stepPin: DigitalPin): void {
        // 인자 순서 주의: 여기는 DIR 이 먼저다. 아두이노 AccelStepper 는
        // AccelStepper(DRIVER, pin1, pin2) 에서 pin1=STEP, pin2=DIR 이고
        // 소켓 이름도 Pin1/Pin2 로 중립이라 위치만 보고 그대로 옮기면 STEP 과 DIR 이
        // 뒤바뀐다(모터는 가만히 있고 DIR 핀만 펄스가 나간다). 이름표를 보고 꽂을 것.
        let i = index - 1
        _stepperDriver[i] = driver
        _stepperDirPin[i] = dirPin
        _stepperStepPin[i] = stepPin
        pins.digitalWritePin(dirPin, 0)
        pins.digitalWritePin(stepPin, 0)
        if (driver == StepperDriver.ULN2003 && !_stepper4PinReady[i]) {
            // ULN2003 은 코일 4개를 직접 구동하므로 2핀으로는 돌릴 수 없다.
            _stepperErr = "ULN2003 은 4핀 설정 블록(step motor ULN2003 set)이 필요합니다"
        } else {
            _stepperErr = ""
        }
    }

    //% block="step motor ULN2003 set( %index ) IN1 %in1 IN2 %in2 IN3 %in3 IN4 %in4"
    //% index.min=1 index.max=4 index.defl=1
    //% group="Stepper Motors" weight=75.5
    //% inlineInputMode=inline
    export function stepperSetupULN2003(index: number, in1: DigitalPin, in2: DigitalPin,
                                        in3: DigitalPin, in4: DigitalPin): void {
        let i = index - 1
        _stepperDriver[i] = StepperDriver.ULN2003
        _stepperIn1[i] = in1
        _stepperIn2[i] = in2
        _stepperIn3[i] = in3
        _stepperIn4[i] = in4
        _stepper4PinReady[i] = true
        _stepperPhase[i] = 0
        // 1회전 스텝수를 28BYJ-48 기준으로 맞춰 둔다.
        // 아두이노 steppermulti_setup 은 모터 종류가 28BYJ-48 이거나 ULN2003 이면
        // number_of_steps 를 무조건 2048 로 박는다(Custom 일 때만 200). 그 2048 은
        // 4상 풀스텝 기준이고, 여기 ULN2003 경로는 8상 하프스텝이라 한 바퀴가
        // 그 두 배인 4096 상(相) 전진이다. 예전에는 A4988 기본값 200 이 그대로 남아
        // "1바퀴 회전"이 약 17.6도만 돌았다.
        // ⚠ 여기서 채운 값은 "설정" 블록(stepperConfig)이 나중에 실행되면 그 블록의
        //   step set 값으로 덮인다. 그 칸의 기본값은 A4988 용 200 이라(설정 블록 하나를
        //   두 드라이버가 공유한다) 손대지 않고 배치하면 17.6도 문제가 그대로 돌아온다.
        //   → ULN2003 과 설정 블록을 같이 쓰면 step set 칸에 4096 을 직접 입력할 것.
        _stepperSteps[i] = 4096
        pins.digitalWritePin(in1, 0)
        pins.digitalWritePin(in2, 0)
        pins.digitalWritePin(in3, 0)
        pins.digitalWritePin(in4, 0)
        _stepperErr = ""
    }

    //% block="step motor last error"
    //% group="Stepper Motors" weight=71
    export function stepperLastError(): string {
        return _stepperErr
    }

    //% block="step motor %index : max speed %maxSpeed . acceleration %accel . speed set %speed . step set %steps"
    //% index.min=1 index.max=4 index.defl=1
    //% maxSpeed.defl=1000 accel.defl=50 speed.defl=200 steps.defl=200
    //% group="Stepper Motors" weight=75
    //% inlineInputMode=inline
    export function stepperConfig(index: number, maxSpeed: number, accel: number, speed: number, steps: number): void {
        // 속도 단위는 초당 스텝수(steps/s)다 — A4988 기준인 아두이노 AccelStepper 와 같다.
        // 아두이노의 StepperMulti(28BYJ-48) 쪽 속도 칸만 분당 회전수(RPM)이고 라이브러리가
        // number_of_steps 로 나눠 쓴다. 그쪽 교재 값을 그대로 옮기면 안 되고
        // steps/s = RPM x (1회전 스텝수) / 60 으로 환산해서 넣어야 한다.
        // ⚠ step set 칸의 기본값 200 은 A4988(NEMA17 풀스텝) 기준이다. 이 블록 하나를
        //   두 드라이버가 공유하므로 ULN2003/28BYJ-48 에 쓸 때는 4096 을 직접 입력해야 한다
        //   (여기 대입이 stepperSetupULN2003 이 넣어둔 4096 을 덮어쓴다).
        let i = index - 1
        _stepperMaxSpeed[i] = maxSpeed
        _stepperAccel[i] = accel
        _stepperSpeed[i] = speed
        _stepperSteps[i] = steps
    }

    //% block="step motor %index : %moveType %position"
    //% index.min=1 index.max=4 index.defl=1
    //% position.defl=200
    //% group="Stepper Motors" weight=74
    //% inlineInputMode=inline
    export function stepperMove(index: number, moveType: StepperMoveType, position: number): void {
        let i = index - 1
        if (moveType == StepperMoveType.Absolute) {
            _stepperTarget[i] = position
        } else {
            _stepperTarget[i] = _stepperPosition[i] + position
        }
    }

    // ULN2003 하프스텝 8상 시퀀스 (28BYJ-48 표준)
    function stepperPhaseWrite(i: number, phase: number): void {
        // 각 상에서 켤 코일을 비트로 표현: bit0=IN1, bit1=IN2, bit2=IN3, bit3=IN4
        // 이 표(IN1 → IN1+IN2 → IN2 → IN2+IN3 → …)를 바꾸지 말 것.
        // 아두이노 AccelStepper::step8 과 StepperMulti::stepMotor 는 pin1 → pin3 →
        // pin2 → pin4 순으로 상을 돌리지만, 그건 라이브러리 인자 번호 기준이라
        // "ULN2003 보드의 IN2 와 IN3 을 서로 바꿔 꽂는다"는 관례를 전제로 한다.
        // 아두이노 쪽 소켓 이름이 IN1~IN4 가 아니라 Pin1~Pin4 로 중립인 이유도 그것이다.
        // 여기 소켓 이름은 IN1~IN4 라 보드와 1:1 로 꽂으므로 위 순서가 물리적으로 맞다.
        // 이 표를 AccelStepper 마스크로 바꾸면 IN1+IN3(= 같은 상의 양 끝 코일)이 동시에
        // 켜져 자기장이 상쇄되고 모터가 제자리에서 떨기만 한다.
        const SEQ = [0x1, 0x3, 0x2, 0x6, 0x4, 0xC, 0x8, 0x9]
        let m = SEQ[phase & 7]
        pins.digitalWritePin(_stepperIn1[i], (m & 0x1) ? 1 : 0)
        pins.digitalWritePin(_stepperIn2[i], (m & 0x2) ? 1 : 0)
        pins.digitalWritePin(_stepperIn3[i], (m & 0x4) ? 1 : 0)
        pins.digitalWritePin(_stepperIn4[i], (m & 0x8) ? 1 : 0)
    }

    function stepperCoilsOff(i: number): void {
        pins.digitalWritePin(_stepperIn1[i], 0)
        pins.digitalWritePin(_stepperIn2[i], 0)
        pins.digitalWritePin(_stepperIn3[i], 0)
        pins.digitalWritePin(_stepperIn4[i], 0)
    }

    // control.waitMicros 는 스케줄러에 양보하지 않는 바쁜 대기(busy wait)라
    // 긴 대기에 쓰면 이동하는 동안 버튼·표시·통신이 전부 멈춘다(정지 블록도 못 받는다).
    // 1ms 이상은 basic.pause 로 넘겨 다른 fiber 가 돌 수 있게 한다.
    function stepperWait(us: number): void {
        // 문턱을 1ms 로 둔다. 4ms 로 두면 250 step/s 를 넘는 모든 속도가 통째로
        // 바쁜 대기가 되어 위 주석이 말하는 문제가 그대로 남는다.
        if (us >= 1000) {
            let ms = Math.idiv(us, 1000)
            basic.pause(ms)
            us = us - ms * 1000
        }
        // 남은 시간이 0 이면 waitMicros 를 호출하지 않는다.
        // 기본 속도 200 step/s 는 half=2500 → us=5000 이라 나머지가 정확히 0 이 되는데,
        // 대기 0 은 구현에 따라 카운터가 언더플로해 아주 오래 도는 사례가 알려져 있다.
        if (us > 0) control.waitMicros(us)
    }

    //% block="step motor %index : %action"
    //% index.min=1 index.max=4 index.defl=1
    //% group="Stepper Motors" weight=73
    export function stepperAction(index: number, action: StepperAction): void {
        let i = index - 1
        if (action != StepperAction.Run) {
            // 즉시 정지(비상 정지)다. 아두이노 AccelStepper::stop() 은 v²/(2a)+1 만큼
            // 목표를 밀어 감속 램프로 세우지만, 여기서는 정지가 곧바로 먹히는 쪽을 택했다
            // (기본값 speed 200 / accel 50 이면 램프 정지는 400 스텝, 약 2초가 더 걸린다).
            // 대신 부하가 크거나 빠를 때는 관성으로 몇 스텝 밀려 아래 current position
            // 값이 실제 축 위치와 어긋날 수 있다. 정밀한 위치가 필요하면 다시 원점을 잡을 것.
            _stepperRunning[i] = false
            if (_stepperDriver[i] == StepperDriver.ULN2003 && _stepper4PinReady[i]) stepperCoilsOff(i)
            return
        }

        if (_stepperDriver[i] == StepperDriver.ULN2003 && !_stepper4PinReady[i]) {
            _stepperErr = "ULN2003 은 4핀 설정 블록(step motor ULN2003 set)이 필요합니다"
            return
        }

        // 이제 이동 루프가 스케줄러에 양보하므로 이벤트 핸들러에서 다시 불릴 수 있다.
        // 이미 도는 중이면 무시해서 같은 모터에 루프가 겹치지 않게 한다.
        if (_stepperRunning[i]) return

        _stepperRunning[i] = true
        // 이 호출이 소유한 세대. 다른 fiber 가 stop 후 다시 run 하면 세대가 올라간다.
        _stepperGen[i] = _stepperGen[i] + 1
        let gen = _stepperGen[i]
        let delta = _stepperTarget[i] - _stepperPosition[i]
        let total = Math.abs(delta)
        let step = delta > 0 ? 1 : -1

        // 사다리꼴 속도 프로파일 — maxSpeed 와 accel 을 실제로 사용한다.
        //   v² = v0² + 2·a·s  (가속) / 끝에서 대칭으로 감속
        let a = Math.max(0, _stepperAccel[i])
        // 순항 속도는 아두이노 AccelStepper 와 맞춘다.
        //   run() → computeNewSpeed() 가 스텝 간격을 _cmin(=1e6/maxSpeed) 에서 잘라서
        //           순항 속도는 setMaxSpeed 값이다. setSpeed 값은 첫 계산에서 덮여 버리고
        //           가속 없는 등속 주행 runSpeed() 에서만 의미가 있다.
        // 그래서 가속도가 있으면 max speed 까지 올려 순항하고, 가속도가 0 이면
        // runSpeed() 처럼 speed set 값으로 등속 주행한다.
        // 예전에는 항상 min(speed, maxSpeed) 로 잘라서 같은 설정값(1000/50/200)이라도
        // 아두이노보다 5배 느리게 돌았고 max speed 칸은 아무 일도 하지 않았다.
        let vMax = a > 0
            ? Math.max(1, _stepperMaxSpeed[i])
            : Math.max(1, Math.min(_stepperSpeed[i], _stepperMaxSpeed[i]))
        let v0 = a > 0 ? Math.max(1, Math.min(vMax, Math.sqrt(2 * a))) : vMax
        // stepperWait 에 넘긴 대기가 1ms 미만이면 그 스텝은 전부 바쁜 대기라 스케줄러가 굶는다.
        // 순항 속도가 올라간 만큼 그 구간이 길어질 수 있으므로 그런 스텝을 세어 두었다가
        // 주기적으로 한 번 양보해 정지 블록·버튼 입력이 도착할 수 있게 한다(스텝 자체는 잃지 않는다).
        let busy = 0

        if (_stepperDriver[i] == StepperDriver.Driver2Pin) {
            pins.digitalWritePin(_stepperDirPin[i], delta > 0 ? 1 : 0)
        }

        for (let s = 0; s < total; s++) {
            // 세대가 바뀌었으면 새 이동이 시작된 것이므로 이 루프는 조용히 물러난다.
            if (!_stepperRunning[i] || _stepperGen[i] != gen) break

            let v = vMax
            if (a > 0) {
                let vUp = Math.sqrt(v0 * v0 + 2 * a * s)               // 가속 구간
                let vDn = Math.sqrt(v0 * v0 + 2 * a * (total - 1 - s)) // 감속 구간
                v = Math.min(vMax, Math.min(vUp, vDn))
                if (v < 1) v = 1
            }
            let half = Math.max(1, Math.idiv(1000000, Math.round(v) * 2))
            // 이번 스텝에서 stepperWait 에 실제로 넘긴 대기 시간.
            // 양보 여부는 반드시 이 값으로 판정한다(아래 주석 참조).
            let rest = half * 2

            if (_stepperDriver[i] == StepperDriver.ULN2003) {
                _stepperPhase[i] = (_stepperPhase[i] + (step > 0 ? 1 : 7)) & 7
                stepperPhaseWrite(i, _stepperPhase[i])
                stepperWait(rest)
            } else {
                // STEP 펄스(HIGH)는 짧게 유지하고 남는 시간은 LOW 쪽에 몰아준다.
                // A4988 은 상승 에지로 동작하므로 토크·타이밍에는 영향이 없다.
                let hi = Math.min(half, 100)
                pins.digitalWritePin(_stepperStepPin[i], 1)
                control.waitMicros(hi)
                pins.digitalWritePin(_stepperStepPin[i], 0)
                rest = half * 2 - hi
                stepperWait(rest)
            }
            _stepperPosition[i] += step

            // stepperWait 은 인자가 1000μs 이상일 때만 basic.pause 로 양보한다.
            // A4988 경로는 HIGH 시간(hi, 최대 100μs)을 뺀 나머지를 넘기므로
            // 여기서 half*2 로 판정하면 스텝 주기 1000~1099μs 구간
            // (약 910~1000 step/s — 기본 max speed 1000 이 바로 여기다)에
            // "stepperWait 도 양보 안 하고 busy 카운터도 안 도는" 구멍이 생긴다.
            // 그러면 순항 내내 한 번도 양보하지 못해 정지 블록·버튼 이벤트가 영영 도착하지 않는다.
            if (rest < 1000) {
                busy = busy + 1
                if (busy >= 64) {
                    busy = 0
                    basic.pause(1)
                }
            } else {
                busy = 0
            }
        }

        // 뒷정리는 아직 내가 현재 세대일 때만 한다. 남의 이동을 꺼버리면 안 된다.
        if (_stepperGen[i] == gen) {
            _stepperRunning[i] = false
            // 유니폴라는 정지 후 코일에 계속 전류가 흐르면 발열하므로 끈다
            if (_stepperDriver[i] == StepperDriver.ULN2003) stepperCoilsOff(i)
        }
    }

    //% block="step motor %index : rotate %revolutions turns"
    //% index.min=1 index.max=4 index.defl=1
    //% revolutions.defl=1
    //% group="Stepper Motors" weight=73.5
    //% inlineInputMode=inline
    export function stepperMoveRevolutions(index: number, revolutions: number): void {
        // stepperConfig 의 "step set"(1회전 스텝수)을 실제로 사용한다
        let i = index - 1
        _stepperTarget[i] = _stepperPosition[i] + Math.round(revolutions * _stepperSteps[i])
    }

    //% block="step motor %index : %status"
    //% index.min=1 index.max=4 index.defl=1
    //% group="Stepper Motors" weight=72
    export function stepperGetStatus(index: number, status: StepperStatus): number {
        let i = index - 1
        if (status == StepperStatus.Position) {
            return _stepperPosition[i]
        }
        return _stepperRunning[i] ? 1 : 0
    }

    /********** MG996R 서보 모터 **********/

    // 서보 통합 구현 — 설정은 핀별로 보관한다.
    // (이전에는 _servoNeutralStop 이 전역 하나뿐이라 servoSetNeutralStop 의 pin 인자가 무시됐고,
    //  servoSetRange 는 범위를 저장하지 않고 서보를 minAngle 로 즉시 움직여버렸다.)
    let _servoPins: number[] = []
    let _servoMin: number[] = []
    let _servoMax: number[] = []
    let _servoNeutral: boolean[] = []

    // 핀별 설정 슬롯 확보 (없으면 기본값으로 생성)
    function servoSlot(pin: AnalogPin): number {
        let p = pin as number
        let i = _servoPins.indexOf(p)
        if (i < 0) {
            i = _servoPins.length
            _servoPins.push(p)
            _servoMin.push(0)
            _servoMax.push(180)
            _servoNeutral.push(false)
        }
        return i
    }

    //% block="servo %pin servo's angle %angle (°) set to"
    //% angle.min=0 angle.max=180 angle.defl=90
    //% group="Servo Motors" weight=82
    //% inlineInputMode=inline
    export function servoSetAngle(pin: AnalogPin, angle: number): void {
        let i = servoSlot(pin)
        // 펄스 대역 차이를 알아둘 것: servoWritePin 은 CODAL 기본값대로 0°=500μs,
        // 180°=2500μs 로 나가고, 아두이노 쪽 Servo::write 는 attach(pin) 이 강제로
        // 544~2400 을 잡아서(브릭셀이 GeekServo 때문에 MAX 를 5000 으로 넓히면서
        // 일반 서보 보호용으로 넣은 값) 0°=544μs, 180°=2400μs 다.
        // 여기서 544~2400 으로 바꾸면 아래 servoSetSpeed / servoStop 의 중립(90°)이
        // 1500μs 에서 1472μs 로 밀려 연속회전 서보가 멈추지 않고 기어 나가므로
        // 그대로 둔다. 각도 눈금이 아두이노판과 미세하게 다른 것은 이 때문이다.
        // servoSetRange 로 정한 범위 안으로 제한
        pins.servoWritePin(pin, Math.constrain(angle, _servoMin[i], _servoMax[i]))
    }

    //% block="servo %pin continuous servo rotation speed %speed \\% set to"
    //% speed.min=-100 speed.max=100 speed.defl=50
    //% group="Servo Motors" weight=81
    //% inlineInputMode=inline
    export function servoSetSpeed(pin: AnalogPin, speed: number): void {
        // -100~100을 0~180으로 변환 (90이 정지)
        let i = servoSlot(pin)
        let angle = Math.map(speed, -100, 100, 0, 180)
        pins.servoWritePin(pin, Math.constrain(angle, _servoMin[i], _servoMax[i]))
    }

    //% block="servo %pin stop"
    //% group="Servo Motors" weight=80
    export function servoStop(pin: AnalogPin): void {
        let i = servoSlot(pin)
        // servoSetRange 로 좁혀둔 범위를 여기서도 지킨다.
        // (예전에는 90도를 그대로 써서 가동 범위 밖으로 밀어붙였다)
        pins.servoWritePin(pin, Math.constrain(90, _servoMin[i], _servoMax[i]))
        if (_servoNeutral[i]) {
            // 펄스를 끊고 PWM 채널까지 반납한다(micro:bit 동시 PWM 채널 수 제한).
            // servoSetPulse(pin, 0) 은 핀을 아날로그 출력 상태로 남겨 채널을 계속 물고 있다.
            pins.digitalWritePin(<DigitalPin><number>pin, 0)
        }
    }

    //% block="set servo %pin stop on neutral %enable"
    //% enable.shadow="toggleOnOff" enable.defl=false
    //% group="Servo Motors" weight=79
    export function servoSetNeutralStop(pin: AnalogPin, enable: boolean): void {
        // 핀별로 보관 — 서보마다 따로 지정할 수 있다
        _servoNeutral[servoSlot(pin)] = enable
    }

    //% block="servo servo %pin 's angle %minAngle from %maxAngle through rangeset to"
    //% minAngle.defl=0 maxAngle.defl=180
    //% group="Servo Motors" weight=78
    //% inlineInputMode=inline
    export function servoSetRange(pin: AnalogPin, minAngle: number, maxAngle: number): void {
        // 범위만 저장한다. 이 블록은 서보를 움직이지 않는다.
        // 이후 servoSetAngle / servoSetSpeed 가 이 범위로 각도를 제한한다.
        // ⚠ 아두이노의 attach_servo_minmax 와 이름만 비슷하고 단위가 다르다.
        //   그쪽 min/max 는 펄스폭(μs, 기본 500/2500)이라 attach 가 0~180도 전체를
        //   그 펄스 대역에 다시 매핑한다(모든 각도가 여전히 도달 가능). 여기 값은 각도(0~180°)라
        //   도달 범위 자체를 좁힌다. 그래서 1000/2000 같은 μs 값을 그대로 넣으면
        //   아래 constrain 이 둘 다 180 으로 잘라 서보가 한쪽 끝에 붙어 움직이지 않는다.
        //   이식할 때는 반드시 각도로 환산해서 넣을 것.
        let i = servoSlot(pin)
        let lo = Math.constrain(Math.min(minAngle, maxAngle), 0, 180)
        let hi = Math.constrain(Math.max(minAngle, maxAngle), 0, 180)
        _servoMin[i] = lo
        _servoMax[i] = hi
    }

    //% block="servo %pin angle range min"
    //% group="Servo Motors" weight=77.6
    export function servoGetRangeMin(pin: AnalogPin): number {
        return _servoMin[servoSlot(pin)]
    }

    //% block="servo %pin angle range max"
    //% group="Servo Motors" weight=77.5
    export function servoGetRangeMax(pin: AnalogPin): number {
        return _servoMax[servoSlot(pin)]
    }

    //% block="servo %pin servo's pulse %pulse (μs) set to"
    //% pulse.defl=1500
    //% group="Servo Motors" weight=77
    //% inlineInputMode=inline
    export function servoSetPulse(pin: AnalogPin, pulse: number): void {
        // 일부러 제한하지 않는 저수준 출구다. 아두이노 writeMicroseconds 는 attach 범위
        // (set_servo_microseconds 는 attach(pin) 이라 544~2400)로 잘라내지만,
        // micro:bit 의 servoSetPulse 는 20ms 주기에 대한 듀티로 변환할 뿐 잘라내지 않는다.
        // 아래 GeekServo 5Kg 모터 모드(3000~5000μs)가 성립하는 이유가 바로 이것이라
        // 여기에 544~2400 제한을 넣지 않는다. 대신 일반 서보에 3000μs 같은 값을 주면
        // 아두이노판과 달리 보호받지 못하니 사용자가 값을 책임져야 한다.
        pins.servoSetPulse(pin, pulse)
    }

    /********** 5Kg GeekServo (360도 서보/DC모터 모드) **********/

    // GeekServo 방향
    export enum GeekServoDir {
        //% block="forward (CW)"
        CW = 0,
        //% block="backward (CCW)"
        CCW = 1
    }

    //% block="5Kg GeekServo setup pin %pin"
    //% group="5Kg GeekServo" weight=60
    export function geekServoSetup(pin: AnalogPin): void {
        // 초기 중립 펄스 전송하여 서보 초기화
        pins.servoSetPulse(pin, 1500)
    }

    //% block="5Kg GeekServo pin %pin set angle %degrees (0~360)"
    //% degrees.min=0 degrees.max=360 degrees.defl=0
    //% group="5Kg GeekServo" weight=59
    //% inlineInputMode=inline
    export function geekServoAngle360(pin: AnalogPin, degrees: number): void {
        if (degrees < 0) degrees = 0
        if (degrees > 360) degrees = 360

        // 구간별 매핑 (Piecewise Mapping) - Arduino 라이브러리와 동일
        let p0 = 500
        let p90 = 990
        let p180 = 1510
        let p270 = 2020
        let p360 = 2500
        let us = 1500

        if (degrees <= 90) {
            us = Math.map(degrees, 0, 90, p0, p90)
        } else if (degrees <= 180) {
            us = Math.map(degrees, 90, 180, p90, p180)
        } else if (degrees <= 270) {
            us = Math.map(degrees, 180, 270, p180, p270)
        } else {
            us = Math.map(degrees, 270, 360, p270, p360)
        }

        pins.servoSetPulse(pin, us)
    }

    //% block="5Kg GeekServo wheel pin %pin speed %speed direction %dir"
    //% speed.min=0 speed.max=100 speed.defl=100
    //% group="5Kg GeekServo" weight=58
    //% inlineInputMode=inline
    export function geekServoWheel(pin: AnalogPin, speed: number, dir: GeekServoDir): void {
        if (speed < 0) speed = 0
        if (speed > 100) speed = 100

        // ★ 3000~5000μs 가 맞다. RC 서보의 일반 범위(500~2500)를 벗어나 보이지만,
        //   긱서보 5Kg 의 "모터 모드"는 실제로 이 대역을 쓴다. 브릭셀 아두이노 라이브러리의
        //   Servo::writeGeekWheel (Servo.cpp) 이 중립 4000 / CW 4000→5000 / CCW 4000→3000
        //   으로 구현되어 있고, 생성기는 servo.attach(pin, 500, 5000) 으로 상한을 열어 둔다.
        //   같은 부품인데 geekServoAngle360 이 500~2500 을 쓰는 것은 모순이 아니라
        //   각도 모드와 모터 모드의 프로토콜이 서로 다르기 때문이다(라이브러리도 함수가 따로다).
        let us = 4000 // 중립 (정지)
        if (dir == GeekServoDir.CW) {
            us = Math.map(speed, 0, 100, 4000, 5000)
        } else {
            us = Math.map(speed, 0, 100, 4000, 3000)
        }

        pins.servoSetPulse(pin, us)
    }

    //% block="5Kg GeekServo wheel pin %pin speed %speed direction %dir duration %duration ms"
    //% speed.min=0 speed.max=100 speed.defl=100
    //% duration.defl=1000
    //% group="5Kg GeekServo" weight=57
    //% inlineInputMode=inline
    export function geekServoWheelTimed(pin: AnalogPin, speed: number, dir: GeekServoDir, duration: number): void {
        geekServoWheel(pin, speed, dir)
        basic.pause(duration)
        geekServoWheel(pin, 0, GeekServoDir.CW)
    }

    //% block="5Kg GeekServo stop pin %pin"
    //% group="5Kg GeekServo" weight=56
    export function geekServoStop(pin: AnalogPin): void {
        // 긱서보 5Kg 모터 모드의 정지값은 4000μs 다 (Servo::writeGeekWheel(0, cw) 와 동일)
        pins.servoSetPulse(pin, 4000)
    }


    /********** Green GeekServo (연속회전 서보, 500~2500μs) **********/

    //% block="Green GeekServo setup pin %pin"
    //% group="Green GeekServo" weight=55
    export function greenGeekServoSetup(pin: AnalogPin): void {
        pins.servoSetPulse(pin, 1500)
    }

    //% block="Green GeekServo wheel pin %pin speed %speed direction %dir"
    //% speed.min=0 speed.max=100 speed.defl=100
    //% group="Green GeekServo" weight=54
    //% inlineInputMode=inline
    export function greenGeekServoWheel(pin: AnalogPin, speed: number, dir: GeekServoDir): void {
        if (speed < 0) speed = 0
        if (speed > 100) speed = 100

        let us = 1500 // 중립 (정지)
        if (dir == GeekServoDir.CW) {
            us = Math.map(speed, 0, 100, 1500, 2500)
        } else {
            us = Math.map(speed, 0, 100, 1500, 500)
        }

        pins.servoSetPulse(pin, us)
    }

    //% block="Green GeekServo wheel pin %pin speed %speed direction %dir duration %duration ms"
    //% speed.min=0 speed.max=100 speed.defl=100
    //% duration.defl=1000
    //% group="Green GeekServo" weight=53
    //% inlineInputMode=inline
    export function greenGeekServoWheelTimed(pin: AnalogPin, speed: number, dir: GeekServoDir, duration: number): void {
        greenGeekServoWheel(pin, speed, dir)
        basic.pause(duration)
        greenGeekServoWheel(pin, 0, GeekServoDir.CW)
    }

    //% block="Green GeekServo stop pin %pin"
    //% group="Green GeekServo" weight=52
    export function greenGeekServoStop(pin: AnalogPin): void {
        pins.servoSetPulse(pin, 1500)
    }


    /********** DC모터 드라이버 (PCA9685) **********/

    // PCA9685 상태 저장
    let _pca9685Addr: number[] = [0x40, 0x40, 0x40, 0x40]
    let _pca9685Initialized: boolean[] = [false, false, false, false]

    // PCA9685 레지스터
    const PCA9685_MODE1 = 0x00
    const PCA9685_PRESCALE = 0xFE
    const PCA9685_LED0_ON_L = 0x06

    // PCA9685 채널 하나에 PWM 설정
    function pca9685SetPWM(addr: number, channel: number, on: number, off: number): void {
        let reg = PCA9685_LED0_ON_L + 4 * channel
        let buf = pins.createBuffer(5)
        buf[0] = reg
        buf[1] = on & 0xFF
        buf[2] = (on >> 8) & 0xFF
        buf[3] = off & 0xFF
        buf[4] = (off >> 8) & 0xFF
        pins.i2cWriteBuffer(addr, buf)
    }

    // PCA9685 채널에 값 설정 (0~4095)
    function pca9685SetPin(addr: number, channel: number, value: number): void {
        if (value >= 4095) {
            pca9685SetPWM(addr, channel, 4096, 0)
        } else if (value <= 0) {
            // 완전 OFF 는 OFF 카운트에 4096 을 쓴다 — 아두이노
            // Adafruit_PWMServoDriver::setPin 의 val==0 → setPWM(num, 0, 4096) 과 동일.
            // 4096 은 LEDn_OFF_H 의 full-OFF 비트라 카운터 비교기보다 우선한다.
            // 예전처럼 ON=OFF=0 을 쓰면 데이터시트에 정의되지 않은 상태라
            // H-브리지 방향 핀에 매 주기 1틱짜리 글리치(순간 구동)가 남을 수 있다.
            pca9685SetPWM(addr, channel, 0, 4096)
        } else {
            pca9685SetPWM(addr, channel, 0, value)
        }
    }

    // PCA9685 초기화
    // 아두이노 Adafruit_PWMServoDriver 의 reset() + setPWMFreq(1000) 순서를 그대로 따른다.
    function pca9685Init(addr: number): void {
        pca9685RememberFrequency(addr, 1000)
        // reset(): MODE1 에 RESTART(0x80) 를 쓰고 10ms 대기
        let buf = pins.createBuffer(2)
        buf[0] = PCA9685_MODE1
        buf[1] = 0x80
        pins.i2cWriteBuffer(addr, buf)
        basic.pause(10)

        // setPWMFreq(): 프리스케일은 SLEEP 상태에서만 바꿀 수 있다
        buf[0] = PCA9685_MODE1
        buf[1] = 0x10 // sleep
        pins.i2cWriteBuffer(addr, buf)

        // Set prescale for ~1000Hz (for DC motor PWM)
        // prescale = round(25MHz / (4096 * freq)) - 1
        // for 1000Hz: round(25000000 / (4096 * 1000)) - 1 = 5
        buf[0] = PCA9685_PRESCALE
        buf[1] = 5
        pins.i2cWriteBuffer(addr, buf)

        // SLEEP 해제와 RESTART 는 반드시 두 번에 나눠 쓴다.
        // 데이터시트가 SLEEP 을 푼 뒤 내부 발진기가 안정될 때까지(약 500μs) 기다렸다가
        // RESTART 비트를 세우라고 요구하므로, 예전처럼 한 바이트(0xA0)에 몰아 쓰면
        // RESTART 요청이 그냥 버려진다. 아두이노도 oldmode 쓰기 → delay(5) →
        // oldmode|RESTART|AI 쓰기 로 두 번에 나눈다.
        buf[0] = PCA9685_MODE1
        buf[1] = 0x00 // wake (SLEEP 해제)
        pins.i2cWriteBuffer(addr, buf)
        basic.pause(5)

        buf[0] = PCA9685_MODE1
        buf[1] = 0xA0 // RESTART + 자동증가(AI)
        pins.i2cWriteBuffer(addr, buf)
        basic.pause(5)
    }

    // 설정 블록을 빼먹으면 칩이 전원 직후 상태(SLEEP=1, 자동증가 OFF)로 남아
    // 모든 레지스터 쓰기가 LED0_ON_L 한 곳에 쏟아져 조용히 망가진다.
    // _pca9685Initialized 는 기록만 하고 아무도 읽지 않았으므로 여기서 사용한다.
    function pca9685Ensure(i: number): number {
        if (i < 0 || i > 3 || i != Math.floor(i)) return -1
        if (!_pca9685Initialized[i] || pca9685Frequency(_pca9685Addr[i]) != 1000) {
            pca9685Init(_pca9685Addr[i])
            _pca9685Initialized[i] = true
        }
        return _pca9685Addr[i]
    }

    // PCA9685 모터 정지 대상
    export enum PCA9685StopTarget {
        //% block="All"
        All = 0,
        //% block="Wheel A"
        WheelA = 1,
        //% block="Wheel B"
        WheelB = 2
    }

    //% block="DC Motor Driver(PCA9685) %index I2C address %addr"
    //% index.min=1 index.max=4 index.defl=1
    //% addr.defl=0x40
    //% group="DC모터 드라이버(PCA9685)" weight=50
    //% inlineInputMode=inline
    export function pca9685DcMotorSetup(index: number, addr: number): void {
        if (index < 1 || index > 4 || index != Math.floor(index) || addr < 0x40 || addr > 0x7f || addr == 0x70 || addr != Math.floor(addr)) return
        let i = index - 1
        _pca9685Addr[i] = addr
        pca9685Init(addr)
        _pca9685Initialized[i] = true
    }

    //% block="Motor Driver %index Wheel A direction %dir speed %speed \\%"
    //% index.min=1 index.max=4 index.defl=1
    //% dir.min=0 dir.max=1 dir.defl=0
    //% speed.min=0 speed.max=100 speed.defl=50
    //% group="DC모터 드라이버(PCA9685)" weight=49
    //% inlineInputMode=inline
    export function pca9685DcMotorWheelA(index: number, dir: number, speed: number): void {
        let i = index - 1
        let addr = pca9685Ensure(i)
        if (addr < 0) return
        let spd = Math.map(Math.constrain(speed, 0, 100), 0, 100, 0, 4095)

        // CH0: IN1, CH1: PWM(속도), CH2: IN2
        if (dir == 0) {
            pca9685SetPin(addr, 0, 4095)
            pca9685SetPin(addr, 1, spd)
            pca9685SetPin(addr, 2, 0)
        } else {
            pca9685SetPin(addr, 0, 0)
            pca9685SetPin(addr, 1, spd)
            pca9685SetPin(addr, 2, 4095)
        }
    }

    //% block="Motor Driver %index Wheel B direction %dir speed %speed \\%"
    //% index.min=1 index.max=4 index.defl=1
    //% dir.min=0 dir.max=1 dir.defl=0
    //% speed.min=0 speed.max=100 speed.defl=50
    //% group="DC모터 드라이버(PCA9685)" weight=48
    //% inlineInputMode=inline
    export function pca9685DcMotorWheelB(index: number, dir: number, speed: number): void {
        let i = index - 1
        let addr = pca9685Ensure(i)
        if (addr < 0) return
        let spd = Math.map(Math.constrain(speed, 0, 100), 0, 100, 0, 4095)

        // CH3: IN1, CH4: PWM(속도), CH5: IN2 - B모터 방향 반전
        if (dir == 0) {
            pca9685SetPin(addr, 3, 0)
            pca9685SetPin(addr, 4, spd)
            pca9685SetPin(addr, 5, 4095)
        } else {
            pca9685SetPin(addr, 3, 4095)
            pca9685SetPin(addr, 4, spd)
            pca9685SetPin(addr, 5, 0)
        }
    }

    //% block="Motor Driver %index stop %target"
    //% index.min=1 index.max=4 index.defl=1
    //% group="DC모터 드라이버(PCA9685)" weight=47
    //% inlineInputMode=inline
    export function pca9685DcMotorStop(index: number, target: PCA9685StopTarget): void {
        let i = index - 1
        let addr = pca9685Ensure(i)
        if (addr < 0) return

        if (target == PCA9685StopTarget.All || target == PCA9685StopTarget.WheelA) {
            pca9685SetPin(addr, 0, 0)
            pca9685SetPin(addr, 1, 0)
            pca9685SetPin(addr, 2, 0)
        }
        if (target == PCA9685StopTarget.All || target == PCA9685StopTarget.WheelB) {
            pca9685SetPin(addr, 3, 0)
            pca9685SetPin(addr, 4, 0)
            pca9685SetPin(addr, 5, 0)
        }
    }

    //% block="Motor Driver %index Wheel A direction %dir speed %speed \\% duration %duration ms"
    //% index.min=1 index.max=4 index.defl=1
    //% dir.min=0 dir.max=1 dir.defl=0
    //% speed.min=0 speed.max=100 speed.defl=50
    //% duration.defl=1000
    //% group="DC모터 드라이버(PCA9685)" weight=46
    //% inlineInputMode=inline
    export function pca9685DcMotorWheelATimed(index: number, dir: number, speed: number, duration: number): void {
        pca9685DcMotorWheelA(index, dir, speed)
        basic.pause(duration)
        pca9685DcMotorStop(index, PCA9685StopTarget.WheelA)
    }

    //% block="Motor Driver %index Wheel B direction %dir speed %speed \\% duration %duration ms"
    //% index.min=1 index.max=4 index.defl=1
    //% dir.min=0 dir.max=1 dir.defl=0
    //% speed.min=0 speed.max=100 speed.defl=50
    //% duration.defl=1000
    //% group="DC모터 드라이버(PCA9685)" weight=45
    //% inlineInputMode=inline
    export function pca9685DcMotorWheelBTimed(index: number, dir: number, speed: number, duration: number): void {
        pca9685DcMotorWheelB(index, dir, speed)
        basic.pause(duration)
        pca9685DcMotorStop(index, PCA9685StopTarget.WheelB)
    }


    // 28BYJ-48, NEMA17은 위의 통합 스테퍼 시스템 사용



    /********** L9110 DC 모터 **********/
    /*
     * L9110/L9110S 는 IN 2핀으로 방향과 속도를 동시에 정한다.
     *   정방향       : A = PWM , B = LOW
     *   역방향       : A = LOW , B = PWM
     *   정지(코스트) : 둘 다 LOW
     *   브레이크     : 둘 다 HIGH
     * ★ 쓰지 않는 쪽은 analogWritePin(…, 0) 대신 digitalWritePin 으로 내린다.
     *   micro:bit 는 동시 PWM 채널이 적어(문서상 3개) 값이 0 이어도 채널을 잡아먹기 때문.
     */

    export enum L9110Dir {
        //% block="forward"
        Forward = 0,
        //% block="backward"
        Backward = 1,
        //% block="stop"
        Stop = 2,
        //% block="brake"
        Brake = 3
    }

    //% block="L9110 motor IN-A %pinA IN-B %pinB %dir speed %speed \\%"
    //% speed.min=0 speed.max=100 speed.defl=60
    //% group="DC모터(L9110)" weight=95
    //% inlineInputMode=inline
    export function l9110Motor(pinA: AnalogPin, pinB: AnalogPin, dir: L9110Dir, speed: number): void {
        let dA = <DigitalPin><number>pinA
        let dB = <DigitalPin><number>pinB
        // speed 는 0~100 퍼센트다(micro:bit 관례). 아두이노 쪽 L9110 블록의 속도 칸은
        // analogWrite 원값 0~255 라(기본값 150 ≈ 59%) 그 값을 그대로 옮기면
        // 여기서는 전부 100% 로 잘린다. 방향 매핑은 아두이노와 같다
        // (Clockwise = A 에 PWM / B LOW, 정지 = 둘 다 LOW = 코스트).
        // brake(둘 다 HIGH)는 아두이노판에 없는 micro:bit 전용 추가 동작이다.
        let pwm = Math.round(Math.map(Math.constrain(speed, 0, 100), 0, 100, 0, 1023))

        if (dir == L9110Dir.Forward) {
            pins.digitalWritePin(dB, 0)
            pins.analogWritePin(pinA, pwm)
        } else if (dir == L9110Dir.Backward) {
            pins.digitalWritePin(dA, 0)
            pins.analogWritePin(pinB, pwm)
        } else if (dir == L9110Dir.Brake) {
            pins.digitalWritePin(dA, 1)
            pins.digitalWritePin(dB, 1)
        } else {
            pins.digitalWritePin(dA, 0)
            pins.digitalWritePin(dB, 0)
        }
    }
}