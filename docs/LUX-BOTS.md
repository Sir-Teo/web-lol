# Lux combat policy

Lux now has a champion-specific policy within the existing bot loop. It queues the same cast commands as input, with ordinary mana, cooldown, rank, windup and CC validation on execution. Saved queued decisions resume identically. This is a local policy designed for this simulator, not a reproduction of Riot's bots or a completed role AI.

Decisions use team-visible enemy champions, sorted by distance and stable identity. Hidden enemy health and position cannot select a combat cast. Q interception analysis also uses only visible enemy units; an unseen blocker can still stop the real projectile. Aim captures an observed position rather than tracking a target after sight loss.

The policy prioritizes an armed E recast when a visible enemy champion is inside the provisional zone boundary. Recast remains usable at zero mana while the original cooldown runs. It then considers W for a living allied champion below 55% health, within wand range, with less than half a fresh W shield and either a nearby visible enemy or an incoming visible targeted projectile. Self-shielding supplies a nonzero throw direction.

Outside retreat, R is a finishing spell: the estimate uses captured-current AP/rank damage, target magic resistance, health and active shields. It intentionally does not count a future passive proc or forecast a guaranteed hit during the one-second windup. Under turret danger, offensive cast planning yields to existing safety behavior.

Q targets a visible champion within range, or within 700 during retreat. The policy sorts visible swept contacts and casts only if the target is among the first two. If Q is unavailable or blocked, it may place E at a visible target within cast range, provided no E is active. Retreat can use W/Q/E but does not stop to cast a finishing R. Existing committed attack windups, recall and movement/tower logic remain relevant to when planning runs.

Skill order is E/Q/W/E/E/R initially, then R/E/Q/W subject to the ordinary level gates. Current purchases are one Amplifying Tome and boots. These are explicit policies in `src/content/lux-bot-policy.ts`, not source-exported recommendations. The item catalog lacks a completed mage build; the diagnostic demonstrates accumulated unused gold after these purchases.

Remaining work includes role and objective coordination, AP item recipes/builds, wave-clear decisions, leading moving targets, multi-target R evaluation, holding E for zone control or combinations, predicting threat/shield timing, and more complete escape behavior. The policy does not certify human-like decisions, native accuracy or full-match quality.

## Evidence

573 source/simulation checks pass. Seven Lux bot scenarios cover Q blockers versus E, threatened-ally shielding, zero-mana recast and saved continuation, R resistance/shield estimates, hidden enemies, self-shield retreat, and E-first learning/AP purchases. The browser encounter first places an enemy inside actual fixture brush and verifies no combat casts, then exposes it and observes automatic W/Q/E, ally shielding, binding, detonation and damage. Existing Ashe Volley/R browser scenarios also pass. Production build and nested-path smoke pass. The diagnostic screenshot was inspected.

`node tools/qa/simulate-rift.mjs 600 artifacts/rift-lux-simulation.json mixed` runs eight Ashe and two Lux across three lanes. The default roster remains all Ashe. The ten-minute mixed run produced no finite/resource violations and its final checkpoint round-tripped exactly. Lux issued 33 initial E casts, 30 Q, 13 W and 2 R; recasts do not emit a separate cast event and are not counted here. Lux finished at levels 7 and 6, with 2 kills each and 3/5 deaths. The run did not reach Nexus victory. Headless wall time is not an FPS measure. Full reference/native comparison, full-match and render-performance gates remain open. [Pinned compact report](reference/lux-bot-verification.json) includes the base revision, changed-source hashes and original report hash.
