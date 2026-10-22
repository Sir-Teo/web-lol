# Gromp legacy effects and the first live death layers

The controlled [neutral Gromp encounter](NEUTRAL-GROMP.md) now displays three
source death-pop layers. Five other death-pop emitters, death spores, original
projectile/impact presentation, miniature/submesh dispatch, sound and native
composition remain unfinished. Standard-mode jungle spawning and scheduling
remain separate unfinished work.

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
`paper01.scb` is pinned but not yet converted or rendered. Exported assets for
deferred emitters are not runtime requests.

## Death event and selected emitters

The original death clip `{bd28bd4d}` in Gromp's animation graph contains
`deathPop` event `{fd3600a1}`, referencing
`DATA/Particles/SRU_Gromp_death_Pop.troy`. Its attachment hash `{7cd8dbdd}`
matches the converted rig's `Buffbone_Glb_Ground_Loc`. The event has no explicit
start frame. `src/content/gromp-death.json` preserves the full event, both source
pin hashes and the selected emitter values.

The source declares eight death-pop emitters. This increment renders `flash`,
`lightring` and `flashfrog`; `chunks`, `shadow`, `pop`, `skinshards` and
`popshards` remain deferred. The death-pop's unknown hashes `b65b01fc`,
`cb9f124c` and `cb9f124d` remain in the source record.

| Layer | Particle lifetime | Birth size | Render mode | Source pass |
| --- | --- | --- | --- | --- |
| flash | 0.30000000000000004 s | 430 | 0 | 10 |
| lightring | 0.2 s | 300, 300, 300 | 4 | 7 |
| flashfrog | 0.2 s | 300, 270, 270 | 1 | 9 |

All three are single camera quads with rate one. Their original scale and alpha
curves are retained, including the ring's fade-in and flashfrog's uniform-scale
flag. All use an 80-source-unit upward offset, authored as `p-offset` for two
layers and `p-postoffset` for the ring. Only flash disables depth testing. Its
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

## Local adapter policies and resource ownership

The first burst occurs on the first 60 Hz update after saved `deadAt`.
`grompDeathParticles` evaluates directly from the death/current clocks, so seeks,
pauses, saves and restores require no renderer history or new snapshot schema.
The existing 299-tick corpse retention exceeds these particle lifetimes. The
profile participates in the existing ruleset fingerprint and development-server
restart detection.

The renderer samples the actual posed ground bone after updating its world
matrix. It skips missing attachments. Offsets use world axes; the quads follow
the camera with source roll/yaw/pitch under the current local Euler reading.
Source units map to 0.01 world units and the two-unit card uses source size as
half extent. Uniform scale takes the X result for all axes, consistent with the
current particle reconstruction. Omitted tint is white. These timing, offset,
extent, orientation and default policies remain subject to native comparison.

The shared particle shader preserves the initial base × tint × lookup RGBA
product. Mode 0 uses One/One addition after the current tint-alpha convention;
mode 1 uses source-alpha/one-minus-source-alpha; mode 4 uses source-alpha/One.
Original passes and depth flags are applied. GPU tests confirm these RGB
factors in this implementation. Native Gromp UV conventions, sampler state,
alpha treatment, blend composition and final visual parity are not certified.

The module and four required textures load only on monster presence. Loading
shares concurrent requests, disposes successful partial loads on failure and
permits retry. Each live layer owns its material; geometry and textures are
shared. Current blue visibility gates the effect, and loss of visibility removes
the scene objects and disposes materials. Reappearance reconstructs the same
pose from saved clocks. Natural expiry performs the same cleanup.

## Reproduction and verification

From the repository root, using the existing CDTB environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-gromp-effects.py
.tools/cdtb-venv/bin/python tools/assets/export-gromp-death.py
python3 tools/assets/test-legacy-troy.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/gromp-death.spec.ts e2e/neutral-gromp.spec.ts --workers=1 --timeout=60000
npm run test:production
```

The extraction repeats exactly. Four independent binary-fixture cases validate
string storage, signed values, packed booleans crossing byte boundaries,
compressed vectors, verified names and malformed/truncated input. All **1,072
checks across 216 files** and TypeScript pass. New cases cover the complete
dependency set, field/event/bone provenance, source lifetime boundaries,
uniform scale, keyed appearance, seek/save reconstruction and loading recovery.

All four focused Chrome cases pass: the two existing encounter cases and two
new death-effect cases. Each of the three isolated layers changes more than 20
framebuffer pixels, the combined draw changes more than 60, and the original
posed attachment is checked directly. Full pose/material state restores exactly
after fog removal/reappearance and save/reload. Hidden/expired materials are
disposed and no effect nodes remain after expiry. Separate GPU samples verify
the three RGB blend-factor combinations.

The reviewed 1440×900 capture `artifacts/gromp-death-pop.png` uses diagnostic
true damage 99999 to freeze the short effect; it is not normal combat damage.
The existing right-click combat/retaliation and death/cleared-save/restart cases
also pass. Nested-path production smoke passes with 17 source recordings,
ordinary Ashe/Lux behavior, no development hook and no Gromp rig, effect-module
or effect-texture requests. These are focused browser results; the entire
browser suite was not rerun. Evidence and file hashes are retained in
`reference/gromp-death-verification.json`.
