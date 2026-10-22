# Six-member raptor camps

Both source-linked Rift raptor camps contain one Crimson Raptor and five small
Raptors. The raptor milestone reached ten calendars, seven ordinary rigs and 24 monsters.
[Krug camps](KRUG-CAMPS.md) extend the current catalog to twelve calendars, ten
rigs and 28 initial monsters, with additional offspring after parent deaths. Practice
loads none of these rigs. The full-match goal remains active; jungle roles,
remaining camps/objectives, native comparison and production certification are
unfinished.

## Original source and reproduction

[The source pin](reference/raptor-camps-source.json) retains 58 Map11 archive
members totaling 1,814,062 bytes. It adds both base skin/animation definitions,
meshes, skeletons, diffuse textures and every atomic animation, without changing
the character, map or script parent pins. The frozen manifest is
`29CE6E781C3B6368` (16.18.8175716). Repeated extraction matches the pin; both GLBs,
manifests and the content export reproduce byte-identically.

Legacy bytecode explicitly constructs six members in camps 3/9. Twelve unique
`OrderVultures1..6` / `ChaosVultures1..6` map locators provide the positions.
Membership comes from script construction and named lookups, rather than nearby
placed templates. The two sides have different spawn aliases and lead-ups:

| Side | Large clip | Small clips in slot order | Protected ticks |
| --- | --- | --- | --- |
| Order | spawn | spawn4, spawn2, spawn3, spawn2, spawn4 | 60 |
| Chaos | north_spawn | north_spawn4, north_spawn2, north_spawn3, north_spawn2, north_spawn4 | 40 |

Order's legacy `SpawnDuration` is 1 second; Chaos's is 0.67 seconds, rounded to
40 ticks. Each camp keeps its own lead-up instead of deriving one value from a
shared species profile. Source spawn poses retain their independent tails after
readiness. Alias lookup checks literal or FNV-hashed graph keys: these rigs use
`run`, `spawn2`, `north_spawn2`, etc., while the large normal idle uses
`idle_normal1_base`. A small-raptor default spawn alias shares the spawn2 source;
the existing loader clones aliases independently.

The initial browser fixture exposed two Order locators inside blocked navigation
terrain. Its original six-point approach search also assumed the smaller wolf
formation. Runtime now projects each raptor home to the nearest valid imported
navigation position using its source navigation radius, keeping the original
locator in content. Only the Order leader and first small raptor move; all Chaos
homes remain unchanged. This is an explicit local placement adapter, not a
recovered native spawn/collision rule. Both packs must complete combat and return
to their homes. Snapshot validation derives the same positions from the active
battlefield, rejecting a forged home inside the original blocked cell. The
browser fixture now searches reachable approaches across the larger formation.

The legacy script also reads `SkinOverrides['SRU_Razorbeak']`. Its external
value is unresolved. Both override windows remain pinned but are not executed
with an invented value. Base skin 0 is the explicit local selection, pending
native initialization evidence.

Large rig: 3,816 triangles, 48 bones, 23 atomic clips, source skinScale
1.399999976158142. Small rig: 2,794 triangles, 48 bones, 25 clips, scale
0.800000011920929. All source clips remain available, including static look-at
poses. Source diffuse textures use the existing unlit conversion; this does not
establish native lighting or graph/pose parity.

