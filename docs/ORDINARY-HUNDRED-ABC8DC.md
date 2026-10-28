# Historical ordinary roster: one hundred checked games

All 100 requested ordinary-roster seeds finish their diagnostic run without a
simulation failure. **98 reach natural victory and two remain unfinished at the
60-minute horizon.** Independent verification passes 16,653,420 checked ticks,
4,676 exact round-trips and 4,576 future comparisons covering 274,560 ticks.
The canonical `hundredSeedInvariantGate` passes; full-roadmap completion remains
false.

The frozen `abc8dc…` profile uses the ordinary Ashe/Lux composition, with five
positions per team and QA automation of the human carry. Production player
control remains manual. The horizon is a diagnostic timeout, never a forced
winner or a rule that ends a live game.

| Duration among the 98 natural victories | Simulation time |
| --- | ---: |
| Shortest | 35:11.200 |
| P50 | 45:07.083 |
| P95 | 56:47.250 |
| Longest | 58:39.517 |

Quantiles use nearest rank among the natural victories. Blue wins 44 and Red
wins 54 in those games. These counts do not establish balance or predict human
matches. The two timeout games remain censored at 60:00 in the original corpus.

Seeds 2 and 25 retain their original unfinished reports and exact tick-216,000
checkpoints. Separate, previously verified continuations reach natural Red
victories at ticks 217,745 (60:29.083) and 229,222 (63:40.367). Those
[continuation results](LATE-MATCH-ROUNDTRIP.md) neither relabel the two original
outcomes nor add seeds to the hundred-game count.

Independent verification checks archived sources, runner/maps, reports,
checkpoint/final hashes, resources, protected structures, legal victories and
terminal freezing. Completed results were retained across interruptions;
partial attempts were archived and interrupted seeds restarted from tick zero.
Recorded quiet-check pauses were resumed. There is no uninterrupted-execution
or wall-time performance claim.

These results remain tied to `/workspace/web-lol-ally-intent` and its frozen
source. They do not certify a hundred games on the current `5a5379…` ruleset,
full human browser play, native fidelity or physical-device performance. The
[ledger](reference/ordinary-hundred-abc8dc-verification.json) pins all accepted
reports, the independent result, timeout states, durations and recovery records.
The two current historical Leona/Lux full-unit failures remain open.
