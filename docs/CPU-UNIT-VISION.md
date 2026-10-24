# Unit visibility reuse during presentation

October 24, 2026. This follows [offscreen pose work](CPU-OFFSCREEN-POSES.md)
and continues the CPU-efficiency priority. Model drawing, labels, selection,
hover, HUD and audio can ask about the same unit repeatedly during a frame.
The existing synchronous, read-only vision scope now shares each unit's result
for each viewing team, as well as the source lists it already shared.

Keys use the actual unit object, keeping detached records with an identical ID
independent. Both visible and hidden results are retained. Neutral queries stay
false. Nested scopes share the outer scope; returning or throwing releases the
outer cache. Ordinary simulation calls and later scopes always compute fresh
answers, including movement and reveal changes within the same tick. Arbitrary
point queries retain their existing behavior. The scope's existing requirement
that callers perform no match mutations still applies.

No visibility rule, targeting rule, simulation clock, source asset or draw
quality changes. This cache is transient and is never serialized. Schema 125
remains; the automatic simulation fingerprint changes with the World module.
Application import checks remain strict. Only diagnostic checkpoints used for
comparison have their ruleset header normalized explicitly.

## Measurements

One unchanged 120-second, ten-champion Rift checkpoint contains 117 units.
Eleven alternating paired Chrome query batches repeat both teams' unit and
structure-knowledge reads, using either the frozen previous implementation or
the current one. Every batch returns the same visibility count and leaves the
checkpoint bytes unchanged.

| Query batch of 100 presentation scopes | Previous | Current |
| --- | ---: | ---: |
| Median batch duration | 96.6 ms | 25.4 ms |
| Point visibility evaluations | 75,200 | 14,300 |

This isolates **73.7% less query time** and **81.0% fewer point visibility
evaluations** for the repeated-read workload. It does not measure the complete
frame or establish a device-independent speedup.

A subsequent serial whole-game observation serves the previous and current
World modules in turn, with the same normalized checkpoint and unchanged
renderer. Chrome 156 on Apple M1 at 1440 by 900 observes:

| Active observation | Previous | Current |
| --- | ---: | ---: |
| Mean application render call | 7.59 ms | 6.83 ms |
| Renderer task CPU / wall time | 4.266 / 6.272 s | 3.889 / 6.259 s |

That short pair observes 10.1% less mean render time and 8.7% less renderer CPU
per wall second. Paused and synthetic-hidden states perform zero renders and
simulation steps. The earlier unpaired observation was slower after the change
(6.71 versus 7.81 ms mean render) and overlapped local typechecking/testing.
Both observations are retained. Other system activity, instrumentation and short
sampling windows limit whole-game conclusions; temperature, total energy, GPU
cost and full-match/device/browser performance remain uncertified.

## Verification

Five new unit cases protect result reuse, team separation, detached identity,
exception cleanup, same-tick movement/reveals, Oracle detection, Garen target
reveal and Scuttler's exact emergence deadline.

The frozen previous and current simulation agree through 3,600 ticks, 61 sampled
checkpoints and 65,574 unit visibility queries. A strict restoration matches
another 60 future ticks. Read-only scopes preserve saved bytes throughout.
Forty paired Chrome frames preserve every framebuffer byte, visible bone matrix,
complete label markup and world snapshot through idle/run/blends, hide/reveal,
attacks, death and respawn.

TypeScript, all 1,782 unit cases across 293 files and three Node QA cases pass.
Nineteen unique Chrome cases pass across the initial run and one focused repair.
The first run passed eighteen cases; its remaining fixture teleported the hero
back to the fountain while paused and expected the sleeping HUD to refresh
without a frame request. Explicitly settling the injected fixture's HUD restores
the existing shop-preparation test; its failure trace is retained. Production
build and nested hosting pass with 32 recordings and no development hook.
No fresh offline audit or complete browser-suite run is claimed.

Schema remains 125; the current working ruleset is
`3f5f13befd26234c86d0603e8fcc4b3236eb6e43b1e4ebf5e47a968d46007653`.
The [verification ledger](reference/unit-vision-verification.json) records
standard checks, focused browser and production coverage, exact source hashes,
raw timings and diagnostic reproducers. Read-only verification uses
`node tools/qa/verify-unit-vision.mjs`; add `--historical` after later changes.
Deferred Zenith work is preserved. The complete project goal remains active;
full-match, complete-roster and native-fidelity requirements remain open.
