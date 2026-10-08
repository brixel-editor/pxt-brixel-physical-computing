# Source and publication notes

This package is derived from the user's existing BRIXEL MakeCode extension working copy, `brixel-final-dev_20260725` (`brixel-ext` version 0.0.3), including its current uncommitted fixes. The original project's MIT license and source comments are retained.

## Packaging changes

- Package name: `brixel-physical-computing`; repository: `brixel-editor/pxt-brixel-physical-computing`; initial publication: v0.1.0.
- The 435 block functions, namespace names, enum values, defaults and device code are retained. The Science Lab drivers are not substituted into this extension.
- Large TypeScript files are split at namespace statement boundaries to stay below MakeCode's per-file package limit. Declarations shared between namespace fragments are exported solely for TypeScript namespace merging, without adding block annotations. Function bodies and variable initializers are unchanged.
- All 35 original locale dictionaries are preserved. PXT loads and merges `<package>-strings.json` and `<package>-jsdoc-strings.json`; large dictionaries use both standard filenames. Translation keys and values are unchanged.
- Development backups, local audit notes, build output and other projects are not included in the public package. Public file selection is explicit.
- The original icon is kept in the repository; binary image data is not listed among the compiler's text input files.

The file size constraint is described in the [official MakeCode extension guide](https://github.com/microsoft/pxt/blob/master/docs/extensions/getting-started.md). The two localization filenames are read by `Package.packageLocalizationStringsAsync` in PXT core.

## Verification

Local records retain the source hashes, normalized declaration comparison, block/category counts, all-locale equality checks, block parameter checks and micro:bit V2 native compilation results. The release is also imported into a separate MakeCode test project from its GitHub URL.

Compilation and editor installation do not verify electrical wiring, timing or sensor accuracy. Existing hardware limitations are summarized in README; device implementations still need testing on the corresponding physical modules.


## v0.2.0 sensor reuse and stability changes

Selected code is adapted from [BRIXEL Science Lab v0.6.1](https://github.com/brixel-editor/pxt-brixel-science-lab/tree/v0.6.1), MIT, Copyright (c) 2026 BRIXEL. Its notice is retained through this package's MIT LICENSE.

| Local file | Science Lab source |
|---|---|
| `11_science_support.ts` | analog/digital pin preparation and stable calibration sampling from `core.ts` |
| `11_basic_sensors.ts` | named analog/digital wrappers from `sensors.ts` |
| `11_science_calibration.ts` | WCS2801 from `analog-science.ts`, voltage/turbidity from `analog-measurements.ts`, dust averaging from `analog-dust.ts` |
| `11_native.ts`, `native-dust.cpp` | only the dust sampling shim/native implementation from `native.ts` / `native.cpp` |

Namespace and pin types were adapted to this extension. The second UART, Science Lab toolbox, Bowerbird transport and unrelated dependencies were not copied. Local provenance records retain source SHA-256 hashes.

`12_pca9685_servo.ts` follows the [NXP PCA9685 data sheet](https://www.nxp.com/docs/en/data-sheet/PCA9685.pdf). `12_websocket.ts` implements bounded text framing using [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html) and the [Espressif ESP-AT TCP interface](https://docs.espressif.com/projects/esp-at/en/release-v2.3.0.0_esp8266/AT_Command_Examples/TCP-IP_AT_Examples.html). Manufacturer references for calibration and gas measurements are linked in `docs/sensor-calibration.md`.

The original checkout is hash-checked without modification. In v0.2.0 the authorized source fixes intentionally change implementation bodies; compatibility checks preserve the original 435 block signatures and enum values rather than requiring old bugs to remain identical. New Korean translations use English fallback elsewhere. Full-file equality checks described above apply to initial packaging only.
