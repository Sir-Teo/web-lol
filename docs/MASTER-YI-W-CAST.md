# Meditate cast effects

Accepted W in the private Yi scene now creates the complete seven-emitter
`MasterYi_W_Cas` system. This changes presentation; the existing four-second
channel still owns healing, mana, mitigation, passive stacks and interruption.
The ordinary selector remains Ashe/Lux. Buff, damage and tenacity systems are
retained sources and are not represented as completed effects here.

| Source emitter | Primitive | Retained behavior |
| --- | --- | --- |
| `fireline` | Ray | Authored color/scale curves and orientation |
| `spiral_1` / `spiral_2` | Native torus mesh | Two births each, distinct life/tilt, rise, spin and scroll |
| `spirit_fire` | Billboard | Velocity, random birth scale/offset, color, alpha lock and two UV layers |
| `Flash` | Arbitrary quad | Two births, randomized orientation/size, uniform collapse and lookup |
| `energy_wave` | Arbitrary quad | Authored 60 Hz rate, rise, expansion and lookup |
| `Stars_Green` | Billboard | Legacy spawn offsets, variable life/velocity/size and world acceleration |

## Source delivery

The [complete native source](reference/masteryi/w-particles.json),
[private decode](reference/masteryi/w-particles-decoded.json) and
[texture transports](reference/masteryi/w-particle-texture-transport.json) stay
separate from the [compiled cast reading](reference/masteryi/w-cast-particle-reading.json).
The selected ten textures retain all 87 authored mip levels. Two identical
transports reuse the existing Q asset URLs; eight new PNGs and one torus GLB
are delivered. No mip is resized, generated, gamma-converted or premultiplied.

The 180-vertex/320-triangle source torus delivers 960 expanded corners. Source
position/UV ordering and opaque face RGB remain exact at the explicit 0.01
transport unit scale. No normals or material tint are invented. Pivot, padding,
source bounds/flags and the zero-length tail remain in source metadata. The
shared surface program applies its explicit actor-root source-X reflection.

All four native W systems omit on-create sound. This visual integration adds no
inferred sound binding. The literal spell audio suffix and bank events remain
separate source work.

## Saved finite presentation

Schema 150 stores a cast's rank, admission audience and per-tick position, facing
and visibility endpoints. Creation audience is separate from endpoint visibility,
including when another command moves the actor in the admission tick. Active
channels require their cast record while it is retained. Decoding also checks
ownership, rank, chronology, frame continuity, live endpoint pose and frozen death
frames. Presentation uses no extra World randomness or event/entity identities.

Source emission/life bounds require 55 ticks on the existing local first-update
grid. An emitter's first particle appears on update one; single bursts retain
the declared rate count. Subsequent births, curves, fixed birth draws, velocity,
rotation, UVs and life reconstruct directly from saved time. Source linger values
remain recorded without adding ten seconds of visible particles.

Interruption stops the channel while the already-created finite cast system
finishes. Death freezes its root; the terminal presentation clock can finish it
without stepping or mutating the frozen simulation. A hidden creation cannot
appear when vision returns. Births require known creation/birth frames; bound
particles also require known current frames, including Alpha Strike body hiding.
Known unbound particles may finish at their captured birth point.

Assets load only for present or late Yi units. Rendering waits for the complete
selected closure. Verified successful textures/geometry survive a partial load
failure; explicit retry fetches only the failed asset. Failure does not cause a
per-frame network retry loop.

## Explicit local interpretation

Exact FNV-1a candidate matches identify the raw acceleration-field hashes. The
frozen records keep those hashes. The local sampler applies the retained
`[0, 600, 0]` world-space vector through the existing 60 Hz semi-implicit motion
helper, separately from root-oriented birth velocity. Empty orbital declarations
remain zero under the shared local defaults. Native force integration, script
dispatch, attachment frames, RNG and source-default parity remain unverified.

The shared material defaults retain their old quad lookup-coordinate mapping.
The flame explicitly selects independently transformed secondary UVs for both
secondary samples, with a neutral white lookup because its source omits one.
This makes its declared multiplier scroll effective. Alpha lock still samples
base alpha without the base translation. Other omitted render controls use the
shared local defaults recorded in the reading, including alphaRef 5/255.

## Reproduce

```sh
python tools/assets/export-masteryi-w-cast-particles.py --check
python -O tools/assets/export-masteryi-w-cast-particles.py --check
python tools/assets/test-masteryi-w-cast.py
python -O tools/assets/test-masteryi-w-cast.py
npx vitest run tests/masteryi-meditate-cast-history.test.ts tests/masteryi-meditate-cast-particles.test.ts --maxWorkers=1
```

Twenty-one source field/value guards pass in each Python mode; actual export
checks/replays preserve all 14 checked delivery files in bytes and timestamps.
The focused simulation/particle/compatibility/shared Leona surface run passes
112 cases across seven files. TypeScript/production build and three Node QA
checks pass.

The full run passes 2,625 tests across 359 files with the same three pre-existing
source-audit failures: missing Leona reflection input, original distortion
compiler artifacts and the unchanged Lux first-sampler digest discrepancy. The
original five-second wave-clock test passes; no deadline, quality setting or
assertion tolerance was loosened.

The final ten-case browser batch passes with zero retries. It covers real W
input, active/cancelled Save/reload and exact future simulation, all 87 selected
in-game Three GPU mip hashes, all seven emitter families, independent multiplier
UV pixel selection, selective explicit retry, fog creation/death/terminal tails,
the three existing Meditate control/pose cases and the three Q contact cases.
The pixel control retains red/red with the default quad mapping and red/green
when the explicitly transformed second UV moves by half the two-color texture.

Initial diagnostics are retained: a unit fixture expected red vision without a
red vision source, another expected a delayed initial particle despite the
established first-update grid, and browser fixtures used unsupported JSON/bare
module imports. Fixtures were corrected while retaining the actual source
hash, motion, particle/future, pixel, retry and deadline assertions. The initial
broad run was interrupted to bind the authored flame multiplier scroll before
final broad/browser validation.

These are canonical source/software and local Chromium/SwiftShader/API checks.
Native callback, attachment/force/default, hardware-decoder/frame, physical-device,
FPS, listening, complete-browser-suite and offline-install acceptance are not
established by this checkpoint.

The final production subpath smoke passes all 32 ordinary input recordings,
including public champion actions, purchases, wards, companions and save/restore.
Development hooks/Yi query flags remain rejected and all Yi model/audio/contact/
Meditate cast preload counts are zero. Exact source archive, final identity and
staged evidence: [runtime verification ledger](reference/masteryi/w-cast-verification.json).
