# Exact visibility range rejection

`seenFrom` now rejects sources outside the query point's axis-aligned radius
box before calling `Math.hypot`. Surviving candidates retain the original exact,
inclusive distance check, source order and terrain query. There is no coordinate
quantization, squared-distance substitution, new visibility cache or change to
brush/terrain rules. Gameplay and fog continue to use the same query.

The current Linux CPU diagnostic identified shared distance and visibility work
as investigation candidates. An isolated benchmark uses 43 actual vision sources
from the current 20-minute standard-roster checkpoint and 65,536 full-map cell
centers. Ten alternating baseline/optimized rounds produce identical masks.
With always-clear terrain, median query-sweep time drops from 42.57 to 11.35 ms;
with always-blocked terrain, from 50.39 to 13.79 ms. Terrain is stubbed in these
timings. They measure this query workload on Node 24.22.1/AMD EPYC, not full fog,
GPU execution, desktop FPS or physical-device performance.

The [source packet](reference/vision-range-sources.json) and
[benchmark report](reference/vision-range-benchmark.json) retain actual inputs,
all durations and mask/source/script hashes. Reproduce with a fresh report path:

```sh
node tools/qa/benchmark-vision.mjs docs/reference/vision-range-sources.json artifacts/fresh-vision-range.json
```

## Equivalence and regression checks

Three new unit cases compare against the original query through 2,007 boundary
and seeded points, check terrain-call order, retain degenerate/nonfinite
behavior, and count one `hypot` instead of 41 for a distant-source case.
The nine-file focused run passes 67 cases, including team vision, snapshot
visibility, exact fog caching, wards, Oracle, jungle brush and Crystal Arrow
control dispatch. Production build and TypeScript pass.

A browser check compares all 65,536 Rift fog samples using the actual terrain
query, current observers and three additional observers. Every boolean and the
terrain-ray count match; its [report](reference/vision-range-browser.json) and
reviewed screenshot cover the real map. The existing structure-vision scenario
passes unchanged in a standalone 46.6-second system-Chromium run under the cloud
60-second configuration. The preceding concurrent attempt completed its state
assertions but timed out at the final screenshot; its artifacts remain retained.
No default-device timing claim is made from this rerun.

The standard-roster simulation repeats from spawn through tick 72000 without
violations and restores exactly. Its final snapshot matches the preceding build
in every field after changing only the root ruleset identifier in memory for
comparison. Both original snapshots retain their bytes; this is not a save
migration. The [comparison record](reference/vision-range-match-equivalence.json)
retains both hashes. This is one selected 20-minute trajectory, not a complete
match or hundred-seed certification.

Schema stays 163. The new fingerprint is
`d1ba0329259738eb4091bba944d813ff6413071c8a4e1f43026dc135a5143d3c`.
Full-match, fresh offline, production-host and native-client checks retain their
previous source/build identities.
