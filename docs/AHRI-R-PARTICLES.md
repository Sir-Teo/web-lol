# Spirit Rush particle source

The isolated source checkpoint retains all twelve R-prefixed base-skin resource
declarations. Eleven reference native VfxSystemDefinitionData records;
Ahri_R_Transform_Out explicitly references {00000000}. It supplies no invented
transform-out system. Ahri_R_TextureSwaps contains only its native identity and
particle name/path: both emitter arrays are omitted, rather than authored empty
arrays or an inferred texture-swap implementation.

The eleven systems contain 55 complex emitters. Missile variants remain separate,
as do the three indicator variants with one, two and three emitters. No simple
emitter arrays are present. The exact dependency closure contains eight BINs,
51 textures and four meshes: 63 files / 3,523,385 bytes. All asset paths resolve.
The source uses the existing pinned patch 16.18.8175716 manifest and Ahri WAD;
its record retains chunk provenance, complete definitions, native hashes,
omissions, unknown field labels and original curve ordering.

The source pin is [r-particles.json](reference/ahri/r-particles.json), SHA-256
3f283be14704aa77c680d2c11eb67441d8376586835e43283ae7be440c956991.
Complete native reparsing and restore pass with the unchanged pinned CDTB parser.
Eleven guards pass in normal and optimized Python. They reject closure/identity
changes, missing or invented null declarations, introduced emitter arrays,
boolean/number substitutions, conflicting native files and leaf/parent symlinks.
Restore preflights existing conflicts before network work or output writes.
See [verification](reference/ahri/r-particles-source-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-r-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-r-particles.py
```

These checks require native inputs and the retained parser installation. No public
transport, save field or runtime binding is added. The accepted Charm runtime
remains schema 180 / d625c0ee. Private decoding, explicit spell/animation joins,
saved visual observations, rendering and native calibration follow separately.
Resource names alone establish no native callback timing or gameplay policy.

## Private authored-mip and mesh decode

All 51 textures retain their 428 authored mip levels as private PNGs totaling
2,144,485 bytes. Compressed ranges, dimensions, straight RGBA pixels and alpha
statistics are checked; no resized/generated mips, gamma conversion or
premultiplication are introduced. Pillow's canonical software BC1/BC3 decode
does not establish native GPU appearance.

The four SCB 3.2 flag-2 meshes retain 844 vertices / 1,531 triangles. Their
individual vertex/triangle counts are 201/380, 260/480, 183/351 and 200/320.
Three have native BGRA vertex colors with separate RGBA projections; the fourth
omits colors. Points, indices, face UV/material bytes, bounds and pivots all
round-trip byte-for-byte to native sources. No normals, reflection, winding
change, unit scaling or pivot offset is added.

The frozen [decode record](reference/ahri/r-particles-decoded.json), SHA-256
d9c25753b0e04e08194709fbafa272ad52003859179f41af7f92b01dcb35dde4,
regenerates exactly. Ten guards pass in normal and optimized Python, covering
mesh/color corruption, invalid indices, nonfinite coordinates, PNG corruption,
changed record identity and whole-output conflict/symlink preflight. See
[decode verification](reference/ahri/r-particles-decode-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-r-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-r-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-r-decode.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-r-decode.py
```

These artifacts remain private. Public transport, producer joins, saved visual
clocks, rendering and native calibration are separate work.

## Explicit producer joins

The pinned character records explicitly select Ahri_R_mis_02 for the missile and
Ahri_R_Tar for contact. Launch bone `chest` remains distinct from contact bone
`C_BUFFBONE_GLB_CHEST_LOC`. FixedSpeedMovement retains speed 1,400 and both
100-unit height declarations. Tracking and visibility fields remain omitted;
CastOnMovementComplete precedes DestroyOnMovementComplete.

Three buff conditions connect the indicator variants to BuffCounter material
drivers with literal operands 1, 2 and 3. Comparison operators are omitted.
The reading preserves the complete driver records without declaring an equality
rule or mapping counters to local remaining charges. A skin HasBuff condition
adds two eye instances on L_Eye/R_Eye and separate TextureSwaps/Ready_tar instances
on the layout bone. TextureSwaps still has no authored emitter arrays.

These nine producer references join eight systems / 39 emitters with 38 textures
and two meshes. Ahri_R_cas, Ahri_R_mis and Ahri_R_Ready_Aura remain unjoined.
There are no R-prefixed ParticleEventData declarations in the pinned animation
clip map. Resource names do not supply the missing dispatch or chronology.
The explicit null Transform_Out resource is retained separately.

The [producer record](reference/ahri/r-particle-bindings.json) regenerates from
committed inputs without private caches, CDTB or Pillow. Nine rejection probes
and five source-pin mutations pass in normal and optimized Python, along with
two Node QA cases. A dedicated R source workflow runs the three portable Python
commands; no remote workflow is dispatched locally.

```sh
python3 tools/assets/read-ahri-r-bindings.py --check
python3 tools/assets/test-ahri-r-bindings.py
python3 -O tools/assets/test-ahri-r-bindings.py
node --test tools/qa/ahri-r-particle-bindings.test.mjs
```

Native counter semantics, missing dispatch, saved visual histories and rendering
remain open. The accepted schema-180 runtime is unchanged.

A fresh committed-file export of 449864c9 passes the reader check, normal and
optimized guard scripts, and both Node QA cases. It contains all required
committed inputs and no private caches, decoder tools or node_modules. This
validates portable producer reading, not native extraction or decoding in CI.
See [portable verification](reference/ahri/r-portable-reading-verification.json).

## Complete private transports

All 51 texture packs retain all 428 authored mip rectangles and exact decoded
pixels in 2,513,512 PNG bytes. Each rectangle must be extracted as its own texture
mip; directly sampling the packed atlas is invalid. Seven guards pass in normal
and optimized Python, including missing recursive dependencies, incomplete mips,
corruption, producer/source changes and all-output conflict/symlink preflight.

Four private GLBs total 39,828 bytes. Per-corner source replay preserves all
1,531 triangles, UVs and optional colors. UV seams produce 917 transport vertices
from 844 source vertices. No normals, coordinate transform, scaling or native
shader are added. All four GLBs have zero validator errors/warnings and load in
Three.js 186 with identity transforms. Five mesh guards pass, including isolated
byte-identical regeneration and rejection before partial publication.
See [transport verification](reference/ahri/r-transports-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/pack-ahri-r-textures.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-r-textures.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-r-textures.py
node tools/assets/convert-ahri-r-meshes.mjs
node tools/assets/verify-ahri-r-meshes.mjs
node --test tools/assets/test-ahri-r-meshes.mjs
```

No runtime or public assets change. Native GPU appearance and unresolved producer
semantics remain separate from transport correctness.

## Original emitter field types

The [native type record](reference/ahri/r-native-types.json) reads the verified
BIN field tags directly for all 55 emitters and all eleven resource records.
It retains 67 distinct field names and 123 FLAG-tagged fields. CDTB's integer
FLAG payloads remain separate from their native tags; JSON numbers do not imply
numeric controls or boolean constructor defaults. TextureSwaps explicitly lacks
an emitter-list field. Unknown field labels remain raw hashes.

Normal and optimized Python checks reproduce the same complete record, SHA-256
916507ddeb2cd0055577a915be79878442033582848e42c9bb7a3dc6d1e1b149.
See [type verification](reference/ahri/r-native-types-verification.json).

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/read-ahri-r-native-types.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/read-ahri-r-native-types.py --check
```

R adds fields beyond the earlier E projection, including distortion, field
collections, emitter linger, directional velocity, auxiliary texture inputs and
four unresolved hash labels. These require explicit profile handling. The type
reading supplies no missing native callbacks or shader semantics.

## Complete private profile projection

All 55 emitters project as 23 billboards, 13 quads, 13 trails and six mesh
instances. The profile retains every original source declaration, including raw
hashed labels and native field tags, beside projected curves, flags, texture
references and explicit local constructor fallbacks. All 68 authored field names
including __type are accounted for. Eleven FNV-checked aliases name period,
lookup, multiplier-division, palette-texture and noise declarations without
rewriting the frozen source pin.

Fourteen omitted emitter lifetimes and three missing palette textures stay
missing. Palette field {143f06d1} stays raw and unresolved. Noise arithmetic,
missing box dimensions, periodic-emission policy, UV rotation, scene-depth and
distortion inputs remain named requirements. The sixteen emitters in the three
unjoined systems retain their missing-dispatch requirement. Null Transform_Out
and identity-only TextureSwaps remain explicit in the reading.

The [portable reading](reference/ahri/r-profile-reading.json) pins the private
1,418,590-byte profile and all helper/input identities. Normal and optimized
guards reject six source-pin mutations and nine structural mutations, including
alias collisions, dropped emitters, boolean substitutions for native integer
FLAG payloads, unhandled fields and nonfinite curves. Every raw declaration and
field-tag set is checked. Four focused Node QA cases pass. See
[projection verification](reference/ahri/r-profiles-verification.json).

```sh
python3 tools/assets/prepare-ahri-r-profiles.py --verify-reading
python3 tools/assets/test-ahri-r-profiles.py
python3 -O tools/assets/test-ahri-r-profiles.py
node --test tools/qa/ahri-r-particle-bindings.test.mjs tools/qa/ahri-r-particle-profiles.test.mjs
```

This projection adds no runtime bindings or public assets. Native semantics and
rendered appearance remain separate from preserving source declarations.

The ff64783d committed export passes all seven producer/profile commands,
including both normal/optimized guard scripts and four focused Node QA cases.
All required committed inputs/helpers are present; no native cache, decoder tools
or node_modules are available. The workflow itself remains undispatched.
See [complete portable verification](reference/ahri/r-complete-portable-verification.json)
and [source-preparation acceptance](reference/ahri/r-source-preparation-acceptance.json).
Application, public-asset and compatibility-fingerprint sources match accepted
primary 2ee8682e byte for byte. Saved visual clocks and runtime rendering follow
as separate development work.

## Saved observation before particle rendering

The schema 181 candidate records bounded Spirit Rush presentation history. It
owns source and target poses, dash and bolt paths, charge changes, hit anchors,
and body-ending anchors so a restored match can reconstruct the same clocks.
Source poses retain at most 721 frames; completed bursts and ended windows age
out after the 720-tick history interval. Long-lived indicators use owned birth
and charge anchors rather than an unbounded path.

Strict save admission checks these records against the live Spirit Rush state,
audio, unit identities, rig clocks, movement limits, and historical deaths. A
separate admission correction permits a target killed by Lux E later in the
same completed tick, before Spirit Rush observes that death on its next update.
It preserves the existing update order and gameplay.

The [regression verification](reference/ahri/r-visual-observer-regression-verification.json)
records 9,256 passing tests, two previously recorded failures, 257 passing Node
QA cases, and 82 passing clean-export commands. A natural seed-one match ends
at tick 157116 with 44 round trips and 43 restored futures. All 45 archived
complete states match accepted E gameplay after excluding only schema, ruleset,
and the new R observation field. Existing E, W, Q, and audio facts remain in the
comparison. The [payload measurements](reference/ahri/r-visual-history-payload.json)
are samples, not worst-case memory bounds.

This candidate does not bind native R particle rendering. The existing
provisional essence-bolt models remain in use. Browser and delivery acceptance
are recorded separately from the earlier candidate proof.

The preparatory [asset reuse audit](reference/ahri/r-asset-reuse.json) verifies all
51 private texture transports and four private mesh transports. Native identity,
transport bytes, and complete mip metadata prove reuse for 29 textures and one
mesh already published by Q/W/E. The remaining transports total 647809 bytes
(22 textures and three meshes). Entries lacking native source identity are
excluded from the proof; matching appearance or filenames alone do not qualify.

```sh
python3 tools/assets/read-ahri-r-asset-reuse.py --check
python3 tools/assets/test-ahri-r-asset-reuse.py
python3 -O tools/assets/test-ahri-r-asset-reuse.py
```

This audit requires the retained private R transports. Its isolated guard run
passes eight rejection probes in normal and optimized Python modes. It does not
publish files, select renderer bindings, or add private-cache requirements to
the portable source workflow.


The [observer acceptance](reference/ahri/r-visual-observer-acceptance.json) passes
all 29 Q/W/E/R/audio browser cases, production nested-path checks covering 32
recordings, and offline lifecycle checks with 978 worker responses and zero
production errors. The fresh schema 181 pack `15b88ebe` contains 1,405 files /
579,768,106 bytes and retains the worker policy. Both R dash and arrival captures
were inspected in software Chromium. All 334 public WAV files / 96,632,632 bytes
match the accepted E primary; all 76 Ahri masters remain intact. The earlier E
pack is retained separately. This accepts saved R observation, not native R
particle rendering, full-project completion, or a current hundred-seed gate.

Primary integration at `9dc23589` preserves accepted application/public bytes.
A fresh primary build reproduces `15b88ebe` exactly and passes 41 focused tests
in five files. See [integration](reference/ahri/r-visual-observer-main-integration.json).
The complete earlier E pack remains retained separately. No push or deployment
is performed. R native particle publication and rendering follow this stage.

## Public profile and transport staging

Publication `65d75d28` stages all 55 profiles, 51 textures / 428 authored mips
and four meshes. Thirty byte-identical transports reuse existing Q/W/E URLs;
25 new public files total 647,809 bytes. Full raw declarations, native field
tags, constructor omissions and unresolved binding requirements remain intact.
The null resource, empty TextureSwaps system and three unjoined systems acquire
no invented dispatch. Source geometry coordinates and normals remain unchanged.

The [publication verification](reference/ahri/r-publication-verification.json)
passes four targeted Node QA cases and all eight Python workflow commands from
a 964-file committed export with no private cache, decoder tools or node_modules.
The isolated publication guard rebuilds required transport paths from committed
public assets and rejects changed source pins, corrupt bytes, conflicts and
symlinks in normal and optimized Python.

```sh
python3 tools/assets/export-ahri-r-particles.py --check
python3 tools/assets/test-ahri-r-publication.py
python3 -O tools/assets/test-ahri-r-publication.py
node --test tools/qa/ahri-r-particle-publication.test.mjs
```

The direct exporter requires the prepared private transport paths; the isolated
guards require only committed inputs. No runtime imports the new profiles yet,
so the schema 181 ruleset and its 675-file compatibility closure remain unchanged.
This isolated staging branch has no fresh delivery build or primary integration.
Renderer bindings, browser packets and delivery gates follow separately.
