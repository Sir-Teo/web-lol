# Health-bar CPU work

This follows [frame vision and rig culling](CPU-VISION-CULLING.md). Optimization
remains the priority; deferred Zenith feature work is preserved.

Each overhead bar now remembers its last position, health/capacity, shield, mana,
name visibility, protection class and status. Rendering still reads live values
every frame, including changes within a single simulation tick. Only changed
values build CSS strings or call DOM setters. Hidden/revealed bars retain their
own state, and removing a bar allows its weakly held state to be collected.
No visual quality setting, animation timing or gameplay rule changed.

## Measurement

A controlled synchronous label benchmark uses the same saved 120-second,
ten-champion Rift state: **117 units and 59 visible labels**.
It compares two fresh views using shared initial model bar-height metadata,
eight warmup pairs, and 20 alternating-order rounds of 100 updates per unit.
It does not draw the scene or measure layout/paint/GPU cost. Median batch time
fell from **20.75 to 14.45 ms**,
a **30.4% reduction** in isolated label-update CPU time.
Final label markup and the saved world are identical.

A browser test counts real style-setter calls, including calls Chrome normally
coalesces. Twenty unchanged renders make zero transform/width/left writes.
Camera movement still writes positions, and same-tick health, mana, root and
shield changes remain visible. Existing health-division and shield tests pass.

The separate short active-game observation is retained in full:

| Instrumented active observation | Baseline | Current |
| --- | ---: | ---: |
| Mean application render call | 6.38 ms | 6.73 ms |
| Renderer task CPU / wall time | 3.611 / 6.211 s | 3.792 / 6.215 s |
| Counted renders | 362 | 361 |

**That sample was slower; this increment does not claim a measured whole-game
CPU improvement.** Scheduling/profiling noise and other work remain. Sampled
health-bar function time decreased, but animation/scene transforms still dominate.
Paused and synthetic-hidden states keep zero renders and zero simulation steps.
These checks measure neither physical heat nor total machine energy.

## Verification and scope

- TypeScript, all 1,771 unit cases/292 files and three Node QA cases pass.
- Ten serial Chrome cases cover label freshness, camera movement, divisions,
  shields, sleeping idle states, structure fog and real ward recovery/expiry.
- Forty paired original/current frames have identical pixels, visible bone
  matrices and complete overhead-label markup; rendering preserves world bytes.
- Production build and nested static-host smoke pass with 32 recordings and no
  development hook. The existing large-bundle warning remains (game 986.06 kB).
- No new offline audit or full browser/full-match/device certification is claimed.
  The preceding offline result applies to its earlier build.

Schema **125** and ruleset **`982958c23a5e30418d2a752119a499c15f6f42ac161331de5e7bf70e65cc91c5`**
remain unchanged by this presentation-only increment.

The [evidence record](reference/health-bar-cpu-verification.json) pins 1591
inputs, raw observations, preserved failures, screenshots and generated build files.
The initial style-counter test assumed prototype CSS descriptors and failed; its
fixed per-element proxy passes. Microbenchmark V1 attempted an unprepared full
reference render; V2 reused a live view and failed markup equality. Neither is an
accepted result. V3 initializes both views fresh and passes both equality gates.
The project goal and remaining performance/native/browser gates remain open.
