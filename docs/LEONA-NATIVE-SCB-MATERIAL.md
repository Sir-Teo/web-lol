# Native SCB color selection, alpha test and particle tint

The matching native executable distinguishes an SCB cache branch from an earlier
resource-format branch. In the identified SCB branch, the sword's missing authored
vertex BGRA leaves `USE_VERTEX_COLORS` off, even though the GPU builder supplies
packed face colors. The ordinary blend-zero state path enables alpha testing
for a nonzero reference, and its CPU tint path premultiplies RGB then forces
`kColorFactor.a` to one. These are conditional generic paths, not an observed
Leona E invocation or native frame.

The [pin](reference/leona-native-scb-material.json) retains23 bounded native word
streams, immutable tables/strings/vtable entries, source SCB bytes and four
additional original Metal/AIR programs. The [earlier reflection-input package](LEONA-NATIVE-REFLECTION-INPUTS.md)
retains the CPU rim/default and fresh-empty-map resource condition. Ordinary
Apple LLVM/file reads and host-generated textual AIR are the observations; there
are no REA MCP Evidence IDs and no native game/shader execution or provider restart.

## Primitive, cache and color flag

The registered `VfxPrimitiveMesh` hash `8594e839` has allocation callback
`10193a73c`, kind3 and vptr `1024861e0`. Its virtual methods at `+0x68` and
`+0xc0` return one and `this+0x10`, respectively. The generic older initialization
path calls those methods and supplies component `+0x24` as the SCB-cache output
index to `1018980a0`. That manager creates/loads the SCB and stores `(hash,pointer)`
in 16-byte entries at manager `+0x110`, then writes the index through its output.

Selector `1018901cc` first tries a separate 40-byte resource cache at manager
`+0xf0`, indexed through component `+0x1c`. That branch reads a returned resource's
`+0x40` format-like value; its enum/type remains unresolved. It is not the SCB
header or SCB `+0x40`.

If that earlier resource is unavailable, `101890350–36c` reads component `+0x24`,
manager `+0x110` and its exact SCB pointer. The branch at `10189036c` targets
`1018903c0`; `1018903c4` reads SCB byte `+0x7d`. That value controls adding
`USE_VERTEX_COLORS` at `101890604–61c`.

The SCB constructor zeroes `+0x7c/+0x7d`. Its parser checks the source header's
has-vertex-colors DWORD at file offset176; only a nonzero value allocates/copies
authored vertex BGRA and sets `+0x7d` to one. The sword has DWORD0. Thus this
identified SCB load/selection branch uses the vertex-color-free VS1/20 pair.
The separate first resource attempt, other resource/default paths and the live
Leona route remain unobserved.

## Packed face color is a separate stream

The source sword has333 vertices,648 faces and1,944 corners. Its flags are one,
with5,832 trailing face-RGB bytes, all zero, and no authored vertex BGRA. The
native parser initially assigns white packed corner colors, then the flags-bit0
face reader overwrites each corner word with:

```text
0xff000000 | (R << 16) | (G << 8) | B
```

This source therefore yields conditional packed word `ff000000`: black RGB,
alpha255. With no authored BGRA, the GPU builder copies those packed face words
to attribute3, offset24, stride36. The buffer's existence does not itself enable
its shader use. VS4/31 consume attribute3, swizzle BGRA to RGBA and multiply it
by `kColorFactor`; VS1/20 emit `kColorFactor` directly. A black face-RGB stream
alone does not establish an invisible effect or which native shader was selected.
The rim is also a separate additive term.

## Alpha-test state and arithmetic

The old ordinary state path reads alphaRef from emitter `+0x77`; the newer path
uses Legacy component `+0x11`. For ordinary blend-zero dispatch, a nonzero byte
adds `ALPHA_TEST` and uploads unsigned byte/255 as `AlphaTestReferenceValue`.
Pass-kind1 and other custom/phase branches can bypass this route. The prior
constructor/loader package supplies the source omission/default byte five;
conversion into a live Legacy component and actual state invocation remain open.

| Additional retained flags | Program | Define hash |
|---|---:|---|
| VS USE_VERTEX_COLORS | 31 | `0572d84bd37124c8` |
| VS DISABLE_FOW + USE_VERTEX_COLORS | 4 | `1b6d3caa38719145` |
| PS ALPHA_TEST | 772 | `5c7fef8e6508748d` |
| PS DISABLE_FOW + ALPHA_TEST | 24 | `f9fbbee4b3db74fe` |

All programs come from previously verified TOC/bundle files; no network fetch
was required. PS24 samples base, particle lookup and global remap, then:

```text
C = base * interpolatedTint * lookup
mapped = remap(dot(C.rgb, [.2126,.7152,.0722]), .5)
if C.a - AlphaTestReferenceValue < 0: discard
RGB = clamp((mapped.a > 0 ? mapped.rgb : C.rgb) + C.a * rim, 0, 1)
alpha = C.a
```

Equality survives. Remap is sampled before the discard, but remap selection,
rim addition and clamp occur afterward. Remap alpha never supplies the test
value or output alpha. PS772 additionally evaluates fog; no native fog bindings
or selected pass follows from its retention.

## Blend-mode tint packing

`blendMode` hash `fa784eab` is registered as U8 at emitter `+0x14` and Legacy
component `+0x0a`. Both constructors initialize that byte to zero. Sword2 omits
the field in the owned source BIN; the generic reader preserves the emitter
constructor's zero through its return. Later processing remains outside this
proof.

The old/new tint consumers combine input particle RGBA and component RGBA as C.
They test `(blendMode | 2) == 2`, which is true exactly for U8 values0 and2:

```text
kColorFactor = [C.r*C.a, C.g*C.a, C.b*C.a, 1]  // modes0/2
kColorFactor = C                             // other modes
```

The old/new identifier globals are `1025e8568` and `1025320d8`. Their initializer
windows name the exact Cstring `kColorFactor` at `10227778c`. Native VS1 metadata
names the same float4 at Globals offset112, which is emitted as TEXCOORD0 and
consumed by PS24. An intermediate research message called it `vColor`; exact
literal/AIR checks caught and corrected that label before this package was
accepted. No alias is inferred.

Consequently, on this conditional blend-zero path, the alpha test and rim use
base-texture alpha times lookup alpha; the particle tint alpha has already been
used for RGB premultiplication and replaced with one. The older local shared
surface adapter premultiplies RGB while retaining alpha. A family-specific
sword adapter can follow this newly identified packing while earlier W/R local
policies remain separate. No global native blend semantic or accepted W/R
change is inferred.

## Verification

```sh
python3 tools/assets/verify-leona-native-scb-material.py --check
python3 -O tools/assets/verify-leona-native-scb-material.py --check
```

The verifier checks the prior native-input package, every bounded instruction
word, source counts/flags/color bytes and conditional packed output, native
color/alpha gates, exact literals/method pointers, original shader ranges/AIR,
TOC selections and strict alpha/remap/rim ordering. The independent tint audit
included then-current local source; its exact pre-sword-tint bytes are frozen
separately so later adapter edits do not overwrite that historical observation.
No native GPU numerical parity, frame or production claim follows.
Normal/optimized Python checks pass. Four altered-evidence controls reject a
changed source color flag, blend default, alpha permutation and native color-flag
instruction word.
