# Native BIN loading and Activate's omitted fields

The identified generic native BIN reader preserves constructor values for fields
absent from a serialized object. The retained R buff record reaches the relevant
wire types: LIST `0x80` of STRUCT `0x82`, with Activate declaring concrete emitter
type `09cde442`. Within this static loading chain, its omitted primitive, texture
and alphaRef retain CameraQuad, empty base name and five through reader return.
Actual live Leona loading, later mutations and material dispatch remain unobserved.
Activate stays excluded locally; visible R coverage remains41/44.

The [pin](reference/leona-native-bin-loader.json) retains five complete word streams
bounded by adjacent `LC_FUNCTION_STARTS` entries, original instruction spans and
exact source BIN bytes. The [constructor pin](LEONA-NATIVE-EMITTER-DEFAULTS.md)
supplies the matching executable, type registry, factory and default stores.
These are ordinary static file/LLVM observations, not REA MCP Evidence or a native
runtime capture. No target, shader or GPU execution occurred.

## Exact frozen source

The source is retained skin0 BIN v3, WAD path hash `8a4c7a0f7f10c5cb`, already
pinned by the [R source extraction](LEONA-R-SOURCE.md). Its entry hash identifies
`Characters/Leona/Skins/Skin0/Particles/Leona_Base_R_buf`.

The `complexEmitterDefinitionData` field begins at byte13791. Its header is
`6ab78e868082570a000004000000`: field hash `868eb76a`, LIST80, element STRUCT82,
encoded length2647 and four elements. Activate is element3 at bytes15710–16447,
concrete type `09cde442`, with18 serialized fields. The direct fields do not
contain hashes `007b14f6` (primitive), `3c6468f4` (texture), or `b99310f4`
(alphaRef). Its STRING `emitterName` is `Activate`.

The verifier walks the containing BIN header and entry table, establishes the
R buff entry's ownership, and recursively parses its field/value boundaries.
It does not treat the audit's listed field offsets as sufficient proof of
ownership or absence. The complete Activate extent and all18 field headers are
also compared with independently retained reader observations.

## Native loading chain

1. LIST reader `1016a50fc` reads the encoded element type and count. Its loop
   obtains each destination slot through the registered container handler and
   calls `10169e414` at `1016a5234` with the element wire type and field metadata.
2. `10169e414` compares the wire type with registered metadata byte+0x11.
   Its immutable table at `10212b6f8` maps STRUCT82, index2, to `10169e4dc`;
   the BL at `10169e4ec` calls `1016a5264`.
3. STRUCT reader `1016a5264` reads the concrete type hash, looks it up through
   registered descriptor hash+8, and checks the permitted parent/pointee type.
   It loads descriptor callback+0x10 at `1016a53d4` and invokes it at `53d8`.
   For registered `09cde442`, that callback is `101925434`, which calls emitter
   constructor `1018ac82c`.
4. After allocation, the STRUCT reader reads a U16 encoded field count at
   `1016a5418–5428`. The loop calls per-field reader `1016a49bc` at `5448` and
   stops after that count. It does not iterate every registered field and clear
   omissions after construction.
5. `1016a49bc` reads each encoded field hash and wire type, searches 48-byte
   registered field records by hash+8, follows parent descriptors when needed,
   and calls `10169e414` for a match at `1016a4b2c`. Unknown serialized fields are
   consumed by the skip path. A registered field absent from the stream does
   not receive a per-field dispatch in this loop.

Omission differs from explicit STRUCT null. When the STRUCT reader is invoked
for a **present** pointer field, `1016a52a4` clears an existing pointer and invokes
its destruction callback. A zero encoded type hash then returns without a new
allocation. Activate omits its primitive field, so this clearing path is not
invoked for that field within the identified chain.

An EMBEDDED83 reader, `1016a552c`, is retained for comparison. It also reads only
the encoded field count, but does not perform the STRUCT reader's default-object
allocation. Activate itself uses STRUCT82; confusing those routes would miss
the concrete constructor call.

## Offline verification and limits

```sh
python3 tools/assets/verify-leona-native-bin-loader.py --check
python3 -O tools/assets/verify-leona-native-bin-loader.py --check
```

The standard-library verifier first verifies the pinned constructor evidence,
then checks each new word stream against original native section bytes and
function-start bounds, direct BL targets, selected instructions and dispatch
bytes. A bounded current-format BIN parser independently checks source ownership,
lengths, concrete type, count and omissions. No external BIN reader, analyzer,
provider, bridge, compiler, network or target runs; no files are written.
Negative controls reject an altered Activate field count and a changed native
branch target. The separate CDTB-based audit agrees with the standard-library
wire parser.

This narrows the constructor pin's earlier missing-field gate to the actual
loader entry and subsequent mutations. Generic container resize internals and
post-load hooks are not fully traced. The generic material's empty-slot-zero
fallback and conditional Metal zero-resource interpretation remain in the
[binding evidence](LEONA-NATIVE-PARTICLE-BINDINGS.md); successful runtime resource
creation/upload and actual Activate draws are not observed. No new pixels,
runtime/assets, schema/ruleset or browser/production/performance claim follows.
