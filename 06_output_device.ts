/**
 * BRIXEL Extension - 06. Output Device
 * Buzzer, MP3 Player, EEPROM
 *
 * 2026-07-26: SD \uce74\ub4dc \ube14\ub85d \uc81c\uac70(\uc2e4\uae30 \uac80\uc99d \ubd88\uac00), \ub9c8\uc774\ud06c\ub85c\ud3f0 \ube14\ub85d \uc81c\uac70(\ub2e8\uc21c \uc544\ub0a0\ub85c\uadf8 \uc785\ub825).
 */

//% weight=1050 color=#50B91A icon="\uf028" block="06. Output Device"
//% groups='["Buzzer","MP3 Player (KT403A)","MP3 Player (DFPlayer)","EEPROM"]'
namespace OutputDevice {


    /********** 부저/스피커 **********/

    // 음악 연주 기능 (패시브 부저, 스피커용)
    // 액티브 부저는 단순 ON/OFF만 가능하므로 음악 연주 불가

    // 음표 (옥타브 4 기준)
    export enum MusicNote {
        //% block="C(C4)"
        C4 = 262,
        //% block="C#(C#4)"
        CS4 = 277,
        //% block="D(D4)"
        D4 = 294,
        //% block="D#(D#4)"
        DS4 = 311,
        //% block="E(E4)"
        E4 = 330,
        //% block="F(F4)"
        F4 = 349,
        //% block="F#(F#4)"
        FS4 = 370,
        //% block="G(G4)"
        G4 = 392,
        //% block="G#(G#4)"
        GS4 = 415,
        //% block="A(A4)"
        A4 = 440,
        //% block="A#(A#4)"
        AS4 = 466,
        //% block="B(B4)"
        B4 = 494,
        //% block="C(C5)"
        C5 = 523,
        //% block="D(D5)"
        D5 = 587,
        //% block="E(E5)"
        E5 = 659,
        //% block="F(F5)"
        F5 = 698,
        //% block="G(G5)"
        G5 = 784,
        //% block="A(A5)"
        A5 = 880,
        //% block="B(B5)"
        B5 = 988,
        //% block="rest"
        Rest = 0
    }

    // 박자 (음표 길이)
    // ★ 예전에는 8분음표 0.5, 16분음표 0.25, 점4분음표 1.5 처럼 소수값을 썼다.
    //   pxt 는 enum 값을 정수 리터럴로만 접을 수 있어서(enumval only support number
    //   literals) 사용자가 그 세 항목을 고르면 프로젝트 전체가 컴파일 실패했다.
    //   그래서 단위를 16분음표(=1)로 바꿔 전부 정수로 만들었다.
    //   재생 길이 계산(buzzerPlayNote)에서 4로 나누므로 실제 박자는 이전과 같다.
    export enum MusicBeat {
        //% block="whole note (4)"
        Whole = 16,
        //% block="half note (2)"
        Half = 8,
        //% block="quarter note (1)"
        Quarter = 4,
        //% block="eighth note (1/2)"
        Eighth = 2,
        //% block="sixteenth note (1/4)"
        Sixteenth = 1,
        //% block="dottedquarter note (1.5)"
        DottedQuarter = 6,
        //% block="dottedhalf note (3)"
        DottedHalf = 12
    }

    // 부저 상태 변수
    let _buzzerPin: AnalogPin = AnalogPin.P0
    let _buzzerBPM: number = 120
    let _buzzerInitialized: boolean = false

    //% block="buzzer set"
    //% group="Buzzer" weight=100
    export function buzzerSetup(): void {
        _buzzerInitialized = true
    }

    //% block="Set the play speed(BPM) %bpm "
    //% bpm.defl=120 bpm.min=40 bpm.max=240
    //% group="Buzzer" weight=99
    export function buzzerSetBPM(bpm: number): void {
        // ★ 아두이노 생성기(14_output.js:13-16)는 buzzer_tempo 에 값을 그대로 대입해
        //   범위 제한이 전혀 없다. 그래서 0 이 들어오면 60000/0 이 되어 사실상
        //   끝나지 않는 음이 나온다. 여기서는 입력 슬라이더가 이미 안내하는
        //   40~240 으로 잘라 그 나눗셈 사고를 막는다(기본값 120 은 아두이노와 동일).
        //   40 보다 느린 템포를 지원해야 한다면 이 범위와 슬라이더 범위를 함께 넓힐 것.
        _buzzerBPM = Math.clamp(40, 240, bpm)
    }

