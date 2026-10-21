# Decisive Strike particle sources

All eleven base Q resource keys now have frozen source definitions, including
31 emitter records, 29 lossless textures and four exact mesh conversions. The
development inspector exposes all assets and definitions. This is source
preparation plus the first live weapon-trail mesh. Thirty emitter records and
native rendering remain open. Gameplay values are unchanged; schema 83 adds
attack outcomes and presentation stops. Garen remains outside production selection.

## Frozen dependency closure

`reference/garen-q-particles.json` resolves every `Garen_Q_` key in the pinned
base skin resource map. All eleven definitions live in six linked multi-skin
BINs. The extractor re-decodes each record from Riot 16.18.8175716, manifest
`29CE6E781C3B6368`, `DATA/FINAL/Champions/Garen.wad.client`, and requires exact
agreement with the saved definition. The 39-file extraction ledger retains
2,879,885 source bytes: six BINs, 29 TEX files and four SCBs, with archive range,
compressed-chunk, WAD-path and individual-file hashes. Subsequent extraction uses
the pin directly, without discovery or current hash dictionaries.

| Resource | Emitters | Explicit primitive observations |
| --- | ---: | --- |
| `Garen_Q_Silence` | 1 | No primitive field |
| `Garen_Q_mis_axis_01` | 3 | No primitive fields |
| `Garen_Q_Sword_Swipe_Blur` | 2 | One arbitrary quad; one primitive absent |
| `Garen_Q_Buf` | 0 | Emitter array absent |
| `Garen_Q_Jump` | 2 | One mesh; one primitive absent |
| `Garen_Q_Jump_Blur` | 1 | Primitive absent |
| `Garen_Q_Land` | 5 | Four arbitrary quads; one primitive absent |
| `Garen_Q_Cas` | 4 | Primitive fields absent |
| `Garen_Q_Cas_Sword` | 4 | One mesh, one arbitrary quad; two primitives absent |
| `Garen_Q_Sword_Trail` | 1 | Mesh |
| `Garen_Q_Tar` | 8 | Two meshes, three arbitrary quads, one ray; two primitives absent |

The buff definition contains only particle name/path, object path and type. Its
missing emitter array is retained explicitly in the audit. This does not prove
that a native buff has no visuals, nor justify adding a sustained glow. The
axis-system name does not establish projectile or debug dispatch. Missing
primitive fields remain missing rather than being normalized to a guessed type.

## Geometry and textures

| Output | Source vertices | Triangles | GLB bytes |
| --- | ---: | ---: | ---: |
| `garen-q-impact.glb` | 4 | 2 | 2,012 |
| `garen-q-jump.glb` | 32 | 16 | 2,952 |
| `garen-q-sword-scroll.glb` | 80 | 76 | 7,352 |
| `garen-q-weapon-trail.glb` | 250 | 500 | 37,892 |

All four observed SCBs are version 3.2, flags 5, with a zero vertex-color
indicator, per-face-corner RGB, a zero header bounds block and an uninterpreted
24-byte tail. The decoder hash-checks the existing pinned LeagueToolkit
`StaticMesh.cs` and `StaticMeshFace.cs` readers at revision
`76bf57bf4fd195343dec610bf0f912a06b910914`. These checks describe the selected
files, not a general SCB format guarantee.

Conversion expands face corners without welding seams, preserves exact UV/RGB
attributes and exports positions at 0.01 source scale with float32 round trips.
Every source vertex is referenced. Pivots, raw/measured bounds, material names,
flags and tail bytes remain metadata; no emitter transforms, winding changes or
native material behavior are baked in. All GLBs validate with zero errors and
warnings and have ordinary model-validator sidecars. In particular, the source
weapon trail remains a 500-triangle mesh rather than a procedural ribbon.

The 29 PNGs total 1,250,707 bytes. Six existing images are reused only after exact
dimension/RGBA comparison; 23 new images add 1,119,506 bytes. The decoded audit
records source/output/RGBA hashes and dimensions, including lookup, distortion,
sprite and mesh maps. Four GLBs add 50,208 bytes. The live trail requests one mesh
and two textures only on Garen presence. The ordinary fixture requests none of
the new Q graphics. All other Q meshes/new textures remain source assets. Shared
textures retain their existing W/E/R consumers.

