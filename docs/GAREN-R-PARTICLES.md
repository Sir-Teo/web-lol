# Demacian Justice source particle assets

The three primary R systems are now verified against the frozen Riot archive and
packaged for the browser: two cast emitters, three sword emitters, and twelve
impact emitters. Four source meshes and all 21 texture dependencies have lossless
exports. **Live R particle dispatch is not implemented by this increment.** The
current gameplay, cast pose, reveal, checkpoint schema 77 and production roster
gate are unchanged.

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
It is not an animated R preview. The page imports no game runtime and adds no
R asset requests to ordinary gameplay. Files are local static assets; extraction
dependencies remain authoring tools.

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

The [existing R gameplay contract](GAREN-R.md) remains authoritative for the local
27-tick windup and target-only reveal. Further integration should explicitly
capture acceptance, target identity, facing, successful release tick/point and
pre-release cancellation in a separate persisted presentation record. Pending
casts and cast animations can clear before a sword/impact tail ends; reveal or
cooldown cannot prove that damage released. A release record should survive a
killed target, subsequent caster actions and save/restore. Choosing frozen-ground
versus target-following anchors, cancellation tails and emission start offsets
requires an explicit local policy until native behavior is verified. No new save
fields or cancellation semantics are introduced here.

## Reproduction and validation

Use the pinned environment from [ASSETS.md](ASSETS.md):

```sh
# Optional discovery, needed only to investigate additional unpinned R resources:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/discover-garen-particle-bins.py

# Repeatable committed source/asset pipeline:
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-r-particles.py
node tools/assets/convert-garen-r-particles.mjs

npm run check
npm run test:browser -- e2e/garen-r-source.spec.ts
npm run assets:validate
```

Repeated frozen extraction and conversion produced byte-identical output across
both ledgers, four GLBs, four sidecars and 21 PNGs. Three new source checks verify
resource resolution, complete dependency closure, recorded output bytes and the
separate frame-10 caster event. All 931 source/simulation tests and TypeScript
pass. Browser/model/production checks for this increment are recorded in
[PROGRESS.md](PROGRESS.md). Native visual parity, runtime R particles/audio,
Garen's remaining effects and complete production/full-match acceptance remain
open.
