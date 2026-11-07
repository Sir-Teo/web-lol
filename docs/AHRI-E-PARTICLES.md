# Ahri Charm particle source

This isolated source checkpoint retains all four E-prefixed resources declared
by the pinned base skin: Ahri_E_buf, Ahri_E_cas, Ahri_E_mis and Ahri_E_tar.
Their complete native records contain 26 complex emitters: four buff, four cast,
twelve missile and six target emitters. Omitted simple-emitter arrays remain
absent. Resource aliases alone do not establish callback chronology.

The selected closure contains 25 native files / 1,764,654 bytes: three BINs
including the skin resource binding, 20 textures and two meshes. It comes from
Ahri's patch 16.18.8175716 WAD through the pinned Riot manifest and chunk ranges.
The source record is docs/reference/ahri/e-particles.json, SHA-256
cdf8ed963d051e9517443949c5a4b30b924d5c7ba9fed36aecccf6bdb5a1a756.
It preserves complete records, unknown hashes, omissions, curve order and asset
paths. No unresolved native asset-path hashes occur in this selected closure.

The unchanged CDTB parser and retained field/type labels have the same pinned
identities as Q/W. Reparse checks compare the complete skin binding and every
selected particle record, allowing only verified symbolic FNV aliases. Nine
guards pass in normal and optimized Python, including altered closure/identity,
changed pins, invented defaults, boolean/number substitutions, added empty
arrays, conflicting cached bytes and symlinked inputs. Restore preflights every
existing output before network/parser work and never repairs conflicts.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-e-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-e-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-e-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-e-particles.py
```

This stage requires the retained native sources and decoder installation; it is
not a cache-free CI claim. It adds no public assets, runtime effect bindings or
save fields. The accepted W renderer remains schema 178 / ff8abc1b; its current
archived cohort verifies unchanged. Decode, transport, spell/animation joins,
particle history, playback and native visual calibration remain separate steps.

## Private texture and mesh decode

The decoded record retains all 20 textures / 170 authored mip levels as private
PNGs (992,516 bytes), with compressed-range and straight-RGBA pixel identities.
It generates no resized mips, color-space transforms or premultiplication.
The SCB 3.2 flag-2 meshes retain 993 native vertices / 1,568 triangles. The heart
mesh has 390 vertices / 776 triangles without vertex colors; the swirl mesh has
603 vertices / 792 triangles with native BGRA and separate RGBA. Bounds, pivots,
indices and per-face UV/material bytes round-trip exactly. No normals, winding
changes, reflection, scale or pivot correction are introduced.

The record SHA-256 is
db521bcff91bf5d9bbccd99f6a8495be9825320789edf3e9487ffe53090cf96b.
A fresh generation reproduces every retained output and the record. Normal and
optimized checks and ten guard cases pass, covering native corruption, indices,
nonfinite coordinates, color metadata, PNG CRC, changed pins, symlinks and whole
publication preflight. Existing Q/W helpers and source artifacts remain intact.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-e-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-e-decode.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-e-decode.py
```

These are private software-decoder outputs, not native GPU appearance or
runtime acceptance. Public transport and playback remain separate work.

The [source/decode receipt](reference/ahri/e-particles-source-verification.json)
pins both commits, the successful checks, unchanged shared helpers and the
unchanged runtime identity.

## Additional persistent-buff resource

The native Charm buff also declares effect key {44fc6ec4} on
C_BUFFBONE_GLB_LAYOUT_LOC. The unchanged base-skin resource map resolves this raw
key to Characters/Ahri/Skins/Skin0/Particles/Ahri_Base_Doom_buf. Its spelling is
not inferred. The separate e-additional-particles.json retains all three complex
emitters and their complete native fields. Its four-file closure contains two
BINs and two additional textures / 88,843 bytes; those textures are absent from
the E-prefixed closure above. The original four-resource pin remains frozen.

The additional source pin SHA-256 is
d16b06cc12bfd2016dc07f048d1b031ff6da346f3dbb2ab7dfdb7aa407086c90.
Native reparse and nine guards pass in normal and optimized Python. The native
integer-to-boolean substitution guard follows an actual integer in this record;
it does not invent a boolean field. Complete buff chronology and rendering are
still separate work. The selected ability now has five resource definitions /
29 complex emitters available for the producer reading.

## Portable native producer reading

The reading retains the complete E ability and both child spell records. Two
spell fields join missile and target effects; two persistent-buff declarations
join the head effect and raw hashed layout effect. Four directional Spell3
animation clips declare the cast resource at source frame 1, without end frames.
The exact E_ prefix excludes unrelated Emote events. All five selected systems /
29 emitters are joined by these declarations, referencing 22 textures and two
meshes; native script bodies and callback chronology remain unverified.

