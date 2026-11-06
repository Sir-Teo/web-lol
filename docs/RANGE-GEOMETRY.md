# Attack-range geometry reuse

The attack-range indicator now keeps its 96 terrain-conforming vertices while
its champion's position and attack range are unchanged. Previously every visible
frame resampled terrain, rewrote the position buffer, marked it for upload and
recomputed its bounding sphere. Movement or a range change rebuilds the geometry;
changes while hidden are applied when the indicator becomes visible again.
Terrain elevation is immutable for the lifetime of a GameView. The cache is
view-local, so match replacement and camera changes cannot reuse another
battlefield's elevations.

The browser regression covers the practice fixture (120 stationary renders) and
full Rift (eight stationary renders). Both observe zero stationary buffer-version
increments, one increment on movement, one on a range bonus, no hidden rebuild
and one rebuild after showing the moved indicator. Cached and explicitly rebuilt
frames compare exactly by synchronous WebGL pixel readback, with nonempty color
buffers. Screenshots were reviewed for both maps. The retained [fixture](reference/range-geometry/fixture.json) and
[Rift](reference/range-geometry/rift.json) results contain the assertion values; screenshots remain in Playwright's ignored output.

Verification on November 6, 2026:

- Production build and TypeScript pass.
- Both new browser scenarios pass with system Chromium and `--no-sandbox`.
- Existing paused/hidden energy-idle and terminal wall-clock scenarios pass.
- Node QA passes 39/39; `git diff --check` passes.

This is an operation-count reduction, not a measured FPS or physical-device
performance improvement. Full-match profiling, source-client comparison,
result-loop sleep, production/offline revalidation and the previously documented
full-suite failures retain their earlier status. Simulation rules and save format
are unchanged.
