#include "pxt.h"
using namespace pxt;
namespace BrixelNative {
#if MICROBIT_CODAL
static bool dustSampling = false;
static bool dustWait(volatile uint32_t &event, uint32_t timeout) {
    uint64_t start = system_timer_current_time_us();
    while (!event) if (system_timer_current_time_us() - start > timeout) return false;
    return true;
}
#endif
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

}
