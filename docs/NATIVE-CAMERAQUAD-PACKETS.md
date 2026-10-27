# Native camera-quad packet routes

The [camera-quad witness](reference/native-cameraquad-packets.json) records eight
complete functions and 90 selected instructions. It connects the candidate type
registration, both constructors and the emitter-default constructor to the
legacy virtual vertex builder. It also checks the optimized quad dispatcher and
both of its packet helpers. The paths use different color conversions.

| Path | Selection | RGBA input at the checked site | Conversion |
| --- | --- | --- | --- |
| Legacy CameraQuad virtual builder | Vptr `0x102481ef8`, slot `+0x28` | Definition modulation × prepared draw RGBA | Float32 ×255, unsigned truncation, low bytes |
| Optimized local quad packet | Primitive kind ≤1, flag mask `0x2` set | Parent `+0x10/+0xe0` block copied to SP+`0x60` | Same truncating helper |
| Optimized billboard packet | Primitive kind ≤1, flag mask `0x2` clear | Same checked RGBA block | Unit clamps, float32 FMA(value,255,0.5), unsigned truncation |

Keep conversions tied to the recovered packet route. For finite unit input 0.5,
truncation produces byte 127 and the rounded path produces 128. The truncating
helper has no explicit unit clamp: finite input 1.5 produces low byte 126,
whereas the clamped path produces 255. Native FPCR and conversion edge behavior
outside these finite examples remain separate evidence.

The type hash candidate `96ddbc74` registers a 24-byte object. Both constructors
store kind zero and vptr `0x102481ef8`; the emitter constructor installs the same
vptr and writes the primitive pointer at definition `+0x60`. Its virtual slot
`+0x28` contains `0x1018d7f34`, whose complete function ends at `0x1018d8784`.
The inherited [primitive dispatch witness](NATIVE-RAY-PACKET.md) supplies a
matching definition-primitive → vptr → slot call site. This is static dispatch
lineage, not a captured live Yi invocation.

The legacy builder multiplies definition `modulationFactor` at `+0xe0` by
prepared draw-record RGBA. When `(blendMode | 2) == 2`, it premultiplies RGB and
sets alpha to one. It calls `0x10167faf0`, the previously
[verified truncating helper](NATIVE-RAY-PACKET.md). All four 28-byte vertices
receive the same packed BGRA word at byte 12. UV0 converts to half4 at byte 16,
and lookup coordinates convert to half2 at byte 24.

The optimized parent at `0x1018f1bc4` explicitly skips primitive kinds above
one, including the separately witnessed ray kind two. It copies the RGBA block
at parent `+0x10/+0xe0` to SP+`0x60` and supplies that pointer as X4. The
`particleIsLocalOrientation` candidate uses mask `0x2` (bit 1): a checked TBNZ
backedge selects `0x1018f18d8`, which passes X4 to the truncating helper.
Otherwise it calls `0x1018f11c4`, which repeats clamping and rounded packing for
each vertex. The exact relation of this optimized input to source color curves,
generated/author textures and live material binding remains unresolved. It is
not established as the same prepared RGBA product used by the legacy builder.

The legacy camera-quad size code independently confirms the
`isUniformScale` candidate's mask `0x8` (bit 3). It reads X/Y size lanes and
applies a shared factor; with that mask set it selects X for height, otherwise
Y. This is a camera-quad height selector. The
[ray birth-scale trace](NATIVE-RAY-BIRTH-SCALE.md) preserves independent ray
width, length and near displacement. The observations do not define uniform
scale for meshes or other primitives.

The [first particle vertex declaration](NATIVE-PARTICLE-VERTEX-FORMAT.md)
provides normalized unsigned-byte color, half4 UV0 and half2 UV1 for the matching
28-byte layout. Actual draw-specific layout and shader selection remain
conditional. No native executable or Metal shader was run; no application,
asset, rendering or source-curve policy changes in this evidence checkpoint.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/native_cameraquad_packets.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-native-cameraquad-packets.py
```

Seventeen guard cases cover exact offline replay, every complete function and
selected word, function boundaries, constructor kinds/vptrs, registration and
virtual targets, color helpers, the unsigned primitive filter and orientation
backedge, malformed branch opcodes and inherited pins/dispatch. The
[verification ledger](reference/native-cameraquad-packets-verification.json)
retains normal/optimized replay and the unchanged accepted application identity.

All 17 guards pass in both Python modes. Normal and optimized replay preserve
36 output files, including 30 distinct accepted runtime outputs and six witness
records, with identical bytes and timestamps. The application fingerprint and
production pack remain those of the accepted Meditate checkpoint; its full unit,
browser and production results are inherited. No new game-performance claim.

## Subsequent source-class queue lineage

The [particle queue route witness](NATIVE-PARTICLE-QUEUE-ROUTES.md) now follows
complex/simple source fields through a checked definition adapter, distinct
runtime constructors, queue insertion, the job virtual slot and this dispatcher.
It narrows the earlier unresolved queue-population question for that construction
path. Individual exported-effect membership, alternate loaders or mutation, live
admission and final material/layout selection remain separate. The original
packet record and its historical verification are unchanged.