    //% block="buzzer: Plays the note $note on digital pin $pin at the beat $beat "
    //% pin.defl=DigitalPin.P0
    //% note.defl=OutputDevice.MusicNote.C4
    //% beat.defl=OutputDevice.MusicBeat.Quarter
    //% group="Buzzer" weight=98
    //% inlineInputMode=inline
    export function buzzerPlayNote(pin: DigitalPin, note: MusicNote, beat: MusicBeat): void {
        // BPM에 따른 박자 시간 계산 (60000ms / BPM = 4분음표 1박 시간)
        // ★ MusicBeat 가 16분음표 단위(4분음표=4)이므로 4로 나눠 ms 로 되돌린다.
        let beatMs = Math.floor(60000 / _buzzerBPM * beat / 4)

        if (note == MusicNote.Rest || note == 0) {
            // 쉼표
            // ★ 아두이노 tone.cpp:18-21 의 play() 는 frequency 가 0 이면 핀만 LOW 로
            //   내리고 duration 을 버린 채 즉시 반환한다 → 쉼표가 0초가 되어 음들이
            //   붙어버리고 리듬이 뭉개진다. 여기서는 음악적으로 옳은 쪽,
            //   즉 쉼표도 제 박자만큼 쉬는 동작을 유지한다. 아두이노와 "맞춘다"며
            //   이 basic.pause 를 지우지 말 것.
            basic.pause(beatMs)
        } else {
            // 음표 재생
            let analogPin = digitalToAnalog(pin)
            pins.analogSetPitchPin(analogPin)
            pins.analogPitch(note, beatMs)
        }
    }

    //% block="buzzer: Stop digital %pin number sound "
    //% pin.defl=DigitalPin.P0
    //% group="Buzzer" weight=97
    export function buzzerStop(pin: DigitalPin): void {
        let analogPin = digitalToAnalog(pin)
        pins.analogWritePin(analogPin, 0)
    }

    //% block="buzzer: digital %pin from frequency %freq Hz play "
    //% pin.defl=DigitalPin.P0
    //% freq.defl=440 freq.min=20 freq.max=8000
    //% group="Buzzer" weight=96
    export function buzzerPlayFrequency(pin: DigitalPin, freq: number): void {
        let analogPin = digitalToAnalog(pin)
        pins.analogSetPitchPin(analogPin)
        if (freq > 0) {
            pins.analogPitch(freq, 0)
        } else {
            pins.analogWritePin(analogPin, 0)
        }
    }

    //% block="buzzer: digital %pin from frequency %freq Hz %duration ms play "
    //% pin.defl=DigitalPin.P0
    //% freq.defl=440 freq.min=20 freq.max=8000
    //% duration.defl=500
    //% group="Buzzer" weight=95
    //% inlineInputMode=inline
    export function buzzerPlayTone(pin: DigitalPin, freq: number, duration: number): void {
        // ★ 아두이노 tone(pin, freq, duration)(02c_pin_util.js:75-83)은 타이머만 걸고
        //   즉시 반환하지만, pins.analogPitch(freq, ms) 는 그 시간만큼 파이버를 재운 뒤
        //   소리를 끈다. 즉 이 기능은 duration 동안 프로그램을 멈춘다(의도된 동작).
        //   멈추지 않고 계속 울리게 하려면 위의 buzzerPlayFrequency 를 쓸 것
        //   — 그쪽이 analogPitch(freq, 0) 으로 아두이노의 tone(pin, freq) 에 해당한다.
        let analogPin = digitalToAnalog(pin)
        pins.analogSetPitchPin(analogPin)
        pins.analogPitch(freq, duration)
    }

    //% block="active buzzer: digital %pin pin %state "
    //% pin.defl=DigitalPin.P0
    //% state.shadow="toggleOnOff" state.defl=true
    //% group="Buzzer" weight=94
    export function activeBuzzer(pin: DigitalPin, state: boolean): void {
        pins.digitalWritePin(pin, state ? 1 : 0)
    }

