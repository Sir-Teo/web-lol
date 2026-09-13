# Spell-rank implementation audit

Current gameplay still starts with Q/W/E/R available at rank one. This is practice behavior, not standard match progression. The production objective requires actual learning and rank allocation.

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

- Add Q/W/E/R rank ownership and unspent points per champion, including saved-state validation and a schema bump. Standard matches need unlearned spells; explicitly retained practice fixtures may start with unlocked skills.
- Validate learning commands against points, maximum rank and verified champion-level restrictions; invalid commands must be atomic. Learning consumes no match time beyond command processing.
- Replace fixed Q attack-speed/damage indexes in attack scheduling and empowered damage. Already released attacks retain captured damage and scheduled timings.
- Replace fixed W damage/arrow count, resource costs and cooldowns. Decide and verify which values snapshot at cast start versus release; current pending casts capture damage but not arrow count.
- Replace E's fixed recharge index everywhere a charge timer is scheduled. Verify behavior when learning a rank during a running recharge before changing existing deadlines.
- Replace R's literal 200 damage and fixed cooldown with the pinned rank data. AP scaling remains a separate missing stat system.
- Use the same learned-rank queries in cast validation, bot resource checks, HUD mana labels, tooltips, cooldown shading and learning controls.
- Bots must allocate earned points and cannot cast unlearned spells. Fixture-specific assumptions must not leak into the real match setup.

## Verification required

Test first learning, legal and illegal rank boundaries, point conservation, independent champions, pending casts and projectiles during upgrades, E recharge upgrades, unavailable unlearned spells, and saved continuation. Exercise real learning controls and bot allocations in a standard match, not only direct test-state mutation. Rank tables alone do not fulfill this gate.


## Source skill recommendations

The same pinned champion file contains `RecSpellRankUpInfoList` record `{2ce6586c}`. For map 11, both bottom and utility list default priority `[3, 1, 0, 2]` (R, W, Q, E) and early overrides `[1, 0, 2, 1]` (W, Q, E, W). Bottom is the default recommendation. Map 12 differs: its early overrides start Q, W, E, W. These records are retained and verified by the rank exporter.

Recommendations express skill choices, not permission to learn an unavailable rank. Future bot allocation must filter priorities through learning validation and use the map-11 record. The inspected champion/map records did not expose standard champion-level unlock thresholds; no runtime learning validator is added by this audit.
