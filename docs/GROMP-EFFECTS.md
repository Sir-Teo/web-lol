# Gromp legacy effects and live death-pop reconstruction

The controlled [neutral Gromp encounter](NEUTRAL-GROMP.md) now reconstructs all
eight source death-pop emitters, including debris, rays, mesh shards and a ground
shadow. Death spores, original projectile/impact presentation, miniature/submesh
dispatch, sound and native composition remain unfinished. Standard-mode jungle
spawning and scheduling remain separate unfinished work.

## Frozen source and format evidence

`reference/gromp-effects.json` pins 16 original Troybin records from
`DATA/FINAL/DATA.wad.client`, Riot reference version **16.18.8175716**, release
manifest **29CE6E781C3B6368**. These legacy files are in the root DATA archive;
the map archive alone did not close the character's particle references. The
manifest hash, archive metadata, required bundle ranges, original path hashes,
byte counts and file hashes are retained. All 20 declared DDS/SCB dependencies
are included in the extraction pin, for 36 original files total.

The strict local `tools/assets/legacy_troy.py` reader retains 664 typed rows,
including storage kind, raw scalar/vector/string values and separately parsed
semantic values. It rejects duplicate keys, incomplete input, unsupported flags
and trailing bytes. Seven unlabeled fields remain under their original hashes;
none receives a guessed runtime meaning.

