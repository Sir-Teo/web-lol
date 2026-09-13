# Lane minions: source reconstruction and implemented coverage

The default Rift now has eight source minion models: blue and red melee, caster, siege, and super minions. Terrain, source routes, barracks, and inhibitor state drive the local lane simulation. This is an incremental implementation; minion stat progression, turret interactions, economy, and full match behavior are not yet reference certified.

## Super-minion sources

`docs/reference/super-minion-definitions.json` freezes both skin/animation graphs and complete CharacterRecord files from CommunityDragon 16.18, with source URLs and hashes. The pinned Map11 barracks definitions point through `{063f0a8c}` and `{83246234}` to each team's `CharacterRecords/Root` and `Skins/Skin0`. Those resolved templates are retained in `rift-layout-source.json`; other mode variants in the same character file are excluded.

The two models contain 3,322 / 2,856 triangles and 58 / 62 bones (blue / red). Both apply the source scale of approximately 1.05. Each retains idle, run, two attack, and two death clips. The red graph explicitly references the blue idle animation, which is preserved. Death selector probabilities and joint-snap events are retained in the source definitions; the runtime currently uses the first death and attack variants. Particle, audio, event-graph behavior, and exact impact-frame calibration remain outstanding.

The extractor reads 17 files, totaling 974,736 source bytes, from 22 patch chunks (1,459,635 compressed bytes). It verifies the frozen manifest, chunks, source files, and definition snapshot. The converter shares the existing minion conversion path. Rebuilding the original six minion models after this change is byte-identical. Both super models, their manifests, and the exported gameplay layout/source snapshot also reproduce byte-identically.

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-reference-super-minions.py
node tools/assets/convert-minions.mjs --super
.tools/cdtb-venv/bin/python tools/assets/export-rift-layout.py
npm run assets:validate
```

The default death clips last approximately 4.633 seconds. Their manifest records the measured animation duration, and the layout exporter derives a corpse retention floor that includes 0.2 seconds of playback margin. This fixes removal at four seconds, which previously truncated these longer animations. Death still removes living vision and targeting immediately; the corpse is visual only.

## Implemented wave behavior

The frozen `InhibitorWaveBehavior` contains the counts `[1, 1, 2]`. The runtime applies one super minion in a lane whose enemy inhibitor is down, and two per lane if all three enemy inhibitors are down. A super wave omits its normal siege minion. Other lanes and the opposing team's waves are independent. Riot's [2026 season preview](https://www.leagueoflegends.com/en-ph/news/dev/dev-2026-season-one-gameplay-preview/) describes super minions accompanying each wave after an inhibitor falls.

Composition is sampled at the wave deadline, then individual units leave at the authored 0.8-second spacing. Destroying an inhibitor while a wave is already leaving affects the following wave. A respawn deadline equal to the wave deadline counts as a recovered inhibitor even though unit updates follow wave scheduling. These ordering choices are explicit simulation policies awaiting matched reference capture. The exact pre-regrowth cutoff for new super minions also remains to be verified; current behavior continues until the inhibitor's configured respawn deadline.

Spawn projection and pathfinding use the super minion's 65-unit gameplay radius rather than the small minion radius. Tests exercise both team barracks and sustained movement along all three lanes.

## Current combat and economy boundary

The selected base record supplies 1,500 HP, 180 attack damage, 100 armor, −30 magic resistance, 350 movement speed, 170 attack range, and approximately 0.85 attacks per second. The simulation currently uses the literal 0.5-second cast field for its melee windup; attack-speed scaling of that field and precise animation hit timing still need reference reconciliation. Negative resistance now uses a bounded amplification branch instead of dividing by `100 + resistance`, which could produce invalid damage at −100 resistance.

Super minions grant 75 local XP and 50 last-hit gold in this foundation. Riot's [26.1 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/) specify those starting rewards and further gold growth. The raw CharacterRecord contains 49 base gold; initialization and barracks upgrades must be applied separately. Current rewards deliberately use the documented initial value. They do not yet implement time scaling, XP sharing, role modifiers, nearby gold rules, or super-minion aura and regeneration behavior. HP and damage likewise remain base values rather than a finished late-game scaling model.

The original melee/caster/siege combat values remain practice approximations. All minions' base stats, upgrades, movement-speed increases, attack timing, lane bonuses, and damage to/from turrets must be reconciled together. In particular, 26.1 specifies faster wave intervals after 14 and 30 minutes, whereas the raw barracks interval is 30 seconds. The current runtime still uses that baseline interval; timed script overrides require the next focused rules update.

## Verification

Simulation scenarios cover one and three downed inhibitors, both team directions, lane independence, cannon replacement, queued-wave stability, simultaneous respawn/spawn ordering, large-unit navigation, melee release, negative resistance, and separate rewards. Browser scenarios inspect both rigs, source clip catalogs, complete death playback, health-bar hiding, independent surviving animation, and corpse cleanup. Screenshot evidence lives in the ignored `artifacts/` directory. These checks establish the implemented behavior, not complete patch or pixel parity.
