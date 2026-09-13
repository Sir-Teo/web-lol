# Summoner Heal

The selected 16.18 `Shared/Spells/SummonerHeal` record is pinned in [summoner-heal.json](reference/summoner-heal.json). Its level-interpolation calculation runs from 80 to 318 health, its cooldown is 240 seconds, and its movement-speed data specifies 30% for one second. `canCastWhileDisabled` and `mDoesntBreakChannels` are both true. `tools/assets/export-summoner-heal.py` verifies the complete cached source SHA and selected record before generating the supported runtime fields.

The current self-cast implementation heals `80 + 14 * (level - 1)` through level 18, capped by missing health. It grants the one-second speed effect and starts the 240-second cooldown even if little health is missing. Its explicit disabled-cast permission bypasses the existing stun command filter; ordinary orders and other implemented spells still obey that filter. It cannot revive a dead player or change a completed match. The speed effect does not remove stun or permit movement during it.

Heal no longer cancels recall. Cooldown, missing-health state, recall deadline, and speed expiry survive checkpoint restoration. The existing attack order and attack timing are unaffected by the self-cast.

Four simulation scenarios verify level totals, missing-health clamp, stun exceptions, restrictions on other spells, recall preservation, cooldown rejection, restored continuation, death, and victory. Browser input verifies F heals during stun and displays cooldown while Volley remains unavailable; existing movement-speed and attack-cycle browser checks are also run.

This is not the full spell. The same source contains ally range 900, cursor forgiveness 200, a repeated-Heal multiplier of 0.5, and a 30-second debuff duration. Ally selection, ally healing/haste, healing modifiers, and exact targeting/refresh semantics remain unimplemented. Other crowd-control types are not represented by this stun-only exception. Exact presentation, input buffering, and additional channel interactions still require reference-client comparison.


## Repeated Heal reduction

The pinned `StackingHealDebuff = 0.5` and `DebuffDuration = 30` now drive a recipient-specific `summonerHealReductionUntil` timestamp. While that deadline is strictly greater than the cast tick, Heal's nominal amount is multiplied by 0.5 before clamping to missing health. Each accepted Heal refreshes the deadline to 30 seconds from the current cast, including casts at full health. The multiplier does not compound with repeated casts, and does not alter ordinary regeneration or the movement-speed burst. Rejected casts do not refresh it.

Expiry is evaluated at the exact simulation tick: a Heal at the deadline is full strength. The deadline is retained across death/respawn until it expires, and snapshot version 7 validates and preserves it. Refresh-on-receipt, full-health application, death persistence, and exact boundary behavior are runtime policies pending matched reference comparison; the source explicitly establishes the amount and duration. There is no additional cleanse/removal system yet.

Three additional simulation cases cover repeated casts, expiry, clamping order, unchanged regeneration, saved continuation, and malformed saved deadlines. The browser resets cooldowns through the actual practice panel and casts F again while stunned, verifying the reduced heal and renewed cooldown. This makes the effect testable before ally casts and independent bot spell inventories are implemented.
