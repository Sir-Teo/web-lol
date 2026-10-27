# Native ray primitive packet

The [ray witness](reference/native-ray-packet.json) connects the candidate
`VfxPrimitiveRay` registration to both constructors, a virtual method and a
primitive-dispatch site. It records seven complete native function spans and
forty separately checked instruction words. The producer reads frozen ARM64
bytes directly, without Capstone, LLVM, shader compilation or target execution.

| Observation | Frozen location / value |
| --- | --- |
| Candidate type hash | `a14bd4d0` |
| Registered object size | 24 bytes |
| Kind byte in both constructors | 2 at object offset 8 |
| Primary vptr | `0x102482228` |
| Virtual slot | `+0x28` → `0x1018d9178` |
| Dispatch | Definition `+0x60` primitive → vptr → slot `+0x28` |

The builder writes four indexed vertices and two triangles. Each vertex has
28 bytes: position float3 at byte 0, packed BGRA at byte 12, UV0 half4 at byte
16, and UV1 half2 at byte 24. UV0 receives affine corner coordinates and two
supplied per-particle frame components. Unlike the selected fast quad routine,
this function does not calculate an atlas frame from `numFrames` and age.
The frame values already reside in its input records.

UV1 can receive per-vertex affine coordinates when optional UV data is selected.
One branch instead loads a coordinate pair from draw-record offset 32, zeros
the four affine coefficients and converts that same pair to half on all four
vertices. This establishes a conditional packet path, not the producer-side
mapping from source texture/lookup controls to that branch.

The byte colors have a different path from the
[fast quad packer](NATIVE-ATLAS-RUNTIME.md):

1. Multiply the draw-record RGBA by definition `modulationFactor` at `+0xe0`.
2. If `(blendMode | 2) == 2`, multiply RGB by alpha and set alpha to 1.
3. For finite components, clamp at zero and one. Inside the unit range,
   convert float32 `fma(value, 255, 0.5)` to an unsigned integer.
4. Store bytes in B, G, R, A order.

The emitter field registration identifies candidate `blendMode` at `+0x14` and
candidate `modulationFactor` at `+0xe0`. The latter's wrapper registers descriptor
tag 13 and the constructor stores four float ones there. These are field/hash
and layout observations; names remain candidates rather than native literals.
The fast color helper separately multiplies by 255 and truncates, without the
ray path's `+0.5` or unit clamps. Exact finite examples distinguish them:

| Component | Ray builder byte | Separate fast helper byte |
| --- | --- | --- |
| 0.5 | 128 | 127 |
| 1.5 | 255 | 126 |

The second fast-helper result follows its low-byte masks after unsigned
conversion. These arithmetic examples do not execute native instructions or
establish live GPU color-space, normalization or blend state. Applying one
packer globally would discard a real distinction between the recovered paths.

The builder consumes 24-byte optional UV records, 44-byte draw records and
172-byte transform records. The later
[draw-data witness](NATIVE-RAY-DRAW-DATA.md) corrects this checkpoint's initial
register reading: draw-record field 20 controls width, field 24 controls length,
and field 28 controls near-edge displacement. The native temporary spills reorder
the registers, while the prepared record retains X/Y/Z order. The immutable
original JSON retains the earlier interpretation; the new witness records the
correction and complete producer/consumer spans. Authored birth input,
orientation, history and clocks remain separate work.

No game behavior changed in this evidence checkpoint. The later
[ray packet correction](PRIMARY-HIT-RAY-PACKETS.md) applies half lookup and
normalized-byte color precision to the local sampler while preserving its
frame and geometry policies. Actual Yi dispatch, live shader selection,
transform producers and live FPCR remain unresolved. The later draw-data witness
establishes prepared scale writes and ray consumption without changing geometry.
Original missing historical LLVM archives are neither replaced nor certified.

The later [particle vertex-format witness](NATIVE-PARTICLE-VERTEX-FORMAT.md)
traces the matching first 28-byte layout through Metal's normalized-byte color,
half4 UV0 and half2 UV1 declarations. Prepared-record producers and draw-specific
layout/shader selection remain separate work.

The later [camera-quad packet trace](NATIVE-CAMERAQUAD-PACKETS.md) locates the
truncating helper in legacy and optimized-local quad routes. Its optimized
billboard route instead uses clamped, rounded packing. The optimized quad
dispatcher skips ray kind 2; these paths do not establish one color conversion
for every primitive.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_ray_packet.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-ray-packet.py
```

Thirteen guard cases cover exact offline replay, each function's bytes and each
selected instruction, both kind constructors, callback/vptr/virtual-slot
changes, function bounds, field hashes/offsets/wrappers and concrete color-path
counterexamples. The [verification ledger](reference/native-ray-packet-verification.json)
retains normal/optimized checks and the unchanged application identity.

The [modern ray coverage increment](REMAINING-RAY-PACKETS.md) applies this byte
format to the two Leona W rays and Garen's critical AA, Q impact and R kill ray.
It preserves their raw source curves and verifies the new owned streams against
independent C-derived words, material GPU probes and real game flows.