`/tools/qa/garen-q-source-preview.html` offers orbit/zoom, wireframe, all four
meshes, an eleven-system selector, complete definitions and every raw image. Its
simple unlit texture view omits emitter transforms, color ramps, blend modes,
distortion and native composition. The empty buff selection visibly distinguishes
an absent array from an authored empty array. The binding table shows all four
animation events with absent fields labeled explicitly. Wireframe uses an
inspection-only sequential index because the installed Three r186 builder
miscounts nonindexed interleaved positions. This preserves every triangle and
leaves the GLBs unchanged. The preserved drawing buffer supports pixel verification
and reliable inspection captures.

## Animation bindings and integration boundaries

The frozen `Spell1` clip contains four particle events:

| Resource | Declared start frame | Declared bone |
| --- | --- | --- |
| `Garen_Q_Jump` | Absent | Absent |
| `Garen_Q_Land` | 9 | Absent |
| `Garen_Q_Sword_Trail` | 8 | `C_Buffbone_Glb_Center_Loc` |
| `Garen_Q_Jump_Blur` | Absent | `Root` |

All four declare `mIsLoop = false`. Jump, Land and Jump_Blur explicitly declare
`mIsKillEvent = false`; Sword_Trail omits that field. The audit preserves these
differences. An omitted frame is not recorded as an authored zero; an omitted
bone is not relabeled Root.

The current Q animation maps its provisional frame-10 contact marker to a saved
local release deadline. Schema 83 now records accepted activation,
committed swing start/release/end, target ID, origin/heading, confirmed impact
point/heading and independent presentation stops. A planned release still cannot
dispatch target-impact or silence particles. The first adapter uses these saved
clocks for the explicitly bound weapon trail; further systems need their own
dispatch and appearance treatment. Native timing, distortion, particle defaults,
materials and pixel comparison remain open.

## Reproduction and verification

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-q-particles.py
node tools/assets/convert-garen-q-particles.mjs
.tools/cdtb-venv/bin/python tools/assets/export-garen-q-particles.py
```

Discovery, if needed independently of the pin, uses
`discover-garen-particle-bins.py --ability q`. Four source checks cover complete
resource/dependency closure, exact output hashes and GLB attributes, absent buff
fields, primitive declarations and all four unchanged animation bindings.
Chrome checks all meshes/images/system selections, wireframe and startup
isolation. Full validation results are recorded in [PROGRESS](PROGRESS.md).

## Live weapon-trail adapter — October 21, 2026

The source `Garen_Q_Sword_Trail` emits its two mesh particles after the saved
frame-8 event, using the existing provisional frame-10-to-release animation map.
The event clock is rounded up to a simulation update, followed by the shared
first-update birth convention. The mesh retains its 0.25-second life, source
rotation/scale, UV scroll, color lookup and source-alpha additive blend. No
particle lifetime is stretched to the gameplay windup. The renderer follows the
explicit center bone's world position, with captured swing heading and authored
YXZ rotation. It does not inherit the bone's live rotation or invent a root
fallback. Missing bindings produce no mesh. Parent-heading and native attachment
semantics still need comparison. All source face-RGB bytes in these four meshes
are zero. They remain preserved metadata; the reader establishes their presence,
not a requirement to multiply them into the live material.

The local adapter hard-stops the bone-bound trail when its primary attack pose
is interrupted; it does not claim a native linger mode from an absent field.
A stop before frame 8 suppresses the future birth entirely. Order changes during
an uninterruptible windup retain that swing; target loss, death, recasts and match
end stop it. After contact, orders, actions and movement may stop presentation
without deleting the confirmed impact or changing attack cadence. Natural pose
completion has its own captured deadline. Audio keeps its existing accepted
one-shots independently of these visual stops.

Schema 83 validates target identity, same-level captured timing pairs, impact at
the actual release, one successful contact per activation, chronological stops,
recasts, terminal reasons and ongoing-cycle correspondence. Impacts are captured
before lethal damage can clear attack state or end a match. They survive target
loss, caster death, later orders and reload. Source target/silence dispatch has
not been added merely because this history is now available. Retention remains
the existing 200-tick sound tail, which also covers this short mesh life.

`export-garen-q-particles.py` pins the selected profile and accounts explicitly
for all thirty deferred emitter records and the empty buff system. Controller,
profile, one GLB and two textures load on Garen presence, with shared concurrent
loads, partial-failure cleanup and cached successful reuse. Each live particle
owns its material; geometry/textures remain shared when a particle retires or
fog removes it. Native timing, other Q layers, distortion, shader/attachment
comparison, W body operations and production/full-match acceptance remain open.
