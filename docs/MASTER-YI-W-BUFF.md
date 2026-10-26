# Sustained Meditate effects

Accepted W in the private Yi fixture now starts all four `MasterYi_W_Buf`
emitters alongside the [seven cast emitters](MASTER-YI-W-CAST.md). The existing
channel owns healing, mana, mitigation and interruption. Public selection remains
Ashe/Lux; damage and tenacity systems are retained sources for later work.

| Source emitter | Primitive | Retained behavior |
| --- | --- | --- |
| `bigray` | Ray | Yellow birth tint, authored fade/growth, non-local orientation and frame 3 of a 2×2 atlas |
| `orb` | Source heal mesh | 35/second, eight random atlas frames, rise/rotation/scale, radian draw-time orbit and independent multiplier scroll |
| `nova` | Arbitrary quad | 9/second, variable finite life, authored rotation, wave texture and randomized UV scroll/offset |
| `energy_sparks` | Billboard | 15/second, rotated legacy shape, variable upward velocity, attraction/orbital fields and source lookup scales |

The [raw source](reference/masteryi/w-particles.json),
[decoded transport](reference/masteryi/w-particle-texture-transport.json) and
[compiled buff reading](reference/masteryi/w-buff-particle-reading.json) remain
separate. Six source textures retain all 54 authored mip levels. Two transports
reuse cast URLs; four new PNGs and one heal GLB are delivered. The source mesh
has 403 vertices, 733 triangles and 2,199 expanded corners. Position/UV ordering,
opaque face RGB, flags and 24-byte tail remain preserved. No normals, vertex
colors or tint are invented. Texture pixels are not resized, gamma converted,
premultiplied or replaced with generated mipmaps.

Schema 151 saves admission audience, rank, the planned channel end and actual
emission stop/reason. New births stop on the interrupted update; existing
particles keep their finite source lives. Natural completion, orders, control,
mana exhaustion, death and victory close emission. Death freezes the captured
root, and terminal presentation drains without advancing the simulation. A
creation hidden from blue never becomes visible through later vision. Each
bound particle also needs known birth and current root frames.

Root histories use lossless runs of identical fixed-step position, facing and
audience endpoints. A stationary channel can retain one run through all 240
channel ticks. Movement or vision changes split runs; interpolation uses the
same endpoints and shortest facing turn as dense frames. Decoding requires
canonical, contiguous coverage, channel linkage and finite retention. The
largest history is 361 ticks; interrupted records expire at stop plus 121 ticks.
Cosmetic sampling consumes no World RNG or entity/event identities.

The energy spark field hashes remain raw in the frozen source. The local
adapter reads the attraction centre `[0,150,0]`, radius 200 and strength 100.
The pinned reconstruction reader supplies the sparse orbital field's omitted
world-up axis. Attraction acts before tangential orbital redirection; draw-time
orbital velocity on `orb` is a separate radian rotation. The 60 Hz force seek,
indexed cosmetic draws, source-X reflection, source shape interpretation and
accepted-W dispatch are local reconstruction policies. Native script callback,
attachment, RNG, integration cadence and precision parity remain unverified.

Shared shader defaults include an explicit neutral white lookup where omitted,
source alpha lock, independent multiplier UVs on the mesh, repeated base
textures and clamped linear lookup. All four W systems omit on-create sound;
this integration infers no audio binding.

Assets load for present or late Yi units. A complete closure is required before
rendering. Verified successes survive a failed load; explicit retry requests
only failed resources. Cast and buff share one page-owned cache for identical
texture URLs, verified declarations and samplers. Concurrent consumers share
both request and decode; a failure is evicted for explicit retry, and unrelated
successes remain available. Programs borrow textures without disposing shared
bitmaps. Rendering does not retry the network each frame.

Reproduce source and focused validation:

```sh
python3 tools/assets/export-masteryi-w-buff-particles.py --check
python3 -O tools/assets/export-masteryi-w-buff-particles.py --check
python3 tools/assets/test-masteryi-w-buff.py
python3 -O tools/assets/test-masteryi-w-buff.py
node tools/qa/orbital-field-conformance.mjs
npx vitest run tests/actor-root-history.test.ts tests/masteryi-meditate-buff-history.test.ts tests/masteryi-meditate-buff-particles.test.ts --maxWorkers=1
```

The source exporter passes 19 guards in both Python modes. Normal and optimized
check/replay runs preserve all ten delivery files in bytes and timestamps. The
focused history, sampling, cache, loader and existing W/force/compatibility run
passes 158 cases across ten files. The full suite passes 2,687 of 2,690 cases
across 364 files; the three previously recorded source-artifact baseline failures
remain. The original 111,600-tick wave-clock check passes its unchanged five-second
limit. TypeScript/production build and three Node QA checks pass.

The shared-cache unit checks cover concurrent borrowing, successful reuse,
shared failure with explicit retry, unrelated successful resources, conflicting
metadata/samplers and disposal during loading. Both targeted browser retry tests
pass with the original cast request counts, exact pixel assertions and timeout.

The final combined Chromium/SwiftShader run passes all 15 cases with retries
disabled: five buff, four cast, three channel and three Q contact checks. Real
W input restores exact particle descriptors and future snapshots at opening,
sustained and interrupted times. The active buff verifies all 54 source mip
levels through Three/WebGL readback, the cast verifies 87, and Q retains its
59-level check. The heal mesh has 2,199 actual loaded corners. Both shared
cast/buff textures are the same Three texture objects. Hidden creation,
selective retry and finite death/victory cleanup retain their exact assertions.

The strict production `/nested/rift/` audit passes all 32 recordings, including
real Lux controls, ward/Oracle/companion interactions, restart/restore and
opacity checks. Ordinary production scenes request zero development Yi cast
or buff textures/meshes; development hooks and private Yi selection remain absent.

Schema 151 uses ruleset
`2226d9e65d9051ccc9513dca219939632de0ad4afa78aef351ecf032cd2e2c14`.
The verified production pack is
`db1c523fc5cc56d52bbada5984d0df8ebb78f14857a05a49eb764dbcb9301c39`
with 1,137 files and 533,088,328 bytes. Exact source archives, staged diagnostics
and verification identities are retained in the
[verification ledger](reference/masteryi/w-buff-verification.json).
These checks do not certify physical-device FPS, listening, native execution,
the entire browser suite or offline installation.
