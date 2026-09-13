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

The ordinary minions now use verified starting rewards: melee 20 gold / 62 XP, caster 14 / 31, siege 50 / 75. All eight lane types start at 350 movement speed. Source barracks movement upgrades add 25 at 10, 15, 20, and 25 minutes, capped at 450; these currently apply when a minion is created. The behavior of already-living minions at upgrade deadlines remains a reference check.

`lane-minion-records.json` pins the six ordinary minion Root records and original upstream hashes. `python3 tools/assets/verify-lane-minion-records.py` checks those bytes and selected records. The exporter follows both teams' actual barracks templates and records them in the layout snapshot. It applies movement and starting rewards from these records, plus melee health and its source-defined growth. Other ordinary minion combat values remain practice approximations until initialization, timed upgrades, and on-hit modifiers are reconciled together. For example, the cannon record stores 36 base AD, while 26.1 describes 39 starting AD; the source base alone is not a complete runtime value. Riot's [26.9 notes](https://www.leagueoflegends.com/en-au/news/game-updates/league-of-legends-patch-26-9-notes/) also change melee health growth and minion-on-minion current-health damage. Melee health growth and the ordinary-minion on-hit rule are now implemented below; complete initialization and lane pacing remain unfinished.

The explicit 26.1 wave overrides now shorten the interval to 25 seconds at 14 minutes and 20 seconds at 30 minutes. The pending deadline preserves elapsed time when the interval changes: the implemented sequence around these boundaries is 13:30, 14:00, 14:25; then 29:50, 30:10, 30:30. This precise transition phase is an explicit simulation policy awaiting matched gameplay capture; the rates come from Riot's notes. The full scheduler is tested tick by tick through 31 minutes without duplicate waves. Cannon/melee alternation and the reduced late-game caster count continue to use the pinned barracks composition rules. Explicit practice wave suppression remains effective across both transitions.

## Verification

Simulation scenarios cover one and three downed inhibitors, both team directions, lane independence, cannon replacement, queued-wave stability, simultaneous respawn/spawn ordering, large-unit navigation, melee release, negative resistance, and separate rewards. Browser scenarios inspect both rigs, source clip catalogs, complete death playback, health-bar hiding, independent surviving animation, and corpse cleanup. Screenshot evidence lives in the ignored `artifacts/` directory. These checks establish the implemented behavior, not complete patch or pixel parity.

Unit creation also copies only position coordinates. Passing an existing unit as a position can no longer overwrite the new unit’s identity, team, or class; the reward tests cover this structural-typing edge case.

## Minion attacks against turrets

The frozen 26.1 rule overrides now include turret attack multipliers: melee, caster, and super minions use 0.60; siege minions use 0.84. The exporter includes them in the Rift layout and its source hashes. Both melee release and ranged impact pass through one basic-attack hit handler, which applies the appropriate multiplier before the existing physical-resistance calculation. Inhibitors and Nexus targets do not receive this turret-specific modifier. Champion attacks and direct non-attack damage keep their own existing paths.

Ranged attacks retain the attack damage recorded at release. Their turret multiplier is applied once at impact, including after the source minion dies while its projectile is in flight. Eleven simulation scenarios exercise all four types for both teams, armor composition, exactly one damage event per hit, post-release stat changes, dead sources, other victim classes, and non-attack damage. These close a pushing-damage discrepancy; turret defenses, aggro details, and complete minion initialization/growth remain outstanding. Source: [26.1 standard Summoner's Rift minion changes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-26-1-notes/).

## Melee health progression

The exporter follows each team's pinned melee Root record and barracks upgrade configuration. Base health is 430; `UpgradeIntervalSecs` is 90, `HPUpgrade` is 35, and `HpMaxBonus` is 1,120. The 26.9 notes independently document the 430 base and 35-per-90-second rate. The runtime interprets the bonus field as a cap on added health, yielding at most 1,550 HP. This cap interpretation and exact initialization timing remain data-derived policies awaiting controlled reference observation.

Creation uses completed 90-second periods in integer simulation ticks: 430 before 1:30, 465 from 1:30, 500 from 3:00, and the cap from 48:00. Queued wave units read the current upgrade at their individual creation time. Existing living units keep their current and maximum HP across a deadline, so an upgrade does not heal them. The source base record remains unchanged, and each new unit starts at its computed maximum health.

Four scenarios cover both teams at exact boundaries, the late-game cap, already-damaged living units, immutable base data, and all 18 melee minions in an actual queued three-lane wave. This establishes the implemented spawn policy; other minion stats, health families, modifiers, and detailed lane pacing remain incomplete.

## Minion current-health on-hit damage

The exporter now follows each ordinary minion Root record's `mClientSideItemInventory` into the frozen 16.18 item table. Items 1509 (melee), 1510 (caster), and 1508 (siege) supply `MinionCurrentHealthDamage` values corresponding to 2%, 3.5%, and 5%. Both teams resolve independently. The original float values are retained. The source item records and English tooltips, with hashes of their upstream files, are frozen in `docs/reference/minion-on-hit-items.json`. Verify them with `python3 tools/assets/verify-minion-on-hit-items.py`. Riot's [26.9 notes](https://www.leagueoflegends.com/en-au/news/game-updates/league-of-legends-patch-26-9-notes/) independently document the same percentages.

Ordinary minion basic attacks add this fraction of the target lane minion's current HP at impact. Melee attacks sample at release; ranged missiles sample on contact and keep their release-time attack damage even if the source dies. The combined hit passes through physical resistance once. That physical composition and pre-hit HP sampling are explicit runtime policies pending matched reference capture: the frozen fields and tooltip identify current-health damage and lane-minion eligibility but do not expose the server's event ordering or damage-type implementation. Subsequent attacks recalculate against the remaining HP.

The modifier covers all four lane-minion victim classes. It does not apply to champions, structures, target dummies, direct non-attack damage, or attacks originating from super minions. Super minions have different source items (1511 and 1512), so they do not inherit the ordinary-minion ratios. The existing turret damage multipliers remain independently applicable when a minion attacks a turret.

Eleven new simulation scenarios exercise both teams, all three source classes and four victim classes, positive/negative armor, reduced current HP, repeated attacks, intervening missile-flight damage, source death, exclusions, and one-time lethal resolution. These checks validate the implemented rule; full reference lane pacing, source initialization, super-minion aura effects still need work. Mid-lane siege attack speed and turret-shot fractions are implemented below.

## Siege attacks against mid-lane turrets

The pinned item 1508 `MidLaneAttackSpeedBonus` field supplies a 30% bonus, corroborated by its English tooltip. The layout exporter retains that source float. Siege minions attacking a turret whose authored structure lane is `mid` use this bonus for their attack period and windup. It applies to both teams and follows the target turret's lane rather than the minion's route assignment. Other victim classes, top/bottom turrets, and turrets without a lane do not qualify.

Attack timing divides the baseline tick duration by the speed multiplier and rounds to the nearest simulation tick, matching the existing combat clock. The bonus is sampled when an attack begins; changing victims does not rewrite an already-scheduled cooldown. Baseline stats remain unchanged. The source animation's playback speed follows the same multiplier and rounded period; this also connects the existing Ranger's Focus speed multiplier to champion attack playback. Exact reference windup and attack-speed stacking with future modifiers remain capture work.

Four simulation scenarios cover both teams' repeated release timestamps, source/victim/lane exclusions, immutable baseline timing, and target switching. A browser scenario checks both source siege rigs against mid and top turrets, verifying that animation duration equals the scheduled combat period. The existing cancellation and full browser regressions remain required.

## Turret attacks against lane minions

The layout exporter now reads turret-shot percentages from the pinned English item tooltips. The reference snapshot includes item 1511 (Super Mech Armor) in addition to the three ordinary-minion items. It retains the upstream hashes and selected original records; `python3 tools/assets/verify-minion-on-hit-items.py` verifies all eight item/tooltip entries. Extraction fails if the expected tooltip phrases change instead of silently retaining stale constants.

| Victim | Outer turret | Inner turret | Inhibitor/Nexus turret |
| --- | ---: | ---: | ---: |
| Melee | 45% | 45% | 45% |
| Caster | 70% | 70% | 70% |
| Siege | 14% | 11% | 8% |
| Super | 7% | 7% | 7% |

For a turret basic attack against a lane minion, the simulation replaces raw attack damage with the applicable fraction of the victim's maximum health at contact, then applies physical resistance once. Fractions do not shrink as the victim loses current health. A flying shot retains this behavior after the source turret dies. Champion victims, non-attack damage, and turrets with no matching authored role retain the ordinary damage path. The rules are configured for the Rift; a battlefield without this table retains its own existing combat rules.

The primary tooltip text directly establishes the listed fractions and turret tiers, but does not specify maximum-versus-current-health sampling, server damage ordering, or armor treatment. Maximum-health sampling at impact and physical mitigation are explicit implementation policies awaiting a matched reference capture. Turret armor penetration, other turret modifiers, and super-minion aura effects remain separate unfinished work. These checks do not certify exact late-game turret durability.

Eleven simulation scenarios cover both teams, all four turret roles and minion classes, multiple maximum health values, positive and negative armor, wounded targets, source death after release, ordinary-path exclusions, and one-time lethal resolution. With zero armor and no other damage, two shots leave a melee minion at 10% HP, while a caster survives the first at 30% and dies to the second. These concrete windows replace the previous behavior that depended solely on turret AD.
