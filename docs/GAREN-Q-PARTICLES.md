# Decisive Strike particle sources

All eleven base Q resource keys now have frozen source definitions, including
31 emitter records, 29 lossless textures and four exact mesh conversions. The
development inspector exposes all assets and definitions. This is source
preparation plus nine live emitters: the weapon trail and eight activation/armed
layers. Twenty-two emitter records and native rendering remain open. Gameplay values are unchanged; schema 83 adds
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
sprite and mesh maps. Four GLBs add 50,208 bytes. The live adapter requests two meshes
and eleven textures only on Garen presence. The ordinary fixture requests none
of the new Q graphics. The other Q meshes/new textures remain source assets. Shared
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

`export-garen-q-particles.py` pins the trail and cast profiles and accounts
explicitly for all twenty-two deferred emitter records and the empty buff system.
Renderer/profiles, two GLBs and eleven textures load on Garen presence, with shared
concurrent loads, partial-failure cleanup and cached successful reuse. Each live particle
owns its material; geometry/textures remain shared when a particle retires or
fog removes it. Native timing, other Q layers, distortion, shader/attachment
comparison, W body operations and production/full-match acceptance remain open.


## Activation and armed layers — October 21, 2026

All four `Garen_Q_Cas` and four `Garen_Q_Cas_Sword` emitters now render alongside
the existing trail. The accepted activation starts the bubble/bubble-2/dark
bubble/flash bursts. These one-shots finish naturally. The sword system starts
at the same local activation clock and follows the saved armed interval, with
its flare, rising glow, spinning source mesh and activation quad. All source
rates, first-update births, life/size/rotation distributions, color/scale curves,
passes, depth flags and scrolling UVs are retained. The cast sampler uses one
indexed chance for birth-value probability tables and an independent roll for
atlas/lookup selection, consuming no simulation RNG. This is repeatable cosmetic
sampling, not the native RNG stream.

These systems have no retained animation-bone event or modern script dispatch
binding. The adapter anchors them at the current caster root and uses current
caster yaw for locally oriented layers. Unoriented bubbles face the camera; the
sword mesh's explicit global orientation keeps its authored rotation independent
of caster yaw. Root translation follows the caster, consistently with the
selected records' constant bind weight of one. These are explicit local dispatch
and attachment policies. The weapon trail keeps its separate source event/bone
binding and pose-stop policy.

The dark bubble declares blend mode 2. The pinned
[blend reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/blend.ts)
uses destination color times one minus source color, with an independent
one-minus-source-alpha destination factor for alpha. The adapter follows those
factors and the reference's ADD/SUBTRACT tint premultiplication. It does not
replace the mode with reverse subtraction. Eight independent PNG texels are
pinned for RGBA product and framebuffer checks across ADD, SUBTRACT and alpha-add.
Those GPU checks establish this implementation's arithmetic, not native scene
composition or pass order.

The spinning mesh declares a multiplier-scroll block with **no named multiplier
texture**. The pinned
[asset reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readValue.ts)
returns no texture for an absent name, and
[pass selection](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/uniforms.ts)
requires both a layer and a texture. The profile preserves its scroll metadata;
no second texture sample is invented. The flare's four authored frames have no
`texDiv`: the
[reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readSurface.ts)
uses a 1×1 grid, so the retained random frame selection wraps to the same cell.
These missing-field interpretations remain reconstruction evidence.

Armed-system stopping follows the pinned
[settlement](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts)
and [wait/cap definitions](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/systemModel.ts).
No stopped update emits a new particle. The mesh's one-second `emitterLinger`
threshold is measured from system activation; it is not an extra second granted
after every stop. On the first eligible simulation update after that threshold,
type 0 caps **total** particle life at its one-second `particleLinger`. Existing
age remains unchanged, and color/scale/lookup phase uses the capped lifetime.
The other armed layers retain their shorter natural lives under their larger
caps. The activation system is dispatched as an independent accepted one-shot,
so its missing flash linger field does not fabricate a buff-driven early kill.

A conservative 122-tick post-stop bound covers the cast adapter, below the
existing 200-tick retained history. Schema 83 and gameplay values remain
unchanged. Early consumption, natural expiry, recasts, death and match end all
use the existing saved stop clock. Native script stop operations, emitter-frame
inheritance, UV_MODE details, mesh color-slot selection, scene composition and
pixel comparison remain open. Eight external reader files and hashes are pinned
in `reference/garen-q-cast-reader.json`; export verifies them and downloads a
missing cache entry from its exact revision URL.


Validation: 1,018 unit/source checks and TypeScript, 32 focused Chrome scenarios,
sixteen independent PNG product/blend GPU comparisons, all model/map validators
and nested-path production smoke pass. Early-cast and consumed-tail checkpoints
restore exact material/transform state. Close-up cast and tail captures were
visually reviewed. All 43 generated Q outputs reproduce byte-for-byte; the
production copy of all 37 static Q files matches. [PROGRESS](PROGRESS.md) records
scope, bundle sizes and the saved-menu browser helper correction.
