# Red Brambleback camps

The lane match now contains both Red Brambleback camps, alongside Blue and
Gromp. Red uses its normal source rig, source animation clips, physical melee
retaliation, its own navigation radius and independently saved respawn calendars.
Lux can attack and root it through the existing input, projectile and impact-pose
paths. Ordinary practice does not load this rig.

[Crest of Cinders](CREST-OF-CINDERS.md) now adds burn/slow, healing, transfer
and saved effect clocks alongside Root gold, XP and CS. Native level scaling,
initialization, effects/audio, attack variants, complete buff calibration/sharing,
Smite and jungle-role bots remain unfinished. This increment does not certify a
complete match or native visual parity.

## Frozen source evidence

[The source pin](reference/red-brambleback-source.json) retains four original
skin/animation BINs, 18 base rig dependencies, the character Lua stub and three
legacy camp-construction windows. All bytes come from the same frozen Riot
16.18.8175716 manifest as the terrain and other monsters. The original jungle
character, map and script pins remain unchanged.

The restricted bytecode reader links camps 4/10 to one `SRU_Red` with the
`spawn` animation. OrderRedBuff1 and ChaosRedBuff1 each match one named map
locator. The other old miniature positions do not create additional monsters.
The locator, source facing point and existing Rift coordinate transform produce:

| Camp | Runtime XY |
| --- | --- |
| Order | 340.244140625, 3404.81298828125 |
| Chaos | -323.130859375, -3475.546875 |

Placed Red objects reference **skin 3**, named `SRU_Red_Baron`, with a hidden
Normal submesh. This differs from Blue's skin-4 reference. Riot's
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
remove Baron-corrupted buff camps. The local runtime chooses normal skin 0 while
retaining the conflicting static placement. Neither the placed skin nor this
local choice proves current native activation. The static decoder's supplied
SkinOverrides=0 is an analysis binding, not an observed native mutator value.

Red's character Lua contains only RETURN and supplies no missing server behavior.
Discovery used a finite set of hash-verified path labels; reproduction uses the
committed source pin without a mutable dictionary. Additional literal names can
resolve old hashes; exact FNV/xxh64 alignment preserves pinned labels without
accepting changed source values.

## Rig and combat

The converted base rig contains 3,766 triangles, 69 bones and all 15 atomic
clips. Three look-at clips have zero duration; they remain static poses. Source
skinScale 2.075000047683716 gives unitScale 0.02075000047683716. The converter
preserves diffuse assignment and uses the existing unlit material policy. Native
lighting, reflection, pose modifiers and complete graph dispatch remain open.

Root supplies 2300 HP, 66 damage, 42 armor/MR, 275 movement speed and
0.49300000071525574 attack speed. Unlike Blue, Red explicitly supplies a
**200-unit attack range**. Gameplay radius 120 and navigation radius 60 remain
separate. Primary attack cast frame 16 gives a 32-tick local windup and a
122-tick period. The attack pose reaches frame 16 at contact; no Gromp missile
or Gromp-specific effect is created. Native selection among attack variants
remains unverified.

The normal idle, run, attack1, death and spawn aliases come from exact source
paths. The spawn clip lasts four seconds. Both graph spawn transitions and the
cascade blend are zero, supporting the existing direct spawn transitions. Corpse
retention rounds up to 163 ticks to cover the full converted death clip.

Root last-hit rewards are 90 gold, 95 XP and four CS. Complete native reward
modifiers and native Crest calibration remain open.

## Timing policies and saves

The published standard Rift first-ready baseline is 55 seconds. The legacy
script supplies SpawnDuration 1.66, leash 1000 and respawn 300 seconds; these are
explicit **provisional local policies**. Protection rounds to 100 ticks at 60 Hz.
The animation continues after readiness until positive health loss or its natural
end. Current native timing, leash/reset behavior and later-patch calibration
remain unverified. Private sight and reset healing use existing local policies.

Each death unlinks only its own calendar and schedules readiness after 300
seconds. Resets leave that deadline unchanged. A corpse-free checkpoint retains
the pending spawn, and a respawn receives a fresh unit ID. Schema 96 validates
all twelve calendars, species ownership, source homes and independent spawn clocks.
Its calendar limit now comes from the catalog rather than an obsolete constant.
Older schemas remain incompatible without silent migration.

## Reproduction and validation

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-red-brambleback.py
node tools/assets/convert-roster-base.mjs SRU_Red
python3 tools/assets/export-red-brambleback.py
npm run assets:validate
npm run check -- --maxWorkers=4 --testTimeout=30000
npx playwright test e2e/red-brambleback.spec.ts e2e/blue-sentinel.spec.ts e2e/rift-gromp-camps.spec.ts --workers=1 --timeout=60000
npm run test:production
```

Source/simulation checks cover recovered range and provenance, every atomic
clip, contact timing, private controllers, rewards, protected pose continuation,
six-camp ownership, corpse-free saves and independent respawn. Chrome checks
real Lux input, Red pixels, Binding, fight reload and a fresh-ID respawn. Final
kills and calendar jumps are diagnostic; these are not full seeded matches.
Commands, results and capture hashes are recorded in
[the verification ledger](reference/red-brambleback-verification.json).