    //% block="melody play: %pin pin|melody %melody "
    //% pin.defl=DigitalPin.P0
    //% melody.defl=Melodies.Dadadadum
    //% group="Buzzer" weight=93
    export function buzzerPlayMelody(pin: DigitalPin, melody: Melodies): void {
        let analogPin = digitalToAnalog(pin)
        pins.analogSetPitchPin(analogPin)
        music.beginMelody(music.builtInMelody(melody), MelodyOptions.Once)
    }

    // 디지털 핀을 아날로그 핀으로 변환 (내부 함수)
    // ★ 예전에는 P0~P4, P10 만 매핑하고 나머지는 default 로 P0 을 돌려줬다.
    //   그래서 P5~P9, P11~P16 에 부저를 연결하면 소리가 안 나고, 대신 P0 에
    //   PWM 이 나가 P0 에 꽂은 서보 등을 망가뜨렸다.
    //   DigitalPin 과 AnalogPin 은 MICROBIT_ID_IO_* 값(100~120)이 동일하므로
    //   그냥 캐스팅하면 모든 핀이 올바르게 변환된다.
    function digitalToAnalog(pin: DigitalPin): AnalogPin {
        return <AnalogPin><number>pin
    }


    /********** KT403A MP3 Module **********/

    // KT403A/GD3200B is a serial MP3 player module
    // Supports SD card and USB flash drive

    // KT403A Device Type
    export enum KT403ADevice {
        //% block="USB (0x01)"
        USB = 0x01,
        //% block="SD Card (0x02)"
        SDCard = 0x02
    }

    // KT403A Control Commands
    export enum KT403AControl {
        //% block="Play"
        Play = 0x01,
        //% block="Pause"
        Pause = 0x02,
        //% block="Next Track"
        Next = 0x03,
        //% block="Previous Track"
        Previous = 0x04,
        //% block="Stop"
        Stop = 0x05
    }

    // KT403A state variables
    let _kt403aRx: SerialPin = SerialPin.P2
    let _kt403aTx: SerialPin = SerialPin.P1
    let _kt403aVolume: number = 20
    let _kt403aDevice: number = 0x02
    let _kt403aInitialized: boolean = false
    // 재생완료 통지를 찾기 위해 들고 다니는 수신 잔여 바이트 (kt403aGetStatus 참고)
    let _kt403aTail: number[] = []

    /**
     * Initialize KT403A MP3 module
     * @param device storage device type
     * @param rx RX pin (connect to module TX)
     * @param tx TX pin (connect to module RX)
     * @param volume initial volume (0-30)
     */
    //% block="MP3 (KT403A) setup: device %device, RX %rx, TX %tx, initial volume (0~30) %volume"
    //% device.defl=OutputDevice.KT403ADevice.SDCard
    //% rx.defl=SerialPin.P2
    //% tx.defl=SerialPin.P1
    //% volume.defl=20 volume.min=0 volume.max=30
    //% group="MP3 Player (KT403A)" weight=100
    //% inlineInputMode=inline
    export function kt403aInit(device: KT403ADevice, rx: SerialPin, tx: SerialPin, volume: number): void {
        _kt403aRx = rx
        _kt403aTx = tx
        _kt403aDevice = device
        _kt403aVolume = Math.clamp(0, 30, volume)

        // ★ serial.redirect 를 직접 부르면 공용 UART 중재자(09_usb_serial.ts)의 소유권
        //   기록과 어긋난다. 그러면 (1) GPS/PMS 가 자기가 아직 주인인 줄 알고 전환을
        //   건너뛰어 MP3 핀으로 통신하고 (2) USB 폴러가 계속 읽어 MP3 응답을 가로챈다.
        USBSerial.uartRegister(USBSerial.UartOwner.KT403A, rx, tx, BaudRate.BaudRate9600)
        USBSerial.uartClaim(USBSerial.UartOwner.KT403A)
        // ★ 상태 조회(0x42)의 10바이트 응답 프레임을 놓치지 않도록 RX 링을 넓힌다.
        //   중재자를 통해서만 키운다 — 직접 setRxBufferSize 를 부르면 WiFi/GPS 용으로
        //   이미 254 로 키워둔 링을 도로 줄이고, 폴러가 읽는 중이면 데이터가 날아간다.
        USBSerial.uartEnsureRxBuffer()
        // ★ 예전에는 100ms 만 기다렸다. KT403A/GD3200B 는 전원이 들어온 뒤 SD 카드를
        //   마운트하는 데 1.5~3초가 걸리고 그 전에 도착한 명령은 버린다. 그래서 아래의
        //   장치 선택·초기 볼륨이 통째로 무시되어 첫 곡이 기본 음량으로 나오곤 했다.
        basic.pause(2000)

        // Select device
        kt403aSendCmd(0x09, 0x00, device)
        basic.pause(200)

        // Set initial volume
        kt403aSendCmd(0x06, 0x00, _kt403aVolume)
        basic.pause(100)

        _kt403aInitialized = true
    }

