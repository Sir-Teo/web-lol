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
