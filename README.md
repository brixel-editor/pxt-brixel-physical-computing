# BRIXEL Physical Computing — v0.2.0

micro:bit V2에서 디스플레이, 센서, 모터, 출력 장치와 통신 장치를 제어하는 BRIXEL MakeCode 확장입니다. **476개 블록, 10개 카테고리**를 제공합니다. 기존 435개 블록의 함수·매개변수와 enum 값은 유지하고, 센서 이름으로 읽는 블록·기준 보정·16채널 서보 제어 등 41개를 추가했습니다. 기존 35개 언어 자료를 유지하며 새 블록은 한국어와 영어를 제공합니다(다른 언어에서는 새 블록이 영어로 표시됨).

## 장치별 안내 바로가기

- **[Excel 입출력 장치 전체 지원 목록](docs/device-support.md)** — 장치마다 대응 블록, 원본 시트·셀, 미지원·확인 항목 표시.
- **[센서별 값 해석·변환식·보정 방법·준비물](docs/sensor-calibration.md)** — 원시 ADC 0~1023부터 전류·전압·탁도·UV 등 각 센서 안내.
- **[v0.2.0 안정화 결과와 남은 제약](docs/stability-20261008.md)** / [변경 기록](CHANGELOG.md).

엑셀의 중복 항목을 99개 입출력 검토 묶음으로 정리한 결과: 전용 블록 구현 **69**, 기본 핀 블록 사용 **17**, 일부 지원 **4**, 미지원 **3**, 모델 확인 필요 **6**입니다. 보드·부속품 3묶음은 별도입니다. 이 수치는 실제 고유 모델 수나 실물 시험 통과 수가 아닙니다. **SD/TF 파일 저장 및 RF433 송수신은 아직 지원하지 않습니다.**

## 피지컬컴퓨팅 바로 시작하기

