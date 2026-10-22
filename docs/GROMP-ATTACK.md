# Gromp missile source playback and saved flight

The controlled [Gromp encounter](NEUTRAL-GROMP.md) now replaces its generic red
attack projectile with all four original missile emitters. Released flight and
surviving particles retain exact checkpoint continuation. This is a source-based
reconstruction, with native origin/height, attack selection and composition still
unverified. It does not finish Gromp presentation or standard-mode jungle play.

## Source contract

`src/content/gromp-attack.json` derives from the frozen
`reference/gromp-effects.json` and `reference/jungle-character-source.json` pins.
It retains both hashes and the complete original `SRU_GrompBasicAttack` spell
record `{e545321f}`. Its `mMissileEffectName` references
`DATA/Particles/SRU_Gromp_BA1_mis.troy`, whose original Troybin has these four
emitters in source order:

| Emitter | Primitive | Rate | Single | Life | Emitter life | Bind | Linger | Blend/pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mis_orb | Camera-quad declaration | 2 | No | 0.5 s | -1 | 1 | 0 | 0 / 1 |
| black_background | Arbitrary quad | 1 | Yes | 0.5 s | 0.5 s | 1 | 1 | 2 / -1 |
| mis_plane | Arbitrary quad | 2 | Yes | 0.5 s | -1 | 1 | 0 | 4 / 1 |
| trailorbs | Camera quad | 25 | No | 0.5 s × probability | 0.5 s | 0.6000000000000001 | 1 | 0 / 4 |

The first local update creates one orb, one background, **two** flare-plane
particles and one trail mote. The single flag reads rate as burst size under the
existing reconstruction convention. Trail lifetime multipliers retain the
original [0→0.5, 0.9→0.8, 1→1] knots, rather than a uniform range. The source
birth-size distribution, shape axes/angles, velocity/drag, rotation, scale and
color curves are retained. Scalar/vector curve and probability extraction now
share a Python helper with the death exporter; the existing death outputs remain
byte-identical.

Three already exported lossless textures are used: `SRU_Gromp_BA_orb`,
`SRU_Gromp_BA_flare` and `Morgana_Skin05_Q_Black_Mis`. Their paths and PNG hashes
are checked against the original asset ledger during export. No bitmap or model
changes are included in this increment. The missile's two unknown source hashes
remain in the original record without inferred meanings.

The full spell retains speed 1800, start bone `root`, target-height augment and
initial offset 100, gravity 1500 and velocity-matching vertical facing. The
current adapter does **not** implement that native height solver or sample the
launch root. It retains the previous terrain-relative **0.9 world-unit** height
policy. The source hit effect and chest attachment also remain unimplemented.

## Flight state and reconstruction

Schema **87** adds required `grompAttackVisuals`, empty in ordinary matches. Each
released Gromp attack records projectile/source identity, neutral faction,
original launch point/tick, optional stop tick and contiguous post-step planar
position/heading frames. A swept contact records its exact endpoint; target loss
freezes the previous endpoint. Presentation never deals damage, replays a hit or
controls the attack deadline.

At most **34 frames** remain per flight. A stopped record remains **31 ticks**,
covering the maximum half-second natural particle life and interpolation. Active
histories must match an actual neutral Gromp attack projectile's source, launch,
origin, endpoint and heading. Every such projectile requires history. Validation
rejects duplicate/conflicting identities, foreign owners/factions, missing/gapped
or future frames, mismatched active endpoints/headings, active/stopped conflicts
and expired tails. Earlier formats retain the existing incompatible-save path.

The sampler reconstructs births from the current/launch/stop clocks on the local
60 Hz grid. First-update and rate-budget scheduling use the existing shared
emission functions. Negative emitter life means unbounded emission; explicit
contact/target-loss stop is non-emitting. Single emitters burst once. Indexed
chance derives from projectile identity, source-emitter index and ordinal;
source birth fields share a chance and consume no simulation RNG.

Position and velocity retain their birth heading. Constant bind weight adds that
fraction of the emitter's later displacement, including terrain-relative height
change. The 0.6 trail binding therefore follows part of the moving projectile,
without snapping every mote onto its current point. Local particle orientation
uses the current heading; other particle frames retain the birth reading.
Native shape, parent/orientation and binding semantics still require comparison.

