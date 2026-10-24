# Explicit-input decal material

The Solar Flare source package contains two `Focused_Sun` planar projections.
Six frozen UNLIT_DECAL Metal/AIR selections now establish a bounded shader
contract. `particle-decal-material.ts` implements that arithmetic with explicit
receiving triangles, world/UV matrices, textures, height range and color inputs.
It is a tested building block; GameView does not import it or draw R projections.

## Static evidence

The [shader pin](reference/leona-r-decal-shaders.json) preserves the two native
TOCs, two program bundles, six original Metal/AIR payloads and textual LLVM IR.
VS0/1 cover fog-disabled/default; PS0/8/11/38 cover ordinary, fog, palette and
fog-plus-palette routes. The TOCs contain eight VS combinations and 512 PS
combinations mapping to 128 unique PS programs. This is a selection, not a claim
to implement every permutation.

The native vertex input is position only. ParticleDecalVS supplies a world matrix,
a world-to-UV matrix and a Y-range vector. After the explicit world transform,
stored UV vectors 0/2 yield U and one-minus-V; view-projection produces clip
position. The adapter does not apply another Object3D model matrix. Height fade
is computed at vertices as:

```text
gap = abs(world.y - centerY)
fade = gap <= innerRange ? 1 : 1 - (gap - innerRange) / fadingDistance
```

Fade interpolates without vertex saturation; the fragment stage multiplies alpha
by `max(fade, 0)`. Diffuse, lookup at COLOR_UV and modulation color multiply.
There is no global RGB-remap stage or RGB clamp in these selected programs.
Palette replaces untinted diffuse RGB, preserves diffuse alpha and precedes
lookup/tint. Fog samples world XZ and multiplies RGB by fog alpha, preserving
the independently height-faded alpha. Native resource slot layouts remain in
the pin; WebGL bindings are explicit named uniforms.

No native shader/client executes. Clang emits textual IR with LLVM passes
disabled and reports its host retargeting; original Metal/AIR bytes remain
separately preserved. Extraction initially tried the older particle pin, whose
chunk coverage excludes these decal programs. The corrected extraction requires
the same frozen manifest and exact equality of every overlapping chunk/file,
then records the additional ranges. Offline `--check` reads only retained bytes.

Five exact-revision LeagueToolkit reconstruction readers are preserved as primary
source bytes. Their flat-ground receiving footprint, epsilon fade guard and
stencil allocation are external implementation choices; they do not establish
native CPU setup. Earlier discovery copies with an extra trailing newline remain
separate from the exact response-byte cache used by this pin.

## Explicit limits

Callers must supply complete finite receiving triangles and all matrix/resource
bindings in consistent units. The adapter copies uniform values and borrows
geometry/textures. Positive fading distance is a local input restriction that
excludes native division by zero; it does not introduce an epsilon fallback.
Inspection defaults use no blending, double-sided drawing, depth test and no
depth write. Native blend/stencil/depth/sampler state is unresolved.

No terrain triangle selection, flat-ground footprint, normal, missing resource,
matrix default or shader dispatch is synthesized. The separate `simple_projected`
family is not treated as UNLIT_DECAL. Native R CPU dispatch, matrices, receiving
terrain, update cadence and frame acceptance remain open. This material does not
resolve gameplay R history, source effect timing or audio.

## Verification

Three unit cases cover input validation, copied uniforms, borrowed resources and
optional bindings. Chrome probes explicit transforms/UV, alpha-only height fade,
vertex interpolation before fragment clamping, fog, palette and their combined
route plus nonzero palette scroll: all 640 RGBA8 samples match exactly. The full
1,818 unit cases/300 files and three Node QA cases pass. A float render target
checks RGB above one. Context loss/recovery must
reproduce all 256 RGBA bytes exactly. The test uses synthetic receiving triangles
and an independent scalar expected-value calculation, not a native reference frame.

```sh
python3 tools/assets/extract-leona-r-decal-shaders.py --check
npm run check
npx playwright test e2e/particle-decal-material.spec.ts
node tools/qa/verify-leona-r-decals.mjs
```

The [verification record](reference/leona/r-decal-verification.json) freezes this
source and evidence. Add `--historical` after canonical changes. Snapshot schema
125 and ruleset 0f7b3e3b stay unchanged. This unused material has no new production
or offline-delivery claim; the prior 996-file R source package remains the latest
delivery. The full project goal stays active.