**[피지컬컴퓨팅 프로젝트 열기](https://makecode.microbit.org/_Fo84JDihLTPm)**

아래 QR코드를 스캔하거나 위 링크를 누른 뒤 **코드 수정**을 선택하세요. 이 공유 프로젝트는 생성 당시의 **v0.1.0**을 포함합니다. 새 기능을 쓰려면 에디터에서 확장을 **v0.2.0으로 업데이트**해야 합니다. 공유 링크의 내용은 새 릴리스를 올려도 자동으로 바뀌지 않습니다. 이 시작 프로젝트에는 `radio`가 없습니다.

[![피지컬컴퓨팅 시작 프로젝트 QR코드](docs/physical-computing-qr.png)](https://makecode.microbit.org/_Fo84JDihLTPm)

## 기존 프로젝트에 확장 추가하기

1. [MakeCode micro:bit](https://makecode.microbit.org/)에서 새 프로젝트를 만듭니다.
2. **확장**을 열고 아래 주소를 검색창에 붙여 넣습니다.
3. **brixel-physical-computing**을 선택합니다. 내장 BLE를 포함하므로 `radio`와의 충돌 안내가 나오면 **radio를 제거하고 확장 추가**를 선택합니다.
4. 도구 상자에서 `디스플레이`, `센서`, `모터장치`, `블루투스` 등 10개 카테고리를 확인합니다. 언어 설정이 영어이면 번호가 붙은 영어 카테고리로 표시됩니다.

```text
https://github.com/brixel-editor/pxt-brixel-physical-computing#v0.2.0
```

이 주소로 설치하는 공개 확장입니다. MakeCode 기본 검색 목록에 등록되는 공식 승인 여부와는 별개입니다. 기존 프로젝트는 **JavaScript → 탐색기 → brixel-physical-computing 옆 버전/업데이트 버튼**으로 갱신합니다.

## 포함한 카테고리

| 카테고리 | 주요 장치·기능 | 블록 수 |
|---|---|---:|
| 01. Displays | LCD, TM1637 숫자 표시, NeoPixel | 29 |
| 02. Adv Displays | SSD1306/SH1106 OLED, HT16K33, MAX7219, 74HC595, TFT | 60 |
| 03. Sensors | 온습도·수온·초음파·NTC·무게·미세먼지·가스·pH·TDS·탁도·전압·지문 등 | 131 |
| 04. Adv Sensors | RTC, 기압, 가속도·자이로, 색상·제스처, 심박, I2C 무게 등 | 92 |
| 05. Actuators | 서보, GeekServo, DC 모터, 스테퍼와 모터 드라이버 | 52 |
| 06. Output Device | 부저, 오디오 모듈, EEPROM | 35 |
| 07. Communications | IR, RFID/NFC, nRF24L01, LoRa, GPS 등 | 40 |
| 08. WiFi | ESP AT 모듈 연결, WebSocket 송수신·성공 확인 | 12 |
| 09. USB Serial | USB/핀 시리얼 송수신, 수신 이벤트·문자열 분리 | 14 |
| 10. Bluetooth | 내장 BLE UART 송수신, 연결·수신 이벤트 | 11 |
| **합계** | 블록 함수 정의 수(숨긴 보조 함수 포함), 드롭다운 항목 제외 | **476** |

## 첫 실행 예제: 서보 각도

서보 신호를 실제 연결한 P핀으로 바꾸고, 서보 전원 정격에 맞는 외부 전원과 공통 GND를 사용합니다. 새 프로젝트의 JavaScript에 다음 코드를 넣으면 A 버튼은 0°, B 버튼은 90°로 이동합니다. 서보가 허용하는 각도와 기구 간섭을 확인하세요.

```typescript
input.onButtonPressed(Button.A, function () {
    Actuators05.servoSetAngle(AnalogPin.P1, 0)
})
input.onButtonPressed(Button.B, function () {
    Actuators05.servoSetAngle(AnalogPin.P1, 90)
})
```

## 사용 조건과 검증 범위

- 실드 소켓 번호 대신 실제 micro:bit **P핀 번호**를 설정합니다. 모듈의 신호 전압, 전원 용량, I2C 주소 중복과 공유 핀을 확인합니다. 5V 신호를 micro:bit 핀에 직접 입력하지 않습니다.
- 센서 UART와 USB는 기존 확장의 `USBSerial` 중재 코드로 핀을 전환합니다. 여러 UART 모듈의 연속 데이터를 동시에 수집하는 구조가 아니며 소유권을 잃은 동안 수신이 누락될 수 있습니다. WiFi는 micro:bit 자체 무선 인터넷이 아니라 별도 ESP AT 모듈을 사용합니다.
- 476개 정의에는 숨긴 색상 보조 블록과 폐기 예정 초기화 블록도 포함됩니다. 팔레트의 눈에 보이는 블록 수와 같지 않습니다.
- v0.2.0은 원시값·실제 단위를 구분하고, 센서의 무응답·오래된 값·CRC 오류 처리를 보강했습니다. 호환성·번역 매개변수 검사, 모의 I/O 회귀 시험과 V2 네이티브 빌드로 검증합니다. **실물 전 장치의 동작이나 측정 정확도는 아직 검증하지 않았습니다.**
- 새 전류·전압·탁도 보정은 재시작하면 지워집니다. 측정 전에 기준 조건에서 다시 보정하세요. 물리량·오류값·준비물은 위의 센서별 안내에 있습니다.
- MH-Z19D는 시작 후 60초 예열하며 CO₂ 실패값은 -1입니다. 초기화만으로 자동 보정 설정을 바꾸지 않습니다. 기존 계열의 온도·범위·상태 API가 D 모델에서도 유효한지는 실물 확인이 필요합니다.
- WebSocket은 ESP-AT 모듈의 TCP 위에 구현했습니다. UTF-8 텍스트 메시지는 최대 1024바이트(송신 블록의 끝 줄바꿈 포함)이며 UART를 다른 모듈과 번갈아 사용하면 재연결이 필요할 수 있습니다. HTTPS 웹앱의 비보안 ws:// 연결 제한은 별도 웹앱 설정 문제입니다.
- PCA9685는 한 칩의 16채널이 주파수를 공유합니다. DC 모터와 서보에는 서로 다른 주소의 별도 드라이버를 사용하세요. 서보 채널 1~16은 기판 CH0~15에 대응하며 각도 블록의 기본 펄스는 1000~2000µs입니다.
- `test.ts`는 컴파일 검사 전용입니다. 서로 핀·주소를 공유하는 장치를 함께 호출하므로 생성된 검사 HEX를 수업용 프로그램으로 실행하지 않습니다. 필요한 장치만 넣은 별도 프로그램을 사용하세요.

## 과학실험 확장과의 관계

전체 장치 제어용은 **이 저장소**, 센서 데이터 수집과 바우어버드 전송 중심의 단순 블록은 [BRIXEL Science Lab](https://github.com/brixel-editor/pxt-brixel-science-lab)입니다. v0.2.0에는 Science Lab v0.6.1의 단순 센서 읽기, 안정된 보정 표본, WCS2801·전압·탁도 보정과 아날로그 먼지 표본 코드를 재사용했습니다. 이 저장소의 `Sensors03` API에 맞췄으며 Science Lab 자체를 의존성으로 추가하지 않습니다. USB/센서 UART 동시 수집용 별도 UART 구현은 가져오지 않았습니다. 이 확장에 맞는 보정 방법은 위 문서를 사용하세요.

## 소스와 라이선스

기존 `brixel-final-dev_20260725`의 작업 파일을 기준으로 게시했습니다. [SOURCES.md](SOURCES.md)에 포장 과정과 검증 방법을 설명합니다. 원본 폴더·기존 저장소는 보존하며 새 저장소는 `brixel-editor/pxt-brixel-physical-computing`입니다.

[MIT License](LICENSE), Copyright (c) 2026 BRIXEL.

## Supported targets

* for PXT/microbit
