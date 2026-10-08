// Continuation of 04_adv_sensors.ts. See SOURCES.md for packaging details.
namespace AdvSensors {

    /**
     * I2C 무게센서 사용 가능 여부 확인
     */
    //% block="I2C Weight Sensor is available"
    //% group="I2C 무게센서" weight=56
    export function i2cWeightIsAvailable(): boolean {
        i2cWeightRaw()
        return !_i2cWeightBad
    }

    /**
     * I2C 무게센서 원시 바이트 읽기
     * @param byteType 읽을 바이트 위치
     */
    //% block="I2C Weight Sensor read raw byte $byteType"
    //% byteType.defl=I2CWeightByte.DataHigh
    //% group="I2C 무게센서" weight=55
    export function i2cWeightReadByte(byteType: I2CWeightByte): number {
        let b = pins.i2cReadBuffer(_i2cWeightAddr, 3)
        let i = byteType
        if (i < 0 || i > 2 || b.length < 3) return 0
        return b[i]
    }

    /**
     * I2C 무게센서 영점 조정
     * @param samples 평균낼 샘플 수, eg: 10
     */
    //% block="I2C Weight Sensor tare samples $samples"
    //% samples.defl=10 samples.min=1 samples.max=50
    //% group="I2C 무게센서" weight=54
    export function i2cWeightTare(samples: number): void {
        let n = Math.clamp(1, 50, Math.floor(samples))
        let sum = 0
        let got = 0
        for (let k = 0; k < n; k++) {
            let v = i2cWeightRaw()
            if (!_i2cWeightBad) {
                sum += v
                got++
            }
            basic.pause(20)
        }
        // 한 번도 유효한 값을 못 받았으면 영점을 건드리지 않는다(0 으로 덮으면 무게가 튄다)
        if (got > 0) _i2cWeightOffset = sum / got
    }

    /**
     * I2C 무게센서 배율 설정 (원시값 → 사용자 단위)
     * @param scale 배율, eg: 1
     */
    //% block="I2C Weight Sensor set scale $scale"
    //% scale.defl=1
    //% group="I2C 무게센서" weight=53
    export function i2cWeightSetScale(scale: number): void {
        // 0 을 넣으면 read 에서 0 나눗셈이 되므로 막는다
        _i2cWeightScale = scale == 0 ? 1 : scale
    }

    /**
     * 마지막 읽기가 실패했는지 (모듈 없음/무효 프레임)
     */
    //% block="I2C weight sensor timed out?"
    //% group="I2C 무게센서" weight=52
    export function i2cWeightTimedOut(): boolean {
        return _i2cWeightBad
    }
}