    /**
     * Play track by number
     * @param track track number (1-65535)
     */
    //% block="MP3 play track number %track"
    //% track.defl=1 track.min=1 track.max=65535
    //% group="MP3 Player (KT403A)" weight=99
    export function kt403aPlayTrack(track: number): void {
        let high = (track >> 8) & 0xFF
        let low = track & 0xFF
        kt403aSendCmd(0x03, high, low)
    }

    /**
     * Play specific file in folder
     * @param folder folder number (1-99)
     * @param file file number (1-255)
     */
    //% block="MP3 folder/file play: folder %folder, file %file"
    //% folder.defl=1 folder.min=1 folder.max=99
    //% file.defl=1 file.min=1 file.max=255
    //% group="MP3 Player (KT403A)" weight=98
    //% inlineInputMode=inline
    export function kt403aPlayFolderFile(folder: number, file: number): void {
        kt403aSendCmd(0x0F, folder, file)
    }

    /**
     * Set volume
     * @param volume volume level (0-30)
     */
    //% block="MP3 set volume (0~30) %volume"
    //% volume.defl=20 volume.min=0 volume.max=30
    //% group="MP3 Player (KT403A)" weight=97
    export function kt403aSetVolume(volume: number): void {
        _kt403aVolume = Math.clamp(0, 30, volume)
        kt403aSendCmd(0x06, 0x00, _kt403aVolume)
    }

    /**
     * Control MP3 playback
     * @param control control command
     */
    //% block="MP3 control %control"
    //% control.defl=OutputDevice.KT403AControl.Next
    //% group="MP3 Player (KT403A)" weight=96
    export function kt403aControl(control: KT403AControl): void {
        switch (control) {
            case KT403AControl.Play:
                kt403aSendCmd(0x0D, 0x00, 0x00)  // Resume play
                break
            case KT403AControl.Pause:
                kt403aSendCmd(0x0E, 0x00, 0x00)  // Pause
                break
            case KT403AControl.Next:
                kt403aSendCmd(0x01, 0x00, 0x00)  // Next track
                break
            case KT403AControl.Previous:
                kt403aSendCmd(0x02, 0x00, 0x00)  // Previous track
                break
            case KT403AControl.Stop:
                kt403aSendCmd(0x16, 0x00, 0x00)  // Stop
                break
        }
    }

