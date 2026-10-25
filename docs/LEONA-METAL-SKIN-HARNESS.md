# Original Metal attached-skin fixture

The retained original skinned-mesh VS0 and PS34 now execute together in an owned
synthetic Metal harness. All 88 RGBA8 samples match the local WebGL skin material
and independent scalar reference byte for byte on the recorded Apple M1,
OS 27 build 26A428. The League executable is never launched. This checks the
explicit shader/palette fixture; native Leona dispatch and gameplay frames
remain open.

## Program and fixture boundary

The [static ABI record](reference/leona-skin-metal-abi.json) identifies the exact
unchanged libraries and their extraction from previously retained Riot bundles.
VS0 uses `DISABLE_FOW`; PS34 uses `DISABLE_FOW` and `ALPHA_EROSION`. Their varying
locations and types match: tint `locn0 float4`, UV/clip-W `locn1 float3`, rim
`locn2 float3`. The initially inspected VS5 emits rim at locn3 and cannot be
assumed to pair with PS34. VS0's original AIR bitcode is decoded to inspection
text with LLVM passes disabled; the captured host-retarget warning does not
alter the original library or bitcode. Normal and optimized-Python static
checks verify the retained bytes without invoking a compiler.

The owned Swift harness loads the original libraries unchanged. It supplies all
buffers, textures, samplers and render state. Vertex buffers are bones at0
(12,288 bytes, 256 transforms of three float4 rows), frame at1 (560 bytes) and
locals at9 (144 bytes). The owned attribute stream uses buffer20 with a64-byte
stride: position0, weights12, normal28, uint joints40, UV56. These offsets are
fixture packing, not evidence of Leona's native vertex layout. Every palette
entry is initialized; all four joint loads are valid even for zero weights.

The frame uses an explicit row-packed orthographic projection and camera z1000.
The WebGL side uses the same geometry and skin weights with identity mesh,
bind and inverse-bind matrices. Bones encode the supplied row transforms; normals
use the forward weighted upper matrix in both shaders. Scalar output evaluates
each vertex's skinned position/normal and rim, then its center barycentrics.
Clip W is1 in all cases. No inverse-transpose, weight normalization or
fragment-level rim substitute is introduced.

PS34 receives its32-byte erosion block at16, textures0 remap/1 erosion/2 base,
and samplers0 erosion/1 base/15 shared. The fixture uses explicit nearest/clamp
sampling, one pixel, no blending, no depth test and no FOW. Depth push is zero;
the local skin material does not implement that native vertex input. Remap RGB
is a constant texel. No native lookup/cube/default-resource or sampler policy is
inferred from these choices.

## Recorded observations

The first87 cases passed; the final88 add a valid joint255 control. All native
command buffers complete, WebGL errors are zero and maximum channel differences
are zero for Metal/scalar, WebGL/scalar and Metal/WebGL. Coverage includes:

- base and tint alpha, front/back/oblique normals and both mapped W powers;
- raw versus mapped exponents, including black tint with visible pre-tint-alpha rim;
- remap alpha0/1/255, erosion channel mixing/drive/band and transformed two-texel UVs;
- translated, rotated and scaled bones, four-bone blending, per-vertex weights,
  interpolated vertex normals and the palette's upper bound.

With black base RGB, full base/tint alpha and the oblique normal, raw .05 gives
`[11,8,4,255]` while mapped .345 gives`[68,50,26,255]`; raw .15 gives
`[32,24,12,255]` while mapped .835 gives`[135,100,51,255]`. All three implementations
produce these exact fixture bytes. The shader power is the mapped CPU input;
this does not prove a specific native Leona draw selected that program.

An independent read-only review checks the harness against retained AIR and the
installed Three skin chunks, including row packing, full palette initialization,
normal transforms and interpolation. The owned harness rejects joint256 before
draw encoding, after library/pipeline creation. Degenerate normals, cancellation
and camera-coincident vertices are excluded from the valid fixture; this is not
a generic malformed-input contract. Nonidentity bind transforms, perspective,
spatial remap ramps, nonzero depth push, native render state and gameplay frames
remain untested.

The [runtime ledger](reference/leona/metal-skin-verification.json) freezes owned
sources, original library/AIR/ABI inputs, compiler version, exact commands,
executable hash, stdout/stderr, all samples and pixel comparisons. Its offline
verifier submits no GPU work. Missing-case, altered-pixel and changed-library
record controls are rejected. The initial offline verifier indexed the saved
WebGL wrapper as an array; that lookup is corrected and the frozen failure
reproduction is retained. Earlier rim/reflection/depth shader ledgers remain
separate.

```sh
# Explicit opt-in: compiles only the owned Swift harness, then executes original shaders.
node tools/qa/run-leona-metal-skin.mjs --run --output .cache/my-fresh-skin-run
# Read-only evidence verification; no compiler/library/GPU execution.
node tools/qa/verify-leona-metal-skin.mjs
```

QA TypeScript and the three Node QA tests pass. This increment changes no game
material, source asset, schema126, ruleset`2f2d7dac` or accepted pack`39440090`.
No new production/offline run, normal-match cohort, performance, playable Leona,
support or full-roster acceptance is claimed.
