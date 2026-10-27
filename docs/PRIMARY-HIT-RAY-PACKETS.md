# Primary-hit ray packet precision

Yi's private critical-hit ray now uses half lookup coordinates and normalized
byte color values matching the recovered
[ray builder](NATIVE-RAY-PACKET.md) and matching first
[Metal declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md).
Its existing local frame, geometry, source curves, motion, birth and lifetime
policies are unchanged.

The ray's color path differs from the fast quad helper. For finite components,
it clamps float32 input at zero and one; inside that range it converts float32
`fma(component, 255, 0.5)` to an unsigned byte. Metal's UChar4Normalized format
then supplies normalized values to the shader. The renderer writes those BGRA bytes to a normalized Uint8 vertex attribute
on the ray's owned geometry, enabling the existing BGRA shader input and using
a white tint uniform. The sampler's source color values stay unquantized. The ray's
explicit mode 4 does not enter the native mode-0/2 RGB-premultiplication branch.
Its omitted modulation factor has a separately witnessed white constructor
default. Other emitter families retain their existing color policies.

Float32 rounding before integer conversion matters. At input
`0.0019607841968536377`, the recovered float32 path produces byte 1, while
rounding only in JavaScript double precision produces byte 0. At input
`0.5039215683937073`, the results are bytes 129 and 128. `particleUnorm8` retains
the float32 input and FMA rounding before truncation. It uses no new browser API.
Half and float32 nearest-even arithmetic remain explicit local policies;
live native FPCR, clocks and prepared-record producers are unobserved.

The retained ray has unit UV scale, no offset/scroll or multiplier, one static
frame, lookup types [1,0] and explicit blend mode 4. Its RGB curves remain white
and alpha stays within the unit range. An assumption guard requires these
properties. Lookup coordinates are half-rounded before upload, as in both
recovered builders. Arbitrary per-vertex UV transforms and native size/orientation
producer mapping remain outside this correction.

```sh
npx vitest run tests/particle-unorm8.test.ts tests/particle-half.test.ts tests/masteryi-primary-hits.test.ts tests/source-particle-surfaces.test.ts tests/ray-quad.test.ts --maxWorkers=1
node tools/qa/verify-primary-hit-packets.mjs --output-dir .cache/packet-check-new
```

The independent Python/C reference checks 2,106 sampler calls against the frozen
source graph at `c0f75042056ee6d919c93b371e9741e1a5e08fa6`. All 13,280 quad
packets retain their previously verified results. Of 90 ray samples, 81 change
packed color and lookup precision. All source color samples and every other
ray field, including frame and geometry, remain exact. These are selected test-corpus counts, not native event frequencies.
The reference also checks 101,030 color inputs: every normalized byte, all byte
midpoints and adjacent float32 values, endpoints and 100,000 deterministic
samples. All match C `fmaf`; 128 cases detect double-only rounding.

The GPU calibration builds actual runtime ray surfaces with the authored base
texture and production's white fallback for its omitted lookup texture.
Its independent reference uses C-derived normalized Uint8 BGRA attributes, a
white color uniform and Python-derived half lookup coordinates. A second material
retains the former float color and lookup values to demonstrate that the probe
can detect the change. Seven times, three cameras, two target sizes and both raw
and runtime blending exercise both raw and runtime blending. All 84 cases are nonempty and match
exactly with no GL error; the former float path differs by 76,513 channel bytes.
An initial uniform representation differed from the normalized-attribute
reference by one byte at one pixel. The final renderer uses the recovered
attribute type directly, preserving strict zero-difference acceptance.
This is a WebGL input-format test, not native Metal execution or complete native
visual parity.

The full unit suite passes 3,095 of 3,097 tests with the same two baseline
failures and the original five-second wave deadline. All 58 focused tests, TypeScript and all six Node QA cases pass. The new
ownership checks cover normalized byte order, a reused dynamic buffer, white
uniform tint and immutable caller color/tint arrays. Unrequested surfaces retain
their existing shared geometry and uniform path. Browser, production and artifact details are
retained in the [verification ledger](reference/primary-hit-ray-packets-verification.json).

The later [birth-scale correction](NATIVE-RAY-BIRTH-SCALE.md) preserves separate
ray width, length and near displacement. The geometry-equivalence statements
and counterfactual pixel counts above describe this packet-precision checkpoint;
its immutable record retains the source snapshot used for those checks.
