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
