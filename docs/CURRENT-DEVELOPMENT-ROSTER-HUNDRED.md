# Current development-roster hundred-seed run

A fresh100-seed run is in progress on ruleset
`7ae8e0f8513df40ceca31f52ad146bbe08b388b09163e996538133fbe600229f`.
It requests seeds1–100 with two isolated workers and a60minute diagnostic horizon.
The roster is two Garen/two Master Yi/two Ashe/two Leona/one Ahri/one Lux, with
five roles per team. QA automates the human Lux mid slot; production control is
unchanged.

The plan, three map inputs, compiled runner and all556archived source files pass
independent byte/hash verification. Results live under ignored
.cache/7ae8e0-development-roster-hundred. The controller stops dispatch on a
failure and drains active workers so failures can be diagnosed from retained
checkpoints. Unfinished games remain unfinished; the horizon is not a forced
victory rule.

[Started-run receipt](reference/7ae8e0-development-roster-hundred-start.json).
This records the start only. It does not certify100executed seeds, completion,
full-roster invariants, human play, browser/device performance or milestone4.
The ordinary e20hundred-seed cohort and its archived continuations remain separate.

## Current browser checks

Four unique roster browser cases now pass: Garen/Ahri source clips, all six
manual player choices with exact saves/restarts, public/private selection
restrictions, and the combined-roster saved future. The initial run exposed an
ambiguous test selector matching both the ally portrait and champion choice;
scoping it to the chooser fixes the test without changing assertions or the app.
Reviewed the1024pixel chooser capture. These are functional checks, not device
performance or completion of the running cohort.

[Browser receipt](reference/7ae8e0-roster-browser-verification.json).
