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
guards require only committed inputs. At the publication checkpoint, no runtime imports the new profiles,
so the schema 181 ruleset and its 675-file compatibility closure remain unchanged.
This isolated staging branch has no fresh delivery build or primary integration.
Renderer bindings, browser packets and delivery gates follow separately.

## Joined spell renderer candidate

Application `1bef0ac0`, schema 181 / ruleset `e2c1447e`, binds 20 spell profiles
from `Ahri_R_mis_02` and `Ahri_R_Tar`. Saved bolt paths and pre-damage contact
poses control their roots and clocks. Two noise profiles and one palette profile
remain deferred, alongside 16 persistent and 16 unjoined profiles. No native
buff-counter comparison or unjoined cast callback is invented.

The selected closure uses 23 textures and one byte-identical W-owned mesh. It
borrows existing Q/W samplers and loads four R textures plus one shared W
transport outside W's own joined subset. W's original 25-asset closure stays
explicit in browser verification. The shared geometry is already converted to
scene units and is not rescaled. Native vertex-color data and absent normals
remain intact.

Private historical skeletons resolve `C_BUFFBONE_GLB_CHEST_LOC`; missing bones
retain named local collision-height fallbacks. Flight roots use the explicit
one-metre adapter. R ribbons preserve binding motion, independent secondary
UVs, 2×2 flipbook cells and soft inputs. Soft ribbons and ordinary surfaces
share one depth capture. Missing global palette inputs remain neutral and
unverified. Provisional bolt spheres retire when the source renderer is ready.

The [candidate regression record](reference/ahri/r-spell-rendering-regression-verification.json)
passes 9,308/9,310 full-suite tests with the same two historical failures, 261
Node QA cases, and 84 clean-export commands. Scoped selections execute 1,080
tests across 134 files with overlap. All 33 distinct browser cases pass, including
real brush visibility, Flash, caster death, terminal retirement and UI reloads.

The [frozen rendering baseline](reference/ahri/r-render-gameplay-reference.json)
retains 357 complete states across 21 scenarios from the accepted R observer.
All 45 natural-match saved states also match, including every R observation,
after excluding only schema and ruleset. The seed reaches Blue victory at tick
157116 with 44 round trips and 43 checked futures. All earlier simulation/content
bytes remain unchanged; the [source delta](reference/ahri/r-spell-rendering-source-delta.json)
records nine renderer dependencies and the compatibility-root declaration.

Pack `3dbfa301` contains 1,432 files / 581,114,779 bytes and passes its complete
byte/worker audit. All 334 public WAV files / 96,632,632 bytes remain exact.
Flight and contact screenshots were inspected in software Chromium.
The [spell-rendering acceptance](reference/ahri/r-spell-rendering-acceptance.json)
passes production nested-path verification with 32 recordings and no unwanted R
renderer/texture preloads. Offline lifecycle checks pass with 978 worker responses
and zero production errors. Primary integration follows separately; native pixel
calibration and representative-device performance remain unfinished.

Primary merge `0f697966` reproduces accepted pack `3dbfa301` exactly and passes
74 focused tests in nine files. Application/public bytes match the accepted
branch. See [integration](reference/ahri/r-spell-rendering-main-integration.json).
The earlier R observer and E packs remain retained. No push or deployment occurs.

## Palette mixer identity reading

The hashed palette field `{143f06d1}` is the FNV-1a lowercase spelling
`palleteSrcMixColor`, including the native misspelling. The pinned external
parser independently uses the same name. The [identity reading](reference/ahri/r-palette-field-reading.json)
finds exactly one occurrence: `Ahri_R_mis_02` / `Ribbon_1`, emitter index 8
(public profile 30). Its `ValueColor` is exactly
`[0.9499961733818054, 0, 0, 0]`. The referenced gradient retains its authored
128×4 base level. Raw source declarations and the published profile stay intact.

```sh
python3 tools/assets/read-ahri-r-palette.py --check
python3 tools/assets/read-ahri-r-palette.py --check --verify-readers
python3 tools/assets/test-ahri-r-palette.py
python3 -O tools/assets/test-ahri-r-palette.py
node --test tools/qa/ahri-r-palette-field.test.mjs
```

