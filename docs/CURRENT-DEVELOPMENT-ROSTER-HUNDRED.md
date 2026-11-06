# Frozen development-roster hundred-seed baseline

Seeds 1–100 all finish with natural victories under schema 167 / ruleset
`7ae8e0f8513df40ceca31f52ad146bbe08b388b09163e996538133fbe600229f`.
There are no unfinished matches or invariant failures. Two isolated workers
used the ordinary 60-minute diagnostic horizon without forced victory or AI overrides.
The roster has two Garen, two Master Yi, two Ashe, two Leona, one Ahri and one Lux,
with five roles per team. QA automates the human Lux mid slot; production control
is unchanged.

| Check | Result |
| --- | ---: |
| Natural victories | 100 / 100 |
| Checked simulation ticks | 14,987,533 |
| Exact save round trips | 4,219 |
| Future checks | 4,119 |
| Checked future ticks | 246,994 |
| Winners | Blue 48 / Red 52 |

The independent verifier passes the frozen source archive, three map inputs,
compiled runner, reports and checkpoint/final hashes. The archive contains 556
source/QA files from source revision `799ecde`; the application behavior is the
accepted `0fa0072` checkpoint. Node 24.22.1 / V8 13.6.233.17-node.58 was retained.
The median natural victory takes 2,477.4167 simulated seconds. Winner counts are
observations from this roster, not a balance certification.

[Completed receipt and per-seed ledger](reference/7ae8e0-development-roster-hundred-completed.json)
retain plan, summary and verifier hashes plus all 100 report hashes. The original
[start receipt](reference/7ae8e0-development-roster-hundred-start.json) stays unchanged.
Ignored archive: `.cache/7ae8e0-development-roster-hundred`.

The development-roster hundred-seed invariant gate passes. The complete roadmap
milestone remains open: this is not human-play, device-performance, native-client
fidelity or acceptance of a later ruleset. Later audio work has separate source
identities and evidence. The ordinary e20 cohort and its archived continuations
remain historical and separate.

## Browser checks at this checkpoint

Four unique roster browser cases pass: Garen/Ahri source clips, all six manual
player choices with exact saves/restarts, public/private selection restrictions,
and the combined-roster saved future. The initial run exposed a test selector
matching both ally portrait and champion choice; scoping it to the chooser kept
the assertions and app unchanged. The 1,024-pixel chooser capture was reviewed.
These are functional checks, not device performance.

[Browser receipt](reference/7ae8e0-roster-browser-verification.json).
