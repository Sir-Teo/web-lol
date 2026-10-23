# Completed normal-rules baseline and jungle approach

The corrected baseline executed all 100 fixed seeds under commit `5d06c6d`,
schema **113** and ruleset
`6466566e3a12e041128f2bafd34800b81ed798b61726c387cc7cfdc8b2003c57`.
Independent verification passed before subsequent source changes. All owned
workers exited. The earlier failed eight-seed run remains separate; its results
were not combined with this corpus.

| Measurement | Result |
| --- | ---: |
| Executed seeds | 100 |
| Victories | 70: 43 Blue, 27 Red |
| Unfinished at the 60-minute horizon | 30 |
| Infrastructure or invariant failures | 0 |
| Checked simulation ticks | 19,960,310 |
| Strict saved-state round trips | 5,578 |
| Original/restored future comparisons | 5,478 |

This passes the initial hundred-seed invariant gate for the interim roster:
six Ashe/four Lux, five roles per team, and the normally human carry automated
only for QA. It does not complete the six-champion milestone, establish balance,
or certify full-length human play, native fidelity or the browser/performance
matrix. The seed population is an explicit regression set, not an independent
random sample for general win-rate estimates.

## Duration and unfinished-match findings

Among the **70 victories only**, duration ranged from **40:28.4 to 59:57.3**.
The median was **53:59.8**, the 10th percentile **47:06.4**, and the 90th
percentile **57:51.6**. Percentiles select the sorted value at
`floor((count - 1) * p)`. All 30 unfinished cases remain right-censored at
60 minutes. They are not dropped from a claimed overall duration estimate.
No match ended by 40 minutes; the design's provisional 25–40 minute planning
window is not a verified native average or a forced timer.

All 30 unfinished cases had additional champion deaths and building-destruction
events in their final ten minutes. These observations do not prove permanent
stalemates or continuous progress. Seeds **8, 42, 54 and 63** had an exposed enemy
Nexus at the horizon in full offline state. That state was available to the
analyst, not supplied to bots. A separate passive replay of seed 8 showed that
the next Red team decision could not see that Nexus and had no actor passing
the local push filters. This finding supports further strategic regrouping and
advancement from permitted map, structure-memory and friendly-wave information.

Seed **38** supplied the sole alive stationary candidate in the final-ten-minute
sample screen: Blue jungler 33 occupied the same position, with no CS or kills,
from minute 57 through minute 60. A ten-second replay established the local
mechanism rather than inferring it solely from minute samples. The jungler was
inside brush, Blue Sentinel was outside, and sight was directional. Each hit
engaged the monster; its attacker then failed the monster's sight predicate,
causing repeated reset/healing while the bot waited or attacked from that spot.
The passive observer matched an uninstrumented replay exactly.

## Bot approach correction

The jungle observation now includes terrain sight from an already team-visible
monster to the actor. When the selected target lacks that sight, the planner
approaches the known camp point through normal navigation before attacking.
The observation uses visible positions and known terrain. Monster target memory,
hidden health, actual respawn deadlines and hidden populations are not inputs.
Existing neutral sight, leash/reset behavior, damage, rewards and match clocks
retain their prior rules.

Both team planners cover blocked sight, restored sight, non-targetable monsters
and absent observations. An actual Rift regression starts an autonomous jungler
at a measured Blue Sentinel brush boundary and checks movement, engagement,
empty neutral-team vision and exact restored continuation. The isolated replay
of the original seed 38 checkpoint leaves brush and clears the monster without
injected movement orders. Its ruleset-only identity bridge is diagnostic data;
production imports retain strict compatibility checks.

There is no new saved field or schema revision. Runtime and package changes
produce ruleset
`3d05c177eca76fafd3c147dd46b8ce77552653ed20eb55f8b1ec0636c10c2350`.
The completed hundred-seed result belongs to the older `6466566…` baseline.
Short smoke matches and checkpoint replays do not establish a hundred-seed gate
for the new ruleset. A new complete corpus is required after relevant runtime
or roster changes; the full six-champion gate remains open.

## Validation and retained evidence

`npm run check` now routes Vitest to `tests/` and the Node GPU timer suite to
its native runner. It passes TypeScript, **1,460 Vitest checks across 266 files**
and **three Node QA checks** with the normal command. Playwright retains its
separate browser command. Source assertions were retained; the runner change
prevents Node and browser suites from being collected as Vitest suites.

The isolated runtime candidate additionally passed two normal-from-zero
ten-minute smoke matches, independent corpus verification, the production build,
and the nested static-host browser smoke with 32 audio recordings. Canonical
post-application results are recorded in
[the result ledger](reference/normal-cohort-results.json). The earlier isolated
run's missing private reference fixtures and concurrent-load timeouts remain
retained with their corrected rerun; they were not relabeled as passes.

The original corpus remains under
`.cache/match-cohort/normal-100-6466566-20261023`. Its `frozen-source` directory
contains exact copies of all 223 pinned source/map/runner files, plus baseline
test and documentation bytes. The archived verifier also passed when executed
from that source archive after the canonical runtime changed. Original reports,
checkpoints, logs, captures and diagnostic inputs remain separate from the new
candidate and canonical validation directories.

The 30 censored cases, long durations, remaining champion kits, role quests and
objectives, strategic objective conversion, native comparisons and full-match
browser/offline/performance coverage remain required work. The next changes
should address those gaps without changing pacing to force victories.

The later [friendly-wave advancement](BOT-TEAM-STRATEGY.md#friendly-wave-advancement--october-23-2026)
uses a separate schema-114 ruleset and matched four-seed pilots. Its results do
not replace this baseline or the archived `3d05c1…` approach validation.
