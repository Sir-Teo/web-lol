# Baron release-pose capture

The evidence below retains its original fa62e049 identity. The subsequent
sampler-factory type change produces a [new current fingerprint](CURRENT-BARON-SOURCE-KERNELS.md)
with the same save schema.

Commit follow-up to the schema-164 flight/contact history: schema **165** adds
an independently owned launch body pose. Current ruleset:
`fa62e04941bf41b136da3d6f35e96314670adcbd4f11dd590e2bdb39e3b78cea`.

The stationary Baron body is sampled at its accepted release tick, before the
release clock is cleared or later damage can select death animation. This pure
preview uses the existing local animation adapter and cloned transition layers.
It does not mutate the live skeleton, simulation clocks, IDs or random state.
The saved pose retains the launch position, facing, clip time and transition.
Strict loading requires the release clock, attack pose and native rig durations
to agree, and rejects missing or edited launch fields.

This enables a later private-skeleton JawBot sample. It does not yet add that
attachment transform or native emitter rendering, and does not certify the
native game's animation graph.

Verification: three pure-preview cases, 36 history cases and adjacent projectile
and Lux E cases all pass (57 total). A real browser combat save/reload passes
with schema 165. Four paired scenarios preserve 1,680 ticks of prior gameplay,
ignoring only schema, ruleset and the new presentation history. Logs:
`artifacts/baron-release-pose-history-tests.log`,
`artifacts/baron-release-browser.log`,
`artifacts/baron-release-gameplay-parity.json`.
The earlier schema-164 evidence is retained under its original filenames.

The quiet full suite passes **3,891/3,893** cases across 431 files. Only the
previous Leona archived-input and Lux historical digest failures remain; the
unchanged lane-clock deadline passes. See `artifacts/baron-release-full-unit.log`.
The owned cohort processes resumed without errors, including after the expected
nonzero test exit.
