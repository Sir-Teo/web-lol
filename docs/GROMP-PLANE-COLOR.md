# Gromp shadow plane color

Gromp's five-second shadow plane now prepares and samples its color keys with
the checked float32 sequence and submits normalized BGRA bytes using unsigned
truncation. The [native route reading](NATIVE-PLANE-COLOR-PACKETS.md) binds the
original Complex group4/p-type1 source to its separate virtual builder and
truncating helper. Authored blend mode1 skips native premultiplication.

The local raw-key policy still assumes unit birth/external/modulation inputs.
Live native backing mode/cache mutation, clocks/RNG, external factors, FPCR and
material/layout selection remain unobserved. This is component fidelity within
the current local policy, not complete native visual parity.

## Arithmetic and retained state

The separate host-C reference scans SHA-pinned original numeric strings,
prepares float32 base/key products, and performs each interpolation operation
separately with contraction and fast math disabled. It accepts only profile4,
checks the source route and mode1, and retains compiler identity, flags and C
source. The five source keys include nonbinary times `.01` and `.8`.

The full-life verifier makes **16,497 sampler calls** over three death ticks,
nine corpse IDs and half-tick steps through 305 ticks (approximately 5.08 seconds).
It checks **16,200 plane states** against C and retains every non-color field
exactly. All **375,622 states from the other seven profiles** match the frozen
accepted application at `395a4fe`. Another 1,013 key-neighbor/random phases match C.

Of the plane states, 3,834 have different float32 color words and 4,617 differ
from the previous float tint after packing. The largest retained normalized
channel difference is 0.0039215684. An initial two-second diagnostic reached only
the constant portion and correctly found no differences; its output is retained.
The longer window is necessary to cover this plane's actual fade.

The billboard writer's checked arithmetic is extracted into a shared finite
unit-RGBA writer. Primitive-specific predicates keep their scopes separate, and
the Ray rounding rule stays independent. The plane's six duplicated local
vertices now use 24 color bytes instead of 96, saving 72 bytes per corpse.
This storage count is not a frame-rate or total-memory measurement. Geometry,
UVs, atlas/lookup inputs, textures, source-alpha blending and local clocks remain
unchanged; the native builder's four-vertex layout is not substituted locally.

## Browser verification

The plane's seven sampled phases include the fade, with three camera directions,
two target sizes and both runtime/raw blending. The reference converts independent
C BGRA bytes to RGBA float attributes, bypassing normalized-byte decoding and the
BGRA shader. **84 nonempty comparisons** match every channel exactly, with zero GL/page errors.
The previous float-tint counterfactual differs in 8,901 channel bytes. Late fade can round RGB to black
while retaining alpha; contribution checks inspect both rather than accepting
an empty render. The original RGB-only test failure is retained as a diagnostic.

All **eight browser cases pass in one clean batch**: the plane, three billboards
(252 comparisons), two Rays (180 comparisons), full eight-layer Gromp death flow
and material blending. Save/reload, fog, posed
bone attachment, disposal and unchanged lookup coordinates remain covered.

```sh
node tools/qa/verify-gromp-plane-color.mjs --output-dir .cache/gromp-plane-new
npx vitest run tests/gromp-plane-color.test.ts tests/gromp-billboard-color.test.ts tests/gromp-ray-packets.test.ts --maxWorkers=1
node --test tools/qa/legacy-plane-color-reference.test.mjs
npx playwright test e2e/gromp-plane-color.spec.ts e2e/gromp-billboard-color.spec.ts e2e/gromp-ray-packets.spec.ts e2e/gromp-death.spec.ts
```

The former whole-sampler billboard verifier now explicitly freezes its accepted
sampler at `395a4fe`, retaining its original equality and C assertions. Its old
non-target counts remain historical. The current plane verifier requires all
billboard, Ray, Simple-flash and mesh sampler states to stay unchanged.
The [verification record](reference/gromp-plane-color-verification.json) retains
source freezes, earlier diagnostics, compiler/C evidence and application checks.

## Application acceptance

TypeScript, all 12 Node QA checks and 158 focused cases pass. The full suite has
3,288 passes across 398 files, with only the two unchanged baseline failures:
missing original Leona Eclipse evidence and the host-sensitive Lux missile
snapshot digest. Assertions and expected results stay intact.

The production build passes all 32 nested-path scenarios with eight fresh
captures and no development hook. Its exact pack is
`a62254a879cebdc7116cc5a58bcbf302246d32848bf876feb5398df84e0425eb`
(1,202 files / 538,092,136 bytes). That exact pack also passes corruption rejection, cancellation/retry, offline
repair, saved-tick restore, a new offline Lux lane match and atomic two-version
activation. The run records 978 service-worker responses and zero page errors.
Schema 163, simulation rules and all 539 active-cohort source pins stay unchanged.
All 1,125 public asset/data files retain their sizes and modification times.
These software-Chromium checks make no physical-device frame-rate claim.
