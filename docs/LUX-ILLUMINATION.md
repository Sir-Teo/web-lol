# Lux Illumination

## Evidence

`reference/lux-illumination.json` retains all three passive ability/spell records from the same hash-verified 16.18 response as Lux's champion stats. The standard-mode parent has `DebuffDuration = 6` and `APRatio = 0.35`; the Arena override is 0.5 and is not used. Its `ByCharLevelFormulaCalculationPart` contains a level-zero entry of 20, followed by 30 through 200 for levels 1–18. Indexing that array as a zero-based playable-level list would understate every level by ten. [Pinned character data](https://raw.communitydragon.org/16.18/game/data/characters/lux/lux.bin.json)

Riot describes damaging spells charging a target and Lux's next attack igniting that energy for bonus magic damage. Its 13.17 notes independently establish the 30–200 level endpoints, but their older AP ratio is not the current source value. [Champion description](https://www.leagueoflegends.com/en-gb/champions/lux/), [13.17 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-13-17-notes/)

## Implementation

A surviving enemy hit by Lux Q receives a mark with source ID and a six-second deadline. A subsequent Q refreshes that owner's deadline instead of stacking or detonating it. Allies and structures are excluded. The existing generic binding diagnostic can still use Ashe as its caster; that does not apply Illumination.

Lux's basic attack checks the mark at impact, removes it once and deals ordinary physical attack damage followed by separately mitigated magic passive damage if the victim survives. Passive damage samples Lux's level and AP at impact. An already committed attack can trigger after caster death. Another champion's attack cannot consume the mark. Multiple Lux actors have independent marks; this is an explicit local ownership policy pending native duplicate-champion comparison.

Expiry occurs before combat on the deadline tick. Target death clears every mark; caster death preserves marks on other targets. Marks neither grant sight nor change targeting eligibility. Health bars show `ILLUMINATED` once higher-priority protected/stun/root/slow statuses are absent, using the existing visibility boundary.

Snapshot 38 requires a mark list on every unit and validates distinct enemy Lux owners, living nonstructure victims and deadlines strictly after the current tick but no more than six seconds ahead. It supports saving during both the mark lifetime and a basic attack's flight.

## Validation and remaining work

All 533 source/simulation checks pass. Seven new cases cover level 1/18 mixed damage and repeat attacks, Q refresh, exact saved continuation, expiry on the impact tick, owner isolation/caster death/target respawn, and malformed snapshots. Three focused Chrome cases cover binding, the Lux rig/cast/recall and Q → mark readout → attack consumption. Production build and nested-path smoke pass.

The native mark/trigger particles, passive attack animation selection and any special attack projectile behavior are unfinished. The child spell's older-looking missile metadata is retained without replacing the independently pinned basic attack. Impact-time AP sampling, component ordering, duplicate-Lux ownership and native visual timing remain comparison targets. R now consumes and refreshes marks (`LUX-R.md`); E application, spell shields, cleanse and other unimplemented systems still need integration; this milestone does not complete Lux's kit. No full browser, full-match or performance rerun was performed.
