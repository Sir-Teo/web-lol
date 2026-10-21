# Courage particle sources

All seven base Courage particle systems are now pinned, with their complete
twenty emitter records and every named mesh/texture dependency. The source
shield and shared attached-mesh reference have exact GLB conversions, and all
eighteen textures have lossless RGBA PNGs. A development inspection page exposes
the meshes, raw textures and complete system definitions.

This increment prepares the full source set. W's live particle dispatch,
character material replacement, attached-skin slicing, attachment transforms and
native composition remain unfinished. Gameplay and snapshot schema 80 are
unchanged; Garen remains outside production selection.

## Frozen source closure

`reference/garen-w-particles.json` resolves every `Garen_W_` key in the existing
base skin resource map. Five definitions live in two linked multi-skin BINs;
the two Avatar definitions live inline in `data/characters/garen/skins/skin0.bin`.
The extractor re-decodes all seven records from Riot 16.18.8175716, manifest
`29CE6E781C3B6368`, `DATA/FINAL/Champions/Garen.wad.client`, and requires exact
agreement with the retained definitions. The inline skin BIN's file hash also
matches the original model extraction. Subsequent runs use the pin directly;
discovery and current online hash dictionaries are unnecessary.

| Resource | Source location | Emitter records | Declared roles |
| --- | --- | ---: | --- |
| `Garen_W_Cas` | Linked BIN | 4 | Shield mesh, ground glow, rising energy and flash |
| `Garen_W_Buff` | Linked BIN | 7 | Ground glow, wings, energy waves and four minimal declarations |
| `Garen_W_Deflect` | Linked BIN | 1 | Rotating shield mesh |
| `Garen_W_Shoulder_L` | Linked BIN | 2 | Streak burst and hoop |
| `Garen_W_Shoulder_R` | Linked BIN | 2 | Streak burst and glint |
| `Garen_W_Avatar` | Inline skin BIN | 2 | Material override and attached-mesh shimmer |
| `Garen_W_Avatar_Fade` | Inline skin BIN | 2 | Transitioned material override and attached-mesh shimmer |

The archive ledger records twenty-four files totaling 2,460,806 source bytes:
three BINs, eighteen TEX files and three SCB paths. Downloaded ranges, compressed
chunk hashes, WAD path hashes and individual file hashes remain inspectable.
Long BIN virtual names retain the existing verified hash-named flat-cache layout.
The optional discovery tool now accepts `--ability w` or `--ability q`, while
its existing R default/output path remains intact.

## Geometry and textures

| Mesh | Version / flags | Source vertices | Triangles | GLB bytes |
| --- | --- | ---: | ---: | ---: |
| Courage shield | SCB 3.2 / 5 | 640 | 1,264 | 92,972 |
| Shared attached-mesh reference | SCB 2.2 / 1 | 76 | 124 | 11,036 |

`assets/particles/arrow01.scb` and `assets/shared/particles/arrow01.scb` have
identical bytes. They share one output GLB, with both path/hash/source records
preserved as aliases. This does not identify the arrow as the geometry displayed
by a native `VfxPrimitiveAttachedMesh`; it is not used as a replacement for Garen's
posed character surface.

The decoder follows the pinned LeagueToolkit
[StaticMesh reader](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Mesh/StaticMesh.cs)
and [face reader](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Mesh/StaticMeshFace.cs).
Both reader files are hash-checked. SCB 3.2 has the extra vertex-color indicator
before its points; the 2.2 reference does not. Both selected files retain their
per-face corner RGB. The shield has a zero bounds header and an uninterpreted
24-byte tail; the arrow has a nonzero bounds header and no trailing bytes. Its
header empirically matches measured minimum plus extent, rather than minimum
plus maximum. These checks describe these exact source files, not all SCB assets.

Both conversions expand face corners without welding UV seams, reference every
source vertex and retain exact UVs and `_SOURCE_FACE_RGB`. Positions convert at
0.01 and round-trip at their exported float32 precision. Source pivot, raw header
bounds, measured bounds, material names and tail bytes remain metadata. No pivot
translation, reflection, winding change or emitter rotation/scale is baked in.
Per-output sidecars work with the ordinary model validator.

