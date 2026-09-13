# Summoner Heal

The selected 16.18 `Shared/Spells/SummonerHeal` record is pinned in [summoner-heal.json](reference/summoner-heal.json). Its level-interpolation calculation runs from 80 to 318 health, its cooldown is 240 seconds, and its movement-speed data specifies 30% for one second. `canCastWhileDisabled` and `mDoesntBreakChannels` are both true. `tools/assets/export-summoner-heal.py` verifies the complete cached source SHA and selected record before generating the supported runtime fields.

The current self-cast implementation heals `80 + 14 * (level - 1)` through level 18, capped by missing health. It grants the one-second speed effect and starts the 240-second cooldown even if little health is missing. Its explicit disabled-cast permission bypasses the existing stun command filter; ordinary orders and other implemented spells still obey that filter. It cannot revive a dead player or change a completed match. The speed effect does not remove stun or permit movement during it.

Heal no longer cancels recall. Cooldown, missing-health state, recall deadline, and speed expiry survive checkpoint restoration. The existing attack order and attack timing are unaffected by the self-cast.

Four simulation scenarios verify level totals, missing-health clamp, stun exceptions, restrictions on other spells, recall preservation, cooldown rejection, restored continuation, death, and victory. Browser input verifies F heals during stun and displays cooldown while Volley remains unavailable; existing movement-speed and attack-cycle browser checks are also run.

This is not the full spell. The same source contains ally range 900, cursor forgiveness 200, a repeated-Heal multiplier of 0.5, and a 30-second debuff duration. Ally selection, ally healing/haste, repeated-Heal reduction, healing modifiers, and exact targeting/refresh semantics remain unimplemented. Other crowd-control types are not represented by this stun-only exception. Exact presentation, input buffering, and additional channel interactions still require reference-client comparison.