Contact/target loss applies the local type-0 total-life cap from `p-linger`.
Orb and flare planes have zero cap and disappear at stop. Background and trail
retain their sampled natural lifetimes under cap one. No additional one-second
tail is granted. This explicit stop differs from merely finishing a death
emitter's birth window. Native legacy termination/linger dispatch is unverified.
At victory, rendering supplies a terminal stop and ages tails without rewriting
serialized match state.

## Rendering, visibility and limits

There is at most one dynamic geometry/material batch per emitter and projectile.
Particle positions, UVs, tints and lookup coordinates reconstruct directly into
fixed-capacity buffers. The flare's two particles share one draw. The generic
projectile mesh is suppressed whenever the real Gromp flight record owns it.

The raw RGBA product is shared with existing source particle rendering. Mode 0
uses One/One, mode 2 uses Zero/OneMinusSrcColor and mode 4 uses
SrcAlpha/One. ADD and SUBTRACT tint RGB is weighted by tint alpha before the
alpha channel is locked, consistent with the existing particle reconstruction.
The three framebuffer factor combinations pass isolated GPU probes. This does
not certify native shader variants, alpha handling, sampler or final composition.

Neutral missiles have no unconditional team visibility. Each particle is gated
by current blue point visibility. Hidden, stopped/expired or retired batches
remove scene objects and dispose owned geometry/materials. Reappearance and
reload recreate the same active buffer bytes. Source textures remain shared.
Loading shares concurrent requests, disposes completed partial texture loads on
failure and permits retry. Gromp presence adds three texture requests to the nine
death textures and one shard GLB. Ordinary production entry requests none of
these Gromp assets or modules.

The close-range GPU audit found that the current actor size/origin/height policy
can occlude orb, flare and trail. Hiding the caster restored their pixels in the
diagnostic; source depth testing remains enabled in the implementation. A legal
in-flight Flash separates the actors while the released missile continues
through Gromp's reset. All four layers then contribute visible pixels, without
altering range, missile speed or depth flags. The acceptance sample uses that
interaction. Close-range appearance, native ranged/melee selection, root/height
initialization and actor scale/spacing remain open comparison work; the test
does not certify stationary close-range native presentation.

## Verification

```sh
.tools/cdtb-venv/bin/python tools/assets/export-gromp-attack.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/gromp-attack.spec.ts e2e/gromp-death.spec.ts e2e/neutral-gromp.spec.ts --workers=1 --timeout=60000
npx playwright test e2e/saves.spec.ts e2e/lux-player-input.spec.ts e2e/structure-vision.spec.ts --workers=1 --timeout=60000
npm run test:production
```

All **1,083 checks across 218 files** and TypeScript pass. Six new cases cover
source profiles, real release/contact, bounded homing/target loss, active/stopped
checkpoints, malformed history, source births/caps/binding and load recovery.
Existing Garen landing/silence validation tests now reference the current schema
constant rather than assuming version 86.

Six focused Gromp Chrome cases and ten existing save/Lux-input/structure-vision
cases pass. The final missile cases also pass after strengthening saved heading
validation. The recorded visible sample uses four draws, contributes 330 combined
pixels and retains all four depth flags. Independent layers contribute 17, 137,
88 and 220 pixels. Exact active and stopped buffers survive two UI save/reload
cycles. Fog removal disposes four geometries/materials; final tail retirement
disposes the remaining two and removes all flight records and effect nodes.
The real Flash enters Gromp reset while the committed missile still damages its
target. Captures at `artifacts/gromp-attack-flight.png` and
`artifacts/gromp-attack-tail.png` were reviewed at 1440×900.

The exporter repeats exactly and the death outputs remain identical after the
shared-helper refactor. Nested-path production smoke passes with 17 source
recordings and no Gromp asset/module requests. No complete browser-suite rerun
or native-parity claim is made. Commands, capture hashes, source assumptions and
the close-range finding are retained in
`reference/gromp-attack-verification.json`.
