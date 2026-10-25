# Original Metal reflective mesh execution

The original ordinary-mesh VS33/PS54 now execute in the owned Metal harness.
All111 synthetic reflective samples match WebGL and the independent scalar
reference exactly at RGBA8 readback on the recorded Apple M1. A fresh150-case
rim regression also matches exactly after extending the shared harness, for261
draw comparisons in this increment. The League executable, native emitter
dispatch and gameplay frames remain unobserved.

## Observed shader behavior

The111 cases include81 source/tint/lookup-alpha combinations, seven face-selection
cases spanning all six cube faces, six varying-normal/scale/parameter cases,
three remap cases, two UV selections, six reflection-power/color cases, two rim
power cases and four isolated cube controls. The first106-case run also passed;
the accepted run adds the negative-Y face and isolated cube controls.

With zero base RGB/alpha, zero tint alpha and zero rim RGB, a reflection amount
of`.7` produces `[49,45,34,0]`. Both zero and full cube alpha produce those exact
bytes. Setting the amount to zero produces `[0,0,0,0]`. Thus original PS54's cube
RGB contribution survives zero fully tinted source alpha and ignores cube alpha
in these controlled draws. The rim contribution still multiplies fully tinted
alpha. PS54 has no alpha test; the harness explicitly rejects a positive alpha
reference for this mode. These findings match the previously retained AIR:

```text
C = source * kColorFactor * lookup
F = interpolated mix(minimum, maximum, 1 - facing^reflectionPower)
selectedRGB = remap.a > 0 ? remap.rgb : C.rgb
RGB = clamp(selectedRGB + cube.rgb * F * mix(1, reflectionColor.rgb, F)
            + C.a * interpolatedRim, 0, 1)
alpha = C.a
```

The selected cube direction and reflection amount are computed per vertex and
interpolated before fragment sampling. Normals use the upper world matrix,
including nonuniform scale. The common camera, row-packed projection, oversized
triangle, RGBA8 textures/target, nearest filtering, no blending/depth test and no
culling follow the [rim harness](LEONA-METAL-RIM-HARNESS.md). Cube faces use the
explicit `+X,-X,+Y,-Y,+Z,-Z` sequence. Solid colors per face check face selection;
they do not validate within-face coordinates, filtering or mip selection.

## ABI and reproducibility

The independently retained static ABI reading re-extracts both exact programs
from their pinned TOC/bundle offsets and checks original Metal/AIR identity,
member metadata and VS/PS varying linkage. It performs no GPU execution. Its
immutable harness snapshot already contains the parent implementation; its
static comparison reports no mismatch in the inspected bindings. The runtime
[verification ledger](reference/leona/metal-reflection-verification.json)
freezes that reading, commands, libraries, harness source/executable, all cases,
pixel results and the fresh rim regression.

| Binding | Reflective layout |
|---|---|
| Vertex attributes |0 position,2 normal,8 UV |
| Vertex buffers |1 frame560B;2 world304B;9 locals160B |
| Vertex locals | reflection0; fresnel16; UV32; multUV80; tint128; depth144 |
| Fragment buffer16 | reflectionColor0; lookupUV16; total32B |
| Textures |0 remap;1 base;2 lookup;3 cube |
| Samplers |0 base;1 lookup;2 cube;15 shared clamp |

On the same supported local setup, explicitly execute:

```sh
node tools/qa/run-leona-metal-rim.mjs --run --reflective --output .cache/my-reflection-run
node tools/qa/run-leona-metal-rim.mjs --run --output .cache/my-rim-regression
```

The runner checks pinned library digests before loading, compiles only the owned
Swift harness and closes its own Chrome/Vite processes. No native game or provider
is started. Offline verification requires no GPU work:

```sh
node tools/qa/verify-leona-metal-rim.mjs --pin docs/reference/leona/metal-reflection-verification.json
node tools/qa/verify-leona-metal-rim.mjs --historical
```

After the later [depth harness](LEONA-METAL-DEPTH-HARNESS.md) extends shared QA
sources, also add `--historical` to the first command for this111+150 ledger.
The depth ledger retains a fresh267-case run with the new projection/state.

The second command verifies the prior150-case rim archive using its frozen case
module. Missing-sample, altered-pixel and changed-library-record controls are
rejected by the shared offline verifier. Its source/ledger remain historical after the shared harness extension.

## Limits

The inputs are explicit synthetic uploaded uniforms and resources. They are not
proof that sword2 selects REFLECTIVE: the identified fresh-empty-map SCB path
instead supports the rim-only adapter. Cube resource/default identity, native
CPU tint/component lifecycle, frame placement, shader variants, fog, depth,
blending/culling and compositing remain unresolved. Byte equality on these finite
one-pixel cases is not float-bit, cross-device or full-frame equality. There is
no performance result, normal-match cohort or new production/offline run. No
application/public asset, schema126, ruleset or offline-pack change is made.
