# Frost Shot basic slow

Basic attack impacts from Ashe champion prototypes now apply a two-second slow that scales linearly from 20% at attacker level 1 to 30% at level 18. Previously every champion projectile applied a fixed 30% slow. Non-player prototypes currently use level one until independent progression is implemented. Structure targets do not receive the slow.

The complete standard passive record is pinned in `docs/reference/ashe-passive.json`. Its `SlowAmount` calculation uses `ByCharLevelInterpolationCalculationPart` with 0.2/0.3 endpoints; standard `SlowDuration` is two seconds. `tools/assets/export-ashe-passive.py` verifies the entire cached character source and selected record before exporting normalized values. The separate `cherry` duration override is not used. Source: [16.18 Ashe character data](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json).

The victim stores the applied `slowMultiplier` alongside the existing deadline. Snapshot version 10 requires that multiplier in [0, 1]. Movement and run playback use the existing shared movement-speed helper, which now reads the stored strength. An attacker leveling after impact does not change an already-applied slow. Respawn resets the field to the provisional generic slow default. Existing snapshots from earlier source versions are incompatible and remain subject to the documented save handling.

Impact-time level sampling and exact deadline ordering are implementation policies pending reference capture. Basic attacks alone use the new scaling. Volley/ultimate retain the prior 30% slow policy; critical/enhanced slows, decay, slow resistance, movement-speed soft caps and multiple-effect priority are unfinished. The current single slow slot replaces an earlier effect on a new application; it is not a complete crowd-control system. Passive bonus damage is also absent.

Three simulation cases cover early/mid/late levels, deadline duration, saved continuation after attacker leveling, exact expiry, and invalid snapshot strengths. A browser case checks level-one and level-18 speed ratios and expiry. These checks establish local behavior, not complete passive parity.
