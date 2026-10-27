# Reuse ray placement scratch

Ray surface updates reuse an owned ray descriptor, three vectors and a size
triple. The eye-relative vector uses the surface's existing scratch vector.
The quad writer checks vector components directly instead of spreading five
iterables into a temporary validation array. Particle inputs, corner arithmetic,
UVs, camera-facing policy, packed colors and transparent sorting are preserved.

The reference is the complete source graph and matching lock at
`552e1562caaab7280113c17649097ded9a693ee0`, archived before bundling. The portable
placement benchmark accepts an explicit full reference commit and can isolate
rays with either uniform colors or the normalized BGRA stream. Its snapshots
include the packed color buffer, and particle inputs are recursively frozen.
Existing callers retain their earlier reference commit by default.

Seven alternating trials on 12 live ray fixtures measured:

| Runtime | Updates per trial | Reference median | Reused scratch median | Time reduction |
| --- | --- | --- | --- | --- |
| Node 24.19.0 | 500,000 | 1,293.69 ms | 930.33 ms | 28.1% |
| Chromium 154 | 100,000 | 249.10 ms | 183.90 ms | 26.2% |

These are placement-update measurements with captured source particles. They
exclude particle sampling, asset decoding, GPU rendering and game startup; they
do not establish a game or full-match FPS improvement. A preliminary shorter
Node run had noisier timings and is retained separately from the longer final
measurement. The mixed-fixture and uniform-color checks establish equivalence;
no timing claim is made from their shorter runs.

All 72 mixed fixtures, containing 714 particle states, match the frozen
renderer exactly, including transforms, uniforms, position buffers and UVs.
The separate uniform-color and packed-color ray checks preserve all buffers and
leave inputs unchanged. Forty-eight focused checks pass. The full suite records
3,095 passing tests out of 3,097 across 391 files, retaining the two baseline
failures without changing assertions or goldens. TypeScript and all six Node QA
cases pass.

Ten browser cases pass. Both the existing 72-case placement oracle and an
additional 72-case packed-color comparison against checkpoint `552e156` retain
zero changed pixel bytes, with 60 nonempty renders in each. The 84 ray-packet and
15 quad-packet comparisons remain exact. Save/reload, 130 future ticks, all 93
GPU mip readbacks, visibility tails, actual emitter materials, sword batching
and combined effects retain their acceptance checks. The
[verification ledger](reference/ray-placement-scratch-verification.json) records
the final production result and source snapshots.

The production build and nested-path smoke check pass all 32 recordings, with
eight fresh screenshots and zero unintended private preloads. Schema remains
163. The offline pack contains 1,200 files / 538,085,030 bytes, 239 bytes larger
than the preceding accepted pack. All 14 accepted primary-hit exports retain
their bytes and timestamps; no public assets change.

```sh
node tools/qa/benchmark-surface-placement.mjs \
  --reference-commit 552e1562caaab7280113c17649097ded9a693ee0 \
  --ray-only --packed-colors --iterations 500000 \
  --output-dir .cache/ray-placement-fresh
```

The native ray-axis investigation remains separate. This optimization retains
the accepted local geometry and does not infer unresolved native attachment,
transform or orientation producers.
