# Alpha Strike contact effects

The private human/NPC Yi fixtures now render the complete frozen ordinary and
critical Q target systems: four ordinary emitters and three critical emitters.
These are the two native resource definitions retained in the
[complete Q source pin](reference/masteryi/q-particles.json). The empty `Q_Hit`
record gains no emitter. Cast, missile, legacy AP, return and audio resources
remain outside this contact renderer.

Native source data and local dispatch are separate. A confirmed local Q contact
chooses its cached mark's ordinary/critical system. First unique marks remain
pending until reappearance; repeats resolve immediately under the existing
controller. Pending and lost marks never create contact effects. For one target,
the first repeated contact is cast +28 ticks; the pending first mark resolves at
cast +56 ticks alongside the final repeat. These are existing local controller
clocks, not recovered native callback times.

## Source and delivery

The ordinary layers are a bound flare, a bound scrolling trail mesh, an unbound
flash and an unbound bubble. Critical contacts use their own flare, flash and
bubble. Rates, single-particle flags, source float lifetimes, birth probabilities,
scale curves, angular velocity, offsets, bound-size coefficients, scrolling,
blend/pass/depth/cull fields and explicit-field lists remain separate in the
[compiled profiles](../src/content/masteryi-q-contact-particles.json).
Missing fields remain missing in the full source. Compiled white color,
blend-zero, lookup and zero-vector fallbacks are pinned-reader/local rendering
policy; they do not turn omissions into native declarations.

Seven texture containers retain 59 authored mip levels, totaling 193,214 PNG
bytes. Each level is extracted with `createImageBitmap` without premultiplication,
color conversion, resizing or generated mips. Levels include zero and upload
through Three's manual-mipmap path. Base textures use a local repeated trilinear
sampler; color lookups use clamped linear sampling. The
[transport record](reference/masteryi/q-contact-texture-transport.json) binds
every rectangle's dimensions and canonical software-decoded pixels.

The trail GLB is 112,976 bytes and expands all 1,500 source triangles into 4,500
ordered corners from 750 original vertices. Position scale is the explicit
game-to-render scale 0.01. Source UVs and face RGB round-trip exactly, with zero
GLTF validator errors/warnings. Native `hasVertexColors=0` keeps the opaque face
RGB as an audit attribute, rather than applying an invented black material tint.
Pivot, bounds, raw material slots, unused source vertex indices and the opaque
nonzero tail remain in source/audit metadata. No normals, reflection, pivot
offset or winding change is generated. The full original SCB remains privately
byte-round-trippable.

Bindings, defaults, geometry proof and compiled identity:
[contact reading](reference/masteryi/q-contact-particle-reading.json).

## Local presentation and saved state

Schema 148 records each contact before damage and lethal cleanup, capturing its
actual target position rather than an earlier mark position. Contact history
uses no extra simulation RNG or entity IDs. Indexed cosmetic probabilities are
deterministic per caster, cast, mark, emitter and birth. Records sort by contact,
cast and mark so the final repeated hit cannot reorder earlier pending marks.
A shared indexed birth chance drives the compiled property tables under this
local adapter; native RNG dispatch remains unobserved.

All selected emitters attach to the target root under this local adapter.
Heading is captured source-to-target direction. Bound-size coefficients use the
captured collision diameter; native attachment-frame and bound-size behavior
remain unobserved. Bound particles interpolate the saved current root; unbound
particles keep their saved birth root. Visibility is required at contact and
birth. Bound layers also require current visibility. Known unbound particles may
finish at their known birth point after vision is lost. A later hidden trail
birth cannot appear retroactively when vision returns. A vanished target has
neither frame audience, independently of the damage/targetability gate.

Death/removal freezes the target endpoint. Accepted finite effects survive Q
recovery cleanup and caster death. The existing terminal presentation clock
drains victory effects without advancing or modifying the saved simulation.
Source lifetimes and the existing local first-update emission grid require 22
history ticks, including interpolation retention. `particleLinger` and
`emitterLinger` are retained as source fields, not interpreted as extra visible
seconds.

Both startup and late presence load the selected closure only when Yi exists.
The renderer waits for all assets, retains verified successes on failure, and
retries failed files only when explicitly requested. It adds eight public source
assets totaling 306,190 bytes. The ordinary Ashe/Lux selector stays unchanged.

## Reproduction

```sh
node tools/assets/convert-masteryi-q-contact-mesh.mjs
python tools/assets/export-masteryi-q-contact-particles.py --check
python -O tools/assets/export-masteryi-q-contact-particles.py --check
python tools/assets/test-masteryi-q-contact-export.py
python -O tools/assets/test-masteryi-q-contact-export.py
npx vitest run tests/masteryi-q-contact-history.test.ts tests/masteryi-q-contact-particles.test.ts tests/authored-mip-texture.test.ts --maxWorkers=1
npx playwright test e2e/masteryi-q-contacts.spec.ts
```

The browser checks use real keyboard Q, ordinary/critical contact rendering,
private Save/reload, identical restored particles/future simulation, finite
cleanup, absent ordinary startup preloads and selective explicit retry. All 59
actual Three texture levels also pass exact GPU pixel readback in Chromium
154.0.8037.57/SwiftShader. Screenshots were inspected for both contact kinds.
This proves the tested local pipeline, not Riot's native renderer, physical
hardware, listening/audio behavior, frame-rate targets or native frame parity.

Nineteen export guards pass in each Python mode, including unsupported dynamics,
probability loss and preflight conflicts. Actual mesh replay and normal/optimized
re-exports pass; all 12 checked staged/public/generated files keep their bytes and
timestamps. The final compatibility-focused run passes 77 tests. Both builds and
all three final browser cases pass without relaxed assertions or deadlines. The
production `/nested/rift/` smoke passes 32 ordinary real-input recordings,
shop/ward/companion/Oracle Save/restore and zero Yi contact preloads, with no
development hook or private fixture flags.
The final full suite passes 2,546 tests across 355 files, retaining the same three
pre-existing source-audit failures: the missing Leona reflection reader, original
distortion compiler artifacts and the unchanged Lux first-sampler hash mismatch.
The wave-clock test passes its original deadline. Assertions, deadlines and
source goldens were not loosened. See [source-audit cache status](SOURCE-AUDIT-CACHES.md).

Identities, original diagnostics, final checks and screenshots:
[verification ledger](reference/masteryi/q-contact-verification.json).
