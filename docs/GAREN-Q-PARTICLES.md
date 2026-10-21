# Decisive Strike particle sources

All eleven base Q resource keys now have frozen source definitions, including
31 emitter records, 29 lossless textures and four exact mesh conversions. The
development inspector exposes all assets and definitions. This is source
preparation plus twenty-one live emitters: the weapon trail, eight activation/armed,
seven confirmed-contact and five jump/landing layers. Ten emitter records and native
rendering remain open. Gameplay values are unchanged; schema 84 retains attack
outcomes, presentation stops and the landing event's ground anchor. Garen remains
outside production selection.

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
sprite and mesh maps. Four GLBs add 50,208 bytes. The live adapter requests all four
meshes and nineteen textures only on Garen presence. The ordinary fixture requests
none of the new Q graphics. Unused textures remain inspection assets. Shared
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
loss, caster death, later orders and reload. Confirmed contacts now drive the
separate target adapter below; silence dispatch remains open. Retention remains
the existing 200-tick sound tail, which also covers this short mesh life.

`export-garen-q-particles.py` pins the trail and cast profiles and accounts
explicitly for all ten deferred emitter records and the empty buff system.
Renderer/profiles, four GLBs and nineteen textures load on Garen presence, with shared
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

## Confirmed-contact impact layers — October 21, 2026

Seven of the eight `Garen_Q_Tar` emitters now reconstruct from saved **confirmed**
contacts: both SIDEWALL source-mesh layers, flash, slash, forward-impact ray and
two directed spark emitters. The distortion record remains separate. An intended
release, missed/cancelled swing or target lost before contact emits nothing.
Once accepted, the local one-shot finishes independently of later armed/pose
stops, recasts, target/caster movement and death. Finishing a match advances its
bounded presentation clock without advancing the saved simulation. No schema,
combat, silence or audio behavior changed.

This adapter anchors the system at the saved target contact's terrain height and
uses its saved caster heading. It retains source emitter/spawn offsets, rotated
velocity, lifetime, scale/color curves, passes, atlas cells and blend modes.
The explicit bind weights and the missing weights on other emitters remain
in the generated profile; this initial fixed-contact policy does not establish
native recipient-bone binding or subsequent target following. No arbitrary
recipient-center height is invented. Native dispatch, attachment, heading and
composition require comparison.

The spark legacy shape rotates offset and velocity by the same sampled X-axis
angle, using normalized source axes. Every birth-value table shares one indexed
chance; a separate indexed roll chooses lookup/atlas values. This is repeatable
cosmetic sampling rather than the native RNG stream. The pinned
[shape reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/spawnShape.ts)
and [emission code](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts)
retain this shared turn. Straight-line motion is sufficient for these seven
records: none declares acceleration, drag or orbital motion. Source singles emit
the rate-sized burst on the first update; nonsingles use the existing 60 Hz rate
budget through their authored 0.1-second emission window. Natural particle life
is independent of the emission window. `particleLinger` remains source metadata;
no script stop is fabricated at the end of emission.

Spark length multiplies source Y size by `max(1, speed * directionVelocityScale)`;
the pinned [draw reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/particleRead.ts)
uses that speed stretch, with the missing minimum default of one from the
[system reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/readVfxSystem.ts).
The ray retains its authored +Z axis despite negative-Z travel; the
[ray classification](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/drawKind.ts)
excludes rays from direction orientation/stretch. The existing camera-facing ray
builder supplies width, length and the near edge. Source 2×2 spark grids omit
`numFrames`; the retained reader default of one therefore leaves their random
start in cell zero. The mesh sheets retain four authored frames starting at one.
Five additional reference files are hash-pinned in
`reference/garen-q-impact-reader.json`, linked to the prior eight-file evidence.
These are external reconstruction semantics, not native-client measurements.

Each enemy particle is filtered at its own world position, independently of caster
visibility or model presence. Reveal reconstructs the current age rather than
restarting. Every particle owns its material; the two live ray particles also own
their dynamic geometry. Fog, retirement and checkpoint removal dispose those
resources while the source meshes, quads and textures stay shared. Loading now
shares three GLBs and fifteen texture paths with atomic partial-failure cleanup.
Only eleven of the new Q PNGs are requested, plus three Q GLBs; the other four
textures overlap existing W/E/R assets. Ordinary Ashe/Lux startup requests none
of the new Q graphics. No binary asset changed.

The exporter accounts for sixteen implemented and fifteen deferred emitters. Its
conservative 75-tick contact tail fits within the existing 200-tick history, even
when a committed attack resolves shortly after armed expiry. Unit checks cover
confirmed-contact gating, source fields, shared spawn motion, stretch, atlas
absences, deterministic finite seeks, lethal contact and exact continuation after
caster death. Three new real-game Chrome cases cover all seven layers, save/reload,
independent movement/death, actual fog with a hidden caster, target loss, frozen
match-end clocks and material/ray disposal. Seven new independent PNG product and
framebuffer probes bring the Q GPU total to thirty comparisons. The 1440×900
close-up contact capture was visually inspected. Full verification is recorded
in [PROGRESS](PROGRESS.md); native comparison and the remaining fifteen layers
remain open.