Eighteen PNGs total 934,113 bytes. Five preexisting PNGs are reused only after
an exact dimension/RGBA comparison; thirteen new files add 908,324 bytes. These
include the shield and shoulder maps, energy wave/color map, wings, two alpha
lookups, material replacement/transition maps and the attached shimmer texture.
The decoded ledger retains source/output/RGBA hashes and dimensions for each.
The two GLBs add 104,008 bytes. None of the new W graphics is requested by either
ordinary startup or the existing Garen fixture yet.

The development page `/tools/qa/garen-w-source-preview.html` provides orbit/zoom,
wireframe, both source mesh versions, a seven-system selector with emitter
declarations, full frozen definitions and all eighteen raw images. The shield's
inspection material is a simple source-texture view. It does not reproduce its
live color lookup, emission, blending, attachment or frame composition.

## Runtime boundaries revealed by the source

The source contains no W particle event in the retained animation clip event
maps. That bounded absence does not establish modern script dispatch or the
absence of native W effects. Shoulder bone selection, body material application,
deflection triggers and stop/removal policy still need explicit treatment.

The cast shield's base particle lifetime is 2.25 seconds; the buff ground/wings
use six seconds; the Avatar override uses seven seconds. These authored lives
are independent of the implemented four-second defense buff and 0.75-second
shield/tenacity window. They are not evidence for changing the gameplay values,
nor for silently stretching particle curves to those gameplay deadlines.
Probability tables, source curves, linger fields and stop history must remain
separate in the eventual adapter.

Avatar's first emitter declares a replacement `baseTexture`. Avatar Fade adds
blend mode 4, a transition texture and `transitionSample = 0.0625`. Their second
emitters declare `VfxPrimitiveAttachedMesh`, slice ranges approximately 0.04/0.08,
local orientation, a scrolling texture and lookup parameters. Fade also declares
`buildUpTime` approximately 0.4 seconds. A root billboard or a standalone arrow
mesh would discard these character-surface and material operations. The raw
definitions are retained instead of treating them as ordinary mesh particles.

Four buff emitter records (`plasma`, `shield_ball`, `electric`,
`ground_glow_steel`) lack explicit rate, particle lifetime, texture and primitive.
The inspector marks missing declarations as absent. This packaging step assigns
no guessed enabled/disabled behavior or fabricated texture/defaults to them.
The existing unresolved shape class `{ee39916f}` remains preserved in five
systems. Source extraction and green local checks do not certify native behavior.

## Reproduction and verification

Use the pinned environment from [ASSETS.md](ASSETS.md):

```sh
# Optional discovery for further investigation, not required after the pin exists:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/discover-garen-particle-bins.py --ability w

# Repeatable extraction and conversion:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-w-particles.py
node tools/assets/convert-garen-w-particles.mjs

npm run check -- --maxWorkers=4 --testTimeout=30000
npm run test:browser -- e2e/garen-w-source.spec.ts
npm run assets:validate
```

Extraction/conversion reproduces twenty-four source/decoded ledgers, PNGs, GLBs
and sidecars byte-for-byte. Four new source/geometry cases check dependency
closure, inline/linked ownership, every output hash/geometry attribute, version
layout, alias identity, bounds/tails and material/attachment declarations.
All 970 source/simulation tests and TypeScript pass. Thirteen focused Chrome
cases cover the new inspector and startup boundary, existing W audio/PCM and
defenses, and shared R inspection/GPU probes, with a 60-second browser deadline.
The shield/texture capture was visually reviewed. All 32 GLBs and the map validate
without errors or warnings. Production build/nested-host smoke passes with the
ordinary 17 recordings, unchanged entry bundles and the Garen roster gate intact.
Native dispatch, material/attached-skin rendering and complete production/match
acceptance remain open.
