# Historical combined roster: one hundred natural victories

The frozen `abc8dc…` development roster completes all 100 requested seeds in
natural, structurally valid victories within the 60-minute simulation horizon.
There are no accepted failures or unfinished games. Independent verification
passes **14,858,652 checked ticks, 4,183 exact save round-trips and 4,083
restored-future comparisons covering 244,834 ticks**.

Each team has five positions. The combined profile contains two Garen, two
Master Yi, two Ashe, two Leona, one Ahri and one Lux across both teams. QA
automation controls the human Lux mid for these headless runs; production
player control remains manual. The seeds include the controller's selected
ordinary seeds and three uint32 boundary cases.

| Simulation duration | Time |
| --- | ---: |
| Shortest | 26:04.317 |
| P50 | 41:09.833 |
| P95 | 48:16.150 |
| Longest | 52:39.667 |

Quantiles use the canonical controller's nearest-rank definition. Blue wins 49
games and Red wins 51 in this fixed seeded profile. These counts do not establish
balance or predict human games. No clock, economy, damage or victory rule forces
a winner at the diagnostic horizon.

The independent check verifies archived sources, runner/maps, reports,
checkpoint/final hashes, role composition, resource invariants, protected
structure dependencies, legal victory and terminal freezing. The
`hundredSeedDevelopmentRosterInvariantGate` passes. The public ordinary,
Leona-only and complete-roadmap flags remain false.

These are historical results from the exact checkout at
`/workspace/web-lol-ally-intent`. They do not certify a hundred games on the
newer `5a5379…` fingerprint or complete native fidelity. Completed results were
retained across interruptions; partial attempts were archived and interrupted
seeds restarted from tick zero. Quiet validation pauses were recorded and
resumed. There is no uninterrupted-execution or wall-time performance claim.

The [verification ledger](reference/combined-hundred-abc8dc-verification.json)
pins the original plan/summary, all 100 accepted reports, independent check,
duration CSV and recovery records. The two historical Leona/Lux full-unit
failures remain open in the current build.
