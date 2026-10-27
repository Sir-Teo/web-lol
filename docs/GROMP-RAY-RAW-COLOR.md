# Float32 raw-key colors for Gromp Rays

The two Gromp death Ray profiles now prepare their source color keys and sample
them with the checked legacy float32 operation sequence. Base and key channels
are converted to float32 and multiplied before interpolation. Key times and
the supplied local phase are float32; subtraction, division, multiplication
and addition round separately. The interpolator does not fuse multiply/add.

This aligns the color component within the game's existing raw-key rendering
policy. It does not establish the native live draw path, later cache mutation,
backing-store mode, actor clocks or external draw modifiers. The six non-Ray
profiles retain their previous arithmetic. Source values, local clocks, RNG,
geometry, atlas, lookup coordinates, texture binding and blend factors remain
unchanged. The existing Ray byte writer still owns premultiplication and packing.

The [native curve witness](NATIVE-LEGACY-COLOR-CURVES.md) retains the exact
original Troy strings, prepared float32 words, reader/sampler instructions and
conditional draw producer. The host-C reference reads those strings from the
SHA-pinned record, compiles without contraction or fast math, and records the
compiler, source and source-pin identities. It executes no native game code.
Only profiles 5 and 7 at normalized local phases are accepted. Host-reference
arithmetic uses IEEE float32 rounding; native FPCR, flush-to-zero and live
process locale remain unobserved.

Across 6,507 calls, all 255,500 non-Ray states and every other field of 59,204
Rays remain exact against the frozen source graph at
`4ebf87e10cabf9f7eeafc94929b9486165cc5b79`. Every Ray color word and packet byte
matches independent C. Another 2,017 boundary and randomized phases also match.

| Profile | Retained states | Changed float32 color states | Changed packed BGRA |
| --- | ---: | ---: | ---: |
| pop (5) | 32,523 | 18,085 | 0 |
| popshards (7) | 26,681 | 8,733 | 1 |

The changed packet is corpse ID 0, death tick 0, sample tick 8, shard ordinal 8.
Its retained local phase is `0.7291666666666665`. Float32 interpolation gives
alpha word `3f0aaaaa`; the previous result rounded to `3f0aaaab`. With the
existing mode-0 premultiplication, BGRA changes from `[111,28,55,255]` to
`[110,28,55,255]`. The maximum retained packet change is one byte value.
The changed-color-state column compares float32 words after coercing the old
tuple; it is distinct from a double tuple simply gaining float32 storage.

Preparation rejects unsupported empty/unordered curves, wrong tuple arity and
nonfinite/overflowing storage. Samples own their output tuples. C-backed unit
fixtures cover keys, neighboring float32 phases and the quantization boundary.
Reference replay and scope guards run with normal and optimized Python.

The earlier [curve-view performance comparison](GROMP-CURVE-VIEWS.md) now freezes
both accepted historical endpoints, preserving its original equality, allocation
and timing assertions. It does not measure this arithmetic change.

```sh
node tools/qa/verify-gromp-ray-packets.mjs --output-dir .cache/gromp-raw-color-new
npx vitest run tests/legacy-particle-color.test.ts tests/gromp-death-particles.test.ts --maxWorkers=1
node --test tools/qa/legacy-ray-color-reference.test.mjs
npx playwright test e2e/gromp-ray-packets.spec.ts e2e/gromp-death.spec.ts
```

The [verification ledger](reference/gromp-ray-raw-color-verification.json)
records final source snapshots, C/compiler provenance, actual-batch pixel
comparisons and application acceptance. Full native appearance and timing
remain separate validation work.

Browser calibration retains the original seven visible phases per Ray profile
and adds the exact tick-eight shard case. All 180 comparisons are nonempty and
match C-backed packet colors and lookup values with zero differing channel bytes
and no GL/page errors. The previous-color counterfactual uses the same byte
attributes, lookup coordinates and material; it differs by 30 rendered channel
bytes across eight views of the added case. The original float-attribute
counterfactual is also retained, including its prior 2,311/26,569 changed-byte
counts across the original phases.

The actual game-flow check still verifies all eight layers, exactly eight
effect draws, posed-bone anchoring, fog, exact active buffer bytes across
Save/reload, and disposal. The 75 focused unit tests, TypeScript and eight Node
QA cases pass; the new unit file contributes 51 cases. The normal/optimized
reference checks preserve output ownership and reject unsupported profiles,
invalid phases, altered source pins and conflicting output files.


Exact knot equality follows the checked `b.le` at `0x10191c240`: the raw-key
loop advances to the next interval, or returns the stored last key. A separate
non-binary-color regression exposes the rounding error from approximating a
stored knot through the interval on its left. The original 34 C fixtures and
all actual Gromp color values are unchanged by this boundary alignment.

Final full-suite acceptance records 3,191 passes out of 3,193 across 396 files,
with the same two historical/platform-dependent baseline failures. Their source,
golden values and assertions are unchanged. Save schema 163 and simulation
rules remain unchanged.

Final nested production validation passes 32 recordings, eight fresh screenshots
and zero unintended private-asset preloads. All 543 asset/data files retain
their bytes and modification times. The verification ledger links the final
build identity and archived closure; native appearance, clocks and live process
conditions remain outside these local component checks.
