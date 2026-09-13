# Hawkshot ammunition and scouting

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

Player state stores `eCharges` and nullable `eRechargeTick`. At full capacity the timer is null; below capacity it is a finite integer deadline. Snapshot version 13 rejects missing, fractional, out-of-range or inconsistent ammunition state. Save/restore retains recharge progress. Respawn does not refill charges. Practice's reset-cooldowns action restores both charges and clears the recharge timer.

The E icon shows its charge count and a thin progress bar toward the next charge. With ammunition available, its main countdown shows only the five-second cast delay; with none, it shows the longer wait for cast eligibility. A shared simulation query computes that wait for cast validation and the HUD. The accessible label also reports charges and time until replenishment. The bar/count layout is authored UI, not a claim of reference pixel parity.

Five simulation cases cover serial recharge/cap, exact cast and replenishment boundaries, rejected casts, recall preservation, death/respawn, save continuation and invalid ammunition snapshots. A Chrome case uses actual keyboard casts and verifies the charge badge, countdown, accessible label, recharge visibility and practice reset.

## Traveling scout and destination vision

Hawkshot now launches a non-damaging projectile toward the selected point, clamped to 25000 units from the cast position. It travels at 1400 units/second, ignores unit and terrain collision, and grants its team unobstructed moving sight. It stops exactly at its destination instead of continuing for the entire maximum range. A zero-length cast creates its destination reveal immediately. Arrival removes the flight model and creates a separate five-second scouting area. Multiple flights and destination areas coexist; caster movement, death or respawn do not relocate or cancel them.

The verified exporter now checks `FixedSpeedMovement`, agreement between component speed and `missileSpeed`, disabled target tracking, `mProjectTargetToCastRange`, matching uniform range arrays, and `VisionDuration`. These establish the 1400 speed, 25000 range and five-second lifetime. The first flight interval occurs during the accepted-cast tick in our fixed-step simulation. Exact cast/arrival timing remains a policy until windup is implemented and measured.

Both moving and destination sight currently retain the earlier **provisional 650 radius** and unobstructed terrain/brush policy. No lingering path trail is implemented. The source exposes `luaOnMissileUpdateDistanceInterval` of 100, but it does not by itself establish the radius or lifetime of trail reveals. Do not interpret the spell's `castRadius` or particle dimensions as verified vision geometry.

Scouting areas share the existing timed vision-area collection, now with explicit `scout`/`attack` kinds. Queries that exclude attack-reveal feedback still include scouting, so an attacker already seen by Hawkshot does not create a spurious hidden-attack reveal. Snapshot version 13 stores the new projectile type and requires the area kind. Saved flights preserve direction, position, speed and remaining range; saved areas preserve their own lifetime. The legacy `world.reveal` slot remains for existing diagnostic fixtures; Hawkshot no longer writes it.

The renderer uses a small authored bird silhouette with two wings. Wing phase derives from simulation time, so pausing does not flap the bird and restoring the same tick gives the same phase. This is a temporary readable flight proxy, **not the original particle effect or a visual-fidelity certification**. Source effect conversion, trail/arrival particles and audio remain required.

Four simulation cases cover fixed speed, collision exclusion, exact arrival/expiry, range clamping, self-targeting, team ownership, scouting versus attack-reveal queries, two concurrent flights, caster death and saved flight/endpoint continuation. Browser coverage checks visible flight, stationary paused pose, delayed distant-unit visibility, removal of the flight model, destination visibility and expiry; charge/reset coverage remains active.

## Remaining Hawkshot fidelity work

Verify and implement sight radius, lingering path vision, the source 0.25-second cast windup and its cancellation/movement rules, minimap targeting, independent rank allocation/haste, original animation, particles and audio. The current moving bubble can reveal the destination during approach before the projectile arrives; the separate five-second destination lifetime begins only at arrival. Complete spell parity remains unverified.
