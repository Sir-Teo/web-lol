# Ten-champion rendering profile

The current mixed-match render sample misses the strict 16.67 ms frame budget: **p95 19.6 ms, p99 21.2 ms**, with a 16.6 ms median on Chrome 152.0.7977.83 / Apple M5 Pro / 64 GiB, 1920×1080 at device scale 1. This is an observation of a roughly thirty-second encounter, not a complete performance certification.

## Fixture and reproducibility

`tools/qa/benchmark-rift.mjs` now optionally accepts a ten-champion checkpoint and output stem. It writes that checkpoint through the application's browser storage module, reloads the page, and requires exact serialized restoration before measuring. It rejects non-Rift, finished, or non-ten-champion checkpoint inputs. The old no-checkpoint 90-second practice benchmark remains available and was smoke-tested.

The recorded checkpoint is the 1200-second eight-Ashe/two-Lux lane diagnostic from [Lost Chapter verification](reference/lost-chapter-verification.json), SHA-256 `778e7b5b580f7be808bd85f46bacab527e586a1d4df3e1cc6896af696b0bd599`. All ten champions run their local AI. The benchmark chooses the living blue champion with the most nearby visible enemies at the start, ties by ID, and follows that same subject during measurement, including death or respawn. This run selected blue Lux, ID 35. It retains the normal player's Ashe HUD and team vision; it does not implement a spectator mode or change human ownership.

There are 120 warmup frames followed by 1800 measured frames. The camera is initially centered on the subject during warmup and follows it during measurement. This report reached tick time 1231.97 seconds with 99 unit records. Activity counters saw at most 42 world projectiles, two world singularities, one world Lux beam and nine living, team-visible champions inside the viewport. The first three counters describe global simulation activity, not proof that each effect was on screen at the same instant. The final capture showed a bottom-lane structure fight with both Lux models; it was visually inspected.

With the development server running:

```sh
node tools/qa/simulate-rift.mjs 1200 artifacts/rift-lost-chapter-simulation.json mixed
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/rift-match-benchmark-final
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/rift-match-profile --profile
node tools/qa/summarize-cpu-profile.mjs artifacts/rift-match-profile.cpuprofile artifacts/rift-match-cpu-summary.json
```

Changes to simulation/content rules invalidate older checkpoints; regenerate them with the matching build. Use a fresh browser context, as the script does. The output `.json` records browser/hardware, input hash, benchmark source hash, camera subject, roster, sample counts and activity. `--profile` retains a Chrome DevTools `.cpuprofile` in a separate run; profiling can perturb frame measurements. The ordinary run is the source for frame-budget observations.

## Observations

| Measurement | Median | p95 | p99 |
|---|---:|---:|---:|
| Frame interval | 16.6 ms | 19.6 ms | 21.2 ms |
| Simulation step | 0.3 ms | 0.5 ms | 1.0 ms |
| HUD update | 0.2 ms | 0.3 ms | 0.4 ms |
| Fog update | 2.4 ms | 3.7 ms | 4.1 ms |
| Application render call | 4.2 ms | 7.2 ms | 9.3 ms |
| Three.js main-render draw calls | 196 | 215 | 218 |
| Three.js main-render triangles | 410,244 | 438,020 | 444,056 |

Different functions run at different cadences: there were 225 fog updates, 504 HUD updates, 1801 simulation calls and 1800 measured renders. Fog is included in application render time; columns must not be added as independent costs. Three.js counters describe the final main render, not a complete GPU pass inventory including every auxiliary render. Animation-frame intervals include scheduling, instrumentation and browser work. None of these timers measures asynchronous GPU execution.

A separate CPU-sampling run attributed about 2.25 seconds inclusively to animation-mixer update, 1.57 seconds to generic scene-matrix propagation and 0.67 seconds to fog update across its 32.23-second profile. WebGLRenderer rendering accounted for about 4.19 seconds inclusively. These are overlapping call-tree measurements, not additive wall-time categories. The summarizer deduplicates recursive occurrences of the same function within a sample; a synthetic recursive profile verified its self/inclusive accounting. Compiled-module source inspection confirmed the mixer function identity. Most wall time was classified idle by the CPU profiler; that does not prove unused GPU capacity.

## Next performance work and limits

The evidence does not justify treating simulation as the primary bottleneck in this fixture. Rendering, animation and matrix work warrant closer examination. An optimization of hidden or offscreen actor updates must preserve exact animation phase, blends, source bounds, reveal transitions, death states and shadows, with frozen-frame and temporal comparisons. GPU timing or a pass capture is still needed before attributing the frame tail to a particular GPU stage. No runtime optimization or frame-rate improvement is claimed by this tooling change.

The older practice-only benchmark is not a controlled before/after baseline for this encounter. This run does not cover completed role AI, jungle/objective fights, lower-end hardware, other browsers, offline delivery, long-session memory behavior, or the unresolved source texture transfer/GPU-storage budgets. The 60 FPS full-match gate remains open. Raw artifacts remain local; [the compact evidence record](reference/match-render-verification.json) retains measurements, sampled attribution, source hashes and raw profile/report hashes.
