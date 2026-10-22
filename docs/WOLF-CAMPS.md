# Three-member wolf camps

Both Rift wolf camps now contain one Greater Murk Wolf and two small Murk
Wolves, each with its own source rig, home, combat state and animation clock.
The wolf milestone reached eight calendars and twelve neutral monsters.
[Krug camps](KRUG-CAMPS.md) extend the current lane match to twelve calendars
and 28 initial neutral monsters once all camps have spawned, with additional
Krug offspring after parent deaths. Ordinary practice loads none of the monster rigs.

Camp calendars now own ordered member slots rather than one unit ID. Killing
the leader leaves surviving small wolves in their original slots. Corpse removal
does not erase them, and the final death schedules a fresh three-member group.
Ranged attacks, Lux Binding, Cinders burns and the existing neutral reward path
work through the shared simulation. Native scaling, complete patience/reset
behavior, effects/audio, jungle-role bots and full-match certification remain open.

## Source evidence

[The source pin](reference/wolf-camps-source.json) retains 51 Map11 archive
members totaling 1,536,352 bytes: both skin/animation definitions and the base
rig dependencies. The original character, map and script pins remain unchanged.
Four additional bytecode windows link camps 2/8 to one large wolf and two small
wolves. Six unique named map locators supply their positions; membership is not
inferred from placed templates or proximity. Placed wolf templates reference
skin 0, consistent with the base rigs, but do not establish active native spawn
configuration.

| Camp/member | Runtime XY | Script spawn |
| --- | --- | --- |
| Order large | -3644.3720703125, 981.01611328125 | spawn |
| Order small 1 | -3444.3720703125, 981.01611328125 | spawn_mini1 |
| Order small 2 | -3694.3720703125, 831.01611328125 | spawn_mini2 |
| Chaos large | 3583.15234375, -962.408203125 | spawn |
| Chaos small 1 | 3633.15234375, -792.408203125 | spawn_mini2 |
| Chaos small 2 | 3383.15234375, -962.408203125 | spawn_mini1 |

The script reverses the small-wolf spawn assignments on the opposite side.
FNV-verified `_base` states link `spawn_mini1` to the right-spawn file and
`spawn_mini2` to the left-spawn file. The unresolved normal idle state retains
its exact source key. Attack1, run and death aliases retain their atomic source
bindings; complete native graph/variant selection remains unverified.

The converter retains all 20 large-wolf and 25 small-wolf atomic clips, including
three static look-at poses per rig. Large: 4,706 triangles, 61 bones and source
skinScale 1.2000000476837158. Small: 3,374 triangles, 57 bones and scale
0.949999988079071. Existing source-to-metre conversion and unlit diffuse shading
apply. Native lighting and complete composition remain open.

The small-wolf default spawn and `spawn_mini1` share one source animation.
The browser exposed a loader assumption that aliases were one-to-one. Runtime
aliases now clone source clips independently, preserving unused source clips and
their samples. This avoids renaming a shared source away before its next alias.
Small-wolf names now appear only on hover or selection, reducing dense-pack
clutter while retaining the leader name and all health bars. This is a local UI
policy pending native label comparison.

## Values and explicit local policies

Root large-wolf scalars are 1600 HP, 30 damage, 42 armor/MR, 525 movement speed,
175 attack range, 0.625 attack speed, 55 gold, 50 XP and two CS. The small wolf
has 630 HP, 20 armor/MR, the same speed/range/attack speed, 15 gold and 15 XP.
Large/small gameplay radii are 80/50; navigation radii are 40/31.52079963684082.
Both primary SpellObjects give cast frame 15, yielding a 30-tick local melee
contact and 96-tick attack period.

**Small-wolf Root omits attack damage and minion score.** The export preserves
both as null source fields. Runtime uses provisional local values of 20 damage
and one CS, giving a local four-CS pack. These are not recovered native values.
Root reward modifiers, level scaling and published percentage-current-health
on-hit damage remain unfinished.

The first-ready baseline is 55 seconds from Riot's
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).
Legacy SpawnDuration 0.66 rounds to 40 protected ticks; the 135-second respawn
adopts the legacy default. These timing adapters remain provisional. Each member
keeps its source animation tail after readiness: the large spawn lasts about
2.433 seconds, and the small variants about 1.3/1.967 seconds. Gameplay readiness
stays separate from pose completion.

Riot's [12.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/)
give a 650-unit leash baseline, shared small-monster patience while the leader
lives within 700 units, and marked death after ten consecutive seconds outside
champion combat. The local implementation uses camp-wide retaliation, shared
hard reset only for nearby members with a living leader, and an individual
cleanup clock for each survivor after the leader dies. Qualifying active
champion retaliation refreshes that survivor's clock. Cleanup kills remaining
members without last-hit rewards or damage-number popups; final removal starts
the respawn calendar.

These are explicit local combat/reset adapters. Native patience depletion,
soft resets, combat classification, attack selection, cleanup reward dispatch
and later-patch calibration remain unverified. The existing reset-healing policy
is retained. Returning monsters clear burns and control effects, while unrelated
camps retain independent targets and calendars.

## Saves and validation

Schema 96 stores ordered nullable member IDs, per-slot cleanup deadlines and
the next group spawn. It validates cardinality, unique ownership, species,
individual source homes, spawn variants and marked-death eligibility. Each
active spawn also stores its clip alias, allowing exact phase continuation when
the small variants have different lengths. A partial corpse-free save does not
resurrect the leader; a complete clear can restore all members with fresh IDs.
Older schemas remain incompatible without silent migration.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-wolf-camps.py
node tools/assets/convert-roster-base.mjs SRU_Murkwolf
node tools/assets/convert-roster-base.mjs SRU_MurkwolfMini
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-wolf-camps.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npm run assets:validate
npx playwright test e2e/wolf-camps.spec.ts e2e/rift-gromp-camps.spec.ts e2e/blue-sentinel.spec.ts e2e/red-brambleback.spec.ts e2e/gromp-spawn.spec.ts --workers=1 --timeout=60000
npm run test:production
```

Repeated extraction requires pin equality. Both GLBs, manifests and the camp
export repeat byte-identically. Source/simulation cases cover three-member
ownership, protected poses, shared combat, partial clears, individual cleanup,
rewards, complete respawns and malformed saves. Chrome checks real input and
source rig pixels, fighting/partial/complete checkpoints and fresh group IDs.
Final kills and time jumps remain diagnostic. Commands, results and capture
hashes are retained in [the verification ledger](reference/wolf-camps-verification.json).
