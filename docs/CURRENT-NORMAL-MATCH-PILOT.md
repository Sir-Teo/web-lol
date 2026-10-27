# Current normal-rules match pilot

Five selected regression seeds ran from zero on the current normal ruleset
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`, schema 163, at source revision
`dbf6c6ef33fd833c9364936cfdc23e9eb29be4e4`. The roster is six Ashe/four Lux with five roles
per team. The normally human carry is automated only for this QA run.

The selected seeds came from earlier unfinished-match and jungle/late-objective
findings. Their 60-minute horizon retains normal clocks and victory rules;
no result is forced. This selected set is not an independent sample for win-rate
or balance estimates and does not pass the 100-seed or complete-roster gate.

| Seed | Winner | Natural match clock | Exact round trips | Saved futures |
| --- | --- | ---: | ---: | ---: |
| 8 | Red | 51:53.3 | 52 | 51 |
| 38 | Red | 42:50.6 | 43 | 42 |
| 42 | Red | 57:45.7 | 58 | 57 |
| 54 | Blue | 45:16.1 | 46 | 45 |
| 63 | Red | 43:20.1 | 44 | 43 |

Independent verification passes all five reports and retained states:
867,943 per-tick resource checks, protected-structure damage checks, 243 exact
checkpoint round trips and 238 restored-future comparisons covering 14,280 ticks.
Each winner's structure dependencies are valid and its state stays frozen after
further step attempts. No invariant or infrastructure failure was recorded.

All 539 pinned source/map/runner files are copied under the corpus's
`frozen-source` directory; its executable and three copied map inputs have
separate identities. This is a headless simulation check. It does not certify
human-play quality, native audiovisual fidelity, full-match browser performance,
the complete six-character roster or all objectives/role systems.

No runtime, rule or asset changes accompany this result. Earlier cohort results
remain attached to their original source identities. The two known historical/
platform-dependent unit failures remain separate from this passing pilot.

```sh
node tools/qa/match-cohort.mjs --jobs 2 --minutes 60 --output .cache/normal-pilot-new 8 38 42 54 63
node tools/qa/verify-match-cohort.mjs .cache/normal-pilot-new
```

The [result ledger](reference/current-normal-match-pilot.json) pins the plan,
runner, maps, source archive, reports, every checkpoint and independent verifier
output. Wall time includes QA checks and is not a gameplay performance benchmark.