Normal/optimized guards pass eight structural rejections and two source-pin
mutations; both targeted Node QA cases pass. The ordinary check needs only
committed inputs; `--verify-readers` additionally checks the retained private
reader files against their recorded hashes. External reader defaults do not
certify native constructors. Authored palette count/selector omissions remain
explicit. This identity stage changes no runtime binding, ruleset or pack.

## Palette ribbon binding

The follow-on renderer binds this checked field for profile 30, bringing the
selected spell subset to 21 profiles. The original 55-profile publication and
all native assets remain unchanged. The adapter rejects unknown palette fields,
dynamic mixer values, unsupported selectors and invalid counts. It preserves an
authored positive count; when count and selector are omitted, the local adapter
uses count 1 and selector 0, matching the pinned external reader. These defaults
remain explicitly unverified as native constructor behavior.

The ribbon applies the authored mixer before sampling the gradient at row 0.5,
alongside its source erosion texture. The gradient uses linear lookup filtering.
The texture closure contains 26 textures, with seven local loads: six R-owned
textures and one additional shared W texture. The remaining 34 deferred profiles
comprise two noise emitters, sixteen persistent producers and sixteen unjoined
producers. Missing global palette inputs remain neutral and unverified.

The focused selection passes 43 tests in six files, including exact ribbon
packets after snapshot restoration and the unchanged complete gameplay baseline.
The full suite passes 9,312/9,314 tests with the same two historical failures;
all 263 Node QA cases pass. All 33 distinct browser cases pass. The clean export
passes 87 commands and 1,084 scoped test executions across 135 file executions,
including overlap. One fingerprint test exceeded its five-second timeout under
concurrent load; the identical command passes after the match job finishes, with
both logs retained. All 5,529 committed export files were verified before cleanup.

All 45 complete natural-match states match the accepted R observer, including
every R observation, excluding only schema and ruleset identifiers. The match
retains its Blue victory at tick 157116, 44 restores and 43 checked futures.
All 334 public WAV files / 96,632,632 bytes remain exact.

Pack `01c9c16a` contains 1,432 files / 581,116,424 bytes and passes its complete
byte and worker audit. Production nested-path checks pass with 32 recordings and
zero eager R texture/renderer loads. Offline lifecycle checks pass with 978
worker responses and zero production errors. See the
[palette acceptance](reference/ahri/r-palette-acceptance.json). The previous
20-profile pack is retained separately.

Primary merge `ec9af34c` reproduces pack `01c9c16a` exactly and passes 78 focused
tests in ten files. Application/public bytes match the accepted candidate. See
[palette integration](reference/ahri/r-palette-main-integration.json). The previous
20-profile R pack remains retained alongside the R observer and E packs.

## Persistent buff mapping preparation

The isolated `ahri-r-persistent-history` helper maps the skin's explicit
`HasBuff(AhriR)` condition to two `Ahri_R_Eyes` instances on `L_Eye` / `R_Eye`
and one `Ahri_R_Ready_tar` instance on `C_Buffbone_Glb_Layout_Loc`. Its local
producer window follows the saved R end observation, including zero charges
and actual Essence extensions. Counter-driver indicators remain excluded.

Caster roots use owned source poses and visibility. Fractional roots require
consecutive observations; discarded history gaps remain unavailable. The
independent birth anchor stays usable. Buff expiry stops births while a living
body keeps moving; death/removal freezes the old body's ending pose. Six focused
cases and the 23-case complete gameplay baseline pass, alongside TypeScript.
The helper remains unconnected to rendering, so the accepted ruleset stays
`a68ca14b` with 685 compatibility files. Particle lifetime/period integration,
long-lived birth roots and native stop behavior still require separate work.

The [spell-packet reference](reference/ahri/r-spell-packet-reference.json) freezes
72 complete missile/contact packet hashes from accepted application `a7092caa`.
Its producer verifies all 690 archived source files and executes only the frozen
sampler, covering two cosmetic seeds, fractional ages and stopped clocks. All
73 reference checks pass before the persistent sampler changes. Reproduction
requires the retained palette cohort and a fresh output path:

```sh
node tools/qa/build-ahri-r-spell-packet-reference.mjs .cache/ahri-r-palette-roster-seed1 FRESH_OUTPUT.json
```

