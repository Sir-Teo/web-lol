# Native generic SCB normal construction

The matching arm64 executable supplies a concrete normal-generation path for the
retained SCB3.2 meshes. It normalizes each face cross product, snaps small
components, accumulates by original vertex index, normalizes the vertex sums,
and expands them to face corners. It does not use triangle-area weighting or
weld coincident positions. The resulting normal triples bind attribute2 at byte12
in a36-byte vertex record, matching the retained ordinary-mesh shader input.

This closes the generic normal-construction prerequisite. It does not establish
actual Zenith sword dispatch, reflection resources or a native frame. The
[existing reflection material](LEONA-E-REFLECTION.md) remains an explicit-input
prerequisite. GameView, existing GLBs, runtime code and assets are unchanged.

The [pin](reference/leona-native-scb-normals.json) retains nine complete bounded
LLVM word streams, original native byte spans, four complete SCBs and derived
normal data, plus a local Chrome comparison. These are ordinary static bytes
and host-derived data, not REA MCP Evidence. No native target or native shader
was executed; the comparison runs the local Three normal-direction shader.

## File and buffer chain

`1018980a0` creates a mesh object and calls `10199326c` with mode1. That wrapper
calls file parser `1019932dc`; on success it updates bounds through `1019918b4`
and, for nonzero mode, calls buffer builder `101991bd4`. The bounds helper does
not rewrite the source position array before normal generation.

The parser's SCB3.2 layout agrees with every retained source byte:

- Fixed header152 bytes, then24 bounds bytes and a vertex-color DWORD at176.
- Float3 positions begin at180, followed by optional4-byte vertex colors, a
  12-byte pivot,100-byte face records and optional9-byte face RGB triples.
- Each face begins with three U32 source indices. The native reader stores them
  as U16; all indices in the four source files fit without truncation.
- No authored normal array occurs in these complete source extents.

Builder `101991bd4` calls normal routine `101991fa8`, then creates three36-byte
vertex records per face. Position occupies bytes0–11, normal12–23, color24–27
and UV28–35. Calls at `101991e6c–e78` supply normal slot2, offset12 and stride36.
The declaration's low word at `102133d60` is `00030002`; backend interpretation
of format enum3 is not independently claimed. The copied triples and retained
VS33 AIR input metadata independently establish the float3/attribute2 contract.

## Arithmetic and source-index identity

Face helper `101991730` reads vertices in face index order0/1/2. With rounded
float32 edges `u=b-a` and `v=c-a`, its cross product is:

```text
x = fma32(uy, vz, -f32(uz * vy))
y = fma32(uz, vx, -f32(ux * vz))
z = fma32(ux, vy, -f32(uy * vx))
```

Normalizer `10167c54c` computes length² in the exact order
`fma32(z,z,fma32(x,x,f32(y*y)))`. It normalizes only when length² exceeds
bits`3089705f`, or9.999999717180685e-10. A shorter vector is left unchanged;
there is no invented zero or fallback direction. Otherwise it takes a float32
square root and reciprocal, then multiplies the components.

After face normalization, components with absolute value strictly below
bits`3a03126f`, or0.0005000000237487257, become positive zero. Equality survives.
The face is not renormalized after snapping. `101991fa8` adds this face vector
to each original source vertex in corner order, visits faces in SCB order,
normalizes every resulting source-vertex sum once, and expands by the unchanged
face indices. UV splits and coincident positions do not invent new smoothing
relationships.

`tools/assets/scb_native_normals.py` transcribes those operations for finite,
original float32 points and U16-compatible source indices. Exact rational FMA
rounding avoids substituting rounded multiply-plus-add. Host square-root/divide
operations use binary64 followed by binary32 rounding; native FPCR settings and
numerical native-versus-host/GPU parity remain unobserved.

## Derived data and local comparison

All four streams are derived data, not authored SCB normals. Their source arrays
and packed float32 hashes are pinned separately. The889 source vertices and
1,687 triangles produce5,061 corner normals, with no zero vertex normal in
these files. The two swords each have333 source vertices and648 triangles.

An independent area-weighted mathematical control differs by up to23.19° on the
outer sword and83.13° on the inner sword. These are differences between derived
algorithms, not measured native-frame error. The retained local normal-color
comparison uses unchanged source GLBs, the same camera and original index
identity. It observes8,370 changed pixels for the outer sword and5,048 for the
inner, with no page/console errors. It does not use the native reflective shader
or claim final effect appearance.

The first standalone preview timed out because its local module allowlist
omitted the existing SkeletonUtils dependency. Adding that route fixed the
fixture. The failure record remains retained. The final four-panel image was
visually checked with both swords fully in frame.

## Verification and remaining work

```sh
python3 tools/assets/scb_native_normals.py --check
python3 tools/assets/verify-leona-native-scb-normals.py --check
python3 -O tools/assets/verify-leona-native-scb-normals.py --check
```

The offline verifier checks whole/arm64 identity, every retained LLVM word,
adjacent function-start bounds, selected arithmetic/binding instructions,
branch targets, shader metadata, complete source extents and recomputed derived
streams. Six mathematical controls cover fused cancellation, tiny-vector
retention, equal face weighting across unequal areas, distinct coincident source
indices, strict post-normalization snapping and degenerate no-fallback behavior.
Negative controls reject an altered arithmetic word and a modified derived
normal. The independent static review agrees with the operation order, strides,
file layout and derived hashes. No analyzer, provider, compiler, network or
target is invoked by the verifier.

The next integration still needs reflection uniform/resource bindings, selected
variant/draw dispatch and the effect's source/world frame policy. No visible E
or R family count increases here. Native frame acceptance, player/support and
the full roster remain open. Schema126 and ruleset591ddf38 remain unchanged;
no new production/offline/cohort/performance run is claimed.
