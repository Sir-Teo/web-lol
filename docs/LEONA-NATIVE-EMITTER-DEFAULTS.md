# Native emitter defaults and registered fields

The matching 16.18.8175716 arm64 executable initializes a default emitter primitive
as CameraQuad, its base texture name as an empty string, and its `alphaRef` byte
as five. This establishes constructor behavior. It does not establish whether
loading Leona's omitted fields preserves those defaults or which material path
an actual Activate instance uses. Solar Flare remains at 41/44 visible families.

The [evidence pin](reference/leona-native-emitter-defaults.json) retains 39 bounded
Apple LLVM word streams, 22 original-byte spans, six type registrations and seven
field registrations. The exact whole executable and derived slice match the
[official-CDN reconstruction](LEONA-NATIVE-MATCHING.md). The records are ordinary
static disassembly and file reads, **not REA MCP Evidence**. LLVM's nearest exported
symbol labels do not name these functions. `LC_FUNCTION_STARTS` provides adjacent
requested bounds, rather than a proof of complete semantic function bodies.
No native game, shader or GPU execution occurred.

## Registration and constructor chain

The lowercased ASCII FNV1a32 hashes match the retained BIN type dictionary. A hash
match alone does not authenticate a name or exclude collisions. Here the callback
behavior, object sizes, field offsets and material readers supply additional
structure. `10169e674` stores the hash at descriptor `+8`, callbacks at
`+0x10/+0x18/+0x20/+0x28/+0x30`, size at `+0x40`, and appends the descriptor to a
registry. `10169ebe8/10169ec4c` append 48-byte field records containing the field
hash, offset, BIN type and optional child descriptor. They are registration
helpers; they do not load missing object fields.

| Registered type | Hash | Size | Hash instructions |
| --- | --- | ---: | --- |
| VfxEmitterDefinitionData | 09cde442 | 0x470 | 1018aafe8/afec |
| VfxPrimitiveCameraQuad | 96ddbc74 | 0x18 | 1018d7e54/e58 |
| VfxPrimitiveArbitraryQuad | 4beb81fd | 0x10 | 101945c2c/c30 |
| VfxPrimitivePlanarProjection | e9945dad | 0x30 | 101945f8c/f90 |
| VfxDistortionDefinitionData | 49d51b69 | 0x18 | 1018ae3cc/3d0 |
| VfxLegacyRenderComponent | 2ffd9a47 | 0x238 | 1018c3254/258 |

The emitter's allocating callback `101925434` allocates `0x470` bytes and calls
`1018ac82c`. Its in-place callback `101925490` branches to the same constructor.
At `1018ac89c–8b8`, that constructor allocates `0x18` bytes, writes kind byte zero,
and installs the same vptr `102481ef8` and secondary pointer as the registered
CameraQuad factory `10193aadc`. The preindexed store at `1018ac8c0` changes X25
from `this` to `this+0x68`; the following store at X25-8 writes the quad pointer
to `this+0x60`.

X27 loads the pointer at `10246e0c0`, which is `102230369`, a terminated empty
string. The preindexed store at `1018ac8f4` writes it to `this+0x98`.
The packed little-endian word `0x0500` stored at `this+0x76` puts five at
`this+0x77`; registration identifies that byte as U8 `alphaRef`.
This is a constructor default, rather than an observed shader state for Leona.

## Field identities and material consumers

| Parent | Field | Offset | Wrapper |
| --- | --- | ---: | --- |
| VfxEmitterDefinitionData | primitive | 0x60 | 1018ac310 |
| VfxEmitterDefinitionData | texture | 0x98 | 10006a1b0 |
| VfxEmitterDefinitionData | alphaRef | 0x77 | 10006c3e0 |
| VfxEmitterDefinitionData | distortionDefinition | 0x50 | 1018ac500 |
| VfxLegacyRenderComponent | distortionDefinition | 0xe8 | 1018ac500 |
| VfxDistortionDefinitionData | distortion | 0 | 10007e314 |
| VfxDistortionDefinitionData | normalMapTexture | 8 | 10006a1b0 |

Both distortion fields pass child descriptor `1025eb380`. The initializer at
`101941760/764` resolves X20 to `1025eaf40`; `101941880` adds `0x440`, then calls
child registration `1018ae388` with X0=`1025eb380`. The child registers a FLOAT
at zero and a STRING at eight. This ties the two retained generic material
callers' first-float loads to the source-named `distortion` field. The older
caller also hashes child+8 and binds generic slot three, `NORMAL_MAP`.
The [earlier binding evidence](LEONA-NATIVE-PARTICLE-BINDINGS.md) pins both scalar
uploads under `DistortionPower`; neither caller converts the scalar's units.
This supports the local source-strength interpretation, while loading, overrides
and actual Leona dispatch remain separate questions.

The older material `10188ee40` reads its definition through object+0x10, then
primitive+0x60 and kind+8. For a non-seven kind, `10188f62c–650` hashes the base
name at definition+0x98 and calls `101893400` with slot zero. That binder's
nil/empty identity branch selects manager+0xa8. Its nonzero-slot branch selects
+a0 instead. The earlier evidence identifies +a8's zero source word and its
conditional transparent BGRA8 interpretation on Metal. The constructor's empty
base therefore aligns with this generic slot-zero fallback, conditional on
preserved defaults and this material route being selected.

## Verification and remaining scope

```sh
python3 tools/assets/verify-leona-native-emitter-defaults.py --check
python3 -O tools/assets/verify-leona-native-emitter-defaults.py --check
```

The verifier checks retained hashes, whole/slice identity, every LLVM word against
original section bytes and adjacent function-start metadata, type dictionary
names/FNV constants, callbacks, sizes, offsets, direct branches, selected stores
and literal pointers. It imports only a pinned local standard-library Mach-O
section parser. It invokes no analyzer, provider, bridge, compiler or target,
uses no network, and writes no files. Negative controls reject an altered field
offset and an altered direct-branch target.

BIN absent-field preservation, polymorphic loading, post-load overrides, actual
Activate instantiation/material dispatch, selected backend and resource upload
success remain unobserved. Activate stays excluded locally. The two weapon quads
still require their attachment frame; native frames, reflection inputs and full
player/support/roster acceptance remain open. Runtime code, assets, schema126 and
ruleset `591ddf38f2020153fafd7cb802a936194de3c2296ae0022371047ed1453581c6`
are unchanged. This audit does not claim a new browser, production or performance
run; the preceding sampler validation remains the latest runtime evidence.
