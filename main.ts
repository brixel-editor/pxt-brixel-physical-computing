/**
 * BRIXEL Extension - MakeCode micro:bit Extension
 * Supports 100+ devices in 10 categories
 *
 * File Structure:
 * - 01_displays.ts      : LCD, TM1637, NeoPixel
 * - 02_adv_displays.ts  : OLED, MAX7219, HT16K33, 74HC595, TFT
 * - 03_sensors.ts       : DHT, DS18B20, HC-SR04, VL53L0X, BH1750, Gas sensors, etc.
 * - 04_adv_sensors.ts   : HX711, Rotary Encoder, Joystick, Keypad, etc.
 * - 05_actuators.ts     : Servo, DC Motor, Stepper Motor, Relay
 * - 06_output_device.ts : Buzzer, Speaker, Vibration Motor
 * - 07_communications.ts: nRF24L01, LoRa, IR, PN532, MFRC522, GPS
 * - 08_wifi.ts          : ESP8266/ESP32 WiFi, WebSocket (브릭셀AI 호환)
 * - 09_usb_serial.ts    : USB Serial communication (브릭셀AI 호환)
 * - (v0.3.0) 블루투스(옛 10번 파일)는 짝 확장 pxt-brixel-physical-computing-ble 로 옮김 — 이 확장은 BLE 의존성이 없다
 *   ⚠ 이 파일에 «bluetooth» 뒤에 점이 붙은 글자를 쓰지 말 것: pxt 가 main.ts 글자를 보고 bluetooth 의존성을 자동으로 더한다(pxt-microbit missingPackage 규칙)
 */