    /**
     * Get MP3 playback status (0 = playback finished)
     */
    //% block="MP3 status value (0=playback finished)"
    //% group="MP3 Player (KT403A)" weight=95
    export function kt403aGetStatus(): number {
        // ★ 예전에는 0x42 질의만 보내고 응답은 읽지 않은 채 항상 1 을 돌려줬다.
        //   그래서 "재생이 끝날 때까지 기다리기" 루프가 영원히 빠져나오지 못했다.
        //
        // ★ 동작 방식은 아두이노판 QueryPlayStatus() 와 똑같이 맞췄다.
        //   그쪽은 질의를 아예 보내지 않는다. KT403A 가 곡이 끝날 때 스스로 보내는
        //   "재생 완료" 통지 프레임을 읽고, 명령 바이트(오프셋 3)가
        //   0x3C(USB)/0x3D(SD)/0x3E(FLASH) 면 0(끝남), 아니면 1(재생 중)을 돌려준다.
        //   returns: 0 = 재생 끝남 / 1 = 그 외.  사용법: "0 이 될 때까지 기다리기"
        //
        //   그래서 두 가지를 반드시 지켜야 한다.
        //   (1) 읽기 전에 버퍼를 비우면 안 된다 — 비우면 그 통지 프레임이 사라진다.
        //   (2) 아무 것도 못 읽었으면 1(재생 중)이다. 0 을 돌려주면 대기 루프가
        //       시작하자마자 빠져나가 곡이 매번 잘린다.
        //
        // ★ 읽은 바이트는 _kt403aTail 에 이어붙여 다음 호출까지 들고 간다. 이게 없으면
        //   프레임이 호출 두 개로 쪼개져 통지를 영영 못 찾는다. 9600bps 에서 10바이트
        //   통지가 다 도착하는 데 약 10ms 가 걸리는데 "0 이 될 때까지" 루프는 그 사이
        //   이 함수를 수십 번 부르고, readBuffer 는 부를 때마다 버퍼를 비운다. 그래서
        //   앞 호출이 7E FF 06 만, 뒤 호출이 3D ... 를 가져가면 어느 쪽도 통지를 못 본다.
        //   (아두이노판은 while(available()) 안에서 delay(1) 로 바이트 도착 속도를
        //    따라가며 한 번에 다 읽어서 이 문제를 우연히 피한다. 여기선 그럴 수 없다.)
        if (!_kt403aInitialized) return 1

        // 통지를 받으려면 UART 소유권이 MP3 쪽이어야 한다.
        // (이게 없으면 USB 폴러가 자기가 주인인 줄 알고 계속 읽어 통지를 가로챈다)
        USBSerial.uartClaim(USBSerial.UartOwner.KT403A)

        // readBuffer(0) 은 RX 버퍼에 있는 만큼만 읽고 블로킹하지 않는다.
        let b = serial.readBuffer(0)
        for (let i = 0; i < b.length; i++) _kt403aTail.push(b[i])
        // 통지 1개는 최대 10바이트다. 오래된 바이트는 버려 배열이 무한히 자라지 않게 한다.
        while (_kt403aTail.length > 32) _kt403aTail.shift()

        for (let i = 0; i + 3 < _kt403aTail.length; i++) {
            if (_kt403aTail[i] == 0x7E && _kt403aTail[i + 1] == 0xFF) {
                let cmd = _kt403aTail[i + 3]
                if (cmd == 0x3C || cmd == 0x3D || cmd == 0x3E) {
                    // 같은 통지를 다음 곡에서 또 읽어 즉시 "끝남"이 되지 않도록 비운다
                    _kt403aTail = []
                    return 0   // 재생 완료 통지
                }
            }
        }
        return 1   // 통지 없음 -> 아직 재생 중으로 본다
    }

    /**
     * Volume up
     */
    //% block="MP3 volume up"
    //% group="MP3 Player (KT403A)" weight=94
    export function kt403aVolumeUp(): void {
        kt403aSendCmd(0x04, 0x00, 0x00)
    }

    /**
     * Volume down
     */
    //% block="MP3 volume down"
    //% group="MP3 Player (KT403A)" weight=93
    export function kt403aVolumeDown(): void {
        kt403aSendCmd(0x05, 0x00, 0x00)
    }

    /**
     * Set loop play mode
     * @param enable enable loop play
     */
    //% block="MP3 loop play %enable"
    //% enable.shadow="toggleOnOff" enable.defl=true
    //% group="MP3 Player (KT403A)" weight=92
    export function kt403aLoopPlay(enable: boolean): void {
        kt403aSendCmd(0x11, 0x00, enable ? 0x01 : 0x00)
    }

    /**
     * Play file in MP3 folder (for files named 0001.mp3 - 9999.mp3 in MP3 folder)
     * @param fileNum file number (1-9999)
     */
    //% block="MP3 play MP3 folder file %fileNum"
    //% fileNum.defl=1 fileNum.min=1 fileNum.max=9999
    //% group="MP3 Player (KT403A)" weight=91
    export function kt403aPlayMp3Folder(fileNum: number): void {
        let high = (fileNum >> 8) & 0xFF
        let low = fileNum & 0xFF
        kt403aSendCmd(0x12, high, low)
    }

