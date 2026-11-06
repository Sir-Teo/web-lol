# Source legacy spawn shapes

`SourceLegacySpawnShape` handles the strict Baron closure's legacy offset,
ordered axis/angle turns and implicit zero translation. Empty probability tables
still consume their per-channel draws: Baron's zero-offset SmokeTrail consumes
three, despite producing the origin. Pins preserve these draws. Offset, raw
position and row-major turn remain separate float32 buffers. A nonzero angle
about a zero axis retains the external turned flag even though its matrix is
identity. Inputs and returned buffers own their storage.

All 59 legacy cases and 77 point/sphere/cylinder cases pass (136 total).
The 54 independent legacy samples execute pinned external shape, basis and value
functions without importing this helper. They include actual Baron smoke,
composed rotations, oblique/zero axes, three phases and three pin policies.
All float32 bytes, turned flags and draw counts match. TypeScript passes.
See `artifacts/source-legacy-shape-tests.log`; reproduce with
`node tools/assets/export-source-legacy-shape-samples.mjs --check`.

This adapter covers the current strict source's absent birthTranslation. An
expanded authored translation field requires an explicit compiler/adapter
extension. Actor placement, emission meshes, flex and final vector transforms
remain separate. No native CPU/PRNG/update or visual certificate is implied,
and no active renderer changes in this step.
