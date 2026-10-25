# Ten-champion rendering profile

**Measurement correction:** the original p95 19.6 ms / p99 21.2 ms values were intervals between callback delivery times (`performance.now()` inside the benchmark callback), not intervals between browser animation-frame timestamps. Variation in work before that callback affects this metric. The previous statement that those values establish missed 16.67 ms frames is withdrawn. Historical data below is preserved with corrected labels; see the current GPU/cadence measurement below.

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

Changes to simulation/content rules invalidate older checkpoints; regenerate them with the matching build. Use a fresh browser context, as the script does. The output `.json` records browser/hardware, input hash, benchmark source hash, camera subject, roster, sample counts and activity. `--profile` retains a Chrome DevTools `.cpuprofile` in a separate run; profiling can perturb frame measurements. Use the ordinary run for cadence observations and separate instrumented runs for attribution. Neither reports physical display presentation.

## Historical CPU and callback observations

| Measurement | Median | p95 | p99 |
|---|---:|---:|---:|
| Callback delivery interval (old clock) | 16.6 ms | 19.6 ms | 21.2 ms |
| Simulation step | 0.3 ms | 0.5 ms | 1.0 ms |
| HUD update | 0.2 ms | 0.3 ms | 0.4 ms |
| Fog update | 2.4 ms | 3.7 ms | 4.1 ms |
| Application render call | 4.2 ms | 7.2 ms | 9.3 ms |
| Three.js main-render draw calls | 196 | 215 | 218 |
| Three.js main-render triangles | 410,244 | 438,020 | 444,056 |

Different functions run at different cadences: there were 225 fog updates, 504 HUD updates, 1801 simulation calls and 1800 measured renders. Fog is included in application render time; columns must not be added as independent costs. Three.js counters describe the final main render, not a complete GPU pass inventory including every auxiliary render. Callback delivery intervals include scheduling, callback order, instrumentation and browser work. None of these historical timers measures asynchronous GPU execution.

A separate CPU-sampling run attributed about 2.25 seconds inclusively to animation-mixer update, 1.57 seconds to generic scene-matrix propagation and 0.67 seconds to fog update across its 32.23-second profile. WebGLRenderer rendering accounted for about 4.19 seconds inclusively. These are overlapping call-tree measurements, not additive wall-time categories. The summarizer deduplicates recursive occurrences of the same function within a sample; a synthetic recursive profile verified its self/inclusive accounting. Compiled-module source inspection confirmed the mixer function identity. Most wall time was classified idle by the CPU profiler; that does not prove unused GPU capacity.

## Next performance work and limits

The evidence does not justify treating simulation as the primary bottleneck in this fixture. Rendering, animation and matrix work warrant closer examination. An optimization of hidden or offscreen actor updates must preserve exact animation phase, blends, source bounds, reveal transitions, death states and shadows, with frozen-frame and temporal comparisons. The new elapsed GPU query below covers the application render as a whole; a pass capture would be needed to attribute GPU cost to individual stages. No runtime optimization or frame-rate improvement is claimed by this tooling change.

The older practice-only benchmark is not a controlled before/after baseline for this encounter. This run does not cover completed role AI, jungle/objective fights, lower-end hardware, other browsers, offline delivery, long-session memory behavior, or the unresolved source texture transfer/GPU-storage budgets. The 60 FPS full-match gate remains open. Raw artifacts remain local; [the compact evidence record](reference/match-render-verification.json) retains measurements, sampled attribution, source hashes and raw profile/report hashes.

The subsequent [constant bone-channel investigation](CONSTANT-BONE-TRACKS.md) removes redundant bindings with exact sampled pose/pixel comparisons. Its limited original/filtered encounter runs do not establish a frame-tail improvement; the performance gate remains open. The benchmark now supports `--raw-bone-tracks` as a test-side bypass for that specific comparison.

## Corrected cadence and asynchronous GPU timing

The benchmark now stores both the timestamp supplied by `requestAnimationFrame` and `performance.now()` at callback delivery. Its `frames` field uses successive supplied timestamps; `callbackDeliveryIntervals` preserves the old metric separately. The HTML algorithm invokes that frame's callbacks with the same supplied timestamp, even though earlier callbacks take time to execute. This distinction explains why delivery jitter alone does not establish missed animation frames. Neither clock certifies physical display presentation. [HTML animation-frame algorithm](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#run-the-animation-frame-callbacks)

`--gpu` adds WebGL2 elapsed queries around the application render. It polls availability on later frames, caps outstanding queries at 64, discards disjoint/invalid results, and drains at most 30 frames after measurement before deleting unresolved queries. Unsupported extensions are reported explicitly. Setup/imports finish before warmup; instrumentation stays outside the shipped renderer. The elapsed query includes submitted application GPU work and possible command-submission gaps, and excludes browser compositor/presentation work. It is not a pure GPU utilization measurement. [Khronos extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)

The final instrumented run used the same checkpoint and hardware described above. All 1,800 queries resolved with no discarded, skipped or unresolved samples: GPU elapsed median **1.80 ms**, p95 **3.41 ms**, p99 **4.85 ms**. Animation-frame timestamp median/p95/p99 were **16.7/16.8/16.8 ms**, while callback-delivery values were **16.6/19.5/21.1 ms**. One timestamp interval exceeded 25 ms. This does not justify reducing source visual quality to solve the previously claimed 19–22 ms frame tail. It also does not certify a complete match, lower-end devices or compositor performance.

```sh
node --test tools/qa/gpu-timer.test.mjs
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/rift-gpu-final --gpu
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/rift-cadence-final
```

Three helper tests verify unavailable extensions, asynchronous reads, bounded pending queries, nanosecond conversion, deletion and invalid/disjoint rejection. The final encounter capture was visually inspected. Tools and documentation changed; the previous 598 application checks and animation/production validation were not rerun for this tools-only change. [GPU and cadence evidence](reference/gpu-render-verification.json) pins the reports, source hashes and validation scope.

A separate run without GPU/CPU profiling measured animation-frame median/p95/p99 **16.7/16.8/16.8 ms**, callback-delivery **16.6/19.4/21.0 ms**, with one of 1,800 timestamp intervals above 25 ms. The default 180-frame practice smoke also completed: timestamp p95 16.7 ms, zero intervals above 25 ms. Both finished without page errors. These are browser cadence observations, not measured physical refresh delivery.

## Development Leona player camera — October 25, 2026

The [Leona Rift measurement](LEONA-RIFT-RENDER-PROFILE.md) uses a matching schema-130
full-match checkpoint, explicit trial save context and owned-player camera.
The scoped M1 observation retains 16.8 ms timestamp p95, with separate GPU elapsed
p95 5.68 ms. Its report records hardware/driver, exact restored state, input whitespace
normalization, render/query counts and audio remaining not unlocked. It does
not replace the historical fixture above or complete the performance matrix.
