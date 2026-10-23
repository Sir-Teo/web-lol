# Lux combat policy

Lux now has a champion-specific policy within the existing bot loop. It queues the same cast commands as input, with ordinary mana, cooldown, rank, windup and CC validation on execution. Saved queued decisions resume identically. This is a local policy designed for this simulator, not a reproduction of Riot's bots or a completed role AI.

Decisions use team-visible enemy champions, sorted by distance and stable identity. Hidden enemy health and position cannot select a combat cast. Q interception analysis also uses only visible enemy units; an unseen blocker can still stop the real projectile. Aim captures an observed position rather than tracking a target after sight loss.

The policy prioritizes an armed E recast when a visible enemy champion is inside the provisional zone boundary. Recast remains usable at zero mana while the original cooldown runs. It then considers W for a living allied champion below 55% health, within wand range, with less than half a fresh W shield and either a nearby visible enemy or an incoming visible targeted projectile. Self-shielding supplies a nonzero throw direction.

Outside retreat, R is a finishing spell: the estimate uses captured-current AP/rank damage, target magic resistance, health and active shields. It intentionally does not count a future passive proc or forecast a guaranteed hit during the one-second windup. Under turret danger, offensive cast planning yields to existing safety behavior.

Q targets a visible champion within range, or within 700 during retreat. The policy sorts visible swept contacts and casts only if the target is among the first two. If Q is unavailable or blocked, it may place E at a visible target within cast range, provided no E is active. Retreat can use W/Q/E but does not stop to cast a finishing R. Existing committed attack windups, recall and movement/tower logic remain relevant to when planning runs.

Skill order is E/Q/W/E/E/R initially, then R/E/Q/W subject to the ordinary level gates. Current purchases begin with Amplifying Tome and boots, then Sapphire/Mote toward Lost Chapter, followed by Rods toward Deathcap and Blasting Wand. Completed Chapter suppresses rebuying its consumed Tome. These are explicit policies in `src/content/lux-bot-policy.ts`, not source-exported recommendations. The item catalog still lacks a completed mage build; [Lost Chapter integration](LOST-CHAPTER.md) records the latest recipe path and its twenty-minute diagnostic.

Remaining work includes complete role and objective coordination, additional mage items and full builds, further wave-clear tools and wave management, leading moving targets, multi-target R evaluation, holding E for zone control or combinations, predicting threat/shield timing, and more complete escape behavior. The policy does not certify human-like decisions, native accuracy or full-match quality.

## Observed E wave clearing — October 22, 2026

Lux can now place E on a useful visible minion group and recast an armed zone on
remaining visible minions. Champion combat/shielding, retreat, committed attack
windups, recall and the existing team-defense travel priority run first. A ready
basic last hit also keeps priority over an ordinary new wave cast.

The pure planner receives copied visible minion positions, radii, health,
resistance, shields and the existing conservative allied-missile claim estimate.
It receives no World, opponent orders, hidden health or spawn calendars. Aim
candidates come from the 24 closest eligible minions, shared circle edges and
the normal cast boundary. An eight-unit aiming margin protects exact-edge
rounding; it does not change E’s actual source-linked range or provisional radius.
The queued point is copied and cannot track minions after sight is lost.

Ordinary placement requires at least three unclaimed minions, useful estimated
post-resistance damage of at least 1.25 times the spell’s raw damage, and enough
mana left for the larger of 30% maximum mana or the learned Q/W costs combined.
This avoids spending E on nearly dead groups, high-resistance targets or farm
already claimed by launched allied attacks. That claim estimate is shared with
basic last hits; it is not a full E-arrival or future-attack forecast.

Support preserves nearby carry farm. Observed pressure within 1,200 units plus
minion radius of a living allied inhibitor/Nexus permits an exception: two
minions, or one super minion, can justify a defensive E. The normal cast cost
still applies; only the reserve/farm/ready-last-hit restrictions are waived.
Emergency placement must still produce at least half one spell’s raw damage in
estimated useful damage. This policy targets no monsters or structures; jungle-role actors do not take ordinary lane farm.

An armed zone can recast at zero mana on a useful remaining minion, using the
damage captured by the original cast. It needs at least one quarter of that raw
damage in useful estimated damage. An airborne or already-requested zone waits.
These free recasts use existing cast validation and never restart the cooldown.

Wave casts can use allied minion cover under a turret; unsupported danger and
planned visible-champion splash under that turret remain excluded. Future
movement, unseen champions, later aggro and guaranteed hits are not predicted.
All scoring and thresholds are authored policy, not recovered native bot AI.

No spell damage, costs, cooldowns, geometry, camp/economy clocks or rewards were
changed. Schema 108’s layout is unchanged: queued points and ordinary E state
already preserve the decision. Earlier simulation fingerprints remain
incompatible under the same-build save policy.