The sampler now prepares only eye-glow profiles 45/46 for the next integration
stage. Their authored emission window is 50 seconds and particle lifetime is two
seconds; periodic trails stay excluded. All 109 scoped checks pass, including
the unchanged 72 accepted spell packets, backward/fractional seeks and finite
local stop/linger behavior. This preparation does not dispatch eye effects yet.

Private buff attachments now resolve the exact eye bones from owned animation
timelines and commit the bone handoff in source-centimetre float32 storage.
Four attachment cases pass within an 86-check selection, including missing-bone
fallbacks, snapshot replacement and same-tick observation refresh. TypeScript
passes. Both eye bones and the layout bone exist in the published Ahri rig.

## Eye-glow renderer candidate

The candidate now draws profiles 45/46 on both explicit eye bones beside the
21 accepted spell profiles. It uses the saved buff window and private caster
poses, current saved visibility for these fully bound particles, and the local
stop/linger policy. The two periodic eye trails, six layout profiles and six
counter-driven indicator profiles remain deferred, alongside the two noise and
sixteen unjoined spell profiles. The remaining deferred count is 32.

The selected texture closure grows to 27 by borrowing the already loaded Q cast
glow texture. It adds no R-owned transport or mesh request. All 167 focused tests
in fifteen files pass, including the 72 unchanged accepted spell packets, late
restoration after rolling pose retention, viewing-team changes and terminal
cleanup without World steps. TypeScript passes. Schema 181 stays unchanged;
the candidate ruleset is `18613342` with 688 compatibility files. Browser and
broader delivery verification are in progress; primary remains the accepted
palette renderer until those checks finish.

Candidate verification now passes 9,401/9,403 full-suite tests in 587 files with
only the two historical failures, all 263 Node QA cases and 87 first-attempt
clean-export commands. Scoped selections execute 1,173 tests across 140 file
executions, including overlap; all 5,546 committed export files verify before
cleanup. All 33 distinct browser cases pass across the retained runs. The initial
eye request-count probe used a truncated Resource Timing buffer; the page
request listener confirms one shared glow request. The original trace remains.

All 45 natural-match complete states match the accepted R observer, excluding
only schema and ruleset identifiers, with victory at tick 157116, 44 restores
and 43 checked futures. All simulation, content, public assets and 334 WAV files
remain exact. Pack `60079db3` contains 1,432 files / 581,122,307 bytes and passes
the complete byte/worker audit. See the
[regression record](reference/ahri/r-eye-glow-regression-verification.json).
Production nested-path checks pass with 32 recordings and zero eager R
renderer/texture loads. Offline lifecycle checks pass with 978 worker responses
and zero production errors. The
[eye-glow acceptance](reference/ahri/r-eye-glow-acceptance.json) records all 23
selected profiles: 21 spell profiles and two eye-glow profiles on both native
eye bones. Pack `60079db3` remains exact after delivery checks; the prior palette
pack is retained separately.


Primary merge `d80bd9a4` reproduces pack `60079db3` exactly and passes all 167
focused tests in fifteen files. Application/public bytes match the accepted
candidate. See [eye-glow integration](reference/ahri/r-eye-glow-main-integration.json).
The prior palette, 20-profile R, R observer and E packs remain retained.

## Periodic eye-trail schedule preparation

The unconnected `ahri-r-eye-schedule` helper preserves profile 47's three-second
continuous period and profile 48's 2.5-second period with authored active duration
`0.6000000238418579`. Both omit emitter lifetime. The proposed local adapter
leaves cessation to the observed buff producer instead of borrowing the glows'
authored fifty-second limit. Native constructors remain unverified.

Constant positive rates and integral period lengths make each period boundary
a count-history barrier in the selected source kernel. Replaying recent cycles
matches complete 5,000-second schedules for both profiles, including their
16-bit pool-counter wraps. Birth timing, shares and absolute emitter phase stay
exact. Cosmetic identities use local update tick and in-step slot; they do not
claim native pool/RNG identity. Distant seeks require at most 200 kernel updates
and retain at most 32 births in the checked cases. All 253 scoped checks and
TypeScript pass. The helper is not connected to rendering, so the accepted
ruleset remains `18613342` with 688 compatibility files.

