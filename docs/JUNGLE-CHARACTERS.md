# Jungle character source review

The original 16.18 Map11 archive now supplies eleven ordinary jungle character
definitions, including all **35 CharacterRecord variants**, their spell records,
and two converted base rigs. This advances the monster source foundation; live
neutral camps and jungle-role matches remain unfinished.

`reference/jungle-character-source.json` retains 64 original files totaling
2,898,228 bytes, with manifest, compressed-chunk and per-file hashes. Its manifest
and archive match [the map source pin](JUNGLE-SOURCES.md). Field/type dictionaries
and a finite set of xxh64-verified asset names supplied discovery labels. Later
reproduction uses the committed pin without downloading those dictionaries.
Literal names cannot silently replace previously unresolved hash keys or values;
the extractor aligns only exact FNV/xxh64 matches before requiring full equality.

## Character records

These are the authored **Root record scalars**, not a verified gameplay table.
Alternate-mode selection, server modifications, level scaling, jungle-item
bonuses and final rewards require separate evidence.

| Character | Root health | Root attack damage | Gold on death | Experience on death |
| --- | ---: | ---: | ---: | ---: |
| SRU_Blue | 2300 | 66 | 90 | 95 |
| SRU_Red | 2300 | 66 | 90 | 95 |
| SRU_Gromp | 2050 | 70 | 80 | 120 |
| SRU_Murkwolf | 1600 | 30 | 55 | 50 |
| SRU_MurkwolfMini | 630 | Absent | 15 | 15 |
| SRU_Razorbeak | 1200 | 17 | 35 | 20 |
| SRU_RazorbeakMini | 500 | 7 | 8 | 10 |
| SRU_Krug | 1400 | 57 | 15 | 15 |
| SRU_KrugMini | 650 | 20 | 10 | 10 |
| SRU_KrugMiniMini | 60 | 13 | 14 | 16 |
| Sru_Crab | 1550 | 35 | 55 | 100 |

Blue has four CharacterRecords with health 1200, 2300, 2300 and 3750. Their
coexistence does not select an active mode. Root Blue omits attack range;
MurkwolfMini omits base attack damage. These absences remain absent. Explicit
zero regeneration and experience radius -1 remain distinct values. The client
also tags Crab `Special_Peaceful`; its damage scalar alone cannot establish
an attack policy.

The initial map investigation found a dragon-specific LevelControlScript rather
than an ordinary-camp roster. Neither its presence nor these character files
establishes ordinary camp membership, first spawn, leash, reset or respawn rules.
Shared containers and nearby source transforms still cannot supply those rules.

## Rig conversion and review

The development page `/tools/qa/jungle-characters.html` provides all eleven
character record selectors, complete raw records, and on-demand Blue/Gromp base
rigs. It is linked from the development map's **Jungle sources** panel. Alternate
records keep unresolved names; missing displayed fields read **Absent**.

| Base rig | Triangles | Bones | Atomic clips | GLB bytes |
| --- | ---: | ---: | ---: | ---: |
| Blue skin 0 | 8,354 | 64 | 16 | 2,400,224 |
| Gromp skin 0 | 6,640 | 82 | 25 | 2,111,176 |

Every atomic graph entry retains its own converted clip, including two Gromp
states that reference the same animation file. Clip names preserve unresolved
state hashes; original paths remain in the manifests. Blue's base normal idle
and three look-at poses have constant tracks; Gromp has three constant look-at
poses. Scrubbing does not manufacture motion in those clips.

Mesh positions, bind matrices, bone translations and animation translations use
the existing source-to-metre conversion. Blue explicitly scales by
`0.01 * 1.3700000047683716`; Gromp omits skinScale and uses identity before the
0.01 conversion. The manifests record this omitted-scale policy and retain
source dependencies. Unused zero-weight joint slots are canonicalized as in the
existing rig converter.

Gromp's comma-separated hidden submeshes are retained and hidden in the preview.
Its mini-material override differs in letter case from the mesh name; the local
preview matches these names without case sensitivity. This is a documented
preview policy, not native shader/visibility certification. Source diffuse
assignments use unlit preview materials. Reflection/gloss, particles, audio,
graph transitions, pose modifiers and native composition remain unfinished.

The placed source objects reference **Blue skin 4** and **Gromp skin 0**. The page
explicitly reviews base skin 0 in isolation. It does not place base Blue at those
objects or imply that source object presence selects a live skin or camp roster.

Selection reuses loaded rigs and requests no rig for the other nine characters.
A failed GLB request can retry; a late response stays hidden when another
character has been selected. Playback is manually controlled, clamps at clip
end, and supports rewinding and restarting. Production startup imports none of
this page, source data or preview code; the two GLBs remain static files for
future monster integration.

## Reproduction and verification

Use the pinned CDTB and .NET/lol2gltf toolchain in [ASSETS](ASSETS.md):

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-jungle-characters.py
node tools/assets/convert-roster-base.mjs SRU_Blue
node tools/assets/convert-roster-base.mjs SRU_Gromp
npm run assets:validate
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/jungle-characters.spec.ts e2e/jungle-map-inspection.spec.ts --timeout=60000
npm run test:production
```

Conversion requires exact hashes for all 64 source files. Each GLB and its
manifest can be compared byte for byte across repeated conversion. Source and
browser checks distinguish base skin from placed object skin, alternate records
from Root, and static poses from moving clips. Current results and captures are
recorded in [PROGRESS](PROGRESS.md).
