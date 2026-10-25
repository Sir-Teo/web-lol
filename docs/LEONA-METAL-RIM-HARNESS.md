# Original Metal rim shader execution

The retained VS1 and PS9/PS24 programs now execute in an isolated, owned Metal
harness. All150 synthetic samples match the reconstructed WebGL material and an
independent scalar reference exactly at RGBA8 readback on an Apple M1. This is
the first execution of the retained native shaders in this project. The League
executable remains unexecuted; this result does not establish its emitter
dispatch, resources, attachment frames or rendered gameplay frames.

## Scope and inputs

The libraries are the original extracted Metal containers from the frozen
16.18.8175716 shader WAD. The existing
[reflection-input](LEONA-NATIVE-REFLECTION-INPUTS.md) and
[SCB-material](LEONA-NATIVE-SCB-MATERIAL.md) packages establish extraction identity
and AIR layouts. They remain historical static findings. The new
[runtime ledger](reference/leona/metal-rim-verification.json) records exact library,
harness, case, executable and output identities separately. There are no REA
Evidence IDs for this ordinary local harness execution.

| Program | Retained flags | Execution |
|---|---|---|
| VS1 | DISABLE_FOW | All150 draws |
| PS9 | DISABLE_FOW | Reference absent/zero |
| PS24 | DISABLE_FOW, ALPHA_TEST | Positive reference |

The owned Swift harness loads these libraries without recompiling their shader
code. It builds two render pipelines with explicit attributes0/2/8, vertex
buffers1/2/9, fragment buffer16, textures0/1/2 and samplers0/1/15. Uniform byte
offsets follow the retained AIR. A row-packed projection maps source z=0 to
Metal clip z=.5 while preserving the WebGL fixture's x/y/w. An oversized triangle
covers the single pixel with barycentric weights `[.5,.25,.25]`. Nonuniform model
scale is compensated in positions so the projected points stay fixed. Camera
position is `[0,0,1000]`. Textures use RGBA8, nearest filtering and clamp-to-edge;
the target is linear RGBA8 with blending/depth tests disabled and no culling.
Each command buffer must complete successfully before CPU readback.

The150 cases cover81 source/tint/lookup-alpha combinations;45 reference/remap
combinations; four fully tinted-alpha rejections; nine varying-normal/scale/remap
combinations; nine power/facing controls; and two source-UV texel selections.
Remap and lookup textures are constant one-pixel synthetic resources. These
cases do not validate a varying luminance ramp or native sampler/resource choice.

The threshold cases demonstrate that original alpha4/255 is discarded at a
reference5/255, equality5/255 survives, and remap alpha does not rescue discarded
source alpha. Source alpha zero still retains RGB in PS9. The mapped exponent
`.8350000381469727` and raw `.15` produce different pixels. Changing upper-world
normal scale and UV texel selection also changes output. Every WebGL probe has
zero GL errors and no cube resource. Maximum Metal/scalar, WebGL/scalar and
Metal/WebGL byte difference is zero in the accepted run.

## Reproduction

On macOS with the retained cache, Apple command-line Swift/Metal and installed
Chrome, explicitly execute:

```sh
node tools/qa/run-leona-metal-rim.mjs --run --output .cache/my-metal-rim-run
```

This checks the static provenance first, compiles only the owned Swift harness,
loads and executes the original libraries, starts an owned local Vite server,
runs Chrome against the existing material probe and closes the browser/server.
It writes scope, commands, compiler/native stdout/stderr, cases, input hashes and
all comparisons. It is excluded from ordinary checks and production boot.
Offline evidence verification performs no GPU execution:

```sh
node tools/qa/verify-leona-metal-rim.mjs
```

The first two-library check only loaded VS1/PS24. The following smoke draw and
initial full run are retained alongside the accepted full run; all completed.
The accepted run adds explicit command/stdout/stderr retention and waits for its
own strict-port server before opening the page. The first offline archive check exposed an absolute/relative executable-path
lookup mismatch; the verifier now normalizes recorded absolute paths against the
repository root. That failure is retained. Missing-sample, altered-pixel and
changed-library-record controls are rejected by the offline verifier. No provider
was restarted.

## Remaining limits

Byte equality on one device, OS, raster configuration and finite synthetic cases
does not imply float-bit equality, cross-device precision or full shader parity.
There is no native depth-push/occlusion, blending, culling, FOW, soft-depth,
multi-pixel derivative, context-loss or performance result here. Existing WebGL
tests cover some of those local behaviors separately. CPU tint/power packing,
SCB normal derivation and conditional shader selection remain static findings;
this harness supplies their inputs explicitly. Actual Leona E bindings, component
lifecycle and native gameplay frames remain open. E remains19 visible families
plus its sound carrier, R remains41/44, and player/support/full-roster acceptance
is unchanged. No application, public asset, schema126, ruleset or offline-pack
change follows from this verification increment.