Reproduce with:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-raptor-camps.py
node tools/assets/convert-roster-base.mjs SRU_Razorbeak
node tools/assets/convert-roster-base.mjs SRU_RazorbeakMini
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-raptor-camps.py
```

## Values and local policies

| Root scalar | Large | Small |
| --- | --- | --- |
| HP | 1200 | 500 |
| Attack damage | 17 | 7 |
| Armor / MR | 42 / 42 | 20 / 20 |
| Movement speed | 450 | 525 |
| Attack range | 200 | 125 |
| Attack speed | 0.6669999957084656 | 1 |
| Primary SpellObject cast frame | 9 | 12 |
| Local contact / attack period, ticks | 18 / 90 | 24 / 60 |
| Gold / XP | 35 / 20 | 8 / 10 |
| Source CS | 2 | 0.4000000059604645 |
| Gameplay / navigation radius | 75 / 30 | 50 / 22.5 |

Small-raptor score retains the original f32 value in source data and uses 0.4
in simulation. Reward accumulation rounds to the existing six-decimal stat
precision. Five small kills and one large kill total exactly four CS, 75 gold
and 70 XP under the current Root-only reward policy. The HUD and scoreboard
floor the accumulated score; partial progress persists internally and in saves.
No buff is awarded. Native level/reward modifiers, jungle items and role quests
are not inferred from these Root scalars.

The first-ready baseline is 55 seconds from Riot's
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).
The 135-second respawn adopts the legacy shared default. A 650-unit leash and
individual ten-second marked cleanup follow the published baselines in Riot's
[12.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/).
Those notes also describe percentage-current-health damage, which is not yet
implemented. These are explicit adapters combining a frozen client source with
published gameplay baselines, rather than proof of one native server version.

The shared pack implementation alerts its living members when one takes health
damage. Nearby members share hard reset while their leader lives. After leader
death, each survivor keeps its own cleanup clock, refreshed by locally classified
champion combat. Cleanup grants no gold, XP or CS. Only the final removal starts
the group respawn calendar. A partial clear preserves ordered missing slots
through corpse expiry and reload. Complete native patience/soft reset, aggro
classification and cleanup reward dispatch remain unverified.

Large attack animations are named `ranged_attack` in the source. The current
adapter applies physical contact damage at the pinned cast frame, with no new
missile; native ranged dispatch, source effects/audio and attack selection remain
open. Merely importing those clips does not certify attack fidelity.

## Saved continuation and validation

Schema 96 accepts six-member groups and canonical fractional champion/observed
CS. Camp validation checks exact cardinality, slot species, individual home,
side-specific spawn alias and lead-up, unique ownership, marked-death clocks and
the next spawn deadline. The member-count bound derives from the catalog.
The raptor content JSON participates in the saved-ruleset fingerprint.
A save cannot swap a north-side spawn into an Order slot or silently replace the
60-tick lead-up with the Chaos timing. Standalone encounters retain their
species-default lead-up validation.

Eight raptor tests cover source/rig linkage, both protected lead-ups and pose
tails, exact attack contacts, fractional last hits, partial corpse-free saves,
reward-free cleanup and complete respawns, Lux area damage across all six source-linked
positions, reachable home/reset behavior, and invalid saves. The existing fog-observation regression now carries
fractional score through hidden gains and exact restoration. Browser and
production results, capture hashes and remaining limits are recorded in
[the verification ledger](reference/raptor-camps-verification.json).

The initial six-case Chrome run passed four cases and exposed blocked raw homes,
the small-fixture approach search and a stale Red calendar-count expectation.
After those repairs all six focused camp cases pass together. The final raptor
rerun also passes after the content-fingerprint and species-leash selection
refinements. It uses real Lux attacks, Binding and Singularity input, verifies
aggregate GPU contribution from the six source rigs, checks both HUD/scoreboard
flooring at 2.4 CS, reloads fighting and partial/cleared saves exactly, and
respawns six fresh members. Setup, final kills and calendar jumps remain
diagnostic. The combat and respawn captures were visually reviewed; crowded
combat text and native rendering/pose calibration remain open. These results do
not certify the entire browser suite or a complete role-aware match.

Production build and the `/nested/rift/` static-host smoke pass with 17 recordings,
both raptor rigs prepared across lane start/restart, no jungle preview requests
and no development hook. The existing bundle-size warning remains (626.33 KB
game and 659.92 KB Three chunks). All GLBs and the map validate with zero errors
and warnings. Full browser-suite, native comparison, offline delivery and
full-match performance certification remain open.
