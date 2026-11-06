# Source UV and flipbook layers

`SourceUvLayer` retains complex emitter UV birth state, live transforms and the
eight-float affine rows a sampler consumes. It preserves float32 birth writes,
live scale/rotation sampling, integrated scroll/rotation, finite versus infinite
lifetimes, signed birth ramps, clamp/wrap/mirror/border behavior, flips, emitter
scroll routing and start-frame/wrapped flipbook order. Base and multiplier share
the same fractional book phase while retaining separate grids/scrolls. No RNG
is consumed here; the caller supplies the shared chance and roll.

All 900 cases pass. The 896 independent samples execute pinned external UV birth,
transform and affine-row functions with zero UV flex channels. There are 28
layers: 21 Baron base layers, their three multiplier layers and four synthetic
address-mode cases. Fixtures compare exact float32 birth/row bytes and float64
draw bytes across shared chances, age, finite/unbounded lifetime and quad/mesh
emitter-scroll routing. The synthetic cases add live rotation, integrated scroll,
negative ramps, noncentral pivots, flips and start frames. The shared-counter
case explicitly tests a fractional phase with different grids.

See `artifacts/source-uv-layer-verified-tests.log`; reproduce with
`node tools/assets/export-source-uv-samples.mjs --check`. TypeScript passes.
Prepared definitions and returned buffers own their storage. Invalid definitions,
birth state and clocks reject. The fixture pool uses local slot indices; it is
not a native pool-memory-layout check. The current strict Baron closure has no
UV flex channels. Materials/shader dispatch, native CPU/PRNG/cadence and visual
fidelity remain separate, and no active renderer changes here.

The [pinned parser/UV/flex readers](reference/baron-uv-flex-readers.json) retain
verified Git blob and SHA-256 identities. The external flex reader does not read
Baron's scaleBirthScaleByBoundObjectSize or scaleEmitOffsetByBoundObjectSize
fields. Their native actor-size convention remains open; no radius-to-size
mapping is inferred from this source.
