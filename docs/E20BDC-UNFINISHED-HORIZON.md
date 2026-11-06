# Frozen ordinary cohort: unfinished horizon evidence

The completed e20/schema163 cohort has two unfinished seeds at its60minute
horizon. Reading their final ten minutes verifies the frozen report ledger and
all sampled checkpoint/final hashes. It never loads an old snapshot into current
simulation code or changes the cohort outcomes.

| Seed | Kills added | Deaths added | CS added | Sampled nexus change |
| --- | ---: | ---: | ---: | --- |
|2|22|22|527|Blue5500→2057.3333 in the final minute|
|25|22|22|468|Both remain5500|

These counters establish continuing combat and farming activity at the sample
resolution. They do not establish why either game failed to end by the horizon.
Minute-spaced snapshots cannot prove recall loops, exact paths, fight timing or
causal bot decisions. Seed2's late nexus damage also makes a blanket frozen-match
label inappropriate. No game timeout, victory rule, bot policy or snapshot was
modified.

The six diagnostic tests pass, including edited reports/checkpoints/final states,
wrong rulesets and reordered checkpoints. The reader writes a fresh result only:

```sh
node tools/qa/inspect-cohort-horizon.mjs .cache/e20bdc-ordinary-hundred docs/reference/e20bdc-ordinary-hundred-completed.json artifacts/fresh-horizon-reading.json
```

[Reading and provenance](reference/e20bdc-unfinished-horizon-reading.json).
This is historical ordinary-roster evidence, not current-ruleset, full-roster or
milestone4 acceptance. Live decision traces or a frozen-source continuation are
needed to investigate the causes without inventing them from sparse samples.
