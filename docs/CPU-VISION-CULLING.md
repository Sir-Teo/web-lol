# Frame vision caching and supported rig culling

This follows the first [CPU efficiency checkpoint](CPU-EFFICIENCY.md), retaining
its sleeping paused/background loop and 60-Hz presentation budget. Feature work
remained deferred during optimization.

Vision-source lists are now shared only during a synchronous, read-only frame
scope. Rendering, hover, HUD and audio use the same lists. Nested render calls
share the scope, and exceptions always release it. Ordinary simulation queries
remain uncached, including changes within one tick. The builder appends sources
directly without temporary filter/map arrays, preserving their original order.

Invisible Lux E flight/field/burst/hit roots skip particle sampling and clear draw
ranges. On reveal, absolute saved phase sampling reconstructs their buffers.
Hidden actors also avoid redundant scene-removal searches.

All supported character, minion, ward and monster rigs now use the existing
conservative all-clip animation envelope, previously enabled only for Leona and
structures. Unsupported rigs still retain disabled culling. Bounds are computed
once when loading a reference mesh; this adds startup work. Per-clone culling
spheres remain separate from Three's original first-pose sorting sphere, so
camera/shadow rejection does not change the depth-sort centre. The adapter uses
the pinned Three 0.186 runtime hook; its older installed type definitions need
an explicit runtime-interface declaration.

## Final observation

A fresh baseline from f9bf504 and the final code used the same 120-second
ten-champion Rift state, with only its strict compatibility header rebased for
the test. Both used Chrome 156 on Apple M1, the same 1440-by-900 viewport and the
same short, instrumented sampling tool.

| Active observation | Fresh baseline | Final |
| --- | ---: | ---: |
| Mean application render call | 9.71 ms | 7.09 ms |
| Renderer task CPU / wall time | 4.930 / 6.255 s | 3.965 / 6.232 s |
| Counted render calls | 345 | 359 |

The final sample averaged **27.0% less render time** and
**19.3% less renderer CPU per wall second** than this
fresh baseline. Paused and synthetic-hidden states still performed zero renders
and zero simulation steps. Intermediate runs are retained, including variable
active timings; the final accepted code's result is used here.

These observations do not measure temperature, total system energy or pure GPU
utilization. Concurrent system load, profiling and scheduling affect timings.
Counters span the profiling setup/drain boundary slightly differently from CDP
CPU metrics; they are not a physical FPS measurement. The full-match 60-FPS,
lower-end device, broader browser, native fidelity and bundle-size gates remain
open. No quality or shadow-resolution setting was reduced.

## Verification

- Production build, 1,771 unit tests/292 files and three Node QA cases pass.
- Twenty-two Chrome cases cover pause/recovery, wards, Oracle, structure fog,
  field/missile reconstruction and hidden effect sampling.
- Original/current simulation agrees through 3,600 ticks, 61 checkpoints, 732
  source lists and 43,716 unit visibility/point queries. A strict reload
  preserves another 60-tick future. Read-only scopes preserve snapshot bytes.
- Sixty-four controlled original/current render comparisons match every pixel
  and visible bone matrix, including hidden/revealed fields and bursts. They
  share untouched GLTF assets; the reference adapter disables newly added rig
  culling while using the frozen original view and Lux update code. Separate
  loader-cache comparisons with isolated one/two-pixel differences remain
  preserved as unaccepted diagnostics. No pixel tolerance was introduced.
- All 30 source rigs pass 12,248,667 sampled skinned-vertex checks across
  their clips and blends. Five paired culling-on/off camera views preserve every
  pixel and shadow while removing main-render calls.
- Nested production hosting passes with 32 recordings and no development hook.
  The fresh offline audit passes all controls for 939 files/
  506,612,807 bytes, with zero production errors.

Schema remains 125. The strict ruleset changes from
`9dc8977c24e239714f3f97409f8a6bde24b073be88c72b6a1ae63e64a16519d3` to
`982958c23a5e30418d2a752119a499c15f6f42ac161331de5e7bf70e65cc91c5` because the World query implementation changed.
Older saves fail the application's existing strict ruleset check. The checkpoint
header rebase is test-only; this change does not add save migration.

The [evidence record](reference/vision-culling-verification.json) pins 1,591
inputs, the 30 rig GLBs/metadata, raw observations, failed attempts and delivery
results. The original duplicate-ally test fixture, benchmark listener startup
race, independent-cache pixel probes and older-type declaration build failure
are retained. The first small test's inputs were reconstructed retrospectively
after its one-line correction; they are not represented as a pre-run freeze.
Existing uncommitted Zenith kernel work is preserved. The full project goal
remains active.

For repeatable checks, keep validation serial and use fresh output paths:

```sh
node tools/qa/check-rig-culling.mjs http://127.0.0.1:5198 .cache/my-culling.json
node tools/qa/benchmark-energy.mjs http://127.0.0.1:5198 .cache/my-energy/result.json
```

Stop the development server before the comparison tool, which owns port 5198.
Optional arguments select frozen Lux/model code; `--shared-assets` uses the
controlled GLTF cache and baseline culling policy described above.
