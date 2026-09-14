# Particle shader evidence

The pinned client contains readable shader metadata and compiled Metal programs in `DATA/FINAL/ShaderCache.metal.wad.client`. This archive has ordinary stored/Zstandard entries and no subchunk table. The selective archive reader now accepts that layout, while still rejecting a missing/unresolved table whenever an archive contains subchunked entries.

`export-particle-shaders.py` verifies the four mesh/quad vertex/pixel TOCs, every define-combination hash (2,576 total), and the complete program-ID coverage. It preserves variant aliases: mesh VS has 256 combinations but 192 unique programs. It downloads six required bundles, checks the length framing and Metal signature of all 516 contained programs, and extracts 18 selected programs. Source manifest, archive chunks, source files, defines, program IDs and exact program hashes are pinned in `reference/particle-shaders.json`. Repeat extraction must match the entire report. The selected define combinations are experiments, not proof of which variant Lux uses.

Layout and define-hash evidence: LeagueToolkit [ShaderToc](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Renderer/ShaderToc.cs) and [ShaderLoader](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Renderer/ShaderLoader.cs). The native bytes themselves come from the pinned Riot manifest/CDN recorded in the report.

## What the disassembly establishes

An existing LLVM disassembler successfully decoded all 18 programs after extracting the exact length-delimited bitcode payload from each Metal library. No native shader was executed. Disassembly, raw binaries and bitcode stay in the ignored cache; the inspection report records their hashes and the tool version.

For mesh pixel program **740**, selected with no defines, the initial color calculation is:

```text
base = sample(TEXTURE_TX, TEXCOORD1.xy)
lookup = sample(PARTICLE_COLOR_TEXTURE_TX, COLOR_LOOKUP_UV)
color = base * TEXCOORD0 * lookup   // all four RGBA components
```

The texture and uniform names are present in the compiled program's argument metadata. In this variant the particle-color lookup uses a uniform two-component coordinate; it is not a replacement of each base texel through a luminance ramp. The later shader also performs a shared pixel-color remap, an additive term and fog-of-war modulation, then clamps RGB. This expression describes only the initial color product, not the complete output or framebuffer blending.

Quad pixel program **2**, also selected with no defines, uses the same initial RGBA product, but base UV comes from `TEXCOORD1.xy` and particle-color UV from `TEXCOORD1.zw`. The quad vertex input therefore needs investigation before reproducing lookup-coordinate generation.

Mesh pixel program **787**, selected with `PALETTIZE_TEXTURES=1`, has an additional, separate palette lookup. It computes a clamped dot product of the base RGBA sample and `cPaletteSrcMixerMain`, combines that with `cPaletteSelectMain` to sample `sPalettesTexture_TX`, retains the original base alpha, and then multiplies by the vertex color and `PARTICLE_COLOR_TEXTURE_TX` sample. A shader feature named “palette” must therefore not be assumed to mean the particle-color texture.

## Lux fields now identified

The pinned [VfxEmitterDefinitionData schema](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit.Meta.Classes/Classes.cs) names these fields. CDTB's bin hash function verifies their numeric identities:

| Bin field hash | Name | Values in Lux basic attack |
| --- | --- | --- |
| `f02bd44d` | `colorLookUpScales` | crescent `[0.5, 1]`; hoop `[1, 0.5]` |
| `cd5a323e` | `colorLookUpOffsets` | crescent `[0.6000000238418579, 0]` |
| `2574b022` | `colorLookUpTypeX` | absent from these pinned emitters |
| `2674b1b5` | `colorLookUpTypeY` | Trail explicitly `1` |

The schema supplies defaults of scale `[1,1]`, offset `[0,0]`, X type `1` and Y type `0`. These are schema evidence, not independent verification of client CPU defaults or enum meaning. The original decoded Lux record remains unchanged, including its anonymous hash keys, so its binary equality/provenance stays intact.

