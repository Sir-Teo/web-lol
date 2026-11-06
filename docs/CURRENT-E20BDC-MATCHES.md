# Selected full matches on the ranged-Baron build

Build `b30c007`, fingerprint `e20bdc…`, completes both selected seed-26018 matches
naturally with Blue victory. The ordinary roster finishes at tick 169,837
(47:10.617 simulation time); the combined development roster finishes at tick
179,372 (49:49.533). QA drives the human slot for these headless scenarios;
production player control is unchanged.

Independent read-only verification passes both frozen source/runner/map
identities and all report/checkpoint/final identities. Across the two games,
349,209 ticks pass resource, structure and victory invariants. Ninety-eight
checkpoint round-trips and 96 restored-future comparisons covering 5,760 ticks
pass. Neither run reports a failure or unfinished horizon. Terminal invariants
also pass. The raw source archives, maps, checkpoints and reports remain in
their separate ignored cohort directories.

The [verification record](reference/current-e20bdc-matches.json) pins both runs,
including their actual final snapshots. Reproduce into fresh directories:

```sh
node tools/qa/match-cohort.mjs 26018 --jobs=1 --minutes=60 --output=.cache/fresh-ordinary
node tools/qa/match-cohort.mjs 26018 --jobs=1 --minutes=60 --development-roster --output=.cache/fresh-combined
node tools/qa/verify-match-cohort.mjs .cache/fresh-ordinary
node tools/qa/verify-match-cohort.mjs .cache/fresh-combined
```

These are two selected complete games on this fingerprint, not hundred-seed
completion, normal human play, a full browser match, FPS/device testing, native
parity or fresh offline delivery. The private Baron target is excluded from
both match calendars, so the runs do not validate a live epic encounter. Earlier
hundred-game audits and delivery reports retain their original identities.
