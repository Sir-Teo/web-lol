# Packed trail traversal

The separate `packedSourceTrailRibbon` kernel supports the pinned external
writer's off/front-to-back/back-to-front traversal modes (0/1/2). It preserves
float32 intermediate writes, birth-order filtering, per-point width, raw-side
miters, camera fallbacks, WAKE parity, and cutoff. Its oldest-first inputs carry
independent base and multiplier UV transforms, cells, color, lookup and erosion.
Visibility splits runs before filtering; this is caller fog policy.

The current adapter supports centred, unflipped layers in WAKE mode. It does not
replace the existing Zenith or Baron helpers. Source/world attachment, texture
sampling, quality reach, missing smoothing defaults and native cadence remain
caller decisions. In particular, a declared mode 2 is not silently mapped to 1.

Forty-two independent fixtures execute the unchanged external writer pinned by
`docs/reference/leona-e-kernel-readers.json` (SHA-256
`ada3d66b955dee7916f10e5b76417a9d7985bbbca337afcd551a7f30fa5cbe68`).
Fixtures cover all three modes at reach 0/3, curved/arbitrary/camera trails,
degenerate views and duplicate points, cutoff, visibility separators, varied
tiling, and independent rotated/scrolled secondary UVs. All vertex fields match
exactly; three additional tests cover pins, visibility, ownership and invalid
inputs (45 tests total).

Reproduce the fixtures with the retained external reader cache:

```sh
node tools/assets/export-packed-trail-samples.mjs --check
npx vitest run tests/source-packed-trail-ribbon.test.ts --maxWorkers=1
```

Unit tests use committed fixtures and need no private cache. The exporter
verifies both the original reader extent and hash before executing it. This is
external-writer agreement, not native CPU, shader, timing or pixel equivalence.
