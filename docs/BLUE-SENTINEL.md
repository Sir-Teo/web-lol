# Blue Sentinel camp foundation

The lane match now schedules one Blue Sentinel on each half of the Rift,
alongside both Gromps. Blue uses the existing normal-skin rig, source clips,
physical melee retaliation, its own home/leash, Root last-hit rewards and a saved
respawn calendar. Lux can attack, mark and root it through the existing input,
projectile and impact-pose paths.

[Crest of Insight](CREST-OF-INSIGHT.md) now adds a last-hit buff, level-scaled
haste, provisional mana regeneration, transfers and a saved HUD timer.
Elemental-terrain pickup/sharing and complete native rewards remain unfinished.
Native initialization, level scaling, effects/audio, other camps, Smite and
jungle-role bots remain open. This does not certify a complete match or native
visual parity.

## Source evidence

`reference/blue-sentinel-source.json` links the frozen character/script/map pins
by SHA-256. It additionally pins two Skin4 BINs from Map11.wad.client and three
Lua members from Scripts.wad.client in Riot 16.18.8175716. It retains selected
Skin4 data, a bounded animation-graph summary, extraction hashes, legacy camp
construction and unique named map locators. The existing model binary is unchanged.

The legacy script explicitly assigns one SRU_Blue to camps 1/7. OrderBlueBuff1
and ChaosBlueBuff1 resolve independently of camp anchors and placed characters:

| Camp | Runtime XY |
| --- | --- |
| Order | -3603.511474609375, -476.05419921875 |
| Chaos | 3606.728515625, 434.15576171875 |

Old miniature positions do not add units to the one-member group. The supplied
skin override in the static decoder is an analysis binding, not an observed
native mutator value.

Placed Blue objects reference skin 4, named **SRU_Blue_Baron**, with Voidborn
audio and a hidden Normal submesh. Riot's
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
removed Baron corruption of buff camps. The local integration therefore chooses
normal skin 0 and retains the conflicting placement data. Neither fact proves
current native skin activation.

Blue's character Lua is only RETURN. Crest/Aura Lua supplies metadata, not the
missing buff implementation. A persistence flag alone does not establish death
behavior. Riot's [26.14 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-14-notes/)
changed Blue haste to 10/15/20 at levels 1/6/11. These findings are retained
with the remaining formula bindings explicitly provisional in the runtime.

## Values and policies

Root supplies health 2300, damage 66, armor/MR 42, speed 275 and attack speed
0.49300000071525574. Gameplay radius 131 remains separate from navigation radius
30. Cast frame 17 gives a local 34-tick windup, consistent with Root's roughly
0.567-second cast time. The local attack period is 122 ticks. Melee hits create
no Gromp missile. The adapter uses attack1; native selection among three attack
variants remains unverified.

Root **omits attack range**. The export keeps sourceAttackRange=null and labels
175 separately as a provisional local range. Raw last-hit rewards are gold 90,
experience 95 and four CS; native jungle-role modifiers remain open.

The published first-ready baseline is 55 seconds. A provisional 1.1-second
protected lead-up, 1000-unit leash and 300-second respawn adopt legacy values.
Protection stays separate from the approximately 5.633-second source spawn clip;
positive health damage interrupts the ready tail. Private sight/reset uses the
existing local neutral policy. Later-patch timing and native calibration remain
required.

The species catalog supplies rig/clip lookup, navigation radius, movement clock,
combat values, corpse retention and reward CS. The camp catalog supplies species,
source locator/facing and deadlines. Gromp retains its own policies, spawn
submesh and dedicated effects. Blue does not borrow Gromp's effects. Schema 96
validates twelve calendars, species ownership, homes and species-specific clocks.
Older schemas remain incompatible without silent migration.

Default practice requests neither rig. Lane matches prepare both, including a
corpse-free waiting checkpoint. Neutral sight and automatic lane-bot exclusion
remain unchanged. Monster names now stay on one centered line without changing
health-bar width.

## Reproduction and validation

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-blue-sentinel.py
python3 tools/assets/export-blue-sentinel.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-jungle-scripts.py
python3 tools/assets/test-lua51.py
```

Repeated extraction/export matches. Moving the restricted data-block decoder to
the existing Lua reader leaves the previous nine-script pin identical. Seven
new cases cover provenance, absent range, rig identity, exact melee release,
private controllers, rewards, four-camp continuation and invalid ownership.
Chrome covers real Lux input, Blue pixels, retaliation, Binding, exact fight
reload, clear, corpse removal and a new-ID respawn. Scripted boundary probes
do not constitute a complete seeded jungle match.

The current increment passes 1,108 checks and TypeScript. Four browser cases
passed initially; an old Gromp model-count assertion was scoped to its species,
and the focused Blue/Gromp rerun passes both cases. Production build/nested-host
smoke passes with both rigs. Final captures were visually reviewed. Commands and
hashes are retained in [the verification ledger](reference/blue-sentinel-verification.json).
