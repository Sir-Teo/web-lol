# Combined private roster in frozen match cohorts

The durable launcher, worker, verifier and recovery tool now support the existing
private six-champion roster. Use a fresh output directory:

```sh
node tools/qa/match-cohort.mjs --development-roster --jobs 4 --output artifacts/my-roster-cohort
node tools/qa/verify-match-cohort.mjs artifacts/my-roster-cohort
```

Both teams use Garen top, Master Yi jungle, Ashe carry and Leona support. The
human slot is Lux mid with existing AI enabled only for QA; Red mid is Ahri.
The default Ashe/Lux and separate `--development-leona` profiles retain their
previous compositions. The two development flags are mutually exclusive and
reject a mixed plan before creating output. No match clock, reward, damage or
victory rule changes are involved.

Each new cohort archives all pinned source files alongside its immutable runner
and copied maps. Historical verification checks those archived bytes even after
the working checkout changes. The verifier checks every combined checkpoint
and final snapshot for the exact champion/role composition. A private run can
only set `hundredSeedDevelopmentRosterInvariantGate`; it cannot set the ordinary
hundred-seed gate. The private gate requires at least 100 distinct seeds, the
60-minute horizon and every requested result completing without failure.
An unfinished horizon is retained without manufacturing a winner.

Recovery accepts both the new controller and its exact historical predecessor.
It forwards the frozen profile, retains accepted results, archives incomplete
attempts and reruns only pending seeds from zero. The original dispatch and
invariant tail is preserved byte for byte. Invalid/mixed flags, changed accepted
profiles and unknown controllers are rejected without rewriting evidence.

## Verified scope

All **39 Node QA tests** pass. They include fixture-only 100-seed gate isolation
and legacy recovery, plus fault tests that recompute checkpoint hashes after
changing champion/role data. A changed archived source and dropped worker
profile also fail verification. These synthetic tests do not certify 100 games.

Real short pilots pass independent verification: one ordinary seed and one
Leona seed at three minutes, two combined seeds at three minutes, and three
combined seeds at five minutes after an intentional process interruption.
Together the accepted runs check **97,200 ticks, 27 exact snapshot round-trips
and 20 original/restored future comparisons covering 1,200 ticks**.
All seven runs are naturally unfinished at their diagnostic horizons.

The actual recovery retained seed 26018's accepted report byte for byte, archived
seed 719's minute-one checkpoint unchanged, restarted 719 from zero and ran
queued seed 927. The frozen plan remained unchanged and read-only preflight
was verified. Receipts explicitly record interrupted execution. The original
partial attempt remains available; it is not counted as accepted coverage.

Schema remains 163 and rules fingerprint remains
`033bd826b7f5899449adbec1cbb02ff826f636cf3b75c758f4effe4f7c5a02be`.
Application code/assets and the matching 1,202-file offline pack are unchanged.
No fresh browser, production, offline or full unit-suite result is claimed for
this tool-only step; their preceding evidence remains linked from the
[player chooser](ROSTER-PLAYER-SELECTION.md). [Five long games](COMBINED-ROSTER-LONG-GAMES.md) subsequently pass independent
verification with natural victories; the hundred-seed result remains open. See the
[verification ledger](reference/combined-roster-cohort-verification.json).
