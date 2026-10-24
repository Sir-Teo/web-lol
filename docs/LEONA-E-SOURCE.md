# Zenith Blade source effect preparation

All five declared standard-game E systems now have retained source definitions
and packaged dependencies. This prepares source assets; the E effects are not
integrated into gameplay. The renderer still omits the unimported Zenith
projectile instead of drawing a substitute arrow. Saved cast/flight/contact/
dash/arrival histories, the emission/trail sampler, material binding and source
E audio remain required.

## Complete declaration inventory

| System | Total emitters | Enabled | Disabled | Source sound declaration |
| --- | ---: | ---: | ---: | --- |
| `Leona_E_mis_weapon` | 20 | 12 | 8 | None |
| `Leona_E_mis_dash` | 4 | 2 | 2 | `LeonaZenithBladeDash_missilelaunch` persistent event |
| `Leona_E_cas_arrive` | 3 | 1 | 2 | `LeonaZenithBladeDash_hit` on create |
| `Leona_E_tar` | 5 | 4 | 1 | `LeonaZenithBladeMissile_hitchampion` on create |
| `Leona_E_ZB_sfx_01` | 1 | 1 | 0 | `LeonaZenithBladeMissile_hit` on create |

All 33 original records are retained, including thirteen disabled declarations.
The twenty enabled records include nine arbitrary quads, five billboards, three
meshes, two arbitrary trails and one attached-character description. One of the
billboards is named `empty`, uses the black texture in both product slots, and
belongs to the system declaring the ordinary hit sound. The inventory classifies
that system as a sound carrier and the other nineteen enabled records as visual
emitters; native callback/dispatch and default material behavior remain unknown.
The four sound names are declared by the retained base SFX bank. This does not
prove which simulation contacts or callbacks should create the systems.

The source pin re-decodes all five records from four original Riot BIN files in
the frozen 16.18.8175716 Leona WAD, matching the retained skin's resource map.
No definition comes only from a filename or discovery JSON. All nested fields,
period/emission windows, atlas/UV modes, bound-size policies, forces, flags,
material overrides and sound declarations remain intact. Disabled sword/trail/
smoke/ray/flare records are retained with their dependencies, not activated.

The two enabled arbitrary trails author mode 1, smoothing mode 1, cutoff values
1,200/3,000 and birth tiling values 805/1,100. Several weapon quads author a 0.05 s
first emission, a 5 s period, 0.5 s active interval and 0.25 s emitter lifetime.
These are raw declarations, not a reconstructed native update algorithm. Trail
sampling/smoothing, inherited transforms, normals/reflection, attachment,
period and native omitted-field defaults remain to be established.

## Hashed material-override dependency

The dash's material override contains `{97d68dc062eb5dfa}` in `baseTexture`.
Reading the original BIN establishes type **PATH (18)** and that exact uint64
value. A retained hash-dictionary candidate resolves to
`assets/characters/leona/skins/base/particles/leona_base_z_empty32.tex`;
recomputing its lowercase UTF-8 XXH64 yields the same native path hash, which
selects an actual entry in the same frozen WAD. The pin preserves the raw field
spelling and records this resolution separately. The texture is extracted and
decoded alongside the named dependencies. Its native binding/effect is not
inferred from its name or pixel content. The first extraction, which had only
the 41 explicitly named textures, remains preserved separately.

## Textures and geometry

The final source set contains **four BINs, 42 TEX files and four SCBs**:
1,576,679 original bytes. TEX conversion preserves full-resolution RGBA without
resizing. All 42 PNGs total 569,680 bytes. Thirty-two PNGs are new; ten already
have identical decoded pixels in the reference pack.

| Mesh | Source vertices | Triangles | Retained color streams |
| --- | ---: | ---: | --- |
| Contact cylinder | 40 | 40 | None |
| Contact cone | 183 | 351 | Vertex BGRA |
| Sword | 333 | 648 | Face-corner RGB |
| Inner sword (disabled declaration) | 333 | 648 | Face-corner RGB |

The strict SCB 3.2 reader uses the existing pinned LeagueToolkit layout evidence.
Every byte is consumed; unreferenced vertices, unknown flags and multiple
material groups fail explicitly. GLB packaging expands original face corners,
converts only POSITION from centimetres to metres, and separately retains raw
source positions, UVs, BGRA and face RGB. Pivots/bounds/material names, source
index hashes and independent attribute hashes remain in each manifest. No
normals, replacement primitive, pivot transform, winding change or native color
interpretation is invented.

The cone's original source and both exported files match the existing Eclipse
cone byte for byte, so it is shared. The other three GLBs total 149,220 bytes;
all four packaged GLBs total 189,016 bytes. GLTF validation reports zero errors
and warnings, and round trips preserve every attribute. A separate Python reader
checks actual SCB arrays and GLB accessor bytes independently of NodeIO.