The missile declares FixedSpeedMovement at 1550, start bone
BUFFBONE_CSTM_WEAPON_1 and initial target-height offset 100; its visibility
component remains omitted. Its ordered behaviors are CastOnHit,
DestroyOnMovementComplete and DestroyOnHit. Root-spell head and missile spine
hit-bone declarations remain distinct. These fields do not supply renderer
transforms, frame conversion, direction selection or persistent-effect stopping.

Portable guards reproduce the reading without caches or a native decoder,
reject six changed input pins, preserve omissions and reject conflicting outputs
and symlinked leaves/parents. Both Node QA wrappers pass. A dedicated workflow
runs the portable reading and normal/optimized guards. This stage adds no runtime
rules, histories or public assets.

The additional two textures also retain all 17 authored mip levels as private
PNGs (50,264 bytes). Complete-record, changed-pin/PNG-CRC, publication-conflict and
symlink guards pass in normal and optimized Python. The combined selected effect
closure therefore has 22 textures / 187 authored mips and the original two
meshes. No public transport has been published.

The [producer verification](reference/ahri/e-particle-bindings-verification.json)
records the eleven-file clean export, all three portable commands, both Node QA
wrappers, the independent 64-record character reparse and additional native /
decode guard evidence. Shared Q/W helpers remain unchanged.

## Private transport preparation

The texture ledger stages 22 lossless mip packages / 1,205,232 bytes, including
both source records and the hashed buff dependency. Each authored mip rectangle
must become a distinct GPU mip; sampling the packed image directly is invalid.
Seven guards pass in normal and optimized Python, covering complete recursive
texture dependencies, duplicate/missing sources, mip extents, source/producer
pins, corruption, symlinks and final-ledger conflicts before any earlier writes.

Two GLBs retain 993 source vertices / 1,568 triangles in 38,520 bytes. Per-corner
indices, positions, UVs and optional RGBA colors replay exactly. The heart stays
without colors; the swirl keeps colors. No normals, transform, pivot correction,
reflection or winding changes are introduced. GLTF validation reports zero
errors/warnings, both load through actual Three.js 186, and five isolated mesh
publication guards pass. The combined transport is 24 private files / 1,243,752
bytes, without public preload or runtime dispatch.

## Native emitter field types

The native type reading retains 54 ordinary field names (55 including the
projected struct type), with 68 authored FLAG fields across all 29 emitters.
It reparses the verified original BINs with a combined symbolic table after
checking both frozen source closures. Normal and optimized checks reproduce
one reading. FLAG payloads remain native flags even when CDTB serializes them
as integers; this is separate from boolean or numeric-control interpretation.

Compared with the W field set, E adds colorLookUpScales on the hashed buff and
hasPostRotateOrientation / postRotateOrientationAxis on two missile heart
emitters. Their raw values and native tags remain retained. Post-rotation math,
attachment transforms and native pixels are not inferred from those fields.
This check requires the private decoder/source installation and is separate
from the portable producer workflow.

## Private profile projection

The projector retains all 29 emitters and all 55 authored fields (including the
struct type) in a 454,094-byte private profile. It covers 16 billboards, four
meshes, four quads, two attached skins and three trails. Existing Q/W value and
material helpers remain unchanged. Five structural mutations and seven changed
input pins reject; normal/optimized portable guards and both Node QA wrappers
pass, including conflicts, corrupt profiles and leaf/parent symlinks.

Six omitted emitter lifetimes and one unnamed palette texture stay missing.
The buff's attached mesh omits its selector list, which stays absent with an
explicit unresolved selector-policy requirement. The cast retains both raw
selectors. Bound-object size and fresnel inputs also stay unresolved.

The two missile heart post-rotation declarations retain integer FLAG payload 1
and raw axis [90, 0, 0], with an explicit arithmetic-binding requirement. The
hashed buff retains lookup scale [1, 0.4000000059604645]. These fields are not
silently replaced by W's defaults. This remains source projection, with no
public assets, renderer, gameplay rules or save-schema change.

## Retained attached selectors

The native SKN draw table verifies the cast's {07c39130} selector as Tails,
joining one current GLB primitive with the same native index count. Its second
selector, {62579b4c}, has no match in the retained table. That is not evidence of
global native absence, and no fallback draw is invented. The buff's selector
list remains omitted; no whole-body draw policy is inferred. Both complete
primitive and reflection declarations stay retained.

Normal and optimized portable checks reproduce this reading and reject five
changed input pins, output conflicts and leaf/parent symlinks. The dedicated
workflow also covers this stage. Locking, native skin sampling, transforms,
fresnel inputs, omitted-selector behavior and pixels remain unverified.

