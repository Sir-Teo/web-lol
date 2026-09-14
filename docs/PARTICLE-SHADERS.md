# Particle shader evidence

The pinned client contains readable shader metadata and compiled Metal programs in `DATA/FINAL/ShaderCache.metal.wad.client`. This archive has ordinary stored/Zstandard entries and no subchunk table. The selective archive reader now accepts that layout, while still rejecting a missing/unresolved table whenever an archive contains subchunked entries.

`export-particle-shaders.py` verifies the four mesh/quad vertex/pixel TOCs, every define-combination hash (2,576 total), and the complete program-ID coverage. It preserves variant aliases: mesh VS has 256 combinations but 192 unique programs. It downloads five required bundles, checks the length framing and Metal signature of all 416 contained programs, and extracts 14 selected programs. Source manifest, archive chunks, source files, defines, program IDs and exact program hashes are pinned in `reference/particle-shaders.json`. Repeat extraction must match the entire report. The selected define combinations are experiments, not proof of which variant Lux uses.

Layout and define-hash evidence: LeagueToolkit [ShaderToc](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Renderer/ShaderToc.cs) and [ShaderLoader](https://github.com/LeagueToolkit/LeagueToolkit/blob/76bf57bf4fd195343dec610bf0f912a06b910914/src/LeagueToolkit/Core/Renderer/ShaderLoader.cs). The native bytes themselves come from the pinned Riot manifest/CDN recorded in the report.

## What the disassembly establishes

An existing LLVM disassembler successfully decoded all 14 programs after extracting the exact length-delimited bitcode payload from each Metal library. No native shader was executed. Disassembly, raw binaries and bitcode stay in the ignored cache; the inspection report records their hashes and the tool version.

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

Next establish the CPU/vertex mapping from lookup types, scales, offsets, particle age and randomness to `COLOR_LOOKUP_UV`/quad UV; native sampler filtering/addressing and texture color-space state; actual Lux variant and blend selection; and MULT_PASS behavior for the Trail multiplier. Then integrate deterministic particle phase and source motion, and compare against native captures. Gameplay still uses the generic Lux basic-attack projectile. Shader evidence does not establish pixel parity, native effect selection or Metal/DirectX equivalence.
