# Eclipse attached-character material

Eclipse's four attached-character emitter descriptions now have a dedicated
skin-capable material and a development inspection page at
`/tools/qa/leona-eclipse-skin-preview.html`. This is a material prerequisite:
match-owned W phase/contact playback remains unfinished. The page draws one
instance of each material, independently of authored emitter birth counts.

## Native arithmetic evidence

The [skin shader pin](reference/leona-w-skin-shaders.json) retains two complete
native TOCs, five selected bundles and ten selected Metal/AIR programs from the
same frozen 16.18 Riot manifest as the character. Seven fragment and three vertex
permutations were statically disassembled with LLVM passes disabled. No native
shader or game client was executed. Original Metal/AIR bytes remain canonical;
clang retargets the textual IR to this host.

The reflective vertex shader computes a per-vertex rim from source normals:

```text
facing = clamp(dot(surfaceToCamera, worldNormal), 0, 1)
rim = (1 - facing ^ fresnelPower) * fresnelColor.rgb
```

Skin fragment program 67 carries that rim by pre-tint texture/lookup alpha,
then clamps output RGB. Erosion program 287 uses the base texture's alpha and
changes only the final alpha with the erosion band. Tinting black therefore
does not erase the rim. The global color-remap stage conditionally replaces RGB
when its sampled alpha is positive, preserving the drawn alpha. The
[reading ledger](reference/leona-w-skin-reading.json) links these observations to
the selected programs and SSA expressions.

```text
lit = baseTexel * particleTint
if globalRemap.a > 0: lit.rgb = globalRemap.rgb
lit.rgb = clamp(lit.rgb + rim * baseTexel.a, 0, 1)
value = clamp(dot(erosionTexel, erosionMixer), 0, 1)
band = clamp((drive - value + sliceWidth) / featherIn, 0, 1)
     - clamp((drive - value) / featherOut, 0, 1)
lit.a *= band
```

The four selected W records author neither a color lookup nor a reflection cube
map. This material draws their Fresnel contribution without a cube map; an
explicit optional global remap can be supplied. Treating absent bindings as
neutral is a local choice, not an observation of native CPU defaults. Source
erosion mixer/feather/slice defaults retain the separately pinned reconstruction
evidence. UV transformation is caller-owned and also feeds erosion sampling.

## Animated source skin and ownership

The material uses Three's skinning chunks for positions and normals, preserves
the source's double-sided single-pass additive policy, and borrows all textures.
WebGL polygon offset `-1/-1` is a local counterpart to the authored depth bias;
native depth-state equivalence remains unverified. Disposing the material does
not dispose the borrowed textures, geometry or skeleton.

The inspection page clones private skeletons from the original Leona rig and
samples explicit W idle, walk and attack clip times. A separate CPU deformation
of the same source geometry checks positions/normals against the GPU render.
CPU evaluation uses doubles and WebGL uses float32, with a source Fresnel power
as small as 0.05. Near-tangent rounding can therefore affect a few pixels.
The diagnostic budget allows at most eight channel levels and at most one pixel
in ten thousand visible pixels differing by more than one level. This is a
local skinning cross-check, not a native-frame comparison. Analytical material
and pinned-texel checks retain a one-level channel limit. Repeated GPU poses and
graphics recovery require exact pixels.

The earlier failed runs remain frozen. They retain an unstable diagnostic
normal at grazing incidence, a missing favicon request, a nullable skeleton
matrix type, the initial zero-difference CPU assumption and a preview clear-color
reset after context restoration. The grazing probe now uses a symmetric normal
whose perpendicular terms cancel exactly. A scene background reapplies the clear
color after recovery. Screenshot review also caught initial readiness before the skin draw appeared;
the page now draws again before readiness and checks all four visible columns.
The material equations and source pixels were unchanged by these preview/test repairs.

## Remaining integration

The [complete W source set](LEONA-W-SOURCE.md) still requires the other enabled
ray, mesh, billboard and quad layers, UV/palette/soft-particle/depth stages,
distortion, authored birth counts and complete buff/detonation/contact dispatch.
Saved poses/audiences, death/recast/stop/victory, resource retirement, source
audio and native comparison remain required. Human selection, support AI and
the full six-character match gates remain open. Schema 123 / ruleset
`18058f085b96c376177780b67d7783fbb24ce283043ecca3daf394c80fcecb30`
remain unchanged while this material is used only by the diagnostic page.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-w-skin-shaders.py
python3 tools/assets/export-leona-w-skin-materials.py --check
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/export-leona-w-skin-samples.py --check
```


## Recorded validation

The full v4 run passes 1,618 tests across 280 files, TypeScript and three Node QA
checks. Final v5 changes only the diagnostic page/test: explicit typing and four
Chrome cases pass, with 185 one-level-bounded numeric probes and three posed-rig
comparisons. Measured CPU/GPU maxima are one, six and two channel levels for W
idle, walk and attack; respectively zero, three and one pixels exceed one level.
Repeated GPU poses and context recovery are exact. All four startup columns
must contain visible skin pixels. Idle and attack screenshots were inspected.

The final archive retains 331 inputs and 37 native files. All 28 production
files are byte-identical to the preceding offline-validated build; this material
is not yet wired into match rendering. Earlier failed inputs/results remain in
separate archives. See the [verification ledger](reference/leona/w-skin-material-verification.json).

```sh
node tools/qa/verify-leona-w-skin-material.mjs
```

Use `--historical` after canonical changes. W playback and native acceptance
remain open.

The subsequent [playback increment](LEONA-W-PLAYBACK.md) now draws these materials
on private saved source poses during actual W initial/extended phases, including
source birth counts and owned skeleton disposal. It does not complete the
remaining W primitives or native dispatch/frame acceptance.