The [wave-clear ledger](reference/lux-wave-clear-verification.json) records source
identity, preimage failures, both-team actual casts/kills/resources and exact
saved continuation, support farm/defense, hidden-input independence, priorities,
range/coverage and tower behavior. A real 5v5 browser scenario restores the queued
aim, observes the armed field, earns three normal caster kills and 42 gold, and
leaves the human’s orders unchanged. A second scenario checks the real support’s
ordinary carry farm and observed base-defense exception. That milestone's
captures used temporary E geometry. Current static layers and moving detonation
particles are documented in [Lux E](LUX-E.md); native composition remains unverified.

The first full-match wave-clear audit reached a Red victory for seed 26018 but
failed terminal checkpoint validation: Lux released a missile before a later
melee hit won on the same tick, leaving its birth frame without x/y/facing. Lux
and Gromp now capture the actual projectile position/direction at release.
Ordinary advancement replaces that same-tick frame; winning cancellation keeps
the complete birth pose without applying damage. Strict validation and schema
108 fields remain unchanged. The original failure and frozen-build reproduction
remain in the ledger; the QA runner now also retains nested error causes.

All 1,356 unit tests across 249 files and 31 targeted Chrome cases pass, including
14 new wave-clear simulation cases, two missile-birth regressions, real mid/support
browser decisions and an actual frozen winning-match download. Nested-path
production smoke passes. The full Chrome/performance suites and native visual
comparison remain open. Fresh full-match evidence and baseline comparisons are
in the [wave-clear audit](reference/lux-wave-match-audit.json).

Those four fresh runs finish at 50:03.383 (Red), 57:01.2 (Blue), 53:07.1 (Blue)
and 56:41.017 (Red) for seeds 26018, 719, 1 and 927. Every tick's health/mana and
finite-state checks pass (780,762 ticks), and 220 minute/terminal checkpoints
restore exactly. The birth-history repair preserves all four winners/ticks and
219 recorded pre-repair samples. These seeds now all finish within an hour,
versus three under the prior ruleset; four seeds do not meet the 100-seed gate
or establish general balance or native AI quality.

## Evidence

The original combat milestone passed 573 source/simulation checks. Seven Lux bot scenarios covered Q blockers versus E, threatened-ally shielding, zero-mana recast and saved continuation, R resistance/shield estimates, hidden enemies, self-shield retreat, and E-first learning/AP purchases. The browser encounter first placed an enemy inside actual fixture brush and verified no combat casts, then exposed it and observed automatic W/Q/E, ally shielding, binding, detonation and damage. Existing Ashe Volley/R browser scenarios also passed, alongside production build and nested-path smoke. The diagnostic screenshot was inspected.

`node tools/qa/simulate-rift.mjs 600 artifacts/rift-lux-simulation.json mixed` runs an older fixture of eight Ashe and two Lux across three lanes; that tool’s default fixture remains all Ashe. The current playable 5v5 roster and roles are described in [BOT-ROLES.md](BOT-ROLES.md). The historical ten-minute mixed run produced no finite/resource violations and its final checkpoint round-tripped exactly. Lux issued 33 initial E casts, 30 Q, 13 W and 2 R; recasts do not emit a separate cast event and are not counted here. Lux finished at levels 7 and 6, with 2 kills each and 3/5 deaths. The run did not reach Nexus victory. Headless wall time is not an FPS measure. Full reference/native comparison, full-match and render-performance gates remain open. [Pinned compact report](reference/lux-bot-verification.json) includes the base revision, changed-source hashes and original report hash.

## Mark-aware last hits

Lux's last-hit estimate now includes her own Illumination proc when its deadline exceeds the projected basic-attack impact. Physical attack damage and passive magic damage are mitigated separately; the passive uses the existing shared level/AP calculation also used by actual attacks and Final Spark. Marks from another Lux are excluded. A mark expiring before the estimate does not turn an otherwise nonlethal attack into a farming candidate.

The arrival estimate is shared with the launched-allied-missile policy: remaining attack recovery, current windup and missile travel against a stationary target. Its conservative deadline may miss a marginal valid proc; target movement, future stat changes and fresh shields are not predicted. This is authored bot behavior, not native AI parity. Existing close-threat priority, tower safety, committed windups and allied-missile exclusions remain in place.

Four simulation cases cover both teams' marked last hit and exact save continuation, foreign/expiring/magic-resistant exclusions, and a Tome purchase-state comparison in which current AP changes the selected target and produces a kill. Two team cases and the original AP fixture reproduced the missing selection before implementation. The AP fixture was then corrected to account for the practice caster's 30 MR and now verifies a controlled without-Tome comparison. A browser case obtains the mark through a real Q, observes selection, and verifies one consumed mark and CS gain from the attack. All 612 simulation checks, three focused farming browser cases and production smoke pass. The practice-scene capture was inspected; native passive particles and full champion presentation are not certified by it.

That passive-last-hit milestone kept schema 48. Current schema 108 remains
unchanged by wave clearing; the changed simulation fingerprint retains the
existing same-build checkpoint restriction.
