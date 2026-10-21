# Demacian Justice source particle assets

Garen R now renders 16 source layers in the development player and NPC fixtures:
the caster flash/ground glow, three sword layers, and eleven impact layers. They
use the previously verified four source meshes and 21 texture dependencies.
The seventeenth source emitter is scene distortion, which remains explicitly
deferred. This is an initial source-backed adapter, not native presentation
certification. Garen remains excluded from production selection.

Snapshot version 78 records accepted R, a valid release and pre-release
cancellation independently of the cast pose and target reveal. The existing
27-tick damage/reveal gameplay policy is unchanged.

## Frozen definitions and dependencies

`reference/garen-model.json` resolves `Garen_R_Cas`, `Garen_R_Sword_Tar` and
`Garen_R_Tar_Impact` through the base skin's resource map. Their definitions are
in two linked multi-skin BINs rather than inline in the skin BIN. The new
`reference/garen-r-particles.json` retains those complete definitions and pins
both BINs, four SCBs and 21 TEX files to patch 16.18.8175716, manifest
`29CE6E781C3B6368`, `DATA/FINAL/Champions/Garen.wad.client`. It records source WAD
path hashes, file sizes/hashes and the downloaded bundle ranges/chunk hashes.

Discovery inspects all 15 skin-linked multi-skin BINs and finds all 14 declared
R resource keys. Field/type labels initially come from existing verified pins and
CDragon dictionaries; every dictionary name is checked against its FNV hash.
The narrower extraction then decodes the three selected records directly from
frozen source bytes and requires exact equality with the retained definitions.
Subsequent reproduction requires no discovery cache or current dictionary
service. Names provide labels; source bytes provide the values. The remaining
resource declarations, including old buff/indicator and kill/death variants, do
not establish which are dispatched by the modern spell script.

Long deduplicated BIN virtual names exceed filesystem filename limits. The
archive reader's optional flat-cache mode stores each member under its verified
16-digit WAD path hash, retaining the full virtual name in provenance. Ordinary
extraction keeps its original path layout. Repeating the existing Judgment
extraction verifies that default behavior still matches its committed pin.

Riot WAD/BIN/TEX/SCB are handled by the repository's pinned format-aware CDTB and
SCB pipelines; the available REA binary opener does not advertise these formats.
This is static artifact evidence, without a native client execution or capture.

## Converted outputs

| Source mesh | Vertices | Triangles | GLB bytes |
| --- | ---: | ---: | ---: |
| Sword plane | 4 | 2 | 1,852 |
| Praxis ground burst | 200 | 320 | 24,616 |
| Half dome | 201 | 380 | 29,028 |
| Sphere | 1,081 | 2,156 | 156,924 |

All four SCBs use version 3.2, flags 5. The decoder expands source face corners
without welding UV seams, and retains positions, per-corner UVs, face RGB,
material names, central point and the uninterpreted 24-byte tail. Every source
vertex is referenced. Their six-float header bounds are all zero; actual bounds
are measured from vertices and preserved separately. A zero header is not a
zero-sized mesh. Positions use the established 0.01 source scale. No pivot
translation, winding change, axis reflection or emitter transform is baked in.
The face RGB, pivot and trailing block are not assigned guessed runtime meanings.

Each GLB round-trips every position, UV and custom `_SOURCE_FACE_RGB` value
exactly through glTF Transform, with zero validator errors or warnings.
Individual sidecars support the ordinary model validator. The complete decoded
ledger is `reference/garen-r-particles-decoded.json`.

The 21 RGBA PNGs total 1,053,820 bytes, including two already present for
Judgment. The decoder reuses those files only after an exact size/pixel
comparison. Source, output and RGBA hashes are retained for every texture.
Dependencies include the sword's scrolling fire and multiplication textures,
lifetime color ramps, ground decal, smoke, rock atlas, shockwave and distortion
inputs. Lossless image conversion alone does not establish their shader roles or
native composition.

