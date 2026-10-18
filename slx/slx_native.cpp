// ⚠ 자동 생성 — 사이언스랩 native.cpp 을 sync_sciencelab_to_pc.py 로 복사한 파일. 직접 고치지 말 것.
#include "pxt.h"
#if MICROBIT_CODAL
#include "neopixel.h"
#include "NRF52Serial.h"
#if !CONFIG_ENABLED(HARDWARE_NEOPIXEL)
#endif
#endif
using namespace pxt;

namespace slxNative {
#if MICROBIT_CODAL
static codal::NRF52Serial *sensorSerial = NULL;
static bool sensorRxOnly = false;
static bool dustSampling = false;
static bool dustWait(volatile uint32_t &event, uint32_t timeout) {
    uint64_t start = system_timer_current_time_us();
    while (!event) if (system_timer_current_time_us() - start > timeout) return false;
    return true;
}
#endif
#if MICROBIT_CODAL
static bool dhtWait(codal::Pin *p, int level, uint32_t limit) {
    uint64_t start = system_timer_current_time_us();
    while (p->getDigitalValue() == level) if (system_timer_current_time_us() - start > limit) return false;
    return true;
}
#endif
// DHT11/DHT22 frame: 5 bytes (checksum checked in TypeScript), or an empty buffer on timing failure.
// Bit timing (26..70us) is measured in C++; the TypeScript polling loop was too slow/jittery and failed now and then.
// v0.8.1: micro:bit V2 microphone off (the mic LED goes out). A later sound read turns it on again;
// micEvents() turns it on again for sound events. Used by the BrixelAI DSL micro:bit USB firmware «mic off».
//%
void micOff() {
#if MICROBIT_CODAL
    // MicroBitAudio::periodicCallback turns the mic back on while the ADC channel stays enabled,
    // so disable the channel first (codal-microbit-v2 v0.3.5), then power the mic down.
    if (uBit.audio.mic) uBit.audio.mic->disable();
    uBit.audio.deactivateMic();
#endif
}
//%
void micEvents() {
#if MICROBIT_CODAL
    if (uBit.audio.mic) uBit.audio.mic->enable();
    uBit.audio.activateMic();
#endif
}
//%
Buffer readDHT(int pin) {
#if MICROBIT_CODAL
    auto p = pxt::getPin(pin);
    if (!p) return mkBuffer(NULL, 0);
    p->setDigitalValue(0);
    uBit.sleep(20);                       // start signal >= 18ms
    p->setPull(codal::PullMode::Up);
    p->getDigitalValue();                 // release the line
    uint8_t data[5] = {0, 0, 0, 0, 0};
    // Response: sensor pulls LOW ~80us, HIGH ~80us, then the first bit's LOW.
    if (!dhtWait(p, 1, 200) || !dhtWait(p, 0, 200) || !dhtWait(p, 1, 200)) return mkBuffer(NULL, 0);
    for (int bit = 0; bit < 40; bit++) {
        if (!dhtWait(p, 0, 200)) return mkBuffer(NULL, 0);   // ~50us LOW
        uint64_t high = system_timer_current_time_us();
        if (!dhtWait(p, 1, 200)) return mkBuffer(NULL, 0);   // 26-28us = 0, ~70us = 1
        uint32_t width = (uint32_t)(system_timer_current_time_us() - high);
        data[bit >> 3] = (data[bit >> 3] << 1) | (width > 45 ? 1 : 0);
    }
    return mkBuffer(data, 5);
#else
    return mkBuffer(NULL, 0);
#endif
}
// HC-SR04 echo width in microseconds by polling the pin, like Arduino pulseIn.
// CODAL pins.pulseIn uses edge events plus a timer wakeup (getPulseUs); on V2 repeated
// calls returned values for a while and then only timeouts. 0 = no echo, -1 = bad pins.
//%
int echoPulse(int trigger, int echo, int timeout) {
#if MICROBIT_CODAL
    auto trig = pxt::getPin(trigger);
    auto input = pxt::getPin(echo);
    if (!trig || !input || trigger == echo || timeout <= 0) return -1;
    input->setPull(codal::PullMode::None);
    uint64_t start = system_timer_current_time_us();
    // A previous ping with no reflection can still hold ECHO high; let it finish first.
    while (input->getDigitalValue()) if (system_timer_current_time_us() - start > (uint64_t)timeout) return 0;
    trig->setDigitalValue(0);
    sleep_us(4);
    trig->setDigitalValue(1);
    sleep_us(12);
    trig->setDigitalValue(0);
    start = system_timer_current_time_us();
    while (!input->getDigitalValue()) if (system_timer_current_time_us() - start > (uint64_t)timeout) return 0;
    uint64_t rise = system_timer_current_time_us();
    while (input->getDigitalValue()) if (system_timer_current_time_us() - start > (uint64_t)timeout) return 0;
    return (int)(system_timer_current_time_us() - rise);
#else
    return -1;
#endif
}
// One explicit SAADC conversion during the Sharp-style LED pulse. Core analogReadPin
// returns a free-running/oversampled DMA value, which is not a synchronized sample.
// Borrow the ADC through CODAL sleep/resume, never while a streaming consumer is active.
//%
int sampleDust(int analog, int lamp) {
#if MICROBIT_CODAL
    auto input = pxt::getPin(analog);
    auto ledPin = pxt::getPin(lamp);
    if (!input || !ledPin || analog == lamp || dustSampling) return -1;
    auto channel = uBit.adc.getChannel(*input, false);
    if (!channel) return -1;
    for (int i = 0; i < NRF52_ADC_CHANNELS; i++)
        if (uBit.adc.channels[i].isEnabled() && uBit.adc.channels[i].isConnected()) return -1;
    dustSampling = true;
    // This also ensures CODAL has a running ADC configuration to restore afterwards.
    input->getAnalogValue();
    uint32_t psel = 0;
    const int analogNames[] = {2, 3, 4, 5, 28, 29, 30, 31};
    for (int i = 0; i < 8; i++) if (input->name == analogNames[i]) psel = i + 1;
    if (!psel) { dustSampling = false; return -1; }
    ledPin->setPull(codal::PullMode::None);
    ledPin->getDigitalValue(); // Released LED control; external voltage-compatible driver required.
    uBit.adc.setSleep(true);
    NRF_SAADC->ENABLE = 0;
    NRF_SAADC->INTENCLR = 0xFFFFFFFF;
    NRF_SAADC->RESOLUTION = SAADC_RESOLUTION_VAL_10bit;
    NRF_SAADC->OVERSAMPLE = 0;
    NRF_SAADC->SAMPLERATE = 0;
    for (int i = 0; i < 8; i++) { NRF_SAADC->CH[i].PSELP = 0; NRF_SAADC->CH[i].PSELN = 0; }
    NRF_SAADC->CH[0].PSELP = psel;
    NRF_SAADC->CH[0].CONFIG = (SAADC_CH_CONFIG_GAIN_Gain1_4 << SAADC_CH_CONFIG_GAIN_Pos) |
        (SAADC_CH_CONFIG_REFSEL_VDD1_4 << SAADC_CH_CONFIG_REFSEL_Pos) |
        (SAADC_CH_CONFIG_TACQ_3us << SAADC_CH_CONFIG_TACQ_Pos);
    volatile int16_t sample = 0;
    NRF_SAADC->RESULT.PTR = (uint32_t)&sample;
    NRF_SAADC->RESULT.MAXCNT = 1;
    NRF_SAADC->EVENTS_STARTED = 0; NRF_SAADC->EVENTS_END = 0; NRF_SAADC->EVENTS_STOPPED = 0;
    NRF_SAADC->ENABLE = 1;
    NRF_SAADC->TASKS_START = 1;
    bool valid = dustWait(NRF_SAADC->EVENTS_STARTED, 200);
    if (valid) {
        ledPin->setDigitalValue(0);
        uint64_t start = system_timer_current_time_us();
        while (system_timer_current_time_us() - start < 280) {}
        // Interrupts remain enabled for BLE; reject a delayed sampling window.
        uint64_t at = system_timer_current_time_us() - start;
        NRF_SAADC->TASKS_SAMPLE = 1;
        valid = at <= 290 && dustWait(NRF_SAADC->EVENTS_END, 30);
        while (system_timer_current_time_us() - start < 320) {}
        ledPin->getDigitalValue();
        if (system_timer_current_time_us() - start > 340) valid = false;
    }
    ledPin->getDigitalValue(); // Release on every exit, including hardware timeout.
    NRF_SAADC->TASKS_STOP = 1;
    if (!dustWait(NRF_SAADC->EVENTS_STOPPED, 200)) valid = false;
    NRF_SAADC->ENABLE = 0;
    NRF_SAADC->EVENTS_STARTED = 0; NRF_SAADC->EVENTS_END = 0; NRF_SAADC->EVENTS_STOPPED = 0;
    NVIC_ClearPendingIRQ(SAADC_IRQn);
    uBit.adc.setSleep(false); // Restores channel configuration, DMA buffers, interrupts and PPI.
    dustSampling = false;
    return valid ? max(0, min(1023, (int)sample)) : -1;
#else
    return -1;
#endif
}
// V2's second UART is independent of the USB console on UARTE0.
//%
bool startSensorUART(int rx, int tx, int baud) {
#if MICROBIT_CODAL
    auto rxPin = pxt::getPin(rx);
    // tx < 0: receive-only. CODAL needs a TX pin, so the RX pin is passed and the UARTE TX output is
    // disconnected right after (CODAL itself only writes PSEL in configurePins; it never configures GPIO).
    bool rxOnly = tx < 0;
    auto txPin = rxOnly ? rxPin : pxt::getPin(tx);
    if (!rxPin || !txPin || (!rxOnly && rx == tx)) return false;
    if (baud != 9600 && baud != 19200 && baud != 38400 && baud != 57600 && baud != 115200) return false;
    if (!sensorSerial) sensorSerial = new codal::NRF52Serial(*txPin, *rxPin, NRF_UARTE1);
    else if (sensorSerial->redirect(*txPin, *rxPin) != DEVICE_OK) return false;
    if (rxOnly) NRF_UARTE1->PSEL.TXD = 0xFFFFFFFF;   // bit 31 = disconnected
    sensorRxOnly = rxOnly;
    if (sensorSerial->setRxBufferSize(254) != DEVICE_OK || sensorSerial->setBaudrate(baud) != DEVICE_OK) return false;
    // Initialize the lazy receive buffer and discard old data.
    uint8_t discard[64];
    for (int i = 0; i < 4; i++) if (sensorSerial->read(discard, 64, codal::ASYNC) < 64) break;
    return true;
#else
    return false;
#endif
}
//%
Buffer readSensorUART() {
#if MICROBIT_CODAL
    if (sensorSerial) {
        uint8_t data[64];
        int count = sensorSerial->read(data, 64, codal::ASYNC);
        if (count > 0) return mkBuffer(data, count);
    }
#endif
    return mkBuffer(NULL, 0);
}
//%
bool writeSensorUART(Buffer data) {
#if MICROBIT_CODAL
    if (!sensorSerial || sensorRxOnly || data->length == 0 || data->length > 32) return false;
    return sensorSerial->send(data->data, data->length, codal::SYNC_SLEEP) == data->length;
#else
    return false;
#endif
}
// First byte is success status; following bytes are payload. Unlike core, retain I2C read errors.
//%
Buffer readI2C(int address, int size) {
    if (size < 1 || size > 64 || address < 8 || address > 119) return mkBuffer(NULL, 1);
    Buffer result = mkBuffer(NULL, size + 1);
#if MICROBIT_CODAL
    int status = uBit.i2c.read(address << 1, result->data + 1, size, false);
#else
    int status = uBit.i2c.read(address << 1, (char *)(result->data + 1), size, false);
#endif
    result->data[0] = status == 0 ? 1 : 0;
    return result;
}

// CODAL hardware PWM/DMA path, avoiding the core bit-banger's long interrupt masking.
//%
bool showPixels(int pin, Buffer data) {
#if MICROBIT_CODAL
#if CONFIG_ENABLED(HARDWARE_NEOPIXEL)
    auto target = pxt::getPin(pin);
    if (!target || data->length == 0 || data->length > 192) return false;
    codal::neopixel_send_buffer(*target, data->data, data->length);
    return true;
#else
    return false;
#endif
#else
    return false;
#endif
}
}
