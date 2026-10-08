# 입출력 장치 지원 목록 — v0.2.0

제공된 Excel 4개 파일, 14개 시트의 장치명 729건을 대조했다. 색상·세트별 중복을 묶고 인터페이스가 불분명한 이름을 분리해 102개 검토 묶음으로 정리했다. 이 중 보드·부속품 3묶음을 제외한 99묶음이 입출력 장치 대상이다. **99는 실물의 고유 모델 수가 아니다.**

“전용 블록 구현”은 코드·블록이 있다는 뜻이다. 전 장치의 실물 시험이나 정확도 인증을 뜻하지 않는다. 기본 핀 입력·출력은 MakeCode 기본 블록에서 사용할 수 있다.

| 구분 | 묶음 수 |
|---|---:|
| 전용 블록 구현 | 69 |
| 기본 핀 블록 사용 | 17 |
| 일부 지원·제약 | 4 |
| 미지원 | 3 |
| 모델 확인 필요 | 6 |
| 보드·부속품 | 3 |

## 원본 자료

표에는 장치명과 셀 위치만 인용했다. 구매 수량·가격·비공개 드라이브 경로는 게시하지 않았다.

- **W1**: `Fullset_IOdevice_list_20210524.xlsx`
- **W2**: `01_입출력 장치 이미지 정리 (1).xlsx`
- **W3**: `BRIXEL device list.xlsx`
- **W4**: `2025_List of all sensor orders.xlsx`

## 장치별 대조표

같은 묶음에 여러 시트/세트가 포함된다. 아래 대표 셀과 실제 블록 API를 대조할 수 있다.