The development inspection page at `/tools/qa/garen-r-source-preview.html`
shows all textures and provides orbit/zoom and wireframe views for every mesh.
It centers each mesh and pairs it with one authored texture for UV inspection.
It is not an animated R preview. Its GPU probe exercises the same live material
extension against independent PNG texels. Authoring tools remain build-time only;
the application uses local static assets.

## Timing and attachment evidence

The source `Spell4_Base` graph has exactly one particle event: `Garen_R_Cas` at
frame **10**, attached to `C_Buffbone_GLB_Layout_Loc`, with loop and kill flags
false. No explicit offset, follow policy or ending frame is present. The
separate 18.5 cast marker is not this event. At the source clip's 30 FPS, these
markers are 0.3333 and 0.6167 seconds respectively. The current local animation
policy maps marker 18.5 to its 27-tick damage release; under that existing map,
frame 10 occurs 14.5946 ticks after acceptance. This arithmetic does not prove
native playback rates or event precedence.

The sword and impact records have authored emission delays, lifetimes, curves,
textures and geometry. Their declaration does **not** provide a modern script
activation time or target attachment rule. The sword drop also has a large
world-acceleration declaration, and its fade layer has a scrolling texture
multiplier. The impact includes billboard defaults, a rock atlas and distortion;
a simple additive mesh approximation would omit those fields. One shape type
remains the unresolved hash `{ee39916f}` in the cast/impact definitions. Preserve
these unknowns until their defaults and semantics have evidence.

## Runtime adapter and persistence

The [existing R gameplay contract](GAREN-R.md) remains authoritative for the local
27-tick windup and target-only reveal. Both the caster event and target sword
start at the frame-10 time under the existing warped pose. The caster start is
source-derived; activating the target sword at that same time is a **local
script-dispatch policy**, since its source invocation is still unknown. Impact
starts only when the simulation releases R onto its captured living enemy
champion. A shielded or invulnerable recipient can still receive the released
presentation; damage processing remains authoritative for health changes.

The caster flash attaches to the actual case-folded
`C_Buffbone_GLB_Layout_Loc` node, with an explicit root fallback if a replacement
rig lacks it. Translation follows the animated attachment; the source-space
frame uses captured caster facing rather than guessed bone-axis inheritance.
Enemy caster draws require caster sight. The target sword follows the selected
champion's interpolated ground position during windup, then freezes at the
release point. Impact shares that frozen point and ground elevation. These
world-space target anchors do not inherit target rotation or hit-bone offsets.
Target effects from an enemy source require sight of the pending target or the
released ground point; friendly source effects follow the existing shared
presentation visibility policy. Native per-pixel fog composition remains open.

The pure sampler reconstructs source rate-sized single bursts, non-single
rate-budget births, float32 delay boundaries, indexed probability tables, shape
offsets/rotations, scale/color curves, UV scroll and static/random atlas cells.
It consumes no simulation RNG and depends on no prior rendered frame. Omitted
scalar/vector/color defaults follow the already pinned reader. The unresolved
shape class keeps only its explicit offset; no unknown shape defaults are added.
A random atlas start adds an indexed frame offset and wraps within the declared
cell grid. Native PRNG, random-frame selection and emission cadence still need
matched execution evidence.

Motion uses **local analytic constant acceleration with exponential birth drag**.
For the undamped sword drop this retains authored initial velocity -2,100 and
acceleration -123,300 source units. This interpretation of `IntegratedValueVector3` is provisional;
it does not inherit the separate Lux study's draw-time acceleration policy.
Velocity-oriented particles align their long axis with computed travel. Camera
quads use the camera frame, while arbitrary quads retain the established Garen
UV/rotation convention. These transforms require native comparison.

