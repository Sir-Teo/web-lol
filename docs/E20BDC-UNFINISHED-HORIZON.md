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

## Frozen-source continuations

Both unfinished games were restored exactly using all548 verified archived
source files, the pinned maps and original Node24.22.1/V8 runtime. No ruleset
identity was bridged, human slot changed, clock advanced manually or victory
condition replaced. Each continuation had a separate ten-minute diagnostic
window and fresh output directory.

| Seed | Natural winner | Final tick | Match time | Time beyond original horizon |
| --- | --- | ---: | --- | --- |
|2|Red|217,745|60:29.083|29.083seconds|
|25|Red|229,222|63:40.367|3:40.367|

All14,967continued ticks pass resource/victory checks and the frozen structure
damage contract. Seven snapshot round trips and five restored-future comparisons
covering300ticks pass. The same compiled archived runner served both jobs.
Existing output directories reject without changing their report bytes.

This establishes that these two archived games end naturally shortly beyond the
chosen horizon. It does not diagnose individual bot decisions or turn the original
98-victory/two-unfinished60minute cohort into a100-victory result. No original
snapshot, report, source archive or cohort outcome changed. Current-build and
full-roster acceptance remain separate.

[Continuation receipts](reference/e20bdc-horizon-continuations.json). Reproduce
into fresh output directories:

```sh
node tools/qa/continue-archived-match.mjs .cache/e20bdc-ordinary-hundred docs/reference/e20bdc-ordinary-hundred-completed.json 2 10 .cache/fresh-seed2-continuation
node tools/qa/continue-archived-match.mjs .cache/e20bdc-ordinary-hundred docs/reference/e20bdc-ordinary-hundred-completed.json 25 10 .cache/fresh-seed25-continuation
```
