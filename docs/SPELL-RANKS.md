# Spell-rank implementation audit

Current gameplay still starts with Q/W/E/R available at rank one. Champions now own saved ranks and unspent points, with validated allocation commands, HUD upgrade buttons and Ctrl+Q/W/E/R shortcuts. This initialization is practice behavior, not standard match progression. The production objective requires actual learning and rank allocation.

## Verified resource tables

`reference/ashe-spell-ranks.json` retains selected game/client fields with complete-file hashes. `tools/assets/export-ashe-spell-ranks.py` verifies both sources and emits `src/content/ashe-spell-ranks.ts`. The existing ability definitions consume rank one of these tables.

| Spell | Normal-rank mana costs | Normal-rank cooldown seconds |
|---|---|---|
| Q | 30 / 30 / 30 / 30 / 30 | 0 / 0 / 0 / 0 / 0 |
| W | 75 / 70 / 65 / 60 / 55 | 18 / 14.5 / 11 / 7.5 / 4 |
| E | 0 / 0 / 0 / 0 / 0 | 5 / 5 / 5 / 5 / 5 |
| R | 100 / 100 / 100 | 100 / 80 / 60 |

Game `mana` arrays begin at rank one. Game `cooldownTime` includes a leading entry: slice from index one. Client cost/cooldown coefficient arrays both begin at rank one and independently confirm the chosen slices. E omits game mana but explicitly has zero client costs. E's five-second cast interval is separate from its 90/80/70/60/50 charge recharge.

The client exports `maxLevel: 0` for every spell. This cannot establish rank caps or learning-level restrictions. The selected game spells’ `mClientData.mTooltipData.mLists.LevelUp.levelCount` confirms five displayed ranks for Q/W/E and three for R; the exporter now derives normal table lengths from these records. This confirms the normal rank catalog, not the champion-level learning restrictions. Extra trailing array values must not be exposed as normal ranks.

## Runtime integration requirements

`src/simulation/ashe-spell-values.ts` exposes validated normal-rank queries for Q buffs, W damage/arrow count, E cast/recharge timers and R damage, together with mana/cooldown costs. Champion `spellRanks` are now saved under snapshot version 30. Casts, Q attack timing/damage, W/R damage, E timers, bot resource checks and live HUD descriptions/costs consume owned ranks. Rank zero blocks casting and Q stack generation. Explicit rank previews remain available through the world damage queries.

Pending casts capture their rank as well as damage; Volley therefore retains its starting arrow count through a windup upgrade. Existing E recharge deadlines and their displayed duration remain unchanged by rank edits; the next recharge uses the new rank. These upgrade-timing choices are current simulation policies, not independently verified native timing. Active Q reads the current rank for subsequently released attacks and newly scheduled attack timing. Already released projectiles retain their damage.

- Standard matches still need unlearned initialization with one starting skill point and canonical point-budget validation. Existing practice initialization grants four rank-one spells and zero points; level-ups grant one point each, so it has three extra total ranks compared with standard play.
- Learning commands now validate points, maximum rank and conventional champion-level gates; rejected commands do not mutate state. Commands execute while dead/stunned and preserve orders, recall and cast state. Native gate-source extraction remains an evidence gap.
- Verify native upgrade timing for active Q and committed attack windups against the current rank-aware behavior.
- Verify native W cast-start rank/damage capture timing against the current captured-rank behavior.
- Verify native E behavior when learning a rank during a running recharge; current behavior preserves the running interval and changes the next.
- R damage and cooldown now consume owned ranks and flat item AP. Broader AP modifiers remain separate work.
- Upgrade buttons and Ctrl shortcuts now enqueue learning commands; add native button art and presentation polish beyond the current CSS controls.
- Bots must allocate earned points and cannot cast unlearned spells. Fixture-specific assumptions must not leak into the real match setup.

## Verification required

Test first learning, legal and illegal rank boundaries, point conservation, independent champions, pending casts and projectiles during upgrades, E recharge upgrades, unavailable unlearned spells, and saved continuation. Exercise real learning controls and bot allocations in a standard match, not only direct test-state mutation. Rank tables alone do not fulfill this gate.


## Source skill recommendations

The same pinned champion file contains `RecSpellRankUpInfoList` record `{2ce6586c}`. For map 11, both bottom and utility list default priority `[3, 1, 0, 2]` (R, W, Q, E) and early overrides `[1, 0, 2, 1]` (W, Q, E, W). Bottom is the default recommendation. Map 12 differs: its early overrides start Q, W, E, W. These records are retained and verified by the rank exporter.

Recommendations express skill choices, not permission to learn an unavailable rank. Future bot allocation must filter priorities through learning validation and use the map-11 record. The inspected champion/map records did not expose standard champion-level unlock thresholds; no runtime learning validator is added by this audit.

## Allocation behavior and evidence

The current validator uses normal basic-skill gates 1/3/5/7/9 and ultimate gates 6/11/16. The [community ability reference](https://leagueoflegends.fandom.com/wiki/Champion_ability) search index confirms the ultimate gates, but direct full-page retrieval failed. These conventional rules are implemented as simulation policy, not claimed as newly extracted game constants. Champion-specific exceptions are outside this Ashe-only validator. The game-file rank caps remain independently pinned.

Unspent points are persisted as bounded integers under snapshot 30. Successful upgrades transfer exactly one point into one rank, and XP grants one point per level gained. Existing manually configured practice states do not enforce a canonical level-to-total-rank budget; standard initialization and corresponding stronger save invariants remain unfinished. Tests demonstrate an explicitly unlearned champion starting with one point reaches 5/5/5/3 with zero points at level 18. Live practice initialization remains four learned spells; bots still need automated allocation.
