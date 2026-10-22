# Jungle companion source preparation

All three `SRU_Jungle_Companions` source skins can now be reviewed with their
Adult/Baby geometry and atomic animations. This prepares the visual and data
dependencies for earned Smite evolution. A separate
[owned companion encounter](OWNED-COMPANIONS.md) now uses these rigs for following,
combat and earned growth in the controlled Gromp fixture. Production matches do
not yet grant companions, and their items are not advertised as working shop entries.
The full match goal remains active.

## Original sources

[The source pin](reference/jungle-companions-source.json) retains 70 original
Map11 archive members (4,162,971 raw bytes), twelve original Scripts members
(2,274 raw bytes), full skin/graph/character records, standard item records and
selected strings. Riot archive chunks use frozen manifest `29CE6E781C3B6368`,
version 16.18.8175716. Parent character, script and Smite pins remain unchanged.
Discovery labels are xxh64 checked; repeat extraction uses the finite pinned
paths. The shared/string mirrors match the existing Smite pin, and the official
Data Dragon item mirror matches the earlier mage-item source digest.

| Source skin | Shapes     | Graph states | Distinct ANM files | Triangles, both forms | Bones | Source skin scale              |
| ----------- | ---------- | -----------: | -----------------: | --------------------: | ----: | ------------------------------ |
| 0           | Fox        |           28 |                 18 |                10,699 |    57 | Absent; local identity default |
| 1           | Cat        |           26 |                 18 |                12,024 |    60 | Absent; local identity default |
| 2           | Salamander |           30 |                 15 |                 8,042 |    67 | ~0.8                           |

The converter retains each atomic graph state even when several states share an
animation file. There are 84 states, not 84 distinct source animation files.
Idle, movement, attacks, healing, Smite, transform, spawn, recall and jump actions
are present. Graph transitions, event dispatch, native pose and material behavior
still need comparison.

Each rig has distinct Adult and Baby submeshes and source diffuse textures. The
source skin definition initially hides Baby. That authored default does not
establish the form used when a player buys a starter companion; native lifecycle
callbacks may change it. The review switches forms manually and frames each one
for inspection. It does not simulate quest growth or establish native world size.
Two skins omit `skinScale`; the converter's existing identity fallback remains
explicit, while skin 2 retains its authored scale.

## Item and counter evidence

Scorchclaw Pup (1101), Gustwalker Hatchling (1102) and Mosstomper Seedling (1103)
each cost 450 gold, sell for zero and require `SummonerSmite`. The records retain
GoldItems, DoransItems and BaseJungleItems memberships. GoldItems and DoransItems
each declare a maximum of one. Other unresolved group/modifier hashes remain in
the pin; the complete purchase/consumption lifecycle is not reconstructed.

All three standard items contain `TotalCounters = 35` and `Breakpoint1 = 20`.
Their extended tooltip labels the breakpoint as treats fed. Riot's
[26.1 notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
instead publish 15 kills for first evolution and 35 for quest completion. The
arithmetic `35 - 20 = 15` is consistent with a remaining-counter interpretation,
but the retrieved callbacks do not prove that direction. This conflict must stay
visible when the runtime adapter is designed. A direct 20-kill implementation
would contradict the published change. Alternate-mode overrides remain separate.

The companion CharacterRecord still carries `Monster_Large`/`Monster_Wolf` tags
and ordinary-looking damage, health and reward fields. Those values do not
establish the live pet's faction, targetability, attack timing or kill rewards.
They remain visible as raw evidence and are not inserted into the neutral camp
catalog. Owned-pet behavior needs its own runtime contract.

The extended item tooltip specifies one feed per large monster kill, two when a
bonus treat is available, with periodic bonus treats also granting gold. The
character's `PuppyControllerBuff` retains 60- and 90-second treat interval values,
20 treat gold, 80 treat XP, 150 first-monster bonus XP, ~1.1 monster damage
multiplier and 0.5 monster damage taken. Their active phase, eligibility, caps,
kill-credit and area/lifecycle bindings remain unverified. The two named
`LargeMonsterBonusGold` and `LargeMonsterBonusXP` data entries omit values; they
are retained as absent. The published post-quest +10 gold/XP is separate evidence.

Standard Smite records retain the 600/1,000/1,400 progression, pet DPS/HPS
calculations and the upgraded targeting/area data. `Monster_Heal_Mis` separately
retains base 70, per-level 20 and cap 250 healing values, mana values and energy
restoration. These are source inputs, not a claim that the complete native
formula or delivery has been implemented. Each companion's final shield, speed
or burn/slow data is also retained without granting an incomplete passive.

## Script boundary and review

The twelve selected scripts contain 84 instructions and no nested functions or
active event callbacks. Item and character scripts are RETURN-only. Controller,
upgrade, attack, snack and healing scripts contain metadata assignments; the
healing script also builds a `SpellFXOverrideSkins` table for `PantheonSkin06`.
These are not executable evidence of feed counting, pet DPS, native spawn/form
selection or quest completion. The retained script inventory makes that boundary
inspectable.

Open the development review at:

`/tools/qa/jungle-characters.html?character=SRU_Jungle_Companions/Skin0`

All eleven ordinary jungle rigs and three companion source skins remain available
on demand. The companion selector exposes Adult/Baby, playback and scrubbing. It
retains the existing absent-field display, retry, request cache and late-load
selection guards. The source page is separate from match simulation.

Reproduce source extraction and conversion:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-jungle-companions.py
node tools/assets/convert-roster-base.mjs SRU_Jungle_Companions 0
node tools/assets/convert-roster-base.mjs SRU_Jungle_Companions 1
node tools/assets/convert-roster-base.mjs SRU_Jungle_Companions 2
```

The extractor expects the frozen item mirrors in `.cache/jungle-quest/` and the
shared/string mirrors used by Smite in `.cache/smite/`; URLs and digests are
retained in the pin. The optional skin argument applies only to companions;
existing base-rig commands retain index zero.

Exact repeat hashes, unit/browser checks, captures and production results are
recorded in [the historical source-review ledger](reference/jungle-companions-verification.json).
The later [owned runtime ledger](reference/owned-companions-verification.json)
covers the ownership foundation separately; its later
[final passive adapters](OWNED-COMPANIONS.md#final-passive-adapters) remain controlled
and require native comparison. Purchased-item consumption, standard
role binding, native effects/audio and jungle-role matches remain
unfinished. Rendering and performance are not certified by this source review.
