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
