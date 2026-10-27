# Current normal-match checkpoint reading

A frozen reading of the first 24 completed seeds passes the original independent
cohort verifier. The 100-seed run remains active. This subset is not its full
invariant gate and does not complete the six-character milestone.

| Retained subset | Result |
| --- | ---: |
| Completed seeds / valid victories | 24 / 24 |
| Unfinished / failures | 0 / 0 |
| Resource-checked simulation ticks | 4,033,896 |
| Exact checkpoint round trips | 1,134 |
| Following-minute comparisons | 1,110 |
| Original horizon per seed | 60 simulation minutes |
| Full 100-seed gate | False |

The reading retains the original 100-seed plan and status bytes, selects only
reported completed seeds, and points to their immutable checkpoint/report files.
The original plan, status, reports and game rules are not rewritten. The derived
24-seed plan keeps the original horizon, input, runner and 539 simulation source
pins. The unchanged verifier checks every retained checkpoint hash, resource and
structural-victory invariant, final snapshot, counter and runtime receipt.

```sh
node tools/qa/verify-match-cohort.mjs .cache/match-cohort/current-normal-completed-24-reading-20261027
```

This is the current normal-rules fingerprint
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`
and schema 163, with the interim six-Ashe/four-Lux roster and QA automated carry.
It is not a full-roster or natural-human-play certification. The full run's later
seeds, censored horizons and failures remain subject to the original gate.

The related production acceptance tool imports an actual completed checkpoint
through the cached game's file UI, checks its result and clock offline, and
requires exact exported bytes before and after another offline reload. It does
not inject a development hook or simulate a whole browser match.

```sh
node tools/qa/offline-completed-match.mjs --report .cache/match-cohort/current-normal-100-20261027/seeds/21/report.json --output-dir .cache/offline-completed-new
```

Use `--system-chromium` for the Linux container's Chromium executable. This is a
software-browser acceptance path, not a physical-GPU performance measurement.

Seed 21's retained Blue victory at tick 126248 (35:04 on the HUD) passes that real
production path with the browser network disabled. Preview, import, result/clock,
browser persistence and both downloaded snapshots match the expected state;
exports remain byte-exact across another offline reload. The run records 973
service-worker responses, zero page errors, zero failed requests and no requests
outside the nested host prefix. The preview/result captures were inspected.

The [verification record](reference/current-normal-checkpoint-reading-verification.json)
retains the subset construction, original plan/status hashes, unchanged verifier,
source/report receipts, exported files, browser result, pause/resume intervals and
the earlier setup failure. Application acceptance is inherited from `8332f5a`;
this increment changes QA tools/documentation only.
