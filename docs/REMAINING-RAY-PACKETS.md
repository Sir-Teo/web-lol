# Modern ray packet coverage

Leona W's two `rays` emitters, Garen's critical `Up_Impact`, Q `forward_Impact`,
and R kill `fireLine` now use owned normalized Uint8 BGRA color streams and
binary16 lookup coordinates. The samplers retain their raw color arrays and
all other fields. The [Ray builder](NATIVE-RAY-PACKET.md) and
[Metal declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md) establish the conditional
packet format; actual live native dispatch and complete composition remain
unobserved.

`writeRayColor` borrows the source tuple and updates an existing vertex range.
It rounds inputs to float32, premultiplies float32 RGB and sets A=1 for modes
0/2, then applies the established clamped float32 FMA byte conversion. The
writer allocates no arrays. Explicit shared-surface tint callbacks retain their
prepared-color override. Default float surface tints and non-ray geometry keep
their earlier paths.

The existing Garen color product material accepts an explicit `bgra-unorm8`
vertex-tint route, swizzling the normalized attribute into RGBA. Its existing
boolean vertex-tint route stays available to Gromp's float batches. Only the
three Garen Ray profiles allocate the new color attribute. Leona W uses the
shared surface renderer's owned Ray geometry. Its real lookup and multiplier
textures retain their existing local UV routing.

The independent comparison archives the complete source graph and lockfile at
`3fa44d105cc8467c5315e7182e1fc1841bf20ba6`. All 116,590 sampled non-ray states and
every other field of 111,272 rays remain exact across 11,403 sampler calls.
C/Python independently checks binary16 lookup values and BGRA words.

| Profile | Ray samples | Changed color packets | Changed lookup pairs |
| --- | ---: | ---: | ---: |
| W initial 3 | 54,295 | 54,295 | 53,620 |
| W extended 8 | 54,205 | 54,205 | 53,530 |
| Critical AA 9 | 333 | 270 | 324 |
| Q impact 3 | 468 | 450 | 450 |
| R kill 18 | 1,971 | 837 | 1,944 |

A second C-backed check covers 100,256 finite colors and 401,024 packets across
modes 0/1/2/4, including neighbor sentinels and frozen source arrays. All match;
eight packet cases detect double-only premultiplication. These are test-corpus
counts, not native event frequencies.

The five GPU input calibrations each draw 84 nonempty cases through seven
source phases, three cameras, two sizes, and raw/runtime blending. All 420
cases match the independent byte reference exactly with no GL error. Leona W
uses the actual surface policy; Garen uses the actual material factories and
shared writer on fixture geometry. Separate game-flow checks cover populated
renderer streams, Save/reload, camera-facing buffer reuse, visibility, death,
cleanup and deferred loading. Earlier Yi and Solar packet/shape calibrations
also pass. Color fixtures share geometry to isolate packet inputs.

Garen AA's historical schema130 assertion now checks the browser-exported
snapshot version. Its late-NPC R test requests the existing development repaint
hook while paused, allowing prepared assets to draw without advancing the world
tick. Leona W's exact BGRA route set includes its two new Ray streams alongside
the original mesh streams. All numerical and resource assertions remain strict.

The two Gromp Troy rays retain their earlier color path. A separate static
legacy-reader investigation is required for their type/default mapping. Native
curve arithmetic, clocks, RNG, optional modifiers, FPCR, draw-specific shader
selection and full visual parity remain outside this packet correction.

```sh
node tools/qa/verify-remaining-ray-packets.mjs --output-dir .cache/modern-ray-check-new
node tools/qa/verify-ray-color-writer.mjs --output-dir .cache/ray-word-check-new
npx playwright test e2e/remaining-ray-packets.spec.ts
```

The [verification ledger](reference/remaining-ray-packets-verification.json)
records the final source identities and acceptance evidence. No performance or
physical game-FPS claim follows from this format correction.

Acceptance records 3,103 passing unit tests out of 3,105 across 393 files, with
the same two baseline failures. All 65 focused tests, TypeScript, six Node QA
checks and four normal/optimized native packet/declaration checks pass. Twelve
packet browser cases and 23 distinct game/default-material cases pass across
the final runs. The latter includes a 120-second cloud allowance for two
multi-load flows; numerical, pixel, buffer and disposal checks are unchanged.
All 543 tracked asset/data files preserve bytes and modification times.
Production validation passes 32 recordings, eight fresh screenshots and zero
unintended private-character preloads.
