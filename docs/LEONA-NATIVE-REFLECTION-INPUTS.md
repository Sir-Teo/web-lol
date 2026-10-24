# Native particle reflection inputs and the rim-only mesh path

The matching 16.18.8175716 executable connects the source `sword2` reflection
fields to two distinct sets of shader inputs. The source's `.15` fresnel becomes
float32 **`.8350000381469727`**, not a shader exponent of `.15`. Its RGB becomes
`vFresnel.rgb`; the authored fourth component, zero, is not read by these uniform
consumers. Four separately retained ordinary-mesh programs show a rim-only path
without a reflection cube. These are static observations, not a captured Leona
E draw or a native frame.

The [machine-readable pin](reference/leona-native-reflection-inputs.json) freezes
native instruction words, exact source BIN ownership, independent audit results,
original Metal/AIR bytes and host-generated textual IR. All observations use
ordinary local file reads and Apple LLVM, with no REA MCP Evidence IDs. No native
game or shader was executed, and no provider was restarted. The host compiler
emitted textual AIR with passes disabled; its target-triple warning is retained.

## Registered fields and omitted values

The native type registration at `1018ae240` uses hash `4112ea83`, a 64-byte Data
object and allocation callback `1019260a8`. Its in-place constructor is
`101926100`; its descriptor is `1025eb2f8`. The registered X6 callback is null.
Names are lower-case ASCII FNV1a hash matches against the retained dictionary,
corroborated by layouts and callbacks; these are not native type-name Cstrings
or a proof against hash collisions.

| Registered field | Byte offset | Constructor value | Sword2 source |
|---|---:|---|---|
| reflectionMapTexture | `0x00` | empty string | omitted |
| reflectionOpacityDirect | `0x10` | 0 | omitted |
| reflectionOpacityGlancing | `0x14` | 1 | omitted |
| reflectionFresnel | `0x18` | 1 | omitted |
| reflectionFresnelColor | `0x1c` | `[1,1,1,1]` | omitted |
| fresnel | `0x2c` | 1 | `.15000000596046448` |
| fresnelColor | `0x30` | `[0,0,0,0]` | `[1,.43921568989753723,.03921568766236305,0]` |

The frozen multi-skin BIN owns the E weapon particle record, whose emitter LIST80
contains STRUCT82 entries. Index18 is `sword2`, concrete emitter `09cde442`.
Its `reflectionDefinition` field occupies bytes16864–16908 inclusive: STRUCT82,
concrete `4112ea83`, exactly two authored fields, FLOAT10 and VEC4_FLOAT13.
The independent bounded source walk verifies the owning entry/list/emitter/child
and the five omissions. The previously pinned [generic BIN reader](LEONA-NATIVE-BIN-LOADER.md)
allocates registered defaults and applies serialized fields only. Thus these
omissions preserve constructor values through that identified reader's return.
Parent/global postprocessing or a later runtime conversion is outside this claim.

The parent reflection field is registered at emitter offset `0x48` and Legacy
render-component offset `0xe0`. A bounded scan did not resolve the separate
`VfxReflectionDefinitionDataInstance` hash or layout. The unrelated material
function `1019caea4` has different offsets and color encoding and is not used to
fill that gap.

## CPU uniform packing

Two consumers agree: `1018df18c` reads reflection Data through the emitter's
`+0x48` child; `1018c0eb0` uses the Legacy component's `+0xe0` child. Their
instructions implement:

```text
vFresnel = [fresnelColor.r, fresnelColor.g, fresnelColor.b,
            FMADD32(fresnel, float32(4.9), float32(.1))]

if the reflection feature is enabled:
  vReflection = [FMADD32(reflectionFresnel, float32(4.9), float32(.1)),
                 reflectionOpacityDirect, reflectionOpacityGlancing, 0]
  vReflectionFColor = [reflectionFresnelColor.rgb, 0]
```

For the source and constructor values, the conditional vectors are therefore
`vFresnel=[1,.43921568989753723,.03921568766236305,.8350000381469727]`,
`vReflection=[5,0,1,0]`, and `vReflectionFColor=[1,1,1,0]`.
The mapped rim exponent has little-endian float32 bytes `90c2553f`.
The source color's alpha is not an opacity multiplier in these uploads.

The newer rim calculation spans `1018c0f54–1018c0fb4`, before the reflection
feature test at `1018c0fbc/0fc0`; the older equivalent is
`1018df6e8–1018df744`, before `1018df748/74c`. Both upload the same rim vector
to `vFresnel` and the additional `FRESNEL` identifier. Reflection parameters and
color are uploaded only on the feature-enabled branch.

Bounded initializer windows tie actual Cstrings to native identifier globals:

| Identifier | Cstring | New global | Old global |
|---|---|---|---|
| FRESNEL | `102277870` | `1025320e0` | `1025e8570` |
| vFresnel | `102277867` | `1025320e8` | `1025e8578` |
| vReflection | `102277839` | `1025320f0` | `1025e8580` |
| vReflectionFColor | `102277845` | `1025320f8` | `1025e8588` |

