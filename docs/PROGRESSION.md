# Ashe progression

The local player now uses pinned 16.18 Ashe CharacterRecord fields and the matching `GlobalPerLevelStatsFactor` record. Original records and upstream SHA-256 hashes live in `docs/reference/ashe-progression.json`; `python3 tools/assets/verify-ashe-progression.py` verifies them. `python3 tools/assets/export-ashe-progression.py` generates the simulation TypeScript data. Source float noise is normalized to six decimal places in the generated gameplay values; the original floats remain inspectable in the pin.

The earlier Data Dragon observation reports zero attack-damage growth. The matching CharacterRecord supplies 3.5, corroborated by Riot's [26.2 Ashe change](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-26-2-notes/). The executable progression follows that record. The global factors provide 0.72 of each growth stat for level 2, 0.755 for level 3, and progressively larger gains, totaling 17 growth units by level 18.

| Stat | Level 1 | Level 2 | Level 18 |
| --- | ---: | ---: | ---: |
| Maximum HP | 610 | 682.72 | 2327 |
| Maximum mana | 280 | 305.2 | 875 |
| Attack damage | 59 | 61.52 | 118.5 |
| Armor | 26 | 29.312 | 104.2 |
| Magic resistance | 33 | 33.792 | 51.7 |

Health and mana regeneration also use the growth factors. Attack speed applies the source 3% growth stat through those factors; attack periods remain rounded to fixed simulation ticks. The existing 20-tick baseline windup scales proportionally. Exact source attack-speed stacking and windup calibration remain unfinished. An already-scheduled attack retains its release and cycle deadlines when a level is gained.

Each level adds only its growth increment, preserving existing item bonuses. Living heroes receive the corresponding HP and mana increase while preserving missing resource amounts. Dead heroes retain zero HP and their original respawn deadline. The current experience threshold formula remains 280 plus 100 per existing level beyond level 1. A single award can now grant multiple levels, with leftover XP carried forward. Level 18 clears further XP accumulation, the HUD displays a full XP bar, and saves reject levels above the supported cap.

The HUD rounds resource maxima and combat stats for display while the simulation retains fractional values; the health-regeneration label grows with level. The source base record initializes the current Ashe champion prototypes, but automatic leveling applies only to the local player. Enemy progression, experience sharing and eligibility rules, champion-kill rewards, role modifiers, ability ranks/skill points, and the complete item/stat system remain unfinished. This is not complete champion or match parity.

Five simulation scenarios cover exact thresholds, multiple levels and the cap, early/endgame stat totals, item bonuses and missing resources, death safety, regeneration, snapshot continuation, invalid saved levels, and in-flight attack timing. A browser scenario verifies level-2 and level-18 resource/stat displays and the XP cap. The level-18 HUD screenshot is inspected for layout.