The initial RGBA product uses raw linear textures, authored tint/lookup and an
independently scrolling sword multiplier. Static atlas scale/offset modifies
only source UVs. Source passes and add/alpha/alpha-add modes, alpha-reference
cutoffs, depth testing, no depth writes and double-sided single-pass draws are
retained. Additive tint alpha attenuates RGB under the existing adapter policy.
The shader does **not** yet establish native UV_MODE lock-alpha, source face-RGB,
full remap/palette semantics or framebuffer composition. The distortion emitter
needs a verified scene-sampling render pass; drawing its normal map as an ordinary
colored billboard would be incorrect, so it stays absent from live draws.

A shared loader fetches four meshes and the 19 textures used by the selected
layers. Ordinary Ashe/Lux startup adds no R-specific requests; two PNGs are already
shared with the existing Judgment loader. The renderer and generated profiles
also load through an on-presence dynamic import. Initial Garen matches await their assets; a later Garen NPC triggers the same cached
resource set on presence. Partial failed loads dispose their completed resources;
late loading can retry after five seconds. Per-particle materials dispose on
expiry/hiding while borrowed geometries and textures stay cached.

`garenRVisual` stores start tick, target ID, captured facing, initial target point,
nullable release tick and nullable cancellation tick. A valid release freezes the
actual recipient position before damage. Killing the target, later caster death,
movement/orders, pose replacement, reveal expiry and target disappearance cannot
create or erase that release. Caster death, target disappearance or match end
cancel an unreleased cast; a dead/missing target at the deadline never manufactures
an impact. Cancellation immediately removes the target sword while already-born
caster particles finish naturally. The record retires 180 ticks after release or
cancellation, covering the longest selected impact envelope (about 2.32 seconds)
plus interpolation. Individual particles still expire on their own source lives.

The decoder requires Garen ownership, learned R, compatible target references,
exact release timing, mutually exclusive release/cancellation, valid pending
cast geometry/facing and matching reveal history. It rejects missing active
history, foreign payloads, future/expired intervals and contradictory clocks.
Released/cancelled history may outlive a removed target; pending history may not.
Restore rebuilds keyed particles and their clocks exactly, independent of map
insertion order. Earlier same-build saves are incompatible under the existing
version/ruleset policy. Practice cooldown resets can replace the single retained
R history; ordinary cooldowns do not permit overlapping R casts.

## Reproduction and validation

Use the pinned environment from [ASSETS.md](ASSETS.md):

```sh
# Optional discovery, needed only to investigate additional unpinned R resources:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/discover-garen-particle-bins.py

# Repeatable committed source/asset pipeline:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-r-particles.py
node tools/assets/convert-garen-r-particles.mjs
.tools/cdtb-venv/bin/python tools/assets/export-garen-r-particles.py

npm run check
npm run test:browser -- e2e/garen-justice.spec.ts e2e/garen-r-source.spec.ts
npm run assets:validate
```

The original source conversion reproduced 31 byte-identical outputs; repeated
playback export also reproduces its two generated files exactly. Source checks
verify resolution, dependency closure and the separate frame-10 event. Ten
new state cases exercise pending/released/cancelled restoration, killing release,
later caster death, missing recipients, match-end cancellation, expiry and
malformed histories. Six new
sampler/source cases cover all sixteen layer identities, source burst sizes,
sword acceleration, deterministic random atlas selection and the full decal life.

Chrome observes every implemented layer with actual meshes/textures and finite
transforms; checks the authored attachment and independent multiplier; saves a
killing R after caster death and compares particles by stable identity after
reload; tests enemy fog/disposal and late NPC loading; and captures caster flash,
falling sword and impact for visual review. Three independent GPU samples verify
all RGBA channels within one byte against source PNG texel products, covering
separate sword scroll coordinates and the rock atlas. Wider check results are
recorded in [PROGRESS.md](PROGRESS.md). Native timing/attachment/composition,
distortion, R source audio, other Garen effects and complete production/full-match
acceptance remain open.
