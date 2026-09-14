# Local group-combat decisions

September 14, 2026. This is our bot policy, not recovered native AI.

Bots now assess living, team-visible champions before starting another attack or offensive spell. When at least two opponents within 1,000 units substantially outweigh the bot and allies within 850 units, the bot looks for tactical space. Strength uses remaining health fraction and basic-attack damage/period; it does not inspect hidden cooldowns or enemy orders. The current threshold is 1.55 times friendly strength. These are explicit tuning choices, not measured League parameters.

Sixteen candidate directions are checked for at least 80 units of additional clearance from the nearest enemy over a 300-unit move. Candidates must have direct navigation clearance and avoid threatening enemy towers. Scoring favors enemy separation with a small homeward preference. Considering all visible threats prevents escaping one opponent directly into another. If no safe improving move exists, normal combat policy remains available.

This does not set the low-health fountain-retreat flag. A bot can resume combat when allies arrive, enemies weaken, or the numerical advantage disappears. Existing low-health retreat and tower danger still take priority. A committed valid attack windup remains protected; Lux shielding/peel and Ashe defensive ultimate decisions remain available before the tactical move.

The planner accepts only observed combatants rather than the World object. The caller filters sight before passing opponent data. No new saved state is required: movement orders and existing think timers retain deterministic continuation.

Validation: all 819 tests across 178 files pass, including healthy outnumbered fights, ally reinforcement, weak opponents, flanking enemies, blocked routes, hidden enemies and snapshot continuation. Five distinct focused browser cases passed across group combat, kiting, Lux spell decisions and tower safety. The tower target-choice fixture now excludes its unrelated sparring opponent so that it tests tower-safe selection independently from group disengagement. The group-combat screenshot was visually reviewed. Production build and nested static-path smoke passed, including 17 audio recordings and real Hawkshot/Light Binding casts.

This is a tactical improvement, not complete team strategy. Objective planning, jungle roles, evaluating spell burst, ally commitment/reachability, minion pressure and calibrated difficulty remain future work. Full seeded match quality and performance have not been certified by these focused cases.