The [transport/profile verification](reference/ahri/e-particle-transports-profiles-verification.json)
pins the transport, native-tag, projection and attached-reading commits and all
successful evidence. One combined clean export reproduces all nine workflow
commands without private caches or native tools. The existing W archived cohort
still verifies against the current runtime sources.

The [source-preparation acceptance](reference/ahri/e-source-preparation-verification.json)
records all 251 passing Node QA cases. Application source, public-asset and gameplay-test
bytes remain unchanged from the accepted W runtime. This accepts preparation
only; E saved histories and rendered playback remain future work.

The [primary integration receipt](reference/ahri/e-source-main-integration.json)
records merge 73cd844, current-source cohort verification and an identical
rebuilt production pack.

## Post-rotation reader baseline

The E heart mesh profiles retain native hasPostRotateOrientation and the
[90, 0, 0] postRotateOrientationAxis. Before adding a local implementation,
42 float32 matrix samples were generated by executing the pinned external
ownBasisInto reader and its unchanged basis dependency. The samples cover six
spins and seven post-rotation choices, including the E axis, omitted rotation
and asymmetric noncommuting angles. Other own-basis factors are disabled or
identity, isolating left multiplication of post rotation after spin.

The producer tools/assets/export-source-particle-post-rotation-samples.mjs
checks all three existing reader SHA-256 pins, imports no application arithmetic,
refuses fixture replacement and reproduces the committed JSON with --check.
These samples establish external composition order; they do not establish native
callback timing or rendered-pixel parity. Local renderer support remains pending.

The isolated sourceParticlePostRotation kernel now matches all 42 frozen
matrices byte for byte, preserving float32 writes between post rotation and the
supplied world basis. It validates finite native angles and matrices and returns
independent storage. Other own-basis factors remain explicit caller work. The
combined spin/draw/post-rotation checks pass 581 tests in four files, and TypeScript
passes. Direct current dependency enumeration confirms the new module is not yet
consumed: the accepted schema-179 ruleset and its 658 files remain unchanged.
The historical schema-113 closure-receipt verifier is inapplicable to this runtime;
its old pinned-receipt mismatch is retained separately from the current check.

## Isolated public transport staging

The E renderer branch now stages all 29 profiles, 22 texture atlases / 187
source mips and both native-coordinate meshes. Eleven atlases borrow verified
Q/W owners, leaving 13 new public files / 519,022 bytes. The colorless heart mesh
retains no vertex-color attribute; the colored swirl retains its exact stream.
Only explicit private transport paths change in the public profile projection.
Raw post-rotation flags, missing selectors, lifetime omissions and unresolved
binding requirements remain intact. No E playback is connected.

Publication preflights all source inputs and outputs, rejects symlinked source
transports, and never repairs conflicts. Eleven input-pin mutations, corrupt
private and borrowed data, symlinked leaves/parents and final-output conflicts
are exercised in normal and optimized Python. Both Node QA wrappers pass.
The eleven E-source workflow commands also pass in a curated portable copy
without decoder tools or private source/transport caches. A committed-export
check follows the publication commit. The accepted primary runtime and pack
remain separately retained while this renderer branch is under development.

The committed publication revision 8ea0a69 reproduces all eleven workflow
commands from a 62-file curated Git archive without private cache or tools.
See e-publication-portable-verification.json for the exact revision and commands.

The unconnected E asset loader now loads eleven E-owned atlases and two meshes,
borrowing eleven sampler textures from the existing Q/W owners. It waits for
owner readiness, validates address modes before delegation, and retains
successful resources across failed loads without exposing partial readiness.
Both source meshes convert centimetres to metres once; the heart remains
colorless and the swirl receives its exact BGRA companion stream. Forty-nine
focused asset/post-rotation tests and TypeScript checks pass, including real
GLB parsing, all vertex positions, color presence and retry counts. Connecting
this loader to a renderer and verifying its browser request closure remain next.

## Saved phase-root adapter

The isolated E history adapter joins cast, flight, hit and both persistent-buff
systems with stable per-cast keys/seeds. Cast acceptance is an explicit local
birth clock, not a recovered conversion of native animation frame 1. Cast and
hit systems retain authored finite emitter windows; flight ends at the observed
stop, and both buffs use the observed control stop or its fixed expiry deadline.

Flight paths include the separate pre-move launch root and actual contact; body
roots use source/target poses rather than the missile contact point. Old target
paths clamp at their retained lifetime ending. Target-bound visibility never
inherits the caster team, and interpolation requires both visible neighbours.
Weak-key path caches invalidate same-tick audience/pose replacement; distances
remain seek-order independent and facing follows the short arc with exact saved
endpoints. Flight flex uses the observed missile radius, separate from body radii.

