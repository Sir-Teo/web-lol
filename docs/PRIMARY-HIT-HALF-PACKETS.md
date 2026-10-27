# Primary-hit quad packet precision

Yi's private primary-hit quad sampler now preserves the native continuous atlas
frame through binary16 conversion before applying the shader's frame floor.
Lookup coordinates use the same packet precision. The
[native atlas witness](NATIVE-ATLAS-RUNTIME.md) establishes this ordering and
keeps the mesh and quad paths distinct.

The previous sampler floored random and animated contributions separately, then
wrapped the result by the entire texture grid. The recovered quad routine takes
modulo `numFrames`, adds `startFrame`, packs that continuous value as half, and
floors it in the vertex shader. Three real local sampler inputs expose the
boundary difference:

| Seed / profile / ordinal | Age | Previous cell | Corrected cell |
| --- | --- | --- | --- |
| 312 / fluid 0 / 5 | 0 | [0, 0] | [0.5, 0] |
| 47 / soft 3 / 3 | 0 | [0, 0.5] | [0.5, 0.5] |
| 144 / blood 2 / 1 | 0.998 | [0.75, 0.75] | [0, 1] |

These particles are alive at the sampled ages. The final blood coordinate
retains the shader's row before the existing repeat sampler applies addressing.
It is not clamped or wrapped by the CPU grid calculation.

All ten retained quad/billboard profiles have unit UV scale and zero offset and
scroll. Their UV0 corners are exactly representable as half, so the existing
uniform matrix produces the recovered atlas coordinates for these profiles.
Random atlases have power-of-two frame counts and zero animation rate, making
the float32 product exact without a general FMA emulation. A profile-assumption
guard rejects future source drift that would invalidate this specialization.
The initial quad checkpoint retained the ray's previous frame and lookup
calculation. The later [ray packet correction](PRIMARY-HIT-RAY-PACKETS.md) applies
its separately traced half lookup and normalized-byte color path.

`particleHalf` rounds float32 input to IEEE binary16 with ties to even, including
subnormals, signed zero and overflow. It uses reusable typed-array storage and
requires no new browser API. This is an explicit local rounding policy: live
native FPCR remains unobserved. Native age, lookup and RNG producers are also
unresolved; the change applies recovered packet arithmetic to the existing
local age, curves and indexed random inputs.

The verification includes every binary16 value, every finite half midpoint and
its adjacent float32 inputs on both signs, and 100,000 deterministic float32
patterns compared with ECMAScript's independent conversion when available.
Literal reference coordinates keep integration tests usable on Node 22, while
Node 24 also executes the standard-conversion corpus.

```sh
npx vitest run tests/particle-half.test.ts tests/masteryi-primary-hits.test.ts tests/source-particle-surfaces.test.ts --maxWorkers=1
node tools/qa/verify-primary-hit-packets.mjs --output-dir .cache/packet-check-new
```

The source comparison freezes commit `c0f75042056ee6d919c93b371e9741e1a5e08fa6`
and its complete `src` graph, verifies the lock and profile bytes, and compares
2,106 sampler calls. An independent Python/C reference uses float32 `fmaf`,
`fmodf` and Python's binary16 conversion. All 13,280 quad particles match that
reference; 84 cells and 13,244 lookup pairs change in this selected corpus.
At that quad checkpoint, every other output field and all 90 ray samples were
exact. The current verifier additionally checks the later ray packet correction.
These counts describe the test corpus, not native event frequencies.

The authored-texture GPU probe uses the actual shared surface material and a
GLSL reference port of the recorded quad atlas AIR expressions. Fifteen cases
at three render-target sizes match with zero differing bytes and no GL error.
The old policy differs by 190,566 channel bytes, so the fixtures detect the
regression. Atlas-only cases use a neutral white lookup because their original
birth/near-expiry lookup colors are black; separate midlife cases retain the
authored lookup textures. Tint, size and blending are normalized to inspect UV
arithmetic. This is an isolated WebGL shader test, not native Metal execution
or a claim of native final-frame parity.

All four game primary-hit browser regressions and both sword regression tests
pass. The full suite has 3,086 passes out of 3,088 tests, with the same two known
baseline failures and the original five-second wave deadline. Focused tests,
TypeScript and Node QA pass. Production identity, offline-pack acceptance and
retained artifacts are in the
[verification ledger](reference/primary-hit-half-packets-verification.json).
