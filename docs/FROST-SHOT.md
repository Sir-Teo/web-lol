# Frost Shot basic slow

Basic attack impacts from Ashe champion prototypes now apply a two-second slow that scales linearly from 20% at attacker level 1 to 30% at level 18. Previously every champion projectile applied a fixed 30% slow. Non-player prototypes currently use level one until independent progression is implemented. Structure targets do not receive the slow.

The complete standard passive record is pinned in `docs/reference/ashe-passive.json`. Its `SlowAmount` calculation uses `ByCharLevelInterpolationCalculationPart` with 0.2/0.3 endpoints; standard `SlowDuration` is two seconds. `tools/assets/export-ashe-passive.py` verifies the entire cached character source and selected record before exporting normalized values. The separate `cherry` duration override is not used. Source: [16.18 Ashe character data](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json).

The victim stores the applied `slowMultiplier` alongside the existing deadline. Snapshot version 15 requires that multiplier in [0, 1]. Movement and run playback use the existing shared movement-speed helper, which now reads the stored strength. An attacker leveling after impact does not change an already-applied slow. Respawn resets the field to the provisional generic slow default. Existing snapshots from earlier source versions are incompatible and remain subject to the documented save handling.

Impact-time level sampling and exact deadline ordering are implementation policies pending reference capture. Basic attacks and Volley use level scaling, with Volley's enhanced champion slow described below. The primary ultimate target retains the prior 30% slow policy; critical basic attacks, slow resistance, movement-speed soft caps and general multiple-effect priority are unfinished. The current single slow slot replaces an earlier effect on a new application; it is not a complete crowd-control system. Passive bonus damage is also absent.

Three simulation cases cover early/mid/late levels, deadline duration, saved continuation after attacker leveling, exact expiry, and invalid snapshot strengths. A browser case checks level-one and level-18 speed ratios and expiry. These checks establish local behavior, not complete passive parity.

## Volley's enhanced champion slow

Volley now applies the pinned `EmpoweredSlowAmount` (40–60% by attacker level) to champion targets, decaying linearly to the ordinary 20–30% strength over one second. The basic slow remains until the two-second deadline. Non-champion targets receive ordinary level-scaled Frost instead of the old flat 30% Volley slow.

The pin also retains and verifies current passive tooltip text describing a decaying enhanced slow and legacy Volley tooltip text identifying champion hits as critical for Frost Shot. Those texts establish enhancement/decay intent, not its exact timeline. The one-second linear window remains an explicit implementation policy pending a controlled reference capture; it is not a numeric field found by the exporter. The ordinary and enhanced endpoint strengths come directly from the standard passive calculations.

Each unit now has a nullable `criticalSlow` component with start/end ticks and start/end speed multipliers. The movement helper takes the stronger of ordinary Frost and the current interpolated component. A later basic attack therefore refreshes ordinary Frost without erasing the enhanced component. Respawn clears the component. Snapshot version 15 validates and persists it, rejecting reversed time/strength bounds. This is not a general multi-source slow-priority system: ordinary effects can still overwrite one another, and critical basic attacks, slow resistance, movement caps and reapplication priority across different strengths remain unfinished.

Three simulation cases cover both level endpoints, halfway decay, normal-strength tail, exact expiry, saved continuation, a subsequent basic hit and invalid saves. A browser case confirms the corresponding speed ratios while updating presentation.


## Passive damage research checkpoint

The pinned standard 16.18 `DamageBonus` calculation begins with **1.0**, plus a crit-stat-dependent term; it does not contain the older unconditional 1.1/1.2 coefficient. The current tooltip describes attack damage without requiring an already-Frosted victim. With zero critical-strike chance, this calculation contributes no extra attack damage. Do not add an old flat amplification or invent a Frost marker requirement from historical descriptions. The runtime currently has no crit-granting item or crit stat, so the missing damage work belongs with that system. Exact stat interpretation, item interactions, structure exclusions and release/impact sampling still require verification. [Pinned character data](https://raw.communitydragon.org/16.18/game/data/characters/ashe/ashe.bin.json)