## Jump and landing ground events — October 21, 2026

Five more color emitters now render: the Jump source mesh and Land's outward dirt,
waves, smoke and delayed decal. The four scene-distortion emitters remain deferred.
All selected profiles retain the complete fields, including missing frames/bones,
empty lookup names, explicit create/kill-event flags and lifetime distributions.
Jump's start frame is absent. The local adapter dispatches it at accepted attack
commitment using the already saved origin/heading; this does not relabel the
missing source frame as authored zero. Both selected animation events omit a bone,
so these ground effects do not invent a Root attachment.

Schema **84** adds `attacks[].landing`, a nullable `{tick, point, facing}` anchor.
The simulation maps source Land frame 9 through the existing provisional
frame-10 release timing and captures the caster's point/heading at that update's
animation boundary. A lost target or stopped attack before dispatch retains no
landing. A subsequent stop preserves the captured event. The decoder rejects a
missing required field, future/wrong-frame anchors and a missing anchor after an
uninterrupted event. A stop exactly on the event tick can occur before dispatch or
after it through an external action, so either state is permitted at that boundary.
The original committed timing pair, impacts and stop validation remain required.
Old checkpoints remain incompatible under the existing version/ruleset policy.

Accepted ground systems use a local natural one-shot policy: source lifetimes
continue independently of later movement, recasts, death and terminal matches.
The explicit `mIsKillEvent=false` describes an event that creates particles;
it does not by itself prove native parent-stop behavior. The ground point and
heading stay fixed. All enemy particles use their own point visibility, even
when their caster is hidden. Reload reconstructs current ages without replaying
births. No combat values, damage timing, silence or audio rules changed.

Singles emit source-sized bursts (2 jump, 40 dirt, 5 waves, 20 smoke, 3 decal).
The first eligible local update is `max(1, ceil(delay * 60))`, with float32 timing
noise removed at the grid boundary. Thus the source 0.01-second wave delay is
eligible at event +1, and the 0.1-second decal delay at +6; no extra empty update
is appended after a positive delay. This implements the eligibility condition
in the pinned [emission reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/emit.ts)
on the local 60 Hz grid, not a native-cadence measurement. A shared birth chance
samples all birth distributions and shape angles; a separate roll remains fixed
for atlas/lookups. No simulation RNG is consumed.

Legacy rotations compose on the right before rotating both spawn offset and
velocity. The smoke's two source axes therefore apply in the retained matrix
order rather than accidentally reversing it. Dirt uses the source stepped drag,
with a closed-form sum and interpolation of the next step. The system omits flags;
the pinned reader's `0xd4` default leaves analytic drag off. The pinned
[integrator](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/integrate.ts)
damps travel before displacement. Separately, source `worldAcceleration` adds
`acceleration * age * particleLifetime` at draw time, following the pinned
[particle reader](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/particleRead.ts).
It is not substituted with a ballistic half-acceleration term. Direction-oriented
dirt takes its local Y axis along travel; camera-facing smoke uses its sampled
rotation. Source sizes, color/scale curves, atlas grids and passes are retained.
The conservative ground tail is 99 ticks, covered by the existing 200-tick history.

Source UV mode 2 now separates scrolled/atlas RGB from locked alpha. The selected
quad records sample alpha at the original corner UV; meshes sample untranslated
UV. None of these records animates UV rotation/scale, so both reduce to raw UV in
this adapter. The existing armed sword mesh also declares mode 2 and now uses the
same correction. The pinned [shared fragment reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/shaders/quad.ts)
and [mesh path](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/shaders/mesh.ts)
are hash-pinned in `reference/garen-q-ground-reader.json`, linked to the prior
thirteen reader files. Independent PNG RGB/alpha texels verify the two coordinate
paths and source alpha blend, in addition to the prior additive/darken modes.
Twenty samples now produce forty product/framebuffer comparisons. These establish
adapter arithmetic, not native material or scene composition.

Loading now includes all four Q meshes and nineteen texture paths, with atomic
partial-failure cleanup and shared cached retry. Fourteen prepared Q PNGs and
four Q GLBs are requested on Garen presence; five image paths overlap W/E/R assets.
Ordinary Ashe/Lux startup requests none of the new Q graphics. Ground particles
own only materials; all geometry/textures remain shared through fog and retirement.
Every prepared binary remains unchanged.

Seven new unit cases cover source bindings/absence, motion, birth delays, composed
shape rotation, exact saved event capture/continuation, before/after-event target
loss, same-tick death and malformed snapshots. Three new Chrome cases check both
jump particles and all 68 landing particles, exact real checkpoints, independent
ground placement and direction, later movement/death, actual fog with a hidden
caster, delayed birth and finite frozen-match tails. Both 1440×900 captures were
reviewed. The close-up landing composite still shows visible quad boundaries;
native sampling, material/pass composition and attachment calibration remain open.
The ten remaining emitter records and full Garen/production acceptance are not
certified by these checks. See [PROGRESS](PROGRESS.md) for current validation.
