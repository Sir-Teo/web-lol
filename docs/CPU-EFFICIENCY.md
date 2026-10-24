# CPU use while playing, paused, and hidden

The pause menu previously froze simulation but kept rendering the entire scene,
evaluating every rig, updating hover, HUD and audio at display refresh. A hidden
document took that same path. Paused and hidden matches now stop the animation
loop. A visible paused match repaints once after an interaction, resize or graphics
restoration; returning to a hidden match still requires explicit resume. Victory
presentation retains its scheduled animation and audio tails.

Active presentation is bounded to 60 Hz, independently of the fixed simulation
clock. Higher-refresh displays no longer multiply scene work. Animation bindings
remain active while their ordered blend is unchanged, with absolute clocks and
weights assigned at every sample. Hidden rigs stay cached outside the scene's
matrix traversal and restore their current saved pose on reveal. Health bars reuse
the actor's visibility result, empty Illumination marks avoid visibility queries,
and audio adapters share their filtered projectile/scout lists. Visual quality,
shadow resolution and simulation rules were not reduced. Vitest defaults to at
most two workers; browser validation remains serial.

## Observations

One Chrome 156 process on Apple M1 restored the same unfinished ten-champion,
120-second Rift checkpoint in fresh contexts. Each state was observed for roughly
six seconds after settling. The active phase also recorded a CPU profile. The
hidden phase deliberately overrode document visibility while keeping browser RAF
available, so the application's own background guard was exercised.

| Observation | Before | Final |
| --- | ---: | ---: |
| Active mean application render call | 14.68 ms | 12.44 ms |
| Active rendered frames | 317 | 322 |
| Active renderer task CPU / wall time | 6.105 / 6.279 s | 5.706 / 6.298 s |
| Paused full renders | 347 | 0 |
| Paused renderer task CPU / wall time | 6.041 / 6.191 s | 0.027 / 6.004 s |
| Hidden full renders | 358 | 0 |
| Hidden renderer task CPU / wall time | 5.259 / 6.004 s | 0.00054 / 6.004 s |

The final sample used **99.54% less paused renderer CPU per wall second** and
**99.99% less hidden renderer CPU**, with zero simulation steps in both states.
The instrumented active render call averaged **15.2% less time**; total renderer
task CPU per wall second fell **6.8%**. Intermediate observations are retained,
rather than selecting the most favorable active result.

These short, instrumented runs are observations, not isolated machine energy or
temperature measurements. Concurrent work from another project included CPU-heavy
software-rendered browser profiling. It was not terminated. Profiling, scheduling,
scene evolution and other work can affect the active timings. These results do
not certify physical refresh delivery, a full-match performance gate or lower-end
devices. The deterministic removal of paused/background renders and redundant
binding work is independently covered by the checks below.

## Verification and reproduction

The [evidence record](reference/cpu-efficiency-verification.json) retains input
hashes, raw result locations and verification scope. Validation freezes 1,588
inputs at schema 125 and the unchanged in-progress ruleset
`9dc8977c24e239714f3f97409f8a6bde24b073be88c72b6a1ae63e64a16519d3`.
The existing, uncommitted Zenith kernel work is preserved separately from this
performance change.

The production build and **1,765 unit tests across 291 files** pass, including
60-Hz budgets on 30/59.94/60/120/144/240-Hz inputs and exact Three.js mixer results
through 104 sequential blend, cut, seek and death samples. Three Node QA cases
pass. A frozen pre-change renderer and the final renderer produce identical
visible bone matrices and every framebuffer byte in forty samples covering
idle/run/blends, fog hiding/reveal, attack, death and respawn. Both renderers start
on the same fog-refresh boundary. An earlier comparison with different fog-cache
ages is retained and is not counted as visual acceptance. The browser validation
record covers **24 passing Chrome cases** for loop/reload clocks, graphics
recovery, explicit resume, Illumination visibility and terminal interpolation.
Nested production hosting passes with 32 recordings and no development hook.
The fresh offline audit passes all checks for 939 files/506,611,671 bytes, including
saved-tick boot, repair, new Lux matches and atomic version changes, with zero
production errors. Pack ID is
`0ed8d6d278bce1539191557327bff660de8f0658d069eb4d6702d4b4724caf8d`.

With a development server on port 5198 and a fresh output directory:

```sh
node tools/qa/benchmark-energy.mjs http://127.0.0.1:5198 .cache/my-energy-run/result.json
```

The first run creates its checkpoint. Subsequent comparisons in that directory
reuse it and require exact browser restoration. Reports and profiles refuse to
overwrite prior results. To compare drawing against a saved pre-change view,
stop the development server first; this tool owns a temporary Vite server:

```sh
git show dc1265c:src/render/view.ts > .cache/pre-energy-view.ts
node tools/qa/compare-energy-renderer.mjs .cache/pre-energy-view.ts .cache/my-energy-comparison.json
```

Keep validation serial. The existing bundle-size warnings and the broader
full-match/browser/native performance gates remain open.
