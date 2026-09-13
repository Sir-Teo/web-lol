# Hawkshot ammunition

Hawkshot now stores two charges. A successful cast consumes one and starts a five-second cast cooldown. Rank-one recharge restores one charge every 90 seconds, serially, until both are available. Spending the second charge preserves the active recharge deadline. The previous prototype used one 45-second cooldown.

## Source and interpretation

`docs/reference/ashe-e.json` pins the complete standard spell selected by slot 2 of Ashe's character spellbook, together with the current Hawkshot tooltip and whole-file SHA-256 hashes. `tools/assets/export-ashe-e.py` verifies the selection, complete record, tooltip and hashes before generating `src/content/ashe-e.ts`.

- `mMaxAmmo` is uniformly 2.
- Both `cooldownTime` and `Cooldown.values` are uniformly 5 seconds.
- `mAmmoRechargeTime` and `BaseCooldown` agree at normal ranks 1–5: 90/80/70/60/50 seconds. Their unused rank-six values differ and are deliberately excluded.
- The current tooltip explicitly describes two charges and a recharge interval. Its separate Jade/Classic counterpart is not selected.

Sources: [16.18 Ashe record](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json), [16.18 English strings](https://raw.communitydragon.org/16.18/game/en_us/data/menu/en_us/lol.stringtable.json).

The current all-abilities-unlocked practice mode starts with both charges; first learning, skill ranks and ability haste remain unimplemented. Serial recharge, starting the timer at accepted cast, continuing it through death, and resolving recharge before commands on the exact deadline tick are explicit runtime policies pending controlled reference comparison. Static fields establish capacity and durations, not all server event ordering.

## State and presentation

Player state stores `eCharges` and nullable `eRechargeTick`. At full capacity the timer is null; below capacity it is a finite integer deadline. Snapshot version 12 rejects missing, fractional, out-of-range or inconsistent ammunition state. Save/restore retains recharge progress. Respawn does not refill charges. Practice's reset-cooldowns action restores both charges and clears the recharge timer.

The E icon shows its charge count and a thin progress bar toward the next charge. With ammunition available, its main countdown shows only the five-second cast delay; with none, it shows the longer wait for cast eligibility. A shared simulation query computes that wait for cast validation and the HUD. The accessible label also reports charges and time until replenishment. The bar/count layout is authored UI, not a claim of reference pixel parity.

Five simulation cases cover serial recharge/cap, exact cast and replenishment boundaries, rejected casts, recall preservation, death/respawn, save continuation and invalid ammunition snapshots. A Chrome case uses actual keyboard casts and verifies the charge badge, countdown, accessible label, recharge visibility and practice reset.

## Remaining Hawkshot fidelity work

The existing effect is still an instantaneous 650-radius, five-second reveal in a single slot. The aiming spec still advertises 8000 range and cast validation does not enforce Hawkshot's target distance. The pinned source instead provides 25000 range, a 1400-speed missile and 0.25-second cast time. Traveling sight, its persistence along the path, endpoint radius, multiple simultaneous reveal areas, minimap targeting, cast windup, animation, particles and audio require implementation and validation. Ammunition does not certify the complete spell.
