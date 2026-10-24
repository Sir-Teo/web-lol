# Seekable Solar Flare source attributes

All 44 enabled R emitters now have compiled profiles and seekable birth/motion/
color/UV attributes. All nine disabled records and all six system declarations
remain verbatim. This is a sampling building block: GameView does not draw these
R source systems yet. Existing saved history and source audio remain independent.

## Complete declarations and explicit boundaries

The [compiler audit](reference/leona-r-particle-profiles.json) hashes the raw source
pin, decoded assets and primary reader pins, and lists every routed enabled
field. Unknown emitter fields and primitive/shape classes fail closed. The compiled table retains the 23 quads,
eight billboards, seven meshes, three rays, two planar projections and attached
skin without primitive substitution. `Activate` still has no source base texture.
The attached skin retains its lock flag and multiplier UV. Projection Y range/
fading remain 500/500; no receiving triangles or UV matrix is invented. Ground
stencil reference 7 remains separate from an absent mode. Three distortion records
retain authored mode 2; their CPU/material route remains unresolved.

Lookup scales/offsets and multiplier birth offsets are preserved independently.
Bokeh's cylinder is represented explicitly, including its zero-height default.
All source assets remain byte-identical to their prepared packages. This increment
introduces no new model, image, audio or inferred normal.

## Pinned reconstruction math

[Eighteen exact primary readers](reference/leona-r-kernel-readers.json), revision
65a7d2a746b9d02d65dab788b5f7b8198d5e555e, bound the external math below. These are
reconstruction choices; none establishes native CPU defaults, update cadence,
PRNG, attachment, dispatch or frame parity.

The two impact noise declarations author only axisFraction[1,1,1]. The external
reader defaults omitted origin/frequency/radius/velocityDelta to zero. These
particular declarations therefore contribute zero noise; no turbulence is
invented. A changed nonzero binding requires a field integrator.

Orbital rate is sampled once at birth, in radians/second. One cosmetic chance
drives all probability channels, so each XYZ rate receives the same signed
factor. The explicit draw helpers apply:

```text
drawn = currentOrigin + RyRxRz(rate*age)*(integratedPoint-currentOrigin)
        + worldAcceleration*age01*currentLifetime²
```

The caller supplies complete world placement after origin/bind/orientation
routing. Acceleration follows orbit unturned. A separate helper rotates an
explicit direction vector; raw travel and speed/stretch stay unchanged. Both
actual orbital emitters use direction-oriented billboards. Camera projection
and primitive-specific basis construction remain later drawing operations.

The reader's comments claim an acceleration term in direction velocity, while
its executable travel/basis path omits it. R follows the executable separation.
Zenith's existing local direction extension is unchanged; its misleading comment
was corrected, and the reader pin preserves the earlier exact comparison bytes.

Cylinder volume flag 1 samples signed uniform radius, uniform height and uniform
Y rotation. Bokeh authors radius 220 and no height, yielding a center-biased XZ
disk, not a sqrt-radius uniform-area sample. Shape rotation also turns birth
velocity. Cosmetic channel hashes retain a height slot even at height zero;
they do not claim the native/shared random sequence.

Linger type 1 settles only after external stop and the emitter wait threshold;
its own emission lifetime does not trigger type 2 behavior. A still-resident
particle receives a deadline at settlement plus particle linger. It cannot
revive an already retired single. Source Ground_ has zero linger; Ground_1 has
.25 seconds. The local 60 Hz sampler compares the absolute rewritten deadline,
avoiding a one-step floating subtraction overrun. The initial boundary failure
and corrected check remain retained. Type 0 keeps the existing capped policy.

Birth scheduling, default lifetime/scale/color, finite-grid integration and
source-to-render units remain explicit local reconstruction policies. Attributes
stay in source centimetres; helpers require consistent caller units. No live
World state, RNG, identity, target pose or generated terrain is consulted.

## Verification

Eight focused unit cases cover complete source routing, all 44 finite/repeatable
families, lookup/multiplier streams, cylinder distribution, correlated orbital
rates/zero noise, independent scalar RyRxRz arithmetic, linger deadlines and long
stopped seeks. The full 1,842 unit cases/303 files plus three Node QA cases pass.
Chrome seeks all 44 families over 720 time samples, exercises explicit draw helpers,
and preserves exact saved state/RNG/IDs/restoration. A separate Zenith source
trail/kernel case passes. These are browser attribute checks, not native or GPU
frame comparisons.

Fresh nested production passes 32 recordings without a development hook or
unrequested Leona preload. The fresh 1,007-file offline pack contains 513,067,346
bytes and passes all controls with 963 service-worker responses and no production
errors. No new normal-match cohort or CPU benchmark is claimed. Ruleset bb304f25
identifies this sampling increment.

```sh
python3 tools/assets/export-leona-r-particles.py --check --readers
npm run check
npx playwright test e2e/leona-solar-kernel.spec.ts
node tools/qa/verify-leona-r-kernels.mjs
```

The [verification record](reference/leona/r-kernel-verification.json) freezes exact
source/readers/evidence. Use `--historical` after canonical changes. Schema 126
stays unchanged; the ruleset includes both new attribute/frame modules. Source R
renderer/material/terrain/attachment/distortion routing and native acceptance,
Leona player/support and full six-character delivery remain open. Nothing is
pushed; the full project goal stays active.

## Subsequent source drawing

The [saved-phase surface increment](LEONA-R-SURFACES.md) now draws 35 families.
It retains this exact 65a7 orbital policy and documents the newer 2adda ordering
difference. Newer distortion mode 2 has an explicit external early/no-character
route; native 16.18 CPU dispatch and the new stage remain unverified/unimplemented.
The counts and source archive above remain the historical sampling increment.