The verifier decodes the ADRP/ADD name addresses, direct hash-function calls and
STR global destinations, independently of LLVM's nearest exported symbol labels.

## Resource guard and shader selection

Material initialization at `1018c15c8–1018c15f0` hashes the reflection child's map
string and binds slot10 with its original resource output at component `+0x220`.
The generic resource loader returns on a nil/empty hash before resource overrides
or output stores. The previously pinned [material fallback](LEONA-NATIVE-PARTICLE-BINDINGS.md)
can append a white resource to the material descriptor; that is a separate place
from the caller's original resource pointer.

The selector `1018c1e24` tests original component `+0x220`, stores its non-null
boolean in the feature structure's byte2 and gates the component reflection flag.
Define builder `1018c2ad4` reads that byte2 at `1018c2c98`; only its nonzero branch
adds the native `REFLECTIVE` Cstring (`102277cac`). Thus a descriptor fallback alone
does not establish that `REFLECTIVE` is requested. This conditional static route
is not evidence that a live E cast selected it. Resource initialization/reuse and
other feature/quality branches must also be accounted for before a source-specific
dispatch claim.

The fresh Legacy component's factory `10192f3dc` calls constructor `10192f41c`.
That constructor zeroes Q0 at `10192f4a8`, sets X8 to `this+0x1f8` at
`10192f530`, and stores two zero vectors at `[X8+0x20]` at `10192f53c`.
The resulting byte range `this+0x218..0x237` includes original pointer `+0x220`.
With a fresh object, a nonnull reflection child and an empty map identity, the
traced generic route therefore leaves that original pointer null despite its
slot10 descriptor fallback. A rim-only path is supported under these conditions.
The empty loader does not clear a reused nonnull pointer; reuse/clearing remains
unresolved. The older layout's `object+0x58` constructor state is not established
by the newer constructor and is not inferred from it.

## Four retained programs without REFLECTIVE

These programs come entirely from five TOC/bundle inputs already pinned in the
[earlier reflective shader extraction](reference/leona-e-reflection-shaders.json).
No new network access was required. Original program ranges and AIR wrappers
are checked against those input bytes.

| Flags | Ordinary mesh VS | Ordinary mesh PS | Define hash |
|---|---:|---:|---|
| none | 20 | 740 | `ef46db3751d8e999` |
| DISABLE_FOW | 1 | 9 | `385f44a4ff47b22d` |

VS1 still needs attribute2 float3 normals and attribute8 UV. It transforms normals
with the upper world matrix and normalizes them. It computes the rim per vertex,
then interpolates it. The [native SCB normal stream](LEONA-NATIVE-SCB-NORMALS.md)
therefore remains relevant without a cube:

```text
P = world * position
V = normalize(P.xyz - camera)
N = normalize(upper3x3(world) * normal)
f = clamp(dot(-V, N), 0, 1)
rim = (1 - pow(f, vFresnel.w)) * vFresnel.rgb
drawPosition = P + V * depthPushPull
```

PS9 has base, particle-lookup and global-remap textures, with no cube resource or
sample. It uses the fully tinted alpha for the rim and preserves that alpha in
the output:

```text
T = base * tint * lookup
mapped = remap(dot(T.rgb, [.2126,.7152,.0722]), .5)
C = mapped.a > 0 ? mapped.rgb : T.rgb
output.rgb = clamp(C + T.a * interpolatedRim, 0, 1)
output.a = T.a
```

PS740 additionally contains the fog path. Retaining it does not establish native
fog resources, sampling, emitter flags or visibility policy. The fog-disabled
pair is a bounded arithmetic prerequisite; no cube is invented to make it work.

## Verification and remaining work

```sh
python3 tools/assets/verify-leona-native-reflection-inputs.py --check
python3 -O tools/assets/verify-leona-native-reflection-inputs.py --check
```

The standard-library verifier checks source identity/ownership/types, constructor
and registration instructions, selected CPU arithmetic, name/global links,
LC_FUNCTION_STARTS bounds and every retained instruction word. It recomputes
the float32 mapped exponent and verifies four shader selections, bundle ranges,
AIR bytes and selected rim arithmetic. Independent reflection-source/type reading
is retained separately. Ordinary and optimized Python checks pass; altered
mapped-power, reused-pointer policy, shader-selection and native-FMA-word controls
are rejected. The first negative-control helper selected the wrong retained
function and stopped before its FMA mutation; its failure is retained, and the
revised helper selects the uniform function explicitly. Neither this check nor host AIR text proves native
GPU/FPCR numerical parity or resource-upload success.

GameView, assets, schema126 and ruleset591ddf38 remain unchanged. E stays18/20
visible families and R41/44. A runtime adapter, full CPU dispatch/lifecycle,
local E integration, native frames, weapon attachments, player/support and full
roster acceptance remain separate work. No fresh production/offline, normal
cohort or performance result is claimed by this static increment.