    // Internal function to send command to KT403A
    function kt403aSendCmd(cmd: number, dataHigh: number, dataLow: number): void {
        // KT403A command format:
        // $S VER Len CMD Feedback dataHigh dataLow checksum $O
        // 7E FF 06 CMD 00 DH DL XX XX EF
        //
        // ★ 아두이노 라이브러리(MP3Player_KT403A.cpp)는 체크섬 두 바이트를 빼고
        //   7E FF 06 CMD 00 DH DL EF 의 8바이트만 보낸다. KT403A/GD3200B 는 0xEF
        //   까지 읽고 체크섬을 선택 사항으로 취급해서 두 형식 다 재생이 된다.
        //   여기서는 데이터시트 그대로의 10바이트 형식을 유지한다 — Len 바이트(0x06)
        //   뒤 길이를 엄격히 세는 펌웨어에서도 안전한 쪽이기 때문이다.
        //   아두이노와 "맞춘다"며 buf[7]/buf[8] 을 지우지 말 것.

        // 다른 UART 장치가 포트를 가져갔을 수 있으므로 송신 직전에 되찾는다
        // (이미 KT403A 가 주인이면 uartClaim 은 아무것도 하지 않는다)
        USBSerial.uartClaim(USBSerial.UartOwner.KT403A)

        let buf = pins.createBuffer(10)
        buf[0] = 0x7E        // Start byte
        buf[1] = 0xFF        // Version
        buf[2] = 0x06        // Length
        buf[3] = cmd         // Command
        buf[4] = 0x00        // Feedback (0 = no feedback)
        buf[5] = dataHigh    // Data high byte
        buf[6] = dataLow     // Data low byte

        // ★ 체크섬은 버퍼에 실제로 담긴 값으로 계산한다. buf 대입은 하위 8비트만 남기므로
        //   범위를 벗어난 인자(변수로 넘어온 folder/file 등)를 원본 그대로 더하면
        //   보낸 바이트와 체크섬이 어긋난다. dfplayerSendCmd 와 같은 방식이다.
        let checksum = 0 - (buf[1] + buf[2] + buf[3] + buf[4] + buf[5] + buf[6])
        buf[7] = (checksum >> 8) & 0xFF   // Checksum high
        buf[8] = checksum & 0xFF          // Checksum low
        buf[9] = 0xEF        // End byte

        serial.writeBuffer(buf)
        basic.pause(30)
    }



    /********** DFPlayer MP3 모듈 **********/

    // DFPlayer Mini는 SD카드의 MP3 파일을 재생하는 모듈입니다.

    // DFPlayer 상태 변수
    let _dfpTx: SerialPin = SerialPin.P1
    let _dfpRx: SerialPin = SerialPin.P2
    let _dfpVolume: number = 15

    //% block="MP3 player(DFPlayer) set|TX pin %tx|RX pin %rx"
    //% tx.defl=SerialPin.P1
    //% rx.defl=SerialPin.P2
    //% group="MP3 Player (DFPlayer)" weight=89
    //% inlineInputMode=inline
    export function dfplayerInit(tx: SerialPin, rx: SerialPin): void {
        _dfpTx = tx
        _dfpRx = rx
        // kt403aInit 과 같은 이유로 중재자를 통해 등록·전환한다 (직접 redirect 금지)
        USBSerial.uartRegister(USBSerial.UartOwner.DFPlayer, rx, tx, BaudRate.BaudRate9600)
        USBSerial.uartClaim(USBSerial.UartOwner.DFPlayer)
        USBSerial.uartEnsureRxBuffer()
        // ★ 예전에는 500ms 만 기다렸다. DFPlayer Mini 는 전원이 들어온 뒤 SD 카드를
        //   마운트하는 데 1.5~3초가 걸리고 그 전에 온 명령은 버린다. 그래서 아래의
        //   초기 볼륨 설정이 무시되어 첫 곡이 기본 음량으로 나오곤 했다.
        basic.pause(2000)

        // 초기 볼륨 설정
        dfplayerSetVolume(15)
    }

