// ⚠ 자동 생성 — 사이언스랩 water-driver.ts 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것(사이언스랩을 고치고 다시 sync).
// Adapted from BRIXEL (MIT), 03_sensors.ts. See _sources/manifest.json.
namespace slxWaterDriver {
    /********** DS18B20 센서 **********/

    // 온도 단위 (DS18B20용)
    export enum DS18B20Unit {

        Celsius = 0,

        Fahrenheit = 1
    }

    // DS18B20 데이터 저장 변수
    let _ds18b20Pin: DigitalPin = DigitalPin.P2
    let _ds18b20Temps: number[] = []
    let _ds18b20Count: number = 0


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


    export function ds18b20StartConversion(): boolean {
        // 셋업 블록을 쓰지 않은 프로그램을 위해, 아직 열거 전이면 여기서 한 번 훑는다.
        // (예전에는 프레즌스만 보고 _ds18b20Count 를 1 로 조작해서, 프로브가 2개여도
        //  항상 1개라고 보고했다)
        if (_ds18b20Count == 0) ds18b20Search()

        // 1-Wire 리셋 (버스 유휴 확인 + 프레즌스 검출은 ds18b20Reset 이 담당)
        if (!ds18b20Reset()) return false

        // Skip ROM (0xCC) - 모든 센서에 명령
        ds18b20WriteByte(0xCC)
        // Convert T (0x44) - 온도 변환 시작
        ds18b20WriteByte(0x44)

        // 변환 대기 (750ms for 12-bit)
        basic.pause(750)
        return true
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
            pins.digitalReadPin(_ds18b20Pin)
            control.waitMicros(64)
        } else {
            pins.digitalWritePin(_ds18b20Pin, 0)
            control.waitMicros(60)
            pins.digitalReadPin(_ds18b20Pin)
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

            while (found < 3) {
                if (!ds18b20SearchStep(rom)) break
                if (rom[0] != 0x28) { if (_dsLastDeviceFlag) break; continue }
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



    export function ds18b20ReadTemp(index: number, unit: DS18B20Unit): number {
        // 프레즌스 결과를 버리면 안 된다. 센서가 없을 때 0xFF/0xFF 를 읽어
        // -0.06°C 라는 그럴듯한 가짜 값이 나오기 때문.
        // ★ 실패값으로 0 을 쓰면 안 된다 — 이건 '물온도' 블록이고 0°C(얼음물)는 교실에서
        //   실제로 나올 수 있는 값이라 학생이 진짜 측정값으로 믿는다. 아두이노판
        //   DallasTemperature 와 동일하게 측정 범위(-55~125) 밖의 표식값을 돌려준다.
        //   DEVICE_DISCONNECTED_C = -127, DEVICE_DISCONNECTED_F = -196.6
        if (index < 0 || index >= _ds18b20Count || !ds18b20Reset()) return unit == DS18B20Unit.Fahrenheit ? -196.6 : -127

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
        if (ds18b20Crc8(sp, 9) != 0 || (sp[4] & 0x9F) != 0x1F) return unit == DS18B20Unit.Fahrenheit ? -196.6 : -127

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
                pins.digitalReadPin(_ds18b20Pin)
                control.waitMicros(64)
            } else {
                // Write 0
                pins.digitalWritePin(_ds18b20Pin, 0)
                control.waitMicros(60)
                pins.digitalReadPin(_ds18b20Pin)
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



}
