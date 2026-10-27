# Solar Flare ray packets

Leona's Solar Flare `FocusCone` rays (green/red area profiles 11/17) and
`FlashRays` impact emitter (profile 23) use normalized Uint8 BGRA vertex colors
and binary16 lookup coordinates. Raw authored color arrays stay unquantized in
the sampler. Each ray owns its reusable color attribute, which the existing
surface material consumes with a white tint uniform.

The [native Ray builder](NATIVE-RAY-PACKET.md) and
[Metal vertex declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md) establish the input
format and conversion. Finite components clamp to [0,1] and convert using
float32 `fma(component,255,0.5)` followed by unsigned truncation. The two area
rays use mode4 and retain RGBA. The mode0 impact ray first premultiplies RGB by
alpha in float32 and sets packet alpha to 1. Previously its local float uniform
premultiplied RGB while retaining alpha, which also changed alpha-threshold
coverage. A renderer-owned scratch tuple supplies the corrected mode0 tint
without allocating a new array each update or mutating the source color.

All three source definitions omit modulationFactor, whose separately witnessed
constructor default is white. Their static 1×1 atlas, unit UV transforms,
omitted lookup texture, absent multiplier and mode0/4 assignments are guarded.
Other Solar families and the shared renderer's default tint policy retain their
existing behavior. Births, local curves, motion, dimensions, rotations, visibility,
audio and saved histories keep their existing policies.

The independent comparison freezes the complete source graph and lockfile at
`d72dd86fe75cc43e0b137bdf29e2ccc28f125cfc`. Across 9,774 sampler calls, all 127,005
sampled non-ray states and every other field of 28,917 rays remain exact. The
C/Python reference checks the controller's actual tint policy and independently
rounds lookup coordinates to binary16.

| Profile | Ray samples | Changed color packets | Changed lookup pairs |
| --- | ---: | ---: | ---: |
| Green area 11 | 756 | 756 | 747 |
| Red area 17 | 756 | 756 | 747 |
| Impact 23 | 27,405 | 27,405 | 26,955 |

These are selected corpus counts, not native emission frequencies. The GPU
oracle borrows color/material routing from the real Solar controller. Seven
phases, three cameras, two sizes and raw/runtime blending yield 84 nonempty
cases per ray. All 252 cases match the independent normalized-byte reference
with zero changed channel bytes and no GL error. The prior float policies differ
by 27,185 green, 9,545 red and 112,272 impact channel bytes in this corpus.
Geometry is shared to isolate packet input changes; this is no new native
geometry or complete visual-parity claim.

```sh
node tools/qa/verify-solar-ray-packets.mjs --output-dir .cache/solar-packet-check-new
npx playwright test e2e/solar-ray-packets.spec.ts e2e/leona-solar-surfaces.spec.ts e2e/leona-solar-history.spec.ts
```

Save/reload and graphics recovery descriptors now include the color attribute.
The older history browser test's stale literal schema130 expectation uses the
exported current snapshot version, retaining an exact version check. Native
clocks, curve arithmetic, RNG, live dispatch, shader selection, optional external
modifiers, transform inheritance and FPCR remain unobserved. No performance or
physical game-FPS claim follows from this packet calibration.

The [verification ledger](reference/solar-ray-packets-verification.json) records
source identities, independent comparisons, browser evidence and production
acceptance.

Acceptance records 3,099 passing unit tests out of3,101 across391 files, with
the same historical Leona archive and platform-specific Lux golden failures.
All31 focused tests, TypeScript and six Node QA checks pass. Sixteen distinct
browser cases pass across the final runs, including both source-family area
alternatives, saved histories, graphics recovery, disposal and prior Yi oracles.
Production validation passes32 gameplay recordings with eight fresh screenshots
and zero unintended private-character preloads. All113 tracked Leona asset/data
files keep their bytes and modification times;49 missing original source
resources were restored and verified against their frozen hashes.
