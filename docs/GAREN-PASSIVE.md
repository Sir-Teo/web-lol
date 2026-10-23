# Garen — Perseverance

Perseverance now contributes maximum-health regeneration to Garen without requiring a skill point, including the development player fixture. `tools/assets/export-garen-passive.py` reads the frozen classic-mode `GarenPassive` record in `reference/garen-character.json`, checks the supported calculation shape and exports all 18 level values to `src/content/garen-passive.ts`. The Arena timer override is not used.

The source curve starts at 1.5%, grows by 0.2 percentage points per level through level 6, by 0.8 at levels 7–13, and by 0.4 at levels 14–18. Its 1.5–10.1% range is expressed per five seconds, as documented in Riot's [9.20 patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-20-notes/). The pinned interruption timer is eight seconds, consistent with the change in Riot's [10.7 patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-7-notes/). The older seven-second value from 9.20 is not used.

| Level | Maximum health per five seconds |
| --- | --- |
| 1 | 1.5% |
| 6 | 2.5% |
| 7 | 3.3% |
| 13 | 8.1% |
| 14 | 8.5% |
| 18 | 10.1% |

The runtime applies that average rate each local simulation tick, alongside ordinary regeneration, and clamps at maximum health. At level one with 690 maximum HP, the passive adds 2.07 HP/second to the existing 1.6 HP/second. At level 18 with 2356 maximum HP, it adds 47.5912 HP/second. Fountain recovery also retains the passive contribution. Continuous 60 Hz accrual follows the existing regeneration adapter; native healing-pulse cadence has not been matched.

## Interruption and lifecycle

An independent `garenPassiveReadyTick` deadline is refreshed by positive enemy champion/turret damage, including damage absorbed by a shield. Lane-minion damage does not interrupt it. Supported hostile slow applications and Light Binding contacts also interrupt it, including a zero-damage binding. Rejected/allied effects do not refresh the deadline. Damage processing precedes regeneration, so a qualifying hit on the exact recovery tick postpones healing again.

This is the current supported-roster policy. The classic source and historical patch notes identify champion/turret/epic-monster interruption and distinguish minions, but the complete native event handler is not present in the BIN. Exact shield/event exceptions need native comparison. Epic monsters, hostile summoners beyond the current roster, pets and future ability contacts must be integrated when those systems exist.

The timer belongs to Garen rather than the attacker, so a removed turret cannot make it disappear. Death clears it and stops healing; respawn restores readiness. These lifecycle choices are explicit adapter policies. No passive event or healing sound is emitted each tick. The development fixture now adds the source [recovery sparks](GAREN-PASSIVE-PARTICLES.md) and saved emission intervals. The [source recovery audio](GAREN-P-AUDIO.md) now adds activation and sustained phases. The source boost trail, passive buff icon and native comparison remain open.

## Checkpoints and verification

Snapshot version 70 requires the timer. Non-Garen owners and dead owners must have zero; active deadlines cannot exceed one source interruption interval beyond the snapshot tick. Ordinary past deadlines remain valid. Mid-interruption restoration continues identically through the recovery boundary.

Eight focused simulation cases verify curve breakpoints, rate units, maximum-health scaling/capping, repeated hits, shielded hits, turret versus minion damage, non-damaging ability contacts, timer restoration after turret removal, death/respawn and malformed saves. The browser scenario verifies the last interrupted tick, first recovery increment, visible health-bar growth, and identical continuation from a checkpoint. Garen's existing Q and base-melee browser scenarios remain part of the regression check.

An impact scheduled on the exact ready tick is also tested through the real projectile loop; it refreshes interruption before the regeneration phase. Browser captures wait for the earlier damage number to finish, so it cannot appear misleadingly during later recovery.

Validation: all 848 tests across 182 files pass. The passive, Q and base-melee browser scenarios pass; the passive capture was rechecked after removing stale damage-text timing from the fixture. Both health-bar captures were visually reviewed. Production build and nested static-hosting smoke pass with 17 source recordings and real Ashe/Lux casts. The existing bundle-size warning remains.