The layout and first extraction's complete hash/value results were independently
cross-checked against
[lolpytools `inibin2.py`](https://github.com/moonshadow565/lolpytools/blob/cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9/lolpytools/inibin2.py).
The finite labels came from that revision's
[`troybin_fix.py`](https://github.com/moonshadow565/lolpytools/blob/cd778cb1b2ace6557bbf9f7c3395b3f6f2f5a2b9/lolpytools/troybin_fix.py),
then each was checked against SDBM of lowercase `section*field`. Both reader
file hashes are pinned. Reproduction uses the committed labels and independent
reader; it does not require the historical filename dictionary or lolpytools.
Labels identify fields, rather than proving engine behavior or omitted defaults.

`reference/gromp-effect-assets.json` accounts for every dependency. Nineteen DDS
textures are decoded to full RGBA8 and saved as lossless PNG under
`public/assets/effects/gromp-legacy/`. The ledger records Pillow 12.3.0, original
and PNG hashes, dimensions, decoded RGBA hashes and channel extrema. A repeated
export verifies all original bytes and exact existing PNG pixels.
The original `paper01.scb` is now converted and rendered. Its 44 source vertices
and 42 triangles become 126 face corners, retaining every UV seam and triangle
order. `public/assets/models/gromp-death-paper01.json` pins the source and output
hashes, raw indices, central point, bounds, flags and layout-reader hashes. The
SCB 3.2 reader follows the pinned LeagueToolkit layout already used by other
particles. Flag 1 includes an all-zero face-RGB block; it is retained in a
custom GLB attribute, without treating it as a runtime tint. There is no pivot
recenter, winding change or reflection in conversion. Native use of that pivot
and raw color block remains unresolved. Attribute round-trip verification is
exact and the GLB validator reports zero errors/warnings.

## Death event and selected emitters

The original death clip `{bd28bd4d}` in Gromp's animation graph contains
`deathPop` event `{fd3600a1}`, referencing
`DATA/Particles/SRU_Gromp_death_Pop.troy`. Its attachment hash `{7cd8dbdd}`
matches the converted rig's `Buffbone_Glb_Ground_Loc`. The event has no explicit
start frame. `src/content/gromp-death.json` preserves the full event, both source
pin hashes and the selected emitter values.

The source declares eight death-pop emitters, all now reconstructed. The
death-pop's unknown hashes `b65b01fc`,
`cb9f124c` and `cb9f124d` remain in the source record.

| Layer | Primitive | Burst | Base lifetime × probability | Render mode | Pass |
| --- | --- | --- | --- | --- | --- |
| flash | Camera quad | 1 | 0.30000000000000004 s | 0 | 10 |
| lightring | Camera quad | 1 | 0.2 s | 4 | 7 |
| flashfrog | Camera quad | 1 | 0.2 s | 1 | 9 |
| chunks | Camera quad | 150 | 0.4 s × [0.2, 1] | 1 | 16 |
| shadow | Arbitrary quad | 1 | 5 s | 1 | -50 |
| pop | Ray | 15 | 1 s × [0.3, 1] | 1 | -5 |
| skinshards | Paper mesh | 20 | 4 s × [0.5, 1] | 1 | 2 |
| popshards | Ray | 35 | 0.4 s × [0.4, 0.75] | 0 | Omitted; local 0 |

All eight use the source single-particle flag; the local adapter uses their rate
as the burst size. Original scale and alpha curves are retained, including the
ring's fade-in and both uniform-scale flags. The first three use an
80-source-unit upward offset, authored as `p-offset` for two layers and
`p-postoffset` for the ring. Only flash disables depth testing. Its
`color-hold.dds` lookup is 4×4 and every channel of every pixel is 255; lookup
coordinate choices therefore cannot change this layer's color. The source
texture colors are preserved.

The legacy-to-modern field reading is informed by the
[Troygrade migration table](https://github.com/Leischii/Leischii.github.io/blob/c3b4e1f02c196243dce4fa834507c9eac2e30671/src/components/TroybinMigrationTool/MigrateSteps/helpers/table.jsx)
at revision `c3b4e1f02c196243dce4fa834507c9eac2e30671`; its SHA-256 is
`15f2ab815b6fbfcf107e24084b66808957e6f7513e6e302aba2ac74fada7a6ed`.
It maps render mode directly to blend mode, p-type zero to a camera quad,
scalar scale to the scalar birth-scale path, rotation to birth rotation and
`uniformscale` to the uniform-scale flag. This external conversion reference is
distinct from an observed native Gromp render.

The added emitters retain the original shape axes/angle distributions, correlated
birth multipliers for lifetime, position, velocity, rotation, size and UV offset,
gravity/drag, integrated shard rotation, scrolling, alpha references and atlas
declarations. Chunks use a 2×2 atlas; the two ray emitters use 4×1. Their random
birth frames remain fixed because no positive frame rate is declared. The
`pop` lifetime's `p-lifeXP` spelling is read as a scalar X probability table;
that alias is an explicit local interpretation, rather than a mapping proven by
the migration table. All original fields remain available for comparison.

## Local adapter policies and resource ownership

The first burst occurs on the first 60 Hz update after saved `deadAt`.
`grompDeathParticles` evaluates directly from the death/current clocks, so seeks,
pauses, saves and restores require no renderer history or new snapshot schema.
Corpse retention is now **302 ticks**, derived from the maximum five-second
shadow, the first-birth tick and one interpolation interval. The prior 299-tick
animation-only retention could remove its anchor early. The small generated
timing module avoids importing the full particle profile during ordinary entry.
The existing schema-86 corpse field retains this duration; the ruleset
fingerprint changes under the existing same-build save policy. The profile and
timing module participate in development-server restart detection.

The renderer samples the actual posed ground bone after updating its world
matrix, skipping missing attachments. Emitter-local offsets/rotation use the
retained caster yaw; other offsets use world axes. Camera quads follow the camera
under the current roll/yaw/pitch reading, the shadow uses its authored 90-degree
arbitrary-quad turn, and the two rays use the shared source-axis ray writer.
Source units map to 0.01 world units; camera/arbitrary cards use source size as
half extent and rays use the existing full-width/length/displacement reading.
The paper GLB already contains the unit conversion. Uniform scale takes the X
result for all axes. Omitted tint is white. Native extent, orientation, default,
parent/binding and dispatch conventions still require comparison.

The deterministic indexed chance and separate frame roll derive from corpse ID,
death tick, original source-emitter index and birth ordinal. A particle's birth
fields share one chance; expiring neighbors do not renumber survivors. No
simulation RNG is consumed. Constant acceleration is applied before per-axis
drag and movement on the local 60 Hz grid, with fractional display interpolation.
The shard's integrated rotation samples right endpoints, scaled by 60. These
readings follow the pinned external reconstruction's
[birth](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts),
[integration](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts)
and [rate scale](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/systemModel.ts).
Their hashes are retained in `reference/garen-q-cast-reader.json` and the new
verification record. Native RNG, cadence, float accumulation and the legacy
zero-linger declarations' termination behavior remain unverified; this one-shot
adapter lets each particle finish its sampled natural life.

The shared particle shader preserves the initial base × tint × lookup RGBA
product. Mode 0 uses One/One addition after the current tint-alpha convention;
mode 1 uses source-alpha/one-minus-source-alpha; mode 4 uses source-alpha/One.
Original passes and depth flags are applied. GPU tests confirm these RGB
factors in this implementation. Native Gromp UV conventions, sampler state,
alpha treatment, blend composition and final visual parity are not certified.

The module, nine required textures and one paper GLB load only on monster
presence. Loading shares concurrent requests, disposes successful partial loads on failure and
permits retry. Source geometry and textures are shared. Each live emitter owns
one material and a fixed-capacity dynamic geometry, with positions, atlas UVs,
tints and lookup coordinates written per surviving particle. The complete
224-particle birth burst uses eight draws and 3,744 vertices. Draw ranges shrink
as particles expire; surviving corners remain in birth-ordinal order. No native
intra-emitter sort equivalence is claimed. Current blue visibility gates the
effect. Hidden/expired batches remove their scene objects and dispose geometry
and materials; reappearance reconstructs the exact active buffers from saved
clocks.

## Reproduction and verification

From the repository root, using the existing CDTB environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-gromp-effects.py
node tools/assets/convert-gromp-mesh.mjs
.tools/cdtb-venv/bin/python tools/assets/export-gromp-death.py
python3 tools/assets/test-legacy-troy.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/gromp-death.spec.ts e2e/neutral-gromp.spec.ts --workers=1 --timeout=60000
npm run test:production
npm run assets:validate
```

The extraction repeats exactly. Four independent binary-fixture cases validate
string storage, signed values, packed booleans crossing byte boundaries,
compressed vectors, verified names and malformed/truncated input. All **1,077
checks across 216 files** and TypeScript pass. New cases cover the complete
dependency set, field/event/bone provenance, source lifetime boundaries,
uniform scale, keyed appearance, correlated births, atlas frames, stable
survivors, stepped gravity/drag, integrated rotation, exact SCB packaging, final
corpse retention, seek/save reconstruction and loading recovery.

All four focused Chrome cases pass: the two existing encounter cases and two
death-effect cases. Each isolated emitter contributes GPU pixels (269–16,942
in the final recorded sample), and the combined effect changes 17,012 pixels.
The original posed attachment, exact burst counts and eight-draw budget are
checked directly. Active position, UV, tint and lookup buffers restore exactly
after fog removal/reappearance and save/reload. All eight owned geometries and
materials are disposed when hidden or expired, with no effect nodes remaining.
Separate GPU samples retain the three RGB blend-factor checks. All 39 GLBs and
the source map validate with zero errors/warnings.

The reviewed 1440×900 capture `artifacts/gromp-death-burst.png` uses diagnostic
true damage 99999 to freeze the short effect; it is not normal combat damage.
The existing right-click combat/retaliation and death/cleared-save/restart cases
also pass. Nested-path production smoke passes with 17 source recordings,
ordinary Ashe/Lux behavior, no development hook and no Gromp rig, effect-module
or effect-texture requests. These are focused browser results; the entire
browser suite was not rerun. Evidence and file hashes are retained in
`reference/gromp-death-burst-verification.json`. The earlier three-layer
milestone remains in `reference/gromp-death-verification.json`.