| 장치 | v0.1.0 → v0.2.0 | 블록 명령 | 해석·남은 조건 | 대표 원본 셀 |
|---|---|---|---|---|
| 16채널 서보 드라이버(PCA9685) | 미지원 → 전용 블록 구현 | `Actuators05.pca9685ServoInit`<br>`Actuators05.pca9685ServoAngle`<br>`Actuators05.pca9685ServoPulse`<br>`Actuators05.pca9685ServoRelease` | 50Hz·16채널 추가. UI 1~16은 기판 CH0~15. 한 칩은 주파수를 공유하므로 DC 모터와 서보는 다른 주소의 별도 보드 권장. | W2 `Sheet1!C84`; W3 `Sheet1!H10`; W4 `Sheet1!E79`; W4 `Sheet2!C5,C6` |
| I2C 듀얼 DC 모터 드라이버(PCA9685) | 전용 블록 구현 → 전용 블록 구현 | `Actuators05.pca9685DcMotorSetup`<br>`Actuators05.pca9685DcMotorWheelA`<br>`Actuators05.pca9685DcMotorStop` | PCA9688 표기는 최신 주문서 PCA9685PW로 정리. 보드 채널 배선 실측 필요. | W2 `Sheet1!C83`; W3 `Sheet1!B25`; W4 `Sheet1!E80`; W4 `Sheet2!C3` |
| DC 모터 드라이버(L293DD) | 모델 확인 필요 → 모델 확인 필요 | `Actuators05.l293dSetPins1`<br>`Actuators05.l293dMotor1` | 블록은 모터당 EN·IN1·IN2 세 신호. 주문서 모듈 4핀 표기와 실제 배선/EN 고정 여부 확인 필요. | W1 `IO device!C80`; W1 `Output!C10`; W2 `Sheet1!C82`; W4 `Sheet1!E70`; W4 `Sheet2!C4` |
| TF/SD 카드 어댑터 | 미지원 → 미지원 | 없음 / 확인 필요 | SPI SD 초기화·파일 읽기·쓰기 없음. EEPROM/MP3의 SD 재생은 파일 저장 API가 아님. | W2 `Sheet1!C89`; W3 `Sheet1!B26`; W4 `Sheet1!E82`; W4 `Sheet2!C7` |
| RF433 수신기 | 미지원 → 미지원 | 없음 / 확인 필요 | 433MHz OOK/ASK 디코딩 없음. nRF24L01/LoRa/micro:bit radio는 대체 불가. | W1 `IO device!C89`; W1 `Sheet1!B72`; W1 `Communi!C5`; W2 `Sheet1!C94`; W4 `Sheet1!E101`; W4 `Sheet2!C15` |
| RF433 송신기 | 미지원 → 미지원 | 없음 / 확인 필요 | 433MHz 펄스 프레임 인코딩 없음. | W1 `IO device!C88`; W1 `Sheet1!B71`; W1 `Communi!C4`; W2 `Sheet1!C93`; W4 `Sheet1!E102`; W4 `Sheet2!C16` |
| 외장 Bluetooth 4.0(JDY-33) | 일부 지원·제약 → 일부 지원·제약 | `USBSerial.serialStart`<br>`USBSerial.serialSend` | 외장 UART로 송수신 가능하나 전용 이름·초기화 없음. Bluetooth10은 micro:bit 내장 BLE. | W1 `IO device!C91`; W1 `Sheet1!B53`; W1 `Communi!C7`; W2 `Sheet1!C96`; W4 `Sheet1!E104`; W4 `Sheet2!C10` |
| 외장 Bluetooth(HC-06) | 일부 지원·제약 → 일부 지원·제약 | `USBSerial.serialStart`<br>`USBSerial.serialSend` | UART 통신을 수동 설정해야 함. 내장 BLE 블록으로 HC-06을 제어하지 못함. | W1 `IO device!C90`; W1 `Sheet1!B52`; W1 `Communi!C6`; W2 `Sheet1!C95`; W4 `Sheet1!E103`; W4 `Sheet2!C9` |
| Wi-Fi(ESP8266/ESP12E) | 일부 지원·제약 → 전용 블록 구현 | `WiFi08.wifiStart`<br>`WiFi08.wsServerStart`<br>`WiFi08.wsSend`<br>`WiFi08.wsSendSucceeded` | ESP-AT TCP에 WebSocket handshake·마스킹·텍스트 프레임·ping/pong 구현. UTF-8 1024바이트 제한. UART 독점 필요; ESP 펌웨어/실물 시험 남음. | W1 `IO device!C92`; W1 `Sheet1!B51`; W1 `Communi!C8`; W2 `Sheet1!C97`; W4 `Sheet1!E106`; W4 `Sheet2!C17` |
| GPS(ATGM332D) | 일부 지원·제약 → 전용 블록 구현 | `Communications07.gpsInit`<br>`Communications07.gpsUpdate`<br>`Communications07.gpsHasFix`<br>`Communications07.gpsRead` | 유효 NMEA 수신이 3초 이상 중단되면 FIX false·숫자 -9999. 좌표 정확도/실외 수신 시험은 별도. | W1 `IO device!C93`; W1 `Communi!C9`; W2 `Sheet1!C98`; W4 `Sheet1!E47`; W4 `Sheet2!C11` |
| 적외선 송신 | 일부 지원·제약 → 전용 블록 구현 | `Communications07.irTransmit`<br>`Communications07.irFrameCode` | NEC 32비트 수신 프레임 읽기를 추가해 재송신에 사용. NEC 외 프로토콜은 지원하지 않음. | W1 `IO device!C86`; W1 `Sheet1!B43`; W1 `Communi!C2`; W2 `Sheet1!C91`; W4 `Sheet1!E100`; W4 `Sheet2!C14` |
| 적외선 수신/리모컨(CHQ1838) | 일부 지원·제약 → 전용 블록 구현 | `Communications07.irInit`<br>`Communications07.irButtonNumber`<br>`Communications07.irRawCode`<br>`Communications07.irFrameCode` | 8비트 명령과 32비트 프레임을 별도 블록으로 구분. 송신에는 프레임 블록 사용. | W1 `IO device!C87`; W1 `Sheet1!B44`; W1 `Communi!C3`; W2 `Sheet1!C92`; W4 `Sheet1!E99`; W4 `Sheet2!C12,C13` |
| USB–UART 변환기(CH340) | 전용 블록 구현 → 전용 블록 구현 | `USBSerial.serialStart`<br>`USBSerial.serialSend` | micro:bit UART 핀과 교차 배선. USB 자체와 외장 변환기 배선은 구분. | W2 `Sheet1!C114`; W4 `Sheet1!E105`; W4 `Sheet2!C8` |
| 무선 업로더 | 보드·부속품 → 보드·부속품 | 없음 / 확인 필요 | 업로드 도구. micro:bit 펌웨어 업로드 호환은 별도 확인 대상으로 센서 지원 수에서 제외. | W2 `Sheet1!C115`; W3 `Sheet1!E26`; W4 `Sheet1!E107` |
| 아날로그 미세먼지(GP2Y1014AU0F) | 미지원 → 전용 블록 구현 | `Sensors03.analogDustRaw` | LED 펄스와 네이티브 ADC 표본 8회 평균 추가. 원시값 0~1023이며 PM2.5/µg/m³ 자동 환산 아님. 5V VO 신호 분압·LED 드라이버 필요; 타이밍 실패=-1. | W3 `Sheet1!B19`; W4 `Sheet2!C53` |
| 모델 미기재 미세먼지 | 모델 확인 필요 → 모델 확인 필요 | 없음 / 확인 필요 | PMS UART인지 GP2Y1014 아날로그인지 해당 행만으로 확정 불가. 같은 이름을 지원 완료로 합치지 않음. | W1 `IO device!C25`; W1 `Sheet1!B41`; W1 `Digital!C25`; W2 `Sheet1!C26` |
| 미세먼지(PMS3003) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.pmsInit`<br>`Sensors03.pmsRead` | 프레임 길이 가변 처리 확인. 어댑터 실제 UART 신호 확인 필요. | W3 `Sheet1!B20`; W4 `Sheet1!E52` |
| 미세먼지(PMS7003) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.pmsInit`<br>`Sensors03.pmsRead` | 체크섬/분할 프레임 처리. UART 독점 사용 제약. | W3 `Sheet1!B21`; W4 `Sheet1!E53`; W4 `Sheet2!C81` |
| 1A 전류(WCS2801) | 일부 지원·제약 → 전용 블록 구현 | `Sensors03.zeroCurrent`<br>`Sensors03.calibrateCurrent`<br>`Sensors03.currentAmps` | Science Lab에서 영점·기준 전류 보정 재사용. ±1A 범위. 보정 전/실패=-9999. ACS712 감도를 쓰지 않음. | W3 `Sheet1!E2`; W4 `Sheet1!E7`; W4 `Sheet2!C49` |
| 전류(ACS712-05B) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.acs712Current` | 5A 타입 185mV/A 선택. 5V 구동·영점·ADC 입력 전압 검토 필요. | W4 `Sheet2!C50` |
| 자외선(GUVA-S12SD) | 일부 지원·제약 → 전용 블록 구현 | `Sensors03.uvInit`<br>`Sensors03.uvCalibrate`<br>`Sensors03.uvSetReference`<br>`Sensors03.uvRead` | 전압과 물리량 구분. 차광 영점 후 기준 UV 계기로 선택 단위를 보정. UVI와 mW/cm² 보정은 독립이며 스펙트럼 차이는 별도 오차. | W3 `Sheet1!H5`; W4 `Sheet1!E34`; W4 `Sheet2!C94` |
| 탁도(AZDM01) | 일부 지원·제약 → 전용 블록 구현 | `Sensors03.turbidityRaw`<br>`Sensors03.calibrateTurbidity`<br>`Sensors03.turbidityTransmission`<br>`Sensors03.turbidityRead` | 외장 ADS1115 없이 ADC. 맑은 물 대비 신호 비율과 기존 0~3000 상대값 제공. NTU 표기를 제거했으며 절대 탁도 아님. | W3 `Sheet1!E33`; W4 `Sheet1!E33`; W4 `Sheet2!C91` |
| 고온(PT100 증폭 모듈) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.hiTempInit`<br>`Sensors03.hiTempSetCalibration`<br>`Sensors03.hiTempRead` | 실측 2점 보정 필요. 생 PT100을 직접 ADC로 읽는 드라이버가 아님. | W3 `Sheet1!E5`; W4 `Sheet1!E19`; W4 `Sheet2!C69` |
| 온도(NTC 10k B3950) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.thermistorInit`<br>`Sensors03.thermistorReadTemp` | Vcc–NTC–ADC–고정저항–GND 배선 및 B/R 값 일치 필요. | W1 `IO device!C32`; W1 `Sheet1!B19`; W1 `Basic Set!B12`; W1 `Analog!C8`; W2 `Sheet1!C33`; W4 `Sheet1!E32`; W4 `Sheet2!C39` |
| 물온도(DS18B20) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.ds18b20SetPin`<br>`Sensors03.ds18b20StartConversion`<br>`Sensors03.ds18b20ReadTemp` | 주문서 analog 표기와 달리 1-Wire. CRC·변환 대기 구현. | W1 `IO device!C33`; W1 `Sheet1!B48`; W1 `Analog!C9`; W2 `Sheet1!C34`; W3 `Sheet1!H13`; W4 `Sheet1!E37`; W4 `Sheet2!C98` |
| 전기전도도/TDS | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.tdsInit`<br>`Sensors03.tdsUpdate`<br>`Sensors03.tdsRead` | EC·TDS 변환 있음. 모듈 이득·표준액·온도 보정 필요. | W3 `Sheet1!B24`; W4 `Sheet1!E8`; W4 `Sheet2!C52` |
| pH | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.phInit`<br>`Sensors03.phCalibrate`<br>`Sensors03.phRead` | pH4/7 표준액 기반 보정 필요. | W3 `Sheet1!B18`; W4 `Sheet1!E25` |
| DC 전압 분압 모듈 | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.voltageRaw`<br>`Sensors03.calibrateVoltage`<br>`Sensors03.voltageCalibrated`<br>`Sensors03.voltageRead` | 외장 ADS1115 없이 ADC. 멀티미터 기준 보정 추가. 기존 voltageRead는 5:1 분압/3.3V 가정. 25V 이름이 안전 측정 범위를 보장하지 않음. | W3 `Sheet1!E3`; W4 `Sheet1!E36`; W4 `Sheet2!C96` |
| 로터리 엔코더(EC11) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.rotaryInit`<br>`Sensors03.rotaryCounter`<br>`Sensors03.rotaryReset` | 5핀 A/B/SW. 회전 카운트 구현, 스위치는 핀 입력 사용. | W1 `IO device!C21`; W1 `Sheet1!B42`; W1 `Digital!C21`; W2 `Sheet1!C22`; W3 `Sheet1!E27`; W4 `Sheet1!E27`; W4 `Sheet2!C82` |
| 무한회전 아날로그 센서 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.infiniteRotation` | 0~1023 파형. 연속 회전 각도 누적·회전수 자동 해석 없음. | W1 `IO device!C29`; W1 `Analog!C5`; W2 `Sheet1!C30`; W4 `Sheet1!E20`; W4 `Sheet2!C71` |
| 조이스틱 | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.joystickInit`<br>`Sensors03.joystickX`<br>`Sensors03.joystickY` | 4핀 모델은 X/Y 중심, SW 없는 모델에서 버튼 입력 미사용. | W1 `IO device!C27`; W1 `Sheet1!B11`; W1 `Basic Set!B9`; W1 `Analog!C3`; W2 `Sheet1!C28`; W3 `Sheet1!E31`; W4 `Sheet1!E22`; W4 `Sheet2!C73` |
| 4패드 아날로그 터치 | 일부 지원·제약 → 일부 지원·제약 | `Sensors03.analogTouch` | 전용 원시값 블록 추가. 4패드별 ADC 임계값과 동시 터치 해석은 보드 실측 후 구성. | W1 `IO device!C26`; W1 `Analog!C2`; W2 `Sheet1!C27`; W3 `Sheet1!E11`; W4 `Sheet1!E5`; W4 `Sheet2!C89` |
| 가변저항 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.rotation` | 0~1023 상대 위치; 양 끝 기준으로 원하는 각도에 선형 변환. | W1 `IO device!C28`; W1 `Sheet1!B18`; W1 `Basic Set!B10`; W1 `Analog!C4`; W2 `Sheet1!C29`; W3 `Sheet1!E28`; W4 `Sheet1!E28`; W4 `Sheet2!C83` |
| 슬라이더 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.slider` | 0~1023 상대 위치; 두 끝점 보정 후 % 또는 길이 환산. | W1 `IO device!C30`; W1 `Sheet1!B49`; W1 `Analog!C6`; W2 `Sheet1!C31`; W4 `Sheet1!E29`; W4 `Sheet2!C86` |
| 빛(CdS/GL5528) | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.light` | 0~1023. CdS 분압의 비선형 응답이므로 lux는 기준 조도계와 곡선 보정 필요. | W1 `IO device!C31`; W1 `Sheet1!B12`; W1 `Basic Set!B11`; W1 `Analog!C7`; W2 `Sheet1!C32`; W3 `Sheet1!E6`; W4 `Sheet1!E6`; W4 `Sheet2!C45` |
| 압력/힘(FSR) | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.force` | 0~1023. 같은 접촉 면적과 표준 하중으로 여러 점 보정; 무보정 N/kg 아님. | W1 `IO device!C36`; W1 `Analog!C12`; W2 `Sheet1!C37`; W3 `Sheet1!H4`; W4 `Sheet1!E9`; W4 `Sheet2!C56` |
| 토양 수분 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.soilMoisture` | 0~1023. 마른 흙/젖은 흙을 기준으로 상대 수분 %로 변환; 절대 함수율 아님. | W1 `IO device!C35`; W1 `Analog!C11`; W2 `Sheet1!C36`; W3 `Sheet1!B17`; W4 `Sheet1!E30`; W4 `Sheet2!C77` |
| 빗물/물감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.rain` | 0~1023 젖음 정도; water 블록도 제공. 강수량 mm로 직접 환산 불가. | W3 `Sheet1!E25`; W4 `Sheet1!E26` |
| 소리 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.sound` | 0~1023 신호. 일정 시간의 최대-최소/평균으로 상대 크기 비교; 기준 소음계 없이 dB 아님. | W1 `IO device!C34`; W1 `Sheet1!B28`; W1 `Basic Set!B13`; W1 `Analog!C10`; W2 `Sheet1!C35`; W3 `Sheet1!E22`; W4 `Sheet1!E31`; W4 `Sheet2!C87` |
| 가스(MQ-135) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C54`; W1 `Sheet1!B64`; W1 `Analog!C30`; W2 `Sheet1!C56`; W3 `Sheet1!E12`; W4 `Sheet1!E10`; W4 `Sheet2!C57` |
| 가스(MQ-2) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C46`; W1 `Sheet1!B56`; W1 `Analog!C22`; W2 `Sheet1!C48`; W3 `Sheet1!E13`; W4 `Sheet1!E11`; W4 `Sheet2!C58` |
| 가스(MQ-3) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C47`; W1 `Sheet1!B57`; W1 `Analog!C23`; W2 `Sheet1!C49`; W3 `Sheet1!E14`; W4 `Sheet1!E12`; W4 `Sheet2!C59` |
| 가스(MQ-4) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C48`; W1 `Sheet1!B58`; W1 `Analog!C24`; W2 `Sheet1!C50`; W3 `Sheet1!E15`; W4 `Sheet1!E13`; W4 `Sheet2!C60` |
| 가스(MQ-5) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C49`; W1 `Sheet1!B59`; W1 `Analog!C25`; W2 `Sheet1!C51`; W3 `Sheet1!E16`; W4 `Sheet1!E14`; W4 `Sheet2!C61` |
| 가스(MQ-6) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C50`; W1 `Sheet1!B60`; W1 `Analog!C26`; W2 `Sheet1!C52`; W3 `Sheet1!E17`; W4 `Sheet1!E15`; W4 `Sheet2!C62` |
| 가스(MQ-7) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C51`; W1 `Sheet1!B61`; W1 `Analog!C27`; W2 `Sheet1!C53`; W3 `Sheet1!E18`; W4 `Sheet1!E16`; W4 `Sheet2!C63` |
| 가스(MQ-8) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C52`; W1 `Sheet1!B62`; W1 `Analog!C28`; W2 `Sheet1!C54`; W3 `Sheet1!E19`; W4 `Sheet1!E17`; W4 `Sheet2!C64` |
| 가스(MQ-9) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `Sensors03.mqReadRaw`<br>`pins.analogReadPin` | 사용자 요청대로 원시 ADC 이용. mqReadPPM은 가스별 R0·곡선·히터 조건 충족 전 절대 ppm으로 사용하지 않음. | W1 `IO device!C53`; W1 `Sheet1!B63`; W1 `Analog!C29`; W2 `Sheet1!C55`; W3 `Sheet1!E20`; W4 `Sheet1!E18`; W4 `Sheet2!C65` |
| 자기감지(SS49E)/Hall | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.magnet` | SS49E 아날로그 원시값. 영점과 기준 자속 계기로 보정해야 mT. 디지털 Hall 버전은 핀 신호 사용. | W1 `IO device!C13`; W1 `Sheet1!B68`; W1 `Digital!C13`; W2 `Sheet1!C14`; W3 `Sheet1!B31`; W4 `Sheet1!E24`; W4 `Sheet2!C67,C76` |
| IR 물체감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.object` | 반사 신호 원시값. 색·각도 영향을 받으며 cm가 아님. DO 모듈은 디지털 입력 사용. | W1 `IO device!C18`; W1 `Sheet1!B70`; W1 `Digital!C18`; W2 `Sheet1!C19`; W3 `Sheet1!E8`; W4 `Sheet1!E21`; W4 `Sheet2!C72` |
| 라인감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.line` | 검정/흰색 표본으로 임계값 설정. AO/DO 배선을 구분. | W1 `IO device!C17`; W1 `Sheet1!B47`; W1 `Digital!C17`; W2 `Sheet1!C18`; W3 `Sheet1!E29`; W4 `Sheet1!E23`; W4 `Sheet2!C74` |
| 외부 버튼(4색) | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.button` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C2,C3,C4` 등; W1 `Sheet1!B13,B14,B15` 등; W1 `Basic Set!B3,B4,B5` 등; W1 `Digital!C2,C3,C4` 등; W2 `Sheet1!C3,C4,C5` 등; W3 `Sheet1!B27`; W4 `Sheet1!E38,E39,E40` 등; W4 `Sheet2!C40,C41,C42` 등 |
| 컬러 터치(4색) | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.touch` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C7,C8,C9` 등; W1 `Digital!C7,C8,C9` 등; W2 `Sheet1!C8,C9,C10` 등; W4 `Sheet1!E42`; W4 `Sheet2!C48` |
| 디지털 터치 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.touch` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C6`; W1 `Sheet1!B45`; W1 `Digital!C6`; W2 `Sheet1!C7`; W4 `Sheet1!E55`; W4 `Sheet2!C90` |
| 잠금 스위치 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.switchValue` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C11`; W1 `Sheet1!B46`; W1 `Digital!C11`; W2 `Sheet1!C12`; W4 `Sheet1!E48`; W4 `Sheet2!C75` |
| 진동감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.vibration` | 아날로그 원시값 및 vibrationDigital 신호 블록. 모듈의 AO/DO를 구분. | W1 `IO device!C12`; W1 `Sheet1!B65`; W1 `Digital!C12`; W2 `Sheet1!C13`; W3 `Sheet1!H7,E32`; W4 `Sheet1!E35,E56`; W4 `Sheet2!C110` |
| 기울기 스위치 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.tilt` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C14`; W1 `Sheet1!B67`; W1 `Digital!C14`; W2 `Sheet1!C15`; W3 `Sheet1!H6`; W4 `Sheet1!E54`; W4 `Sheet2!C88` |
| 포토인터럽터/회전감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.photoGate` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 펄스 주기와 슬롯 수로 RPM 계산은 별도. | W1 `IO device!C15`; W1 `Sheet1!B66`; W1 `Digital!C15`; W2 `Sheet1!C16`; W3 `Sheet1!E7`; W4 `Sheet1!E50`; W4 `Sheet2!C79` |
| 불꽃감지 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.flame` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C16`; W1 `Sheet1!B69`; W1 `Digital!C16`; W2 `Sheet1!C17`; W4 `Sheet1!E46`; W4 `Sheet2!C55` |
| 인체감지(PIR) | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.human` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W1 `IO device!C19`; W1 `Sheet1!B20`; W1 `Basic Set!B7`; W1 `Digital!C19`; W2 `Sheet1!C20`; W3 `Sheet1!E21`; W4 `Sheet1!E51`; W4 `Sheet2!C80` |
| 수위 스위치 | 기본 핀 블록 사용 → 전용 블록 구현 | `Sensors03.waterLevel` | 전용 디지털 신호 블록 0/1. 실물 모듈의 Active HIGH/LOW 확인. 연속 물리량 측정값이 아님. | W3 `Sheet1!H8`; W4 `Sheet1!E57`; W4 `Sheet2!C97` |
| 초음파(GV–Echo–Trig) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.hcsr04SetPins`<br>`Sensors03.hcsr04Read` | 사용자 확정 GV–Echo–Trig 핀 순서. 구형 어댑터는 신호 변환 여부 확인. | W1 `IO device!C20`; W1 `Sheet1!B17`; W1 `Basic Set!B8`; W1 `Digital!C20`; W2 `Sheet1!C21`; W3 `Sheet1!B29`; W4 `Sheet1!E49`; W4 `Sheet2!C92,C93` |
| 온습도(DHT11) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.dhtQuery`<br>`Sensors03.dhtRead`<br>`Sensors03.dhtLastQuerySuccessful` | 시간 민감 비트뱅잉 실물 검증 필요. | W1 `IO device!C22`; W1 `Sheet1!B33`; W1 `Digital!C22`; W2 `Sheet1!C23`; W3 `Sheet1!B9`; W4 `Sheet1!E43`; W4 `Sheet2!C51` |
| 온습도(DHT22) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.dhtQuery`<br>`Sensors03.dhtRead`<br>`Sensors03.dhtLastQuerySuccessful` | DHT22 타입 선택. 타이밍·음수 온도 실물 검증. | W3 `Sheet1!B10`; W4 `Sheet1!E44` |
| 지문(AS608) | 전용 블록 구현 → 전용 블록 구현 | `Sensors03.fingerprintInit`<br>`Sensors03.fingerprintEnroll`<br>`Sensors03.fingerprintSearch` | AdvSensors.fp*에도 중복 6블록. 두 그룹을 섞지 않도록 정리 필요. | W1 `IO device!C24`; W1 `Digital!C24`; W2 `Sheet1!C25`; W4 `Sheet1!E45`; W4 `Sheet2!C54` |
| 무게(HX711/0x63 어댑터) | 모델 확인 필요 → 모델 확인 필요 | `Sensors03.hx711Init`<br>`Sensors03.hx711ReadWeight`<br>`AdvSensors.i2cWeightRead` | 2선 HX711 및 커스텀 I2C 0x63 3바이트 프로토콜 둘 다 있음. 주문서 I2C+HX711 표기로 어댑터 확인 필요. | W1 `IO device!C23`; W1 `Sheet1!B74`; W1 `Digital!C23`; W2 `Sheet1!C24`; W3 `Sheet1!B30`; W4 `Sheet1!E67`; W4 `Sheet2!C99` |
| 기압/고도(BMP280) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.bmp280Init`<br>`AdvSensors.bmp280Read`<br>`AdvSensors.bmp280Calibrated` | 공장 보정 계수 사용. 고도는 기준 기압에 따라 달라짐. | W1 `IO device!C41`; W1 `I2C!C6`; W2 `Sheet1!C42`; W3 `Sheet1!B7`; W4 `Sheet1!E58`; W4 `Sheet2!C37` |
| eCO₂/TVOC(SGP30) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.sgp30Init`<br>`AdvSensors.sgp30Measure`<br>`AdvSensors.sgp30Read` | 초기 15초·CRC 실패·2.5초 이상 미갱신이면 -1. Measure를 1초 주기로 계속 실행. eCO₂는 CO₂ 직접 측정값이 아님. | W2 `Sheet1!C46`; W3 `Sheet1!B23`; W4 `Sheet1!E59`; W4 `Sheet2!C85` |
| CO₂(MH-Z19D) | 일부 지원·제약 → 일부 지원·제약 | `Sensors03.mhz19Init`<br>`Sensors03.mhz19Read`<br>`Sensors03.mhz19GetStatus` | MH-Z19D UART CO₂ 읽기. 60초 예열·오류/무응답 -1, 시작 시 ABC 설정을 강제로 바꾸지 않음. 기존 온도·범위·상태 명령은 D 모델 보증 불가; 상세 제약 참조. | W3 `Sheet1!B8`; W4 `Sheet1!E60`; W4 `Sheet2!C46` |
| 색상(TCS34725) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.tcs34725Setup`<br>`AdvSensors.tcs34725Detect`<br>`AdvSensors.tcs34725GetChannel` | 조명/거리 조건에 따라 값 달라짐. | W1 `IO device!C38`; W1 `Sheet1!B35`; W1 `I2C!C3`; W2 `Sheet1!C39`; W3 `Sheet1!E30`; W4 `Sheet1!E61`; W4 `Sheet2!C47` |
| 제스처(APDS9960) | 일부 지원·제약 → 전용 블록 구현 | `AdvSensors.apds9960Setup`<br>`AdvSensors.apds9960GetGesture`<br>`AdvSensors.apds9960ReadGesture` | 두 리포터가 같은 400ms 제스처 캐시를 공유. FIFO를 중복 소비하거나 만료 시각을 늘리지 않음. | W1 `IO device!C44`; W1 `I2C!C9`; W2 `Sheet1!C45`; W4 `Sheet1!E62`; W4 `Sheet2!C66` |
| 6축(MPU6050) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.mpu6050Setup`<br>`AdvSensors.mpu6050Update`<br>`AdvSensors.mpu6050AutoCalibrate` | 오프셋 보정 지원. | W1 `IO device!C39`; W1 `Sheet1!B36`; W1 `I2C!C4`; W2 `Sheet1!C40`; W3 `Sheet1!B16`; W4 `Sheet1!E63`; W4 `Sheet2!C38` |
| 심박(MAX30102) | 일부 지원·제약 → 전용 블록 구현 | `AdvSensors.heartRateSetup`<br>`AdvSensors.heartRateGetBPM`<br>`AdvSensors.heartRateIsReady` | MAX30102. 신규 표본이 250ms 이상 없으면 손가락·준비·맥박 상태 해제. BPM/SpO₂ 알고리즘은 교육용 추정, 실물 정확도 미검증. | W1 `IO device!C40`; W1 `Sheet1!B73`; W1 `I2C!C5`; W2 `Sheet1!C41`; W4 `Sheet1!E64`; W4 `Sheet2!C68` |
| 온습도(GXHT30) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.sht30Init`<br>`AdvSensors.sht30Query`<br>`AdvSensors.sht30ReadTemp` | 0x44/0x2400·6바이트·CRC 기반 호환. 블록 제목 SHT30; 보유 모델명 안내 필요. | W1 `IO device!C45`; W1 `I2C!C10`; W2 `Sheet1!C47`; W3 `Sheet1!H3`; W4 `Sheet1!E65`; W4 `Sheet2!C70` |
| 레이저 거리(VL53L0X) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.vl53l0xInit`<br>`AdvSensors.vl53l0xRead` | 커버글라스/오프셋 실물 비교 필요. | W1 `IO device!C42`; W1 `I2C!C7`; W2 `Sheet1!C43`; W4 `Sheet1!E66`; W4 `Sheet2!C95` |
| 모델 미기재 거리 센서 | 모델 확인 필요 → 모델 확인 필요 | 없음 / 확인 필요 | GP2Y0A21YK/초음파/VL53L0X 중 어떤 장치인지 확정 불가. | W3 `Sheet1!E9` |
| 비접촉 온도(MLX90614) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.mlx90614Init`<br>`AdvSensors.mlx90614ReadTemp` | 방사율/거리·대상 크기 확인 필요; PEC 검증 별도 보강 대상. | W1 `IO device!C43`; W1 `I2C!C8`; W2 `Sheet1!C44`; W3 `Sheet1!H9`; W4 `Sheet1!E68`; W4 `Sheet2!C78` |
| 시계(DS1307) | 전용 블록 구현 → 전용 블록 구현 | `AdvSensors.rtcInit`<br>`AdvSensors.rtcSetTime`<br>`AdvSensors.rtcGet` | 초기 시간 설정 포함. | W1 `IO device!C37`; W1 `Sheet1!B40`; W1 `I2C!C2`; W2 `Sheet1!C38`; W3 `Sheet1!B11`; W4 `Sheet1!E69`; W4 `Sheet2!C84` |
| eCO₂/TVOC(CCS811) | 일부 지원·제약 → 전용 블록 구현 | `AdvSensors.ccs811Init`<br>`AdvSensors.ccs811Read` | FW/오류 상태·결과 레지스터를 검사하고 오류 또는 2.5초 이상 미갱신이면 -1. 충분한 burn-in·run-in 필요. CO₂ 직접 측정 아님. | W4 `Sheet2!C44` |
| 전자석 | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | 드라이버 내장 모듈의 제어 신호 HIGH/LOW. 전용 블록 없음. | W1 `IO device!C73`; W1 `Sheet1!B50`; W1 `Output!C3`; W2 `Sheet1!C75`; W3 `Sheet1!B33`; W4 `Sheet1!E71`; W4 `Sheet2!C103` |
| 릴레이/펌프 릴레이 | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | Active HIGH 모듈. 펌프는 드라이버/릴레이를 통해 제어. | W1 `IO device!C74`; W1 `Sheet1!B55`; W1 `Output!C4`; W2 `Sheet1!C76`; W3 `Sheet1!E24`; W4 `Sheet1!E75,E76`; W4 `Sheet2!C106,C107` |
| 펌프(2선 부하) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | 릴레이/모터 드라이버와 함께 사용. GPIO 직접 전원 공급 대상 아님. | W4 `Sheet1!E3` |
| 진동모터 모듈 | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | 드라이버 내장 모듈 HIGH/LOW. 전용 블록 없음. | W1 `IO device!C76`; W1 `Sheet1!B21`; W1 `Basic Set!B25`; W1 `Output!C6`; W2 `Sheet1!C78`; W4 `Sheet1!E78`; W4 `Sheet2!C102` |
| 팬 모터(TC118) | 모델 확인 필요 → 모델 확인 필요 | 없음 / 확인 필요 | 2입력 제어 추정이나 TC118 보드 진리표 확인 전 L9110 호환을 단정할 수 없음. | W1 `IO device!C77`; W1 `Sheet1!B26`; W1 `Basic Set!B26`; W1 `Output!C7`; W2 `Sheet1!C79`; W3 `Sheet1!E4`; W4 `Sheet1!E72`; W4 `Sheet2!C100` |
| 기어모터/TT/레고 DC 모터 | 전용 블록 구현 → 전용 블록 구현 | `Actuators05.l293dMotor1`<br>`Actuators05.pca9685DcMotorWheelA` | 연결한 드라이버에 맞게 사용. RPM 피드백 제어는 없음. | W1 `IO device!C78,C84,C85`; W1 `Util!C22`; W1 `Sheet1!B75`; W1 `Output!C8,C14,C15`; W2 `Sheet1!C80,C88,C90`; W4 `Sheet1!E73`; W4 `Sheet2!C104` |
| 스텝모터(A4988) | 전용 블록 구현 → 전용 블록 구현 | `Actuators05.stepperSetup`<br>`Actuators05.stepperConfig`<br>`Actuators05.stepperAction` | 주문서 I2C 표기는 오류; STEP/DIR 방식. 스텝수/마이크로스텝 일치 필요. | W1 `IO device!C79`; W1 `Sheet1!B54`; W1 `Output!C9`; W2 `Sheet1!C81`; W3 `Sheet1!B28`; W4 `Sheet1!E81`; W4 `Sheet2!C109` |
| 서보(MG90S/레고 서보) | 전용 블록 구현 → 전용 블록 구현 | `Actuators05.servoSetAngle`<br>`Actuators05.servoSetPulse`<br>`Actuators05.geekServoAngle360` | 직결 서보 및 별도 PCA9685 블록 제공. 각도·펄스·연속회전 타입을 실물에 맞춤. | W1 `IO device!C81,C82,C83`; W1 `Sheet1!B27`; W1 `Basic Set!B27`; W1 `Output!C11,C12,C13`; W2 `Sheet1!C85,C86,C87`; W4 `Sheet1!E77`; W4 `Sheet2!C101` |
| 버저 | 전용 블록 구현 → 전용 블록 구현 | `OutputDevice.buzzerSetup`<br>`OutputDevice.buzzerPlayTone`<br>`OutputDevice.activeBuzzer` | 수동/능동 타입 구분. | W1 `IO device!C72`; W1 `Sheet1!B7`; W1 `Basic Set!B24`; W1 `Output!C2`; W2 `Sheet1!C74`; W4 `Sheet1!E74`; W4 `Sheet2!C105` |
| MP3 플레이어(KT403A/DFPlayer) | 전용 블록 구현 → 전용 블록 구현 | `OutputDevice.kt403aInit`<br>`OutputDevice.kt403aPlayTrack`<br>`OutputDevice.dfplayerInit`<br>`OutputDevice.dfplayerPlay` | 실물 UART 모듈 프로토콜 선택 필요; 두 계열 블록 제공. | W1 `IO device!C75`; W1 `Sheet1!B34`; W1 `Output!C5`; W2 `Sheet1!C77`; W4 `Sheet1!E83`; W4 `Sheet2!C108` |
| 7세그먼트(TM1637) | 전용 블록 구현 → 전용 블록 구현 | `Displays01.tm1637Init`<br>`Displays01.tm1637ShowNumber` | CLK/DIO 핀 지정. | W1 `IO device!C62`; W1 `Sheet1!B8`; W1 `Basic Set!B21`; W1 `Display!C9`; W2 `Sheet1!C64`; W3 `Sheet1!E23`; W4 `Sheet1!E84`; W4 `Sheet2!C22` |
| 레이저 출력 | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | 드라이버 내장 모듈 HIGH/LOW. 전용 블록 없음. | W1 `IO device!C61`; W1 `Sheet1!B29`; W1 `Basic Set!B20`; W1 `Display!C8`; W2 `Sheet1!C63`; W3 `Sheet1!E10`; W4 `Sheet1!E85`; W4 `Sheet2!C25` |
| 단색 LED(4색) | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin`<br>`pins.analogWritePin` | 전용 블록 없음. | W1 `IO device!C55,C56,C57` 등; W1 `Sheet1!B2,B3,B4` 등; W1 `Basic Set!B14,B15,B16` 등; W1 `Display!C2,C3,C4` 등; W2 `Sheet1!C57,C58,C59` 등; W4 `Sheet1!E86,E87,E88` 등; W4 `Sheet2!C27,C28,C29` 등 |
| 신호등 LED | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.digitalWritePin` | 3개 핀을 각각 제어. 전용 블록 없음. | W1 `IO device!C59`; W1 `Sheet1!B6`; W1 `Basic Set!B18`; W1 `Display!C6`; W2 `Sheet1!C61`; W4 `Sheet1!E93`; W4 `Sheet2!C35` |
| 일반 RGB LED | 기본 핀 블록 사용 → 기본 핀 블록 사용 | `pins.analogWritePin` | 3채널 PWM. 네오픽셀 블록과 다른 신호. | W1 `IO device!C60`; W1 `Sheet1!B9`; W1 `Basic Set!B19`; W1 `Display!C7`; W2 `Sheet1!C62`; W3 `Sheet1!B22`; W4 `Sheet1!E92`; W4 `Sheet2!C34` |
| 네오픽셀(링/사각/8×8) | 전용 블록 구현 → 전용 블록 구현 | `Displays01.neopixelCreate`<br>`Displays01.neopixelSetPixelColor`<br>`Displays01.neopixelShow` | 픽셀 수 16/18/64 설정. 매트릭스 좌표 매핑은 사용자가 구성. | W1 `IO device!C70,C71`; W1 `Sheet1!B22`; W1 `Basic Set!B23`; W1 `Display!C17,C18`; W2 `Sheet1!C72,C73`; W3 `Sheet1!B4,H12`; W4 `Sheet1!E90,E91`; W4 `Sheet2!C31,C32,C36` |
| I2C 매트릭스(HT16K33) | 전용 블록 구현 → 전용 블록 구현 | `AdvDisplays.ht16k33Init`<br>`AdvDisplays.ht16k33SetPixel`<br>`AdvDisplays.ht16k33Refresh` | 8×8/8×16 모델 선택 필요. | W1 `IO device!C68,C69`; W1 `Display!C15,C16`; W2 `Sheet1!C70,C71`; W4 `Sheet1!E94,E95`; W4 `Sheet2!C20,C24` |
| SPI 매트릭스(MAX7219) | 전용 블록 구현 → 전용 블록 구현 | `AdvDisplays.max7219Init`<br>`AdvDisplays.max7219SetPixel`<br>`AdvDisplays.max7219Refresh` | 연결 수/회전 설정. | W1 `IO device!C66,C67`; W1 `Display!C13,C14`; W2 `Sheet1!C68,C69`; W3 `Sheet1!B6`; W4 `Sheet2!C18,C23` |
| 모델 미기재 도트매트릭스 | 모델 확인 필요 → 모델 확인 필요 | 없음 / 확인 필요 | 이름만으로 SPI MAX7219와 I2C HT16K33 구분 불가. 두 드라이버 모두 있지만 실물 선택 필요. | W1 `Sheet1!B38,B39`; W3 `Sheet1!B32`; W4 `Sheet2!C19` |
| LCD1602(PCF8574T) | 전용 블록 구현 → 전용 블록 구현 | `Displays01.lcdInit`<br>`Displays01.lcdShowString`<br>`Displays01.lcdClear` | 주소/모듈 배선 확인. | W1 `IO device!C63`; W1 `Sheet1!B10`; W1 `Basic Set!B22`; W1 `Display!C10`; W2 `Sheet1!C65`; W3 `Sheet1!H2`; W4 `Sheet1!E96`; W4 `Sheet2!C26` |
| OLED 0.96/1.3(SSD1306) | 전용 블록 구현 → 전용 블록 구현 | `AdvDisplays.oledInitSSD1306`<br>`AdvDisplays.oledShowString`<br>`AdvDisplays.oledDisplay` | 주문서 두 크기 모두 SSD1306. 크기만으로 SH1106 선택하지 않음. | W1 `IO device!C64,C65`; W1 `Sheet1!B37`; W1 `Display!C11,C12`; W2 `Sheet1!C66,C67`; W3 `Sheet1!B2`; W4 `Sheet1!E97,E98`; W4 `Sheet2!C21,C33` |
| 컨트롤러·실드·DSL 보드 | 보드·부속품 → 보드·부속품 | 없음 / 확인 필요 | 마이크로비트 V2용 확장. 다른 MCU 펌웨어 지원을 뜻하지 않음; DSL 내장 장치는 개별 칩셋으로 확인. | W1 `IO device!C94,C100`; W1 `Util!C11,C12,C13` 등; W1 `Sheet1!B23,B24,B31`; W1 `Basic Set!B28,B34`; W2 `Sheet1!C99,C100,C101` 등; W3 `Sheet1!B3,H11,B12` 등; W4 `Sheet1!E108,E109,E110` 등 |
| 케이블·케이스·바퀴·전원·보관함 | 보드·부속품 → 보드·부속품 | 없음 / 확인 필요 | 소프트웨어 제어 대상 아님. | W1 `IO device!C95,C96,C97` 등; W1 `Util!C3,C4,C5` 등; W1 `Sheet1!B25,B30,B32`; W1 `Basic Set!B29,B30,B31` 등; W3 `Sheet1!B5`; W4 `Sheet1!E4` |

## 바로 확인할 미지원·불확실 장치

- **SD/TF**: SPI 카드 초기화와 FAT 파일 읽기·쓰기 구현이 없다. MP3 모듈의 SD 음원 재생과는 다르다.
- **RF433 송수신**: OOK/ASK 프로토콜 구현이 없다. LoRa·nRF24L01·micro:bit radio로 대체할 수 없다.
- **모델 확인**: L293DD 4핀 모듈, TC118 팬 보드, HX711 I2C 어댑터, 모델 미기재 먼지·거리·도트매트릭스는 배선 또는 모델 확인 후 맞는 드라이버를 선택해야 한다.
- **외장 Bluetooth**: HC-06/JDY-33은 USBSerial의 핀 UART 설정을 사용한다. Bluetooth10은 micro:bit 내장 BLE다.
- **가스 MQ 계열**: 사용자 요청대로 원시 아날로그 블록을 사용한다. 가스별 보정 없는 ppm 값을 실제 농도로 해석하지 않는다.

보정과 오류값은 [센서별 사용·보정 안내](sensor-calibration.md), 변경 및 검증 결과는 [안정화 보고서](stability-20261008.md)를 참고한다.
