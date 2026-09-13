# Summoner Heal

The selected 16.18 `Shared/Spells/SummonerHeal` record is pinned in [summoner-heal.json](reference/summoner-heal.json). Its level-interpolation calculation runs from 80 to 318 health, its cooldown is 240 seconds, and its movement-speed data specifies 30% for one second. `canCastWhileDisabled` and `mDoesntBreakChannels` are both true. `tools/assets/export-summoner-heal.py` verifies the complete cached source SHA and selected record before generating the supported runtime fields.

Each cast heals the caster and up to one eligible allied champion for `80 + 14 * (level - 1)` using the caster’s level through level 18, capped separately by each recipient’s missing health. It grants the one-second speed effect and starts the 240-second cooldown even if little health is missing. Its explicit disabled-cast permission bypasses the existing stun command filter; ordinary orders and other implemented spells still obey that filter. It cannot revive a dead player or change a completed match. The speed effect does not remove stun or permit movement during it.

Heal no longer cancels recall. Cooldown, missing-health state, recall deadline, and speed expiry survive checkpoint restoration. The existing attack order and attack timing are unaffected by the self-cast.

Four simulation scenarios verify level totals, missing-health clamp, stun exceptions, restrictions on other spells, recall preservation, cooldown rejection, restored continuation, death, and victory. Browser input verifies F heals during stun and displays cooldown while Volley remains unavailable; existing movement-speed and attack-cycle browser checks are also run.

This is not the full spell. The same source contains ally range 900, cursor forgiveness 200, a repeated-Heal multiplier of 0.5, and a 30-second debuff duration. Healing modifiers and other crowd-control types remain unimplemented; exact targeting/refresh semantics remain unverified. Other crowd-control types are not represented by this stun-only exception. Exact presentation, input buffering, and additional channel interactions still require reference-client comparison.


## Repeated Heal reduction

The pinned `StackingHealDebuff = 0.5` and `DebuffDuration = 30` now drive a recipient-specific `summonerHealReductionUntil` timestamp. While that deadline is strictly greater than the cast tick, Heal's nominal amount is multiplied by 0.5 before clamping to missing health. Each accepted Heal refreshes the deadline to 30 seconds from the current cast, including casts at full health. The multiplier does not compound with repeated casts, and does not alter ordinary regeneration or the movement-speed burst. Rejected casts do not refresh it.

Expiry is evaluated at the exact simulation tick: a Heal at the deadline is full strength. The deadline is retained across death/respawn until it expires, and snapshot version 8 validates and preserves it. Refresh-on-receipt, full-health application, death persistence, and exact boundary behavior are runtime policies pending matched reference comparison; the source explicitly establishes the amount and duration. There is no additional cleanse/removal system yet.

Three additional simulation cases cover repeated casts, expiry, clamping order, unchanged regeneration, saved continuation, and malformed saved deadlines. The browser resets cooldowns through the actual practice panel and casts F again while stunned, verifying the reduced heal and renewed cooldown. This makes the effect testable while independent bot spell inventories remain unimplemented.


## Allied champion selection and haste

The source tooltip, now retained and verified with its string-table SHA, specifies healing the caster plus a target allied champion and falling back to the most wounded allied champion in range. Source values `AllyRange = 900` and `CursorForgiveness = 200` are exported.

Runtime selection considers living allied champions other than the caster within 900 center-to-center units. A cursor within 200 units of an eligible ally selects the closest such ally, breaking equal-distance ties by ID. Otherwise, choose the lowest current/max-health fraction, then the closest to the caster, then the lowest ID. A self-target point (including clicking the HUD spell button) uses the fallback. Enemies, dead allies, and non-champions cannot consume the allied recipient slot. If nobody qualifies, the caster still receives Heal.

The F key passes the picked unit’s coordinates or the ground cursor location. Both recipients receive independent healing reduction deadlines and one-second `summonerHealSpeedUntil` deadlines. Movement and run playback read each unit’s own haste; snapshot version 8 removes the old player-only speed deadline in favor of these unit fields. Moving away after receiving Heal does not remove its timed effects.

Center-distance boundaries, interpreting “most wounded” as lowest health percentage, cursor-distance ranking, self-target handling, and tie-breaking are explicit runtime policies pending reference-client comparison. The source establishes range/tolerance values and fallback intent, but not every selection detail. Walls do not add a line-of-sight requirement in this implementation.

Five added simulation cases cover cursor preference, fallback percentage, range/tolerance boundaries, excluded recipients, independent reduction, caster-level scaling, speed expiry, and saved continuation. A browser case hovers the healthier ally and presses F, verifying that ally receives healing and haste while the more wounded ally does not. Existing Heal, save, and run-speed checks remain in the affected test set.