Chrome loads all four actual GLBs, hashes every attribute and draws the original
triangle geometry with no WebGL error. The inspection screenshot also shows
wireframes from exact position copies. The installed Three.js non-indexed
wireframe helper counts an interleaved attribute's whole backing array rather
than its position count, causing the retained failed inspection's out-of-range
indices. The passing test verifies direct triangles first and copies positions
only for its inspection wireframe, checking the copied bytes again. Neither the
GLBs nor Three/application runtime was changed for this QA issue. The first
browser-discovery JSON import failure is also preserved separately.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-e-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-leona-e-particles.py
node tools/assets/convert-leona-e-particles.mjs --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/verify-leona-e-particles.py
```

The final two commands check current packaged files without rewriting them. No
native client, effect engine or shader was executed. Source preparation does
not certify runtime E playback, native parity, Leona selection/support or the
full project goal.


## Validation record — October 24, 2026

All **1,676 unit tests in 287 files**, TypeScript, three Node QA checks and
production build pass. Four new source-package tests and one real Chrome case
cover the five-system inventory, exact textures, raw source streams, shared cone,
disabled inner sword, hashed PATH dependency, trails/period/sound declarations,
actual GLTF loading, exact attribute bytes and visible triangle/wireframe draws.
Independent source verification and read-only conversion reproduction pass.
The screenshots were inspected as source geometry/texture evidence; they are not
native effect-frame comparisons.

No application runtime file changed. Schema **124** and ruleset
`d69c16c0407a5b436ef8cd078c989535ae38e72e9ed42778d60b77c9dacecdb2`
remain. The existing two-seed, ten-minute normal smoke was independently checked
against the current sources: 72,000 invariant-checked ticks, twenty round trips
and eighteen following-minute comparisons. This revalidates existing evidence;
it is not a newly run cohort or the required current full hundred-seed gate.
All 31 generated application/frontend files match the preceding audio build.
Only the offline manifest and its embedded worker change.

Production nested-path checks pass 32 recordings with zero unrequested Leona
preloads. A fresh full real Chrome offline audit passes **939 files/506,593,617
bytes**, 963 worker responses, saved-tick boot, new Lux 5v5, integrity/cancel/
retry/repair, multi-tab refusal, explicit activation, missing-entry revocation
and scope-only removal, with zero production errors. Pack ID:
`1413135caaee42a83730c37334cefdfaffa4bd22ceaa6bf75c11d66c071ec37f`.
The 32 new PNGs, three GLBs and three metadata files add 593,364 bytes.
Existing bundle-size warnings and full-match performance remain open.

The final archive `.cache/leona-e-source-validation-v3-20261024` retains **1,561
source/QA inputs and fifty original source files**. V1/V2 preserve discovery and
wireframe-harness failures, source snapshots, outputs and traces. The earlier
incomplete extraction retains its original 49 source files, pin and extractor;
the final extraction includes the resolved override texture. Two pinned layout
reader files are retained with the review evidence. See the
[verification ledger](reference/leona/e-source-verification.json).

```sh
node tools/qa/verify-leona-e-source.mjs
```

Use `--historical` after later canonical changes. The next required integration
is saved E phase/contact/flight/dash/arrival history, authored emissions and
trails, mesh/skin/quad/billboard material dispatch and source audio. Native CPU/
frame/listening comparison, Leona player/support integration and the full
six-champion match requirements remain open. The full project goal stays active.


## Subsequent saved-history integration — October 24, 2026

[Zenith histories](LEONA-E-HISTORY.md) now bind conservative retention bounds to
all twenty enabled declarations and save the gameplay phase/contact/dash/arrival
history required for later playback. This source-package audit remains historical
schema-124 evidence; the new history increment uses schema 125. Source drawing,
trails/materials/skin dispatch, audio and native acceptance remain unfinished.

## Subsequent kernel preparation — October 24, 2026

[Emission/history/trail kernels](LEONA-E-KERNELS.md) now compile all twenty enabled
records and retain all thirteen disabled declarations. Independent ribbon arrays
and saved-phase sampling are verified. GameView drawing, material/attachment
dispatch, source audio and native acceptance remain unfinished. This source
package's original delivery evidence keeps its historical identity.

## Subsequent reflective-mesh prerequisite — October 24, 2026

[Ordinary-mesh reflection](LEONA-E-REFLECTION.md) now has four pinned native shader
samples and an explicit-input material tested with synthetic geometry/resources.
The sword's SCB has no normal stream. Native normal construction, uniform/resource
bindings and variant dispatch remain unresolved; no normals are generated and
GameView still does not draw E. The skin shader's alpha treatment cannot be
substituted for the observed ordinary-mesh contract.

## Subsequent arrival-skin integration — October 24, 2026

[The arrival skin](LEONA-E-SKINS.md) now draws its authored complete rig from saved
poses, color and erosion. GameView includes this one enabled family, with lazy
loading and private skeleton cleanup. The other E primitives and source audio
remain unfinished. Fresh production/offline delivery evidence belongs to this
arrival increment; earlier source-package audits keep their original identities.

## Subsequent nonreflective-surface integration — October 24, 2026

[Nonreflective E surfaces](LEONA-E-SURFACES.md) now draw fifteen contact, dash and
flight mesh/quad/billboard families from saved history. Shared W rendering is
compared against its frozen implementation over 63 exact framebuffer/state
samples. Missile-ground projection and world acceleration have explicit local
binding policies backed by pinned external reconstruction. Together with the
arrival skin, sixteen visible families draw. Two trails, the reflective sword,
source E audio, native acceptance and player/support integration remain open.
Fresh production/offline evidence belongs to this surface increment.