    //% block="MP3 player(DFPlayer) play track %track"
    //% track.defl=1 track.min=1 track.max=65535
    //% group="MP3 Player (DFPlayer)" weight=88
    export function dfplayerPlay(track: number): void {
        // ★ 0x03 명령은 트랙 번호를 16비트로 싣는다. 아두이노 SpecifyMusicPlay 는
        //   uint16_t index(0~65535)를 받아 hbyte=index/256, lbyte=index%256 로 쪼개
        //   보낸다(MP3Player_KT403A.cpp:66-81). dfplayerSendCmd 도 이미 상·하위
        //   바이트로 쪼개므로 전송 경로에는 문제가 없었는데, 입력값 상한만 255 로
        //   묶여 있어 256번 이후 곡을 지정할 수 없었다. 형제 기능인 kt403aPlayTrack
        //   과 같은 65535 로 맞춘다.
        dfplayerSendCmd(0x03, track)
    }

    //% block="MP3 pause"
    //% group="MP3 Player (DFPlayer)" weight=87
    export function dfplayerPause(): void {
        dfplayerSendCmd(0x0E, 0)
    }

    //% block="MP3 resume"
    //% group="MP3 Player (DFPlayer)" weight=86
    export function dfplayerResume(): void {
        dfplayerSendCmd(0x0D, 0)
    }

    //% block="MP3 stop"
    //% group="MP3 Player (DFPlayer)" weight=85
    export function dfplayerStop(): void {
        dfplayerSendCmd(0x16, 0)
    }

    //% block="MP3 volume %volume (0~30)"
    //% volume.defl=15 volume.min=0 volume.max=30
    //% group="MP3 Player (DFPlayer)" weight=84
    export function dfplayerSetVolume(volume: number): void {
        _dfpVolume = Math.clamp(0, 30, volume)
        dfplayerSendCmd(0x06, _dfpVolume)
    }

    //% block="MP3 player(DFPlayer) next track"
    //% group="MP3 Player (DFPlayer)" weight=83
    export function dfplayerNext(): void {
        dfplayerSendCmd(0x01, 0)
    }

    //% block="MP3 player(DFPlayer) previous track"
    //% group="MP3 Player (DFPlayer)" weight=82
    export function dfplayerPrevious(): void {
        dfplayerSendCmd(0x02, 0)
    }

    //% block="MP3 player(DFPlayer) play folder %folder 's file %file"
    //% folder.defl=1 folder.min=1 folder.max=99
    //% file.defl=1 file.min=1 file.max=255
    //% group="MP3 Player (DFPlayer)" weight=81
    //% inlineInputMode=inline
    export function dfplayerPlayFolder(folder: number, file: number): void {
        dfplayerSendCmd(0x0F, (folder << 8) | file)
    }

    //% block="MP3 loop %state"
    //% state.shadow="toggleOnOff" state.defl=true
    //% group="MP3 Player (DFPlayer)" weight=80
    export function dfplayerLoop(state: boolean): void {
        dfplayerSendCmd(0x11, state ? 1 : 0)
    }

    // DFPlayer 명령 전송 함수
    function dfplayerSendCmd(cmd: number, param: number): void {
        // 송신 직전에 UART 소유권을 되찾는다 (같은 주인이면 무동작)
        USBSerial.uartClaim(USBSerial.UartOwner.DFPlayer)

        let buf = pins.createBuffer(10)
        buf[0] = 0x7E  // 시작 바이트
        buf[1] = 0xFF  // 버전
        buf[2] = 0x06  // 길이
        buf[3] = cmd   // 명령
        buf[4] = 0x00  // 피드백 (0: 없음)
        buf[5] = (param >> 8) & 0xFF  // 파라미터 상위
        buf[6] = param & 0xFF         // 파라미터 하위

        // 체크섬 계산
        let checksum = 0 - (0xFF + 0x06 + cmd + 0x00 + buf[5] + buf[6])
        buf[7] = (checksum >> 8) & 0xFF
        buf[8] = checksum & 0xFF

        buf[9] = 0xEF  // 종료 바이트

        serial.writeBuffer(buf)
        basic.pause(30)
    }


    /********** EEPROM (AT24C32/AT24C64 등) **********/

    // I2C EEPROM - 전원이 꺼져도 데이터 유지
    // AT24C32: 4KB, AT24C64: 8KB, AT24C256: 32KB

    // EEPROM 상태 변수
    let _eepromAddr: number = 0x50  // 기본 I2C 주소

    //% block="EEPROM set I2C address %addr"
    //% addr.defl=0x50
    //% group="EEPROM" weight=56
    export function eepromInit(addr: number): void {
        _eepromAddr = addr
    }