An additional exhaustive glow check samples every 60 Hz update through 52
seconds (3,120 updates), covering the complete authored fifty-second emission
window and drain. All birth/binding clocks stay valid; the four glow-sampler
cases pass without a runtime change.

The [accepted glow-packet reference](reference/ahri/r-eye-glow-packet-reference.json)
adds 36 complete packet hashes from application `c5ab6230`. Its producer pins the
retained cohort plan and verifies all 693 archived source files before executing
the frozen sampler. All 37 reference checks pass before trail integration.
The 72 earlier spell-packet references and their producers remain unchanged.

The [trail-policy reading](reference/ahri/r-eye-trail-policy-reading.json) pins
four external reader files. Their parser maps omitted `mMode` / `mSmoothingMode`
to ordinary ribbon mode / smoothing off. Those remain explicit local defaults;
the raw source omissions stay intact and native constructors remain unverified.
Ordinary mode measures UV distance along the current visible run, so discarded
caster history needs no fabricated lifetime odometer. The shared packed writer
now supports that mode through an opt-in flag, preserving WAKE as its default.
All twelve independent ordinary-mode fixtures, all earlier WAKE fixtures and
both frozen packet baselines pass within 173 scoped checks. TypeScript passes.

The sampler now prepares profiles 47/48 without binding them to live drawing.
Recent-cycle schedules keep birth caches bounded, while per-birth whole-second
clock origins preserve float32 sub-tick precision at long system ages. Emitter
phase stays absolute, and saved pose queries retain their actual caster times.
All 122 sampler checks pass, including million-second ages, backward/fractional
seeks, stop/drain behavior and all 108 earlier spell/glow packet hashes. Ribbon
geometry and renderer ownership are the next separate integration stage.

The procedural ribbon upload layer now preserves the packed shader attributes,
converts source centimetres once, grows owned buffers and retires their materials
without disposing page-owned textures. Three ownership/upload cases pass within
62 packed-ribbon checks. The upload helper remains unconnected to live effects.

## Periodic eye-trail renderer candidate

Both authored eye trails now draw from saved eye-bone roots beside the earlier
glows. Local ordinary-ribbon mode re-measures each visible live run; its unused
lifetime odometer stays neutral. Ground-layer metadata does not project these
head-height ribbons onto terrain. Birth/binding motion uses the saved actor
frame without a missile tilt or a second caster translation. Caches retain only
recent births and owned pose-window roots.

The selected subset is now 25 profiles: 21 spell profiles plus all four eye
profiles on both native eye bones. Six layout and six counter-driven profiles
remain deferred, alongside two noise and sixteen unjoined profiles. The texture
closure contains 28 textures and one shared W mesh. Seven R-owned transports and
one shared W transport load locally; eye glows keep borrowing the Q cast texture.
The newly selected soul-trail texture retains all ten authored mip levels.

All 279 focused checks in 22 files and TypeScript pass. All eight R browser cases
pass, including the periodic active/gap windows, exact restoration of all eight
ribbon attribute buffers, native eye bones and one new texture request. The
earlier 72 spell and 36 glow packet hashes remain exact. Broader regression,
production/offline and natural-match verification follow before acceptance.

The regression checkpoint passes 9,468/9,470 tests in 593 files, with only the
two historical failures, plus all 263 Node QA cases. All 87 clean-export commands
pass on their first attempt; scoped selections execute 1,240 tests across 146
file executions, including overlap. All 5,565 committed export files verify
before removing only the disposable export.

All 25 cross-kit browser cases pass beside the eight R cases. An additional
same-scene framebuffer probe places a diagnostic camera from the actual eye
bones and renders each ribbon profile against both ribbons hidden. Profiles 47
and 48 change 16,362 and 11,695 pixels respectively, with no attachment fallback
or World mutation. The combined image shows the golden ribbons at the moving
head. This establishes visible contribution in software Chromium, with no claim
of native-client pixel equivalence or representative-device performance.

All 45 complete natural-match projections match the accepted R observer,
excluding only schema/ruleset identifiers; victory remains at tick 157116.
Simulation, content, public assets and all 334 WAV files remain exact. See the
[trail regression record](reference/ahri/r-eye-trail-regression-verification.json).
Production/offline delivery remains pending at this checkpoint.
