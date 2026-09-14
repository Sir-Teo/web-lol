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

Fourteen referenced textures export to PNGs totaling 279,435 bytes, including inputs belonging to disabled emitters. The shared target-hit atlas, flash and ring images, particle-color lookups, spark image and flame gradient remain distinct inputs. The flame gradient is nested under `paletteDefinition`; treating it as a second color sprite or as the particle-color lookup would be incorrect. The palette sections below reconstruct RGB replacement and the supplied row coordinate; complete native variant selection remains unverified. Every PNG retains decoded RGBA bytes exactly, and repeated exports verify dimensions, pixel hashes, PNG hashes and sizes.

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

## Spark palette shader

The initial-color-product material now optionally implements the palette replacement found in pinned native quad pixel programs 12, 23 and 33. Program 12 (`PALETTIZE_TEXTURES` plus `DISABLE_FOW`) has SHA-256 `64372231ea7c1c5d781b247f4654c83c6bf50b87116c542ccfcb6d5a0d0915a2`. The existing shader exporter pins the program and the disassembler validates its hash before decoding the exact LLVM payload. The inspected operations are:

1. Sample base RGBA; dot all four channels with `cPaletteSrcMixerMain` and clamp to [0,1].
2. Form `(clampedDot, cPaletteSelectMain.x)`, then add `cPaletteSelectMain.zw`. Scroll is after saturation.
3. Sample `sPalettesTexture_TX`; replace base RGB while retaining **base alpha**, ignoring palette alpha.
4. Multiply that result by particle tint and the particle-color lookup. Quad MULT_PASS also multiplies its separate texture; the existing lookup/multiplier coordinate relationship remains intact.

Program 12's `%13–%30` contain those operations, followed by a separate pixel-color remap. The helper deliberately stops before that remap and framebuffer blending. Program 33 confirms the same replacement before the quad multiplier. This verifies the operation available in those native variants, not which complete variant the running Lux effect selects.

The impact audit now resolves nested palette field hashes as well. Both spark records author `palleteSrcMixColor=[0,1,0,0]`, `paletteSelector=[9,0,0]`, `paletteCount=10` and the flame-trail gradient. Animation curves and address mode are absent in the records and reported as null rather than invented authored values. The [pinned CPU reconstruction](https://github.com/LeagueToolkit/ltk-manager/blob/65a7d2a746b9d02d65dab788b5f7b8198d5e555e/src/modules/workshop/bin/vfx/palette.ts) converts the row to `(9+0.5)/10=0.95`; this reconstruction supports the preview's normalized uniform, while the native pixel program itself only establishes use of the supplied coordinate.

`/tools/qa/particle-palette.html` compares the original spark with this RGB replacement and allows inspection of all ten rows. It uses raw texture channels, `flipY=false`, linear filtering and clamp addressing, with an opaque RGB presentation. It does not claim a native final spark appearance. The selected row-9 screenshot was visually reviewed. Twelve synthetic GPU probes cover source alpha (including zero), alpha as the mixer input, multi-channel mixing, both saturation bounds with opposing scroll, shifted rows, nonwhite tint/lookup, and quad multiplication. Expected values come from an independent CPU nearest-sample calculation; every channel agrees within one byte. Existing initial-product and atlas GPU tests also pass.

```sh
python3 tools/assets/inspect-particle-shaders.py --llvm-dis /path/to/llvm-dis
npx playwright test e2e/particle-palette.spec.ts e2e/particle-color-product.spec.ts e2e/particle-atlas.spec.ts
```

Palette replacement is now an available rendering building block. Composition, spark birth/motion, native sampler state, target attachment, saved impact history and gameplay integration remain unfinished.

## Ring and flash component playback

`/tools/qa/lux-impact-rings.html` now composes the two shared ring layers and the two critical additions. The source exporter preserves float precision for lifetime, scale and color keyframes, lookup settings, atlas selection and birth rotation. It asserts that shared normal/critical definitions match except for names. Disabled normal layers are never exported. `luxImpactRings` samples one birth's age directly, so reverse seeking and repeated reads do not accumulate simulation drift.

The preview follows the existing reconstruction's uniform-X scale policy and unit conversion (a two-unit quad times source scale times 0.01), ADD tint premultiplication and SrcAlpha/One mode-4 flash blending. The ring and flash use birth chance times 360 degrees; the blast ring uses its fixed 45 degrees. The display adapts that source angle into a negative camera-plane Z rotation. Native orientation, flex-shape behavior and target binding remain unverified, and the component preview explicitly holds all particles at a stationary origin. It begins at **particle birth**, not a claimed native impact-event emission time. No spark particles are included yet.

The normal view has two layers until the outer ring expires at 0.25 seconds, then one until the blast ring's exact authored lifetime `0.30000001192092896`. The critical view also has the flash until `0.10000000149011612` and expanding ring until 0.5 seconds. GPU rendering uses the previously verified color product and atlas path, with raw linear texture sampling. The screenshot at 0.045 seconds was visually reviewed; it is a component reconstruction rather than native parity evidence.

Three unit tests check exact source lifetimes/scales, expiry boundaries, scale keyframes, chance rotation, deterministic seeking, shared normal/critical state, and constant-versus-lifetime lookup coordinates. The browser test checks rendering, reverse seek, playback controls and successive retirement of all four layers. All 684 unit tests pass. The QA module also passed a direct TypeScript check because normal application compilation excludes that directory.

```sh
python3 tools/assets/export-lux-impact-rings.py
npx playwright test e2e/lux-impact-rings.spec.ts
```

Next integration work is still spark emission/motion and direction alignment, followed by target-attached saved impact playback and comparison with native captures.