    //% block="EEPROM write address %memAddr|value %value"
    //% memAddr.defl=0 memAddr.min=0 memAddr.max=32767
    //% value.defl=0 value.min=0 value.max=255
    //% group="EEPROM" weight=55
    export function eepromWrite(memAddr: number, value: number): void {
        let buf = pins.createBuffer(3)
        buf[0] = (memAddr >> 8) & 0xFF  // 주소 상위 바이트
        buf[1] = memAddr & 0xFF          // 주소 하위 바이트
        buf[2] = value & 0xFF            // 데이터
        pins.i2cWriteBuffer(_eepromAddr, buf)
        // ★ AT24C32/AT24C64 의 쓰기 사이클 tWR 최대값은 10ms 다.
        //   예전의 5ms 로는 소자·온도 편차에서 다음 트랜잭션이 NAK 되어 쓰기가 유실될 수 있다.
        basic.pause(10)
    }

    //% block="EEPROM read address %memAddr"
    //% memAddr.defl=0 memAddr.min=0 memAddr.max=32767
    //% group="EEPROM" weight=54
    export function eepromRead(memAddr: number): number {
        let addrBuf = pins.createBuffer(2)
        addrBuf[0] = (memAddr >> 8) & 0xFF
        addrBuf[1] = memAddr & 0xFF
        pins.i2cWriteBuffer(_eepromAddr, addrBuf)

        let result = pins.i2cReadNumber(_eepromAddr, NumberFormat.UInt8BE)
        return result
    }

    //% block="EEPROM string write address %memAddr|string %text"
    //% memAddr.defl=0
    //% text.defl="Hello"
    //% group="EEPROM" weight=53
    export function eepromWriteString(memAddr: number, text: string): void {
        // ★ 길이와 문자를 8비트로 저장하는 형식이라 한계가 있다.
        //   예전에는 초과분이 조용히 잘려 문자열이 깨진 채 저장됐다.
        //   여기서는 잘림을 눈에 보이게 만든다: 길이는 255 로 제한하고,
        //   1바이트로 표현할 수 없는 문자(한글 등)는 '?'(0x3F) 로 대체한다.
        let n = Math.min(text.length, 255)
        eepromWrite(memAddr, n)

        for (let i = 0; i < n; i++) {
            let c = text.charCodeAt(i)
            eepromWrite(memAddr + 1 + i, c > 255 ? 0x3F : c)
        }
    }

    //% block="EEPROM string read address %memAddr"
    //% memAddr.defl=0
    //% group="EEPROM" weight=52
    export function eepromReadString(memAddr: number): string {
        // 길이 읽기
        // ★ 예전에는 여기서 100 으로 잘랐다. 쓰기 쪽(eepromWriteString)은 255 자까지
        //   저장하므로 101~255 자 문자열이 아무 안내 없이 잘려서 읽혔다.
        //   길이는 1바이트에 저장되므로 이미 0~255 범위라 별도 제한이 필요 없다.
        let len = eepromRead(memAddr)

        // 문자열 데이터 읽기
        let result = ""
        for (let i = 0; i < len; i++) {
            let char = eepromRead(memAddr + 1 + i)
            result += String.fromCharCode(char)
        }
        return result
    }

    //% block="EEPROM number write (4byte) address %memAddr|value %value"
    //% memAddr.defl=0
    //% value.defl=0
    //% group="EEPROM" weight=51
    export function eepromWriteNumber(memAddr: number, value: number): void {
        // 32비트 정수로 저장
        eepromWrite(memAddr, (value >> 24) & 0xFF)
        eepromWrite(memAddr + 1, (value >> 16) & 0xFF)
        eepromWrite(memAddr + 2, (value >> 8) & 0xFF)
        eepromWrite(memAddr + 3, value & 0xFF)
    }

    //% block="EEPROM number read (4byte) address %memAddr"
    //% memAddr.defl=0
    //% group="EEPROM" weight=50
    export function eepromReadNumber(memAddr: number): number {
        let b0 = eepromRead(memAddr)
        let b1 = eepromRead(memAddr + 1)
        let b2 = eepromRead(memAddr + 2)
        let b3 = eepromRead(memAddr + 3)
        return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
    }


}