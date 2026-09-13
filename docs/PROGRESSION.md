# Ashe progression

Champions now use pinned 16.18 Ashe CharacterRecord fields and the matching `GlobalPerLevelStatsFactor` record. Original records and upstream SHA-256 hashes live in `docs/reference/ashe-progression.json`; `python3 tools/assets/verify-ashe-progression.py` verifies them. `python3 tools/assets/export-ashe-progression.py` generates the simulation TypeScript data. Source float noise is normalized to six decimal places in the generated gameplay values; the original floats remain inspectable in the pin.

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

The HUD rounds resource maxima and combat stats for display while the simulation retains fractional values; the health-regeneration label grows with level. The source base record initializes the current Ashe champion prototypes, and automatic minion progression now applies independently to champions on both teams. Complete champion-kill rewards and eligibility, role modifiers, ability ranks/skill points, and the complete item/stat system remain unfinished. This is not complete champion or match parity.

Five simulation scenarios cover exact thresholds, multiple levels and the cap, early/endgame stat totals, item bonuses and missing resources, death safety, regeneration, snapshot continuation, invalid saved levels, and in-flight attack timing. A browser scenario verifies level-2 and level-18 resource/stat displays and the XP cap. The level-18 HUD screenshot is inspected for layout.

## Minion experience collection

Rift minion XP uses the victim team's pinned barracks `ExpRadius`, currently 1,500 units for both teams. Riot's [25.S1.1 notes](https://www.leagueoflegends.com/en-au/news/game-updates/patch-25-s1-1-notes/) document the increase from 1,400 to 1,500. The implementation includes the exact radius using center-to-center distance. Each living opposing champion receives its share of the configured bounty when an opposing lane minion dies within that radius, without requiring vision or the last hit. Automatic minion proximity XP is suppressed while that champion is dead. This does not prevent explicit scripted progression through `gainExperience` while dead; that method preserves zero HP.

Minion XP does not grant last-hit gold or CS. Conversely, a last hit outside the XP radius can still grant its gold and CS. Allied minions, dummies, and structures are excluded. Champion-kill XP retains its previous separate approximation and 1,400-unit range pending a complete kill/assist/eligibility model. Battlefields without a configured minion radius retain the legacy practice radius of 1,400.

Seven new scenarios verify the two exported source radii, all four minion classes just inside/on/outside the boundary, no sight or last-hit requirement, dead-player and victim exclusions, independent gold/CS, and automatic leveling through a nearby death. Multi-champion minion sharing is now implemented below; role-specific modifiers remain unfinished.

## Shared minion XP and independent progression

The pinned standard mode links `mExperienceModData` to `{0059202c}`. Its `mPlayerMinionSplitXp` table gives recipient multipliers of 1, 0.65, 0.433, 0.325, 0.26 and 0.217 for one through six nearby champions. These match Riot's [26.1 minion changes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/). Original float values, the map hash and mode link are retained in `reference/minion-xp-sharing.json`; `tools/assets/export-minion-xp-sharing.py` verifies and exports them. Three-way sharing uses the authored 0.433, not an inferred 1.3/3.

Eligibility is evaluated once at death: opposing, living champions within the victim team's minion XP radius, without requiring sight or a last hit. Every recipient gets bounty times its table multiplier. Level-capped champions still count in the local sharing denominator, but gain no additional XP; this eligibility edge awaits native verification. Sandbox populations above six clamp to the last entry, outside the five-player team target. Role quests, positional penalties and catch-up modifiers remain unimplemented.

`gainExperience(amount, championId)` updates the chosen record and unit's growth stats; omitting the ID preserves the human convenience API. Automatic minion XP uses it on both teams. Level events are private to the recipient team. Missing resources, item increments, scheduled attack deadlines, dead HP and respawn deadlines retain the existing progression semantics. Champion-kill XP remains the legacy human-only approximation pending a proper participation and level-difference model; the source curve has been located at standard-mode `mExperienceCurveData` `{c6f6a84c}` for that follow-up.
