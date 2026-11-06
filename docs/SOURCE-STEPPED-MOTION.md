# Source stepped local motion

`sourceSteppedMotion` preserves the field-free stepped integrator's float32
writes: birth/live acceleration updates stored velocity, live carried velocity
adds only to the moving vector, then summed drag adjusts both. Drag clamps when
it would cross zero. Position advances by the resulting moving velocity. A fresh
birth uses zero delta on its first update; it does not advance by fractional age.
Inputs remain unchanged and returned buffers own their storage.

All 89 cases pass. Independent fixtures execute selected pinned external
integrate/drag functions with supplied sampled values, infinite lifetime and
no-op spin/placement/carry. They cover 64 single-step cases and 21 Baron birth
velocity/drag replays, totaling 1,260 replay steps. Every position, stored/moving
velocity and fresh flag matches exactly. Cases include carried velocity, negative
drag, overshoot, acceleration and rounding-sensitive values. Source pool.spawn
marks births fresh, and the integrator clears that flag after the zero-delta step.
TypeScript passes.

See `artifacts/source-stepped-motion-tests.log`; reproduce with
`node tools/assets/export-source-stepped-motion-samples.mjs --check`.
The [pinned motion readers](reference/baron-motion-readers.json) retain verified
Git blob/SHA-256 identities. Prior birth fixtures are also pinned by hash.

This is local-frame motion, not complete particle playback. The caller samples
live curves, retires expired particles and applies world acceleration integrals,
spin, emitter placement, binding and world transforms separately. Force fields,
analytic drag and native CPU/PRNG/cadence remain outside this certificate.
No gameplay or active renderer changes here.