Twenty-two phase/snapshot/W-path tests pass. A real posthumous cast is retained
until its exact retirement boundary, round-trips there, and cannot reappear on
the caster's actual respawn. The minimum champion death timer is 600 ticks,
longer than this E retention; no source-ending field or schema change is needed
for that case. Bone transforms, attached-skin selection and renderer integration
remain separate steps.

## Isolated E sampler

The E sampler now projects all 29 authored emitters through the existing
source-referenced birth, motion, binding, appearance, spin, UV and lookup kernels.
Two non-neutral rate probability curves retain per-phase deterministic schedules;
they are not replaced with neutral tables. Indexed cosmetic draws, a 60 Hz grid,
nearest-tick delays and phase scheduling bounds are explicit local policies.
The two heart meshes carry their independently checked post-rotation matrices.
Missing attached selectors remain metadata; producing a skin packet does not
claim that a mesh-selection policy or attached renderer has been resolved.

Five system samplers match pure reconstruction on forward/backward seeks and
after cache disposal. All 29 emitters produce finite packets without changing
authored profiles. Tests cover moving-root transport, source-size flex, no cache
reference exposure, probability-driven rate counts, post-rotation, late-birth
suppression and finite stop drains. Total particle life is capped by authored
linger after a stop rather than extended by it. The combined E/W/schedule/basis
checks pass 133 tests across four files, and TypeScript passes. Scene integration,
attachments, GPU material choices and browser request/draw verification remain
pending. No native callback or rendered-pixel parity is claimed.

The shared surface path now accepts an explicit source rotation matrix before
attachment reflection. Existing packets retain their unchanged Euler branch.
Seventy-one basis/E/W checks and 37 existing surface-consumer checks pass across
ten files, with TypeScript clean. A consumed-file audit against primary 1c95b19
finds only source-particle-surfaces.ts changed among the 658 compatibility files.
The isolated candidate therefore has ruleset 7d183645 under schema 179; it is
not an accepted delivery identity and E playback is still unconnected. See
e-surface-basis-verification.json. The primary accepted runtime remains 062e397a.

## Ribbon and attached-skin bindings

All three camera-facing missile trails now produce source-centimetre packed
points with actual path distances, birth visibility and source smoothing mode 2.
Their quad materials retain erosion and packed UV/tint channels while borrowing
textures. The local missile root is ground plus one metre, using the declared
100-centimetre target-height offset as an adapter value rather than claiming a
reconstructed native start-bone transform. Ten E/W ribbon and skin-binding tests
pass, and TypeScript passes.

Attached skin binding draws only the verified cast Tails match. The second
selector remains unmatched, and the buff Avatar's omitted selector list remains
an unresolved omission with no invented whole-body geometry. Both exact native
Fresnel inputs (0.05f and 0.15f) reuse the already checked common skin-property
mapping, yielding 0.3449999988079071 and 0.8350000381469727. This does not recreate
the unavailable historical Leona reader or claim a new native dispatch proof.
The unresolved buff skin must remain a named rendering limitation.

## Private attachment-root sampling

Historical cast/target roots can now sample private reference skeletons using
exact declared bone names and saved body positions/facing. Live models and World
remain untouched. Recent poses refresh at each frame; older queried points stay
cached, returned vectors are independent, and replaced Worlds/retired groups
release owned samplers. Flight keeps the explicit ground-plus-one-metre root.

A missing rig or exact bone name uses a recorded collision-height fallback;
no alias from the missile's raw spine field to a differently named bone is
invented. Target lifetime endings clamp the pose query clock. Seventeen private
pose/history checks pass across three files, and TypeScript passes. These use
functional reference fixtures; actual asset attachments and fallback diagnostics
still require the upcoming scene/browser check.

## Unconnected scene renderer

The E scene layer now draws 24 regular surface profiles, three packed ribbons
and the verified cast Tails overlay. All 28 bound profiles contribute in the
real-World unit fixture; the buff Avatar remains an explicit unresolved skin
profile. Cast skin uses E's sampled color, erosion, UV and finite lifetime over
a private animated source pose. Hidden cast births cannot replay that overlay
after reveal. Missing palette inputs and named attachment fallbacks remain
reported local limitations rather than fabricated source data.

The combined E and shared-consumer checks pass 104 tests. They include exact
fresh/reused save reconstruction through backward seeks and real Flash, genuine
visibility changes, three trail families, finite matrices, terminal drainage
without World steps, and disposal that preserves borrowed textures/geometry.
TypeScript passes. The renderer is not yet connected to View; the next commit
adds lazy roster routing and the full compatibility closure before browser QA.
