# Zenith Blade ordinary-mesh reflection prerequisite

The enabled `sword2` family declares reflection on an ordinary SCB mesh. Its
shader contract is now retained separately from Eclipse's attached-skin
material. The new `createParticleMeshReflectionMaterial` is an explicit-input
development prerequisite; GameView does not import it or draw Zenith Blade.

## Retained native observations

[The source pin](reference/leona-e-reflection-shaders.json) retains ordinary mesh
VS33/PS54 (`REFLECTIVE`, `DISABLE_FOW`) and VS98/PS790 (`REFLECTIVE`) from the
existing frozen 16.18.8175716 Metal shader WAD. The extraction script checks every
TOC combination against the pinned reader, preserves original Metal/AIR bytes,
and statically emits LLVM text with passes disabled. These observations come
from archived files and ordinary shell tools. No native client or shader was
executed; there are no REA Evidence IDs for these observations.

VS33 requires position at attribute 0, a float3 normal at attribute 2, and UV at
attribute 8. It transforms the normal with the upper world matrix and normalizes
it. It does not use an inverse transpose or construct a missing normal. Reflection
direction, amount and rim are computed per vertex, then interpolated:

```text
P = worldMatrix * position
V = normalize(P - camera)
N = normalize(upper3x3(worldMatrix) * normal)
f = clamp(dot(-V, N), 0, 1)
R = V - 2 * dot(N, V) * N
r = mix(vReflection.y, vReflection.z, 1 - f ^ vReflection.x)
rim = (1 - f ^ vFresnel.w) * vFresnel.rgb
drawPosition = P + V * depthPushPull
```

The canonical observations are VS33 LLVM lines 35–70 (displacement/projection),
71–113 (normal/reflection), and 127–135 (rim), in the cache paths retained by the
pin. The API supplies Three's projection/view matrices as the local counterpart
of the native combined projection transform.

PS54 binds the global remap, base, particle lookup and reflection cube to texture
slots 0–3, respectively; its sampler slots are 15, 0, 1 and 2. Fragment buffer 16
contains reflection color and lookup UV. Its LLVM lines 15–45 establish:

```text
T = base * tint * lookup
C = remap(T.rgb).alpha > 0 ? remap(T.rgb).rgb : T.rgb
RGB = clamp(C + cube(R).rgb * r * mix(1, reflectionColor.rgb, r)
              + T.alpha * rim, 0, 1)
alpha = T.alpha
```

The cube contribution survives zero output alpha. The rim uses fully tinted
alpha, including the lookup. Eclipse skin PS67 instead gates its combined
cube/rim contribution by pre-tint base/lookup alpha. Reusing that skin fragment
formula for the sword would therefore change the observed ordinary-mesh
arithmetic. PS790 adds fog resources and a final RGB fog multiplier; the new
material implements the fog-disabled sample only.

## Explicit local adapter and remaining bindings

Every texture, reflection/fresnel value, UV transform, tint, lookup coordinate and
depth displacement must be supplied. There is no automatic neutral cube or
lookup, source-to-uniform mapping, emitter permutation selection, or normal
generation. Geometry must have matching position/normal/UV streams and finite,
nonzero normals. Both powers must be finite and positive, a local supported-input
restriction that avoids the undefined zero-to-zero endpoint. Uniform values are
copied; geometry and textures remain caller-owned. Blend/raster policy and the
cube's coordinate basis remain the caller's responsibility; the material starts
with blending disabled for arithmetic inspection.

The pinned SCB 3.2 reader and byte-checked source exports contain positions, UVs,
vertex BGRA and face RGB, with no normal stream. The sword GLB preserves those
source inputs and has no generated normals. Native SCB normal construction,
shader dispatch, `vReflection`, reflection color, cube/remap/lookup resources,
sampler state and source power/color CPU mapping remain unresolved. The authored
fourth reflection-color component is not assumed to be opacity. The pinned
asset manifest contains no native client executable; no executable was opened
or installed in this investigation.

## Verification

Four Chrome tests compare 103 synthetic GPU samples against independent scalar
calculations and exact recovery checks. They cover zero/source/lookup/tint alpha,
cube face direction, nonlinear per-vertex interpolation, upper-world-matrix
normals under nonuniform scale, descending reflection ranges, remap alpha,
translated UVs, RGB saturation, depth displacement against an occluder, and exact
graphics recovery. A one-byte channel budget covers float32 arithmetic and RGBA8
rounding. Three unit cases cover rejected normal streams and bindings, uniform
isolation, and borrowed-resource ownership.

The initial browser run passed its pixel assertions but failed because the new
probe page requested a nonexistent favicon. A data favicon fixes that fixture;
the failure archive remains retained. No native frame, E material binding,
complete E renderer, performance, production delivery or offline claim follows
from these synthetic checks. See the [verification ledger](reference/leona/e-reflection-verification.json).

```sh
python3 tools/assets/extract-leona-e-reflection-shaders.py --check
npx playwright test e2e/particle-mesh-reflection-material.spec.ts --workers=1
node tools/qa/verify-leona-e-reflection.mjs
```

The later [matching-client](LEONA-NATIVE-MATCHING.md) investigation retained the
native executable. Its [generic SCB normal reading](LEONA-NATIVE-SCB-NORMALS.md)
now identifies unit-face accumulation, source-index preservation and the
attribute2/offset12/stride36 binding. Derived source streams and a local normal-
color comparison are pinned separately; existing GLBs and GameView remain
unchanged. Actual E dispatch, reflection resources/uniforms and native frames
remain gates. The unresolved-normal statements above describe this earlier
shader-only stage.

The later [native reflection-input reading](LEONA-NATIVE-REFLECTION-INPUTS.md)
now identifies Data defaults and both CPU uniform consumers. Source fresnel
`.15` maps to exponent `.8350000381469727`; its RGB is uploaded without reading
the authored zero alpha. Separate non-REFLECTIVE VS1/PS9 programs implement a
rim-only path with no cube. The generic selector tests the original resource
pointer, separately from a material descriptor fallback. Actual E dispatch,
resource lifecycle, local integration and native frames remain open.

The [rim-only material prerequisite](LEONA-E-RIM-MATERIAL.md) now shares the
common arithmetic/stream validation while compiling out all cube/reflection
uniforms. Six local Chrome tests retain both material paths as a historical
prerequisite. The later [saved sword integration](LEONA-E-SWORD.md) now connects
the rim-only path to GameView with separate normals and PS24 alpha testing.
Actual native E bindings and frames remain open.
