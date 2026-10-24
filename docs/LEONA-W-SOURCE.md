# Eclipse source dependencies

All five standard-game W particle systems are retained from the frozen Riot
16.18.8175716 manifest. Every selected BIN definition is re-decoded from its
original bytes and compared in full. The separate DoomBot indicator is outside
the frozen Summoner's Rift mode. This prepares the complete source set for
Eclipse presentation; runtime playback remains unfinished.

| Resolver key | Records | Enabled | Disabled |
|---|---:|---:|---:|
| `Leona_W_buf_1` | 7 | 7 | 0 |
| `Leona_W_buf_2` | 3 | 3 | 0 |
| `Leona_W_cas_fail` | 14 | 6 | 8 |
| `Leona_W_cas_hit` | 20 | 11 | 9 |
| `Leona_W_tar` | 6 | 3 | 3 |
| Total | 50 | 30 | 20 |

The [source pin](reference/leona-w-particles.json) retains all fields, including
disabled records, source names, sound declarations, curves, probabilities,
render flags and dependencies. Naming alone does not prove native dispatch or
attachment. The [decoded ledger](reference/leona-w-particles-decoded.json)
records every emitter's exact definition hash and explicit fields. No emitter
is currently marked as implemented by this packaging step.

## Images and geometry

The three BINs, 36 TEX images and six SCB meshes total 2,595,943 source bytes.
All 36 images decode to full-resolution RGBA PNGs totaling 650,289 bytes. Three
images already shared with Sunlight retain identical bytes/pixels. The 33 new
PNGs add 649,178 bytes; no source texture is resized or replaced.

The six SCB meshes contain 3,055 triangles. Conversion expands each face corner
to preserve UV seams and retains winding, materials, pivot and raw bounds.
Four meshes have per-vertex BGRA data, and two have separate face RGB data;
Praxis contains both. These streams are preserved as separate custom glTF
attributes without assuming their native shader contribution. The converter
applies only the established 0.01 unit scale to `POSITION`; `_SOURCE_POSITION`
also retains the original unscaled float32 coordinates exactly. No normals,
pivot offsets or emitter transforms are generated. The six GLBs total 342,596
bytes. Together with their six sidecars and new PNGs, 45 public files add
1,001,180 bytes.

The SCB reader follows the pinned LeagueToolkit revision and verifies all input
bytes, indices, color streams and file boundaries. Its raw-bounds values remain
separate from measured minima/maxima. Native mesh flags, material color use,
coordinate conventions and complete composition still need comparison.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-w-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-leona-w-particles.py
node tools/assets/convert-leona-w-particles.mjs
node tools/assets/convert-leona-w-particles.mjs --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/verify-leona-w-particles.py
```

The read-only verifier re-decodes all three source BINs and every TEX pixel. It
parses GLB chunks/accessors independently of NodeIO and compares every exported
coordinate, UV and authored color byte against the original SCB, including
original-coordinate attributes. Conversion also requires zero Khronos errors
or warnings and exact NodeIO attribute round trips. The reproduction command
checks generated GLBs, sidecars and the decoded ledger byte for byte using the
retained decoder intermediate.

## Required playback work

The enabled set contains four attached-character mesh layers, two ray layers,
ten custom-mesh layers, seven billboards and seven arbitrary quads. It requires
the complete attached-skin material path, reflection/erosion, source UV and
palette stages, soft-particle/depth behavior and two distortion declarations.
The attached character layers must use the animated character mesh; flat quads
are not an equivalent implementation. Negative particle life, missing defaults,
variable birth rates and phase/stop behavior also require explicit handling.

Future integration must cover both buff systems, successful and failed
detonations, confirmed target contacts, movement, death/recast/victory, saved
poses and audiences, hidden births, context recovery and resource retirement.
Authored disabled records remain disabled. Source sound dispatch/audio,
human controls/selection, support AI and native timing/rendering comparison
remain required. The current simulation stays at schema 123 / ruleset
`18058f085b96c376177780b67d7783fbb24ce283043ecca3daf394c80fcecb30`;
this source preparation changes no match rule or saved state.


## Validation record

All 1,615 tests across 279 files, TypeScript and three Node QA checks pass,
including eight new asset checks. Production smoke and a complete real Chrome
offline-pack audit pass. The current 878-file/499,066,391-byte pack adds only the
45 prepared files; all preceding file entries and the worker policy are exact.
Full match cohorts and the Q browser suite were not repeated for this unused
source preparation. The source archive preserves 317 final inputs, 45 raw
particle files and 28 generated build files. Initial extractor ownership and
missing-validator-type findings remain separate from the final passing revision.
See the [verification ledger](reference/leona/w-source-verification.json).

```sh
node tools/qa/verify-leona-w-source.mjs
```

Use `--historical` after later canonical changes. These checks establish source
packaging and delivery behavior; Eclipse runtime and native acceptance remain open.

The four attached-character records now have a separately verified
[skin material and posed-rig inspection](LEONA-W-SKIN-MATERIAL.md). Full W
particle scheduling and match rendering remain unfinished.

The subsequent [playback increment](LEONA-W-PLAYBACK.md) records W phase/contact
histories, samples all enabled emitters and draws the four attached-character
material descriptions. The other 26 layers and full/native acceptance remain open.
