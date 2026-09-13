# Structure progression and base assets

The default Rift contains 22 towers, six inhibitors, and two Nexus objects at the source-authored transforms. Both teams use matching patch 16.18 meshes, rigs, painted textures, and retained animation clips. This establishes the building dependency chain and a terminal local-game result; it does not certify full structure or match fidelity.

## Data and implemented rules

`docs/reference/structure-rules-source.json` freezes seven selected CharacterRecords with source URLs, file hashes, and resolved property keys. Unresolved record names are matched using the game's lowercase FNV-1a path hash. The layout exporter validates that snapshot's hash and includes the selected statistics in `rift-layout.json`.

| Structure | Initial health | Armor / MR |
|---|---:|---:|
| Outer turret | 9,000 | 60 / 60 |
| Inner turret | 5,000 | 60 / 60 |
| Inhibitor turret | 4,750 | 60 / 60 |
| Nexus turret | 3,500 | 60 / 60 |
| Inhibitor | 4,000 | 0 / 0 |
| Nexus | 5,500 | 0 / 0 |

The turret values agree with Riot's [26.1 patch notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/). The runtime also applies the selected base damage/range/attack-speed values and source health-bar heights. This is base data only: item/script modifiers, timed damage scaling, plates, and backdoor protection remain unfinished. Gameplay radius uses the explicit override where present and otherwise the pathfinding radius; that fallback still needs reference collision calibration. Inhibitor/Nexus regeneration currently interprets the static regeneration field as health per five seconds; its timing and health-segment behavior are not certified.

Riot's [game guide](https://www.leagueoflegends.com/en-us/how-to-play/) describes clearing a lane through three towers and an inhibitor, then the two Nexus defenders. The simulation checks protection both during target acquisition and at damage application. Inner defenders require the earlier towers in their lane to be destroyed. An inhibitor requires its lane's defenders to be destroyed. Nexus turrets require at least one allied inhibitor to be down; the Nexus additionally requires both of its turrets to be down. Other lanes remain protected independently.

Inhibitors currently return after 300 seconds, at full health and at the same authored position. The exact timer remains a reference-reconciliation item: its boundary is tested, but it has not yet been independently recovered from the pinned gameplay scripts. Nexus turrets return after 180 seconds at 40% health, following the respawn timing introduced in [25.S1.1](https://www.leagueoflegends.com/en-au/news/game-updates/patch-25-s1-1-notes/) and the health change in [26.1](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/). Regrowth can protect the Nexus again.

Destroying either Nexus sets the opposing winner, clears orders and pending commands/waves, and stops subsequent simulation steps and purchases. The result dialog offers a restart, traps keyboard focus, and cannot resume a finished game. Rendering continues the destruction animation behind the result. This is a valid terminal condition in the local practice simulation, not a complete nine-bot match implementation.

## Asset reconstruction

`base-structure-definitions.json`, `base-structure-extraction.json`, and `base-structure-wad-paths.json` retain the four skin/animation definitions and pin 40 source assets from 56 CDN chunks. The extractor yields 8,317,618 source bytes. The shared structure converter preserves source submesh names and state metadata, geometry precision, skinning, and full-resolution textures. Tower outputs remain byte-identical after moving their conversion into this shared module. Rebuilding all four base models also reproduces their committed bytes exactly.

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-base-structures.py
node tools/assets/convert-base-structures.mjs
.tools/cdtb-venv/bin/python tools/assets/export-rift-layout.py
npm run assets:validate
```

The idle body and destroyed submesh remain separate. Nexus death plays once and clamps; inhibitor death transitions into its authored dead-idle clip. Regrowth currently switches back to the intact idle state at the gameplay deadline. Spawn/respawn clips and particle event definitions are retained, but their complete event sequencing, ambient effects, sounds, shader glow, and final-match camera choreography remain unfinished. A generic glTF viewer must honor the node visibility extras to avoid overlapping intact and destroyed parts.

## Verification and next work

Simulation scenarios cover initial structure counts/health/protection, rejection of protected attacks and damage, lane-specific exposure, inhibitor and Nexus-turret respawn boundaries, fixed positions, and immutable terminal results for either team. Browser scenarios cover both base layouts, destruction/dead-idle playback, a real right-click final attack, bot-driven defeat, continued rendering after game end, keyboard focus, and restart. Tests preserve the original practice fixture separately.

Destroyed inhibitors now affect future lane waves through the [super-minion foundation](MINIONS.md), including both-team source models and the frozen barracks counts. Minion speed, economy, scaling, and mid/late wave cadence still need reconciliation with the 26.1 changes and later patches through 26.18. Permanent plates, structural rewards, regeneration thresholds, siege damage modifiers, exact building-knowledge calibration, and full-match bot behavior remain required production work. Known building presentation is described in [vision policy](VISION.md).
