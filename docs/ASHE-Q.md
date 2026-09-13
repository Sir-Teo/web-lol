# Ashe Q fidelity

The prototype's Ranger's Focus active duration now uses six seconds from the standard Ashe spell record in pinned 16.18 character data. The tooltip derives its duration from the same generated constant. This corrects the previous four-second active window. [Riot's patch 13.5 notes](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-13-5-notes/) explicitly increased the empowered duration from four to six seconds, corroborating the current source's `BuffDuration` data value.

The complete selected spell record is retained in `docs/reference/ashe-q.json`, with source URL and SHA-256. `python3 tools/assets/export-ashe-q.py` verifies the cached whole source and selected record before exporting the rank-independent duration. Rank-dependent attack speed and damage values and missile behavior remain available in that pin for subsequent work. Stack duration/falloff are now applied as described below.

Casting schedules an absolute deadline 360 simulation ticks later. Active attack-speed evaluation and the HUD already use a strict deadline comparison, so the buff ends on that exact tick. Existing attacks retain their scheduled cycles across expiry. Saves retain the original deadline, and death clears the active buff through the existing cleanup path.

The prototype still lacks spell ranks and the complete five-arrow damage/animation behavior, and requires reference calibration of attack-event timing. These remain fidelity gaps. Six-second duration alone does not establish complete Q parity.

One simulation test casts Q, verifies it remains active after four seconds and immediately before expiry, and compares saved continuation through the exact deadline. One browser test verifies the corresponding empowered HUD state. Existing attack-cycle and death-cleanup regressions remain relevant.

## Focus decay and active-window exclusion

The exporter now verifies the string-table source and selected legacy `game_spell_tooltip_asheq` alongside the complete spell record. The tooltip explicitly describes individual stack falloff and no Focus accumulation during Q. This is retained legacy text, not independently captured runtime evidence. Current spell `DataValues` supply four-second `StackDuration`, one-second `StackFalloffDuration`, and four `MaxStacks`.

The implementation removes the first stack at the four-second deadline and one additional stack each second thereafter. The existing `qStackExpiry` field now stores the next decay deadline; after the final stack it resets to zero. A new eligible released attack adds a stack up to the cap and refreshes the full four-second window. Active Q blocks new Focus, and casting clears the old stack deadline. Death cleanup remains unchanged. No additional snapshot field is required; source-version matching handles saves from older implementations.

Exact first-falloff timing and same-tick attack/expiry ordering remain authored policy pending reference capture. The simulation processes attack release before decay, so a release on the expiration tick refreshes the window. Target restrictions and complete Q rank/flurry behavior require further work.

Three additional simulation cases cover individual decay, saved continuation, impact refresh, and active-window damage without stacks. A browser case verifies the pips falling from four to three to two rather than disappearing together.

## Focus at attack release

Focus generation now runs at the successful attack-release event, before creating the arrow, rather than on projectile contact. This makes readiness independent of travel distance and lets the fourth released attack unlock Q while its arrow is still traveling. Canceled windups, dead/invalid targets before release, stun interruption and death before release grant no stack. Impact never grants or refreshes Focus; an arrow fired during active Q cannot grant a delayed stack merely because it lands after the active window ends.

The pinned tooltip establishes attacks granting Focus, but does not encode the precise event callback. Mapping that behavior to successful release is an implementation interpretation pending controlled capture, not a claim that the static record contains server script logic. The current target eligibility follows the existing attack system; specialized blind/dodge/projectile destruction and target-class cases are not fully implemented.

Three new simulation cases cover release before impact, no duplicate/refresh on impact, saved arrows, canceled/invalidated windups, and casting Q after the fourth release before contact. A browser case checks four visible pips with an arrow in flight and an undamaged target. Existing active-Q and death tests remain green.

## Additive rank-one attack speed

The source exporter now retains all five normal-rank `BonusAS` values (20/30/40/50/60%) and verifies the character root's `attackSpeedRatioModifiable` field, normalized to 0.658. The current prototype uses rank one until skill-point allocation is implemented. Q therefore adds 0.658 × 0.20 = 0.1316 attacks/second to the existing baseline, rather than multiplying the entire baseline by 1.4. The HUD calls the same effective-speed calculation as combat. Other champion prototypes do not inherit the player's buff.

The existing baseline remains represented by integer attack-period ticks, so this change does not remove baseline quantization or implement the full attack-speed stat/cap system. The helper converts the additive amount to a scheduling multiplier, then existing cycle creation rounds the period and windup. Scheduled cycles remain immutable across buff expiry. At level one this schedules a 76-tick cycle; at level 18 a 53-tick cycle. Full spell ranks, attack-reset behavior, cap interactions, and flurry damage still require implementation and reference testing.

A new simulation case checks equal absolute speed gain across early and late levels and the resulting scheduled cycles. Existing saved-duration and animation-cycle tests use the corrected values. The Q browser case now verifies the HUD changes from 0.79 while active to 0.66 on expiry.

## Empowered aggregate damage

The exporter now emits the five normal-rank `DamagePerStrike` values, normalized to six decimals. The pinned `EmpoweredDamage` calculation combines this value with attack damage. Rank one therefore captures 110% of the attacker's AD at release. The arrow stores that amount in its existing damage field, so later Q activation/expiry, AD changes or source death do not alter it. Physical resistance remains sampled at impact through the normal attack damage path. This does not change non-player champion or minion attacks.

This is **aggregate damage**, not the completed flurry: the renderer and simulation still represent one arrow and one damage application. Five-arrow sequencing, individual mitigations, per-hit interactions, passive Frost Shot amplification, attack reset and rank allocation remain unfinished. This intermediate change establishes the source-backed total coefficient without claiming full Q combat parity.

Three simulation cases compare normal/empowered attacks against armor, preserve empowered damage through expiry/AD changes/death and saved continuation, and ensure activating Q after release does not retroactively empower an arrow. A browser case casts Q and checks damage after expiry in flight.

## Attack projectile speed and remaining flurry research

`docs/reference/ashe-attack-projectiles.json` pins the complete ordinary attack, alternate ordinary attack, Q attack and Q no-on-hit attack records. All four select fixed-speed movement at 2,500 units/second. `python3 tools/assets/export-ashe-projectiles.py` verifies the cached character source hash, each selected record, movement type and agreement before generating the shared speed constant. Champion prototypes, which currently all use Ashe's stats, now use this speed instead of the provisional 2,000. Other units retain their own projectile rules. Speed is captured in each projectile and preserved through checkpoints.

The records specify a right-hand start bone and target-height offsets. The Q records also expose distinct on-hit/no-on-hit spell identities and the `Ashe_Q_mis` effect key. They do not encode an inter-arrow launch delay in the selected missile specifications. These facts alone are insufficient to implement the complete five-arrow sequence, animation/event binding or damage classifications. Those remain research/implementation work; the current aggregate Q representation remains explicit.

A simulation case checks ordinary and empowered arrows moving exactly 2,500/60 units on their first flight tick, impact timing from the current collision geometry, and identical saved continuation. These are local simulation guarantees, not proof of reference collision-radius parity.
