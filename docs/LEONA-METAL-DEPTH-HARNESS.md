# Original Metal depth-push ordering

The owned harness now compares original VS1/PS9/PS24 and VS33/PS54 output with a
controlled depth plane. All 267 RGBA8 samples match Metal, WebGL and the scalar
reference exactly on the recorded Apple M1: 153 rim cases and 114 reflective cases.
The six added cases exercise push values `-.5`, `0` and `.5` against a plane at world
z `-.25`. The original League executable and its render-state selection remain
unobserved.

| Push | Original rim RGBA8 | Original reflective RGBA8 | Result |
|---:|---|---|---|
|-.5 |18,28,67,23 |39,55,99,23 | particle visible |
|0 |18,28,67,23 |39,55,99,23 | particle visible |
|.5 |0,255,0,255 |0,255,0,255 | green plane visible |

The original vertex programs apply push along the normalized camera-to-world
particle ray. Positive push moves these points away from the camera and behind
the plane; negative push moves them toward the camera. Rim/reflection inputs
are evaluated before the displacement. The table tests well-separated depth
ordering; it does not establish threshold precision at a tie.

## Controlled fixture

The camera is at z 1000 with orthographic near `.1`, far 2000 and the same x/y
projection as the existing WebGL fixture. The Metal row-packed projection now
uses `clipZ=(999.9-worldZ)/1999.9`, accounting for its 0..1 depth range. The source
triangle and varyings are otherwise unchanged.

Metal uses a one-pixel depth32Float target. A green color clear and a depth clear
at the projected z `-.25` represent the fully covering plane, with `lessEqual`
testing and depth writes enabled for the three occluded cases. It draws only
the original particle shaders; it does not compile a substitute plane shader.
The WebGL probe renders its existing green plane geometry. With full coverage,
constant plane depth and no blending, both fixtures implement the same ordering
comparison. Cases without the plane use an always-pass state with depth writes
disabled, preserving earlier color results. All six added cases retain exact
backend/scalar equality, and the prior 261 synthetic cases remain byte-exact
after the projection/depth attachment change.

These explicit fixture states are not recovered native CPU pass, depth format,
attachment, blend or cull settings. Backend storage/rounding near equal depth,
arbitrary camera/projection, clipping/coverage edges, FOW, sampled soft depth,
multisampling and native compositing remain outside the result.

## Reproduction and evidence

On the supported retained-cache/macOS/Metal/Chrome setup:

```sh
node tools/qa/run-leona-metal-rim.mjs --run --depth --output .cache/my-rim-depth
node tools/qa/run-leona-metal-rim.mjs --run --reflective --depth --output .cache/my-reflection-depth
```

The [verification ledger](reference/leona/metal-depth-verification.json) freezes
both complete runs, original library and source hashes, compiled harness,
commands/stdout/stderr, cases, readbacks and comparisons. Offline verification
performs no GPU work and rejects missing-sample, altered-pixel and
changed-library-record controls:

```sh
node tools/qa/verify-leona-metal-rim.mjs --pin docs/reference/leona/metal-depth-verification.json
```

The earlier [rim](LEONA-METAL-RIM-HARNESS.md) and
[reflection](LEONA-METAL-REFLECTION-HARNESS.md) ledgers still verify with
`--historical` and their frozen case modules. No application/public asset,
schema126, ruleset or offline-pack change follows. Actual native Leona dispatch,
resources, full-frame acceptance and player/support/full-roster work remain open.
