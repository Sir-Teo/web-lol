# Late natural finishes and exact offline round-trips

Both selected ordinary games that were unfinished at 60 minutes finish naturally
when their exact saves continue under the frozen rules. Their original cohort
reports remain **unfinished**, and their original reports and saves remain
byte-identical. These are separate diagnostics of two selected cases.

| Seed | Natural result | Final tick | Game clock | Added verified ticks | Exact round-trips | Saved futures |
| ---- | -------------- | ---------: | ---------- | -------------------: | ----------------: | ------------: |
| 2    | Red victory    |    217,745 | 60:29.083  |                1,745 |                 2 |  1 / 60 ticks |
| 25   | Red victory    |    229,222 | 63:40.367  |               13,222 |                 5 | 4 / 240 ticks |

Together, independent replay covers **14,967 added ticks, seven exact
round-trips and five saved futures totaling 300 ticks**. Both winning states
also remain frozen across 120 requested ticks each. The seed-2 evidence retains
its [earlier ledger](reference/unfinished-match-continuation-verification.json).

At seed 25's 60-minute boundary, both Nexuses are intact and all lane turrets
are down. During continuation, both teams destroy an inhibitor, Blue destroys
a Red Nexus turret, and Red eventually destroys both Blue Nexus turrets and
the Nexus. The independent replay checks finite resources/economy and victory
dependencies on every added tick and independently observes structure damage
eligibility. It reproduces the exact final state and damage/destruction records.
The checkpoint is imported without reseeding, new orders, reward changes,
compatibility bridges or a forced winner. The 80-minute diagnostic ceiling ends
early on ordinary victory. This evidence supports late natural finishes in
these two cases; other unfinished games retain their own evidence needs.

## Current-pack offline verification

Fresh nested-path production checks pass for pack
`8511251dbb909130d44970a3e4e453cc58c295a8f9d026637e3a1073bcabb680`,
with **1,202 files / 538,111,476 bytes**. The full-pack gate independently hashes
every file and exercises integrity failure, retry/cancel/focus, exact paused
startup offline, repair, a new offline Lux match and save-preserving removal.
Its separate two-version fixture verifies atomic switching, multi-tab refusal,
missing-entry readiness and scoped cleanup. It observes 978 service-worker
responses and no page errors.

The completed-match gate then uses seed 25's independently verified result.
With network access disabled, the real UI previews **63:40 · Red team victory**,
imports the file, displays **Defeat**, and exports the exact saved state.
Reloading offline retains the same clock, outcome and stored bytes and exports
that state exactly again. It observes 973 service-worker responses, no page
errors, no failed requests and no requests outside the nested game prefix.
Source report, checkpoint and manifest bytes remain unchanged. Both late-match
captures are visually reviewed at 1600×1000. No development hook is exposed.

[The ledger](reference/late-match-roundtrip-verification.json) pins the exact
origin, runner/verifier sources and bundles, archived-source manifest, new
checkpoints, replay results, production logs, exports, captures and resumed
pause receipt. Both 100-seed audits continue against frozen `a3e47aa` and
ruleset `abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
Neither continuation is counted as another seed or a replacement 60-minute
result. Hundred-seed completion and full browser match simulation remain
separate gates. Application code, schema 163, assets and saved fields remain
unchanged in this evidence step. The preceding 3,574/3,576 full-unit result
retains its two identified source-evidence/runtime-digest failures.