## Reproduction and remaining work

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/export-particle-shaders.py
python3 tools/assets/inspect-particle-shaders.py --llvm-dis /absolute/path/to/llvm-dis
```

The second command requires an existing compatible LLVM executable; it does not install a compiler. The verified run used the LLVM executable bundled with the installed Unity 6000.5.7f1 WebGL tools. `artifacts/particle-shader-disassembly.json` records the reported version.

Next establish the CPU/vertex mapping from lookup types, scales, offsets, particle age and randomness to `COLOR_LOOKUP_UV`/quad UV; native sampler filtering/addressing and texture color-space state; actual Lux variant and blend selection; and Trail primitive attachment, tiling and scrolling. Then integrate deterministic particle phase and source motion, and compare against native captures. Gameplay still uses the generic Lux basic-attack projectile. Shader evidence does not establish pixel parity, native effect selection or Metal/DirectX equivalence.

## WebGL color-stage implementation

`src/render/particle-color-product.ts` implements the verified initial RGBA product as a reusable shader material. Mesh-style lookup uses a uniform; quad-style lookup accepts a dedicated `particleLookupUv` vertex attribute. The inspection supplies a constant RGBA particle tint. Texture ownership stays with the caller. The material deliberately performs no framebuffer blending, display conversion, tone mapping, fog or palette replacement; it is not yet the complete gameplay material.

Further tracing of native quad VS program **1** establishes that input **ATTR9**, a float2 at location 9, passes directly to output `TEXCOORD1.zw`, which quad PS 2 samples as particle-color UV. The vertex shader neither evaluates lookup-type enums nor computes age-derived lookup coordinates. It separately computes atlas UV from ATTR8 and TEXTURE_INFO, and swizzles the packed color input ATTR3 from BGRA to RGBA. These input-packing operations are not implied by the custom WebGL attribute name and must be implemented when building native-compatible particle geometry.

Open `/tools/qa/particle-color-preview.html` on the development server to inspect Crescent/Ring04 and Hoop/mote color products. The controls supply explicit lookup coordinates; they do not pretend to map animation age to those coordinates. Inspection textures use raw bytes, clamped addressing and linear filtering; native sampler/color-space state remains unresolved. The display offers raw RGB or alpha compositing over black; neither selects a verified native blend mode. The full RGBA output is verified separately in an offscreen target.

The browser test compares actual GPU render-target bytes against CPU products of hash-verified PNG texels: nine source/second-texture sample pairs, with uniform/vertex coordinates and the optional quad multiplier (36 samples, 144 channel comparisons, tolerance one byte). `sample-particle-colors.py` records the texels directly through Pillow and verifies each PNG against the existing Lux source pin. The tests verify the PNG file hashes before using those reference values. The vertex path deliberately supplies an unrelated uniform coordinate; fractional RGBA tint and translucent trail pixels exercise alpha. Numerical probes use nearest filtering at texel centers; visual inspection uses linear filtering. These checks do not establish native sampler state, interpolation of varying lookup coordinates across a triangle, or the final blended effect.

## MULT_PASS and the Lux trail

The sample selection now includes MULT_PASS alone in both stages: mesh PS **615**, mesh VS **49**, quad PS **4** and quad VS **8**. The exporter’s explicit `--extend-pin` option can add samples only while preserving every prior selection, source-file record, chunk hash, table and bundle count. Normal repeated export still requires exact equality.

For mesh PS 615, the initial product is source RGBA × particle color × TEXTUREMULT, sampled at TEXCOORD3. This variant has no PARTICLE_COLOR_TEXTURE binding. The reusable material represents this by passing the multiplier as its second texture. Mesh VS 49 applies a distinct `vParticleUVTransformMult` to produce those coordinates; the inspector supplies explicit coordinates, not that full transform.

Quad PS 4 instead multiplies source RGBA × particle color × TEXTUREMULT × PARTICLE_COLOR_TEXTURE. Both secondary textures sample TEXCOORD1.zw. The material’s optional fourth argument enables this extra multiplier. Quad VS 8 applies a second atlas transform using TEXTURE_INFO_2 to ATTR9; the no-define program 1’s direct passthrough does not describe this variant. The palette-enabled MULT_PASS programs retain this mesh/quad distinction as well.

The pinned VfxTextureMultDefinitionData schema resolves `e19d1593` to `emitterUvScrollRateMult`; Lux Trail sets `[1,0]`. The primitive hashes resolve to `VfxPrimitiveArbitraryTrail` (`5705625a`), `mTrail` (`5e661fd4`) and `VfxTrailDefinitionData` (`00c2a390`). Its `mMode` (`ac59cf4b`) is 1, `mCutoff` (`ee88201d`) is 1000, and `mBirthTilingSize` (`8c784fc7`) is `[500,0,0]`. CDTB hashes match these schema names. Names establish data identity, not the runtime meaning of mode 1, coordinate units, culling or blendMode 4. The original binary-equal source record remains unchanged.

The inspector now includes the Trail source texture with its rainbow multiplier, labeled as a mesh-MULT_PASS inspection. This is a shader experiment, not confirmation that the native arbitrary-trail renderer chooses that variant. Source and product can both be viewed over black; raw RGB is available to inspect the uncomposited product. Low-alpha PNG texels must not be measured through Canvas 2D: for example, the source trail pixel `[206,207,206,13]` became `[216,216,216,13]` after that browser alpha round trip. WebGL sampling matched the original pinned bytes. This is why the updated test uses direct decoded texels.
