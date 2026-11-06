# Particle preview random stream

`ParticlePreviewRng` uses the pinned external viewer's Murmur finalizer,
xorshift32 and 24-bit unit draws. It is explicitly not the native xorshift64
stream and never borrows gameplay randomness. Signed state snapshots restore
without remixing; clones advance independently. Invalid seeds, state and range
endpoints reject without consuming draws.

All 11 tests pass, including 640 independent external draws across eight seeds,
JSON state restoration and clone futures. TypeScript passes. Reproduce fixtures
with `node tools/assets/export-particle-preview-rng-samples.mjs --check`.
Evidence: `artifacts/particle-preview-rng-tests.log`. This enables deterministic
local particle replay; it does not certify native randomness or visual fidelity.
