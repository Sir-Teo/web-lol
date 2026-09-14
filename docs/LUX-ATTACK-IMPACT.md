# Lux normal and critical impact source package

Normal and critical basic attacks resolve through the pinned skin resource map to `Lux_Base_BA_tar` and `Lux_Base_BA_tar_crit`. Both definitions are in the same verified 63,091-byte particle binary already used for Lux's basic missile: client 16.18.8175716, manifest `29CE6E781C3B6368`, binary SHA-256 `ca21a60661167c36f6416bdb32f7b93badabab8874e0a7b46e7311579fc1e152`. The exporter checks each spell's hit-effect key, resource-map resolution and complete decoded record against the binary.

The normal record contains eight authored emitters, but five are disabled: `star`, `star2`, `outerring`, `innerring` and `innerring1`. The active normal hit consists of `blastring`, `outerring1` and `sparks`. All three match critical emitters exactly except for the renamed outer ring. The critical hit adds `flash` and `ring`, for five active emitters. Rendering all eight normal entries would incorrectly restore disabled star layers.

| Active layer | Normal | Critical | Nominal particle life |
| --- | --- | --- | --- |
| Blast ring | `blastring` | Identical `blastring` | 0.3 s |
| Outer ring | `outerring1` | Identical `outerring` | 0.25 s |
| Sparks | `sparks` | Identical `sparks` | 0.4 s, with birth probability scaling |
| Flash | — | `flash` | 0.1 s |
| Expanding ring | — | `ring` | 0.5 s |

The schema audit resolves hashed fields using LeagueToolkit's generated metadata at revision `76bf57bf4fd195343dec610bf0f912a06b910914`: `33f36f05` is `disabled`, `76f8ad24` is `startFrame`, `6563bee8` is `miscRenderFlags`, and `8aa1ffc1` is `paletteDefinition`. Direction velocity scaling and flex-shape fields are also identified. The raw records retain their original field spellings; the normalized audit supplements them rather than silently rewriting the source.

Fourteen referenced textures export to PNGs totaling 279,435 bytes, including inputs belonging to disabled emitters. The shared target-hit atlas, flash and ring images, particle-color lookups, spark image and flame gradient remain distinct inputs. The flame gradient is nested under `paletteDefinition`; treating it as a second color sprite or as the particle-color lookup would be incorrect. Optional native palette shader selection and coordinate generation still need reconstruction. Every PNG retains decoded RGBA bytes exactly, and repeated exports verify dimensions, pixel hashes, PNG hashes and sizes.

`docs/reference/lux-attack-impact.json` preserves both full records, asset paths, hashes and archive/chunk provenance. `docs/reference/lux-attack-impact-audit.json` contains normalized emitter summaries, schema evidence, disabled flags and exact cross-variant equivalences. The browser inspection page at `/tools/qa/lux-impact-source.html` displays active/disabled entries and all source images. Its browser check verifies all fourteen images load, the five disabled entries remain visible as audit rows, and the active counts are three and five. The full-page texture board was visually reviewed.

Reproduce from the repository root:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-lux-attack-impact.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/audit-lux-attack-impact.py
npx playwright test e2e/lux-impact-source.spec.ts
```

This package does not change gameplay impact rendering. Next work must compose the three shared active emitters and two critical additions, verify atlas-frame and palette behavior, and connect them to saved impact state and target-bone attachment. Target-follow binding, native height/orientation, material variants and timing remain unverified. The current generic hit feedback is not presented as a native Lux impact.

## Static atlas inspection

The atlas inspector now isolates any of the six `GlobalTargetHit01` cells, initially frame 4. Both active outer-ring records explicitly author `texDiv=[2,3]`, `numFrames=6` and `startFrame=4`. The row-major, top-down convention follows the [pinned LeagueToolkit UV reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/uvTransform.ts) and its [source-coordinate discussion](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/docs/plans/vfx-particle-renderer.md#213-the-palette-and-erosion-readings-and-what-a-review-found). This is reconstruction evidence, not a captured native frame comparison.

`particleAtlasUv` maps local top-down coordinates directly into geometry UVs; source textures use `flipY=false`. This avoids relying on `Texture.offset/repeat`, which the initial-color-product custom shader does not apply. The helper only selects a static cell, with explicit invalid-input rejection. Animation rate, random phase, wrapping inside a cell, scrolling, rotation and native filtering remain separate work. UV boundaries use exact normalized thirds: the 512-pixel atlas height is not divisible by three, so rounded image crops would change the authored sampling region.

The browser test pins both active emitters' atlas fields and checks every RGBA byte of all six cells of an asymmetric synthetic texture through the actual particle shader. Its CPU reference crops texture rows directly and accounts for bottom-up WebGL readback; a zero-alpha colored texel checks preservation of hidden RGB. The source frame-4 screenshot was also visually reviewed. The preview uses nearest filtering and displays the raw cell's aspect ratio, not the final particle's world-space dimensions or framebuffer blend. Gameplay remains unchanged.

```sh
npx playwright test e2e/particle-atlas.spec.ts e2e/lux-impact-source.spec.ts
```
