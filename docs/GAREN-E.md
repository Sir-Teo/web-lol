# Judgment integration

Garen NPCs can learn and cast E. His passive and all four spells now have initial
simulation foundations. A [development player fixture](GAREN-PLAYER.md) now
exercises input/HUD and checkpoint flows. Complete spell effects/audio, native
timing comparisons and role integration remain required before production selection.

## Verified source foundation

`tools/assets/export-garen-e.py` reads the archive-verified character record and
[Data Dragon 16.18.1 E](reference/garen-e-ddragon.json). A fresh October 21, 2026
download through `data/en_US/champion/Garen.json` matches the earlier cached
complete-response hash. R's metadata now records this successful verification too.

| Property | Frozen value |
| --- | --- |
| Physical damage per strike | 4/7/10/13/16 + 40/43/46/49/52% total AD |
| Duration / base strikes | 3 seconds / 7 |
| Extra strike | Per 25% bonus attack speed from supported growth/item sources |
| Radius | 325, client range and character display override |
| Nearest enemy bonus | 25% |
| Champion contacts before armor reduction | 6 |
| Armor reduction / duration | 25% / 6 seconds |
| Critical modifier | 30% of bonus critical damage |
| Cooldown / cost | 9/8.25/7.5/6.75/6 seconds / zero mana |

[Riot 26.5](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-5-notes/)
confirms damage, [26.1](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/)
confirms critical scaling, and [9.24](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-24-notes/)
confirms the 25% attack-speed step. [Riot 25.11](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-11-notes/)
establishes the post-spin cooldown and removal of level-based damage, cancel
refunds and bonus monster damage. [Riot 25.12](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-12-notes/)
fixes subsequent-spin armor-debuff extension. Older formulas are not restored.

The exporter checks rank counts, client cooldowns/radius, self-AoE targeting,
the cancel child's self-toggle, the damage calculation, and `Spell3`'s five
parametric angle clips. It verifies the existing GLB's manifest hash and
`Spell3_0` source mapping. The displayed 325 radius remains distinct from raw
660 cast-range and 35 cast-radius fields, which do not establish the hit circle.

## Runtime and explicit adapter policies

Activation interrupts recall and ordinary attack windups, retaining the current
movement order. A committed Q rejects E until release. E captures rank, strike
count and hasted cooldown duration. Unrounded level growth adds whole strikes;
the current item catalog has no attack-speed items. Temporary speed multipliers
and rounded attack periods do not contribute. Supported levels produce 7–9 spins.

Strikes complete at evenly spaced, rounded-up endpoints on the 60 Hz grid. At
level one the relative ticks are 26, 52, 78, 103, 129, 155 and 180. There is no
activation hit or extra hit after three seconds. Damage resolves after unit
movement and before missiles, reading current AD/crit equipment and captured
rank/count. One seeded critical roll per damaging strike is shared by its
recipients. Ordinary crits use 1.3× damage; the implemented Infinity Edge makes
that 1.39×. Event order, capture choices and roll granularity require native comparison.

Living enemy nonstructures intersecting the body-inclusive circle receive damage,
including unseen units. Nearest bonus uses center distance with entity-ID ties.
Shared physical area damage handles resistance, shields, omnivamp, kill rewards
and Courage credit. E applies no attack on-hit and does not consume Q. Unseen
targets receive damage without revealing their health, combat text or location.

Movement remains available, and attack orders approach to 100 units plus target
radius while attacks are suppressed. Root/stun prevent movement; accepted spins
continue through these controls and silence. New casts/recasts retain ordinary
control gates. Q/W, Heal and Flash coexist with E; recall is blocked. Valid R
interrupts E after target validation. A rejected R preserves the spin. E's local
recast lock is one second, pending native script timing. Completion, recast,
R interruption, death and match end start the captured full cooldown and clear
the current order. There is no unused-duration refund. Commands precede periodic
damage, so a recast accepted on a strike tick suppresses that strike.

After six contacts with a surviving champion, E applies an armor debuff after
the sixth damage event. Subsequent contacts refresh it, including another cast
while that source's debuff remains active. Multiple Garen grants retain separate
expiry but use one 25% reduction under the local same-name policy. Negative armor
is unchanged. These cross-cast/owner and threshold-ordering details remain adapter
interpretations. Stored base/item/growth armor is never mutated; physical damage
and the player HUD read `effectiveArmor`. Caster death preserves existing debuffs;
target death/respawn clears them.

Source `spell3_0` playback takes precedence over movement/ordinary cast poses and
loops at a rate scaled by captured strikes. Directional parameter blending,
source graph execution, exact damage contact and audio remain open. The subsequent
[source-particle adapter](GAREN-SPIN.md) adds four of six inline spin layers with
retained stop tails; native composition and the remaining glow layers are open.
Bots learn E after early Q/W points, then prioritize R/E ranks. Existing retreat,
tower, recall and lethal-R decisions take precedence. E activates for a safe
visible champion already in the circle or three safe visible lane minions; queued
casts pass the ordinary validator. Hidden health and structures do not trigger E.

Snapshot version 74 retains the spin lifecycle, deterministic completed strikes,
per-champion contact counts, captured cooldown and source-owned armor debuffs.
Validation checks ownership, ranks, reachable counts/cooldowns, exact deadlines,
cadence, unique enemy recipients and incompatible actions. Restore does not
reapply armor changes. Earlier checkpoints are incompatible.

Validation: 18 new simulation cases cover all ranks, cadence, geometry/fog,
controls, Q/W/R/Flash interactions, critical damage, rewards, multiple owners,
expiry/death, RNG continuation and malformed saves. All 904 tests and TypeScript
pass. Five focused Q/W/E/R browser cases cover movement with the source clip,
finite bones, checkpoint continuation and the player armor display changing
100 → 75 → 100. `artifacts/browser-garen-e-spin.png` was visually reviewed.
Production build and nested static-host smoke pass with 17 source recordings.
The existing large-bundle warning remains.

The source review also corrects Courage stacking before W is learned; see
[GAREN-W.md](GAREN-W.md). Native comparison, attack-speed items and complete
player/role presentation remain unfinished.
