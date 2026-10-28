# Full matches on the initial Baron ruleset

Three selected games finish naturally on `25f21e…`, the initial private Baron
fixture's fingerprint. Two use the ordinary Ashe/Lux roster with QA automation
of the human carry. One uses the combined six-champion development roster with
QA Lux mid. These are headless match checks; production player control remains
manual.

| Roster | Seed | Winner | Finish tick | Simulation time |
| --- | ---: | --- | ---: | --- |
| Ordinary | 26018 | Blue | 169,837 | 47:10.617 |
| Ordinary | 719 | Red | 144,476 | 40:07.933 |
| Combined development | 719 | Red | 129,166 | 35:52.767 |

Independent verification passes **443,479 checked ticks, 125 exact checkpoint
round-trips and 122 restored-future comparisons covering 7,320 ticks**. Frozen
sources, runners, maps, checkpoint/final hashes, resources, structure protection,
natural victory and terminal freezing all verify. Both checks run from the
exact frozen source without a historical bypass.

Every one of the 125 retained checkpoints matches its earlier `abc8dc…` game
after normalizing only the root ruleset identifier in memory. All three final
states also match. The normalized file bytes are identical as well. The original files remain unchanged and no normalized state
is imported or used as a migration. This is evidence for these selected games,
not a general balance or performance result.

The original source commit is `87c1209`. The retained checkout at
`/workspace/web-lol-recovery-baseline`, commit `c3f70e0`, matches all 548 pinned
source files for each corpus. After a workspace transition, recovery kept
completed results, archived partial attempts and restarted interrupted seeds
from tick zero. There is no uninterrupted-execution or wall-time performance
claim.

These results precede the [Baron control policy](BARON-CONTROL.md) and its new
`5a5379…` fingerprint. They do not certify that newer fingerprint, a hundred-seed
gate, full browser play, native fidelity or fresh offline delivery. The two
original hundred-seed audits remain separate at `abc8dc…`.

The [verification ledger](reference/baron-baseline-matches-verification.json)
pins both corpora, the independent reports, recovery records, comparisons and
all three final states.
