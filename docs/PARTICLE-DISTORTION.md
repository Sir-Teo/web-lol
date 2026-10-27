# Particle distortion: native shader evidence and copy stage

The frozen 16.18 Metal cache contains four separate particle-distortion shader
tables, outside the ordinary quad/mesh tables inspected earlier. The new
[pin](reference/particle-distortion-shaders.json) retains all four tables, their
four bundles, every define combination and all **fifteen programs**. Original
libraries and wrapper bitcode are preserved by SHA-256 in the ignored cache.
The extractor verifies every TOC combination hash and all pinned archive chunks.

Run with the existing project asset tools:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-particle-distortion-shaders.py
```

Installed Apple clang 21 decodes the AIR bitcode to textual IR with LLVM passes
disabled. It retargets the textual module header to the host; original Metal and
bitcode bytes remain canonical. This is static ordinary-tool inspection. No native
Metal program or game client was executed, and the text is not recovered original
HLSL source.

## Observed fragment arithmetic

The default quad fragment (`distortion_ps` program 0) names the framebuffer copy,
base image, particle-color lookup, normal map and `DistortionPower`. The default
mesh fragment (program 0) performs the same arithmetic with a uniform lookup UV.
With `R` the lookup sample, `N` the normal sample, `B` the base image, `C` the
already unpacked RGBA tint, `P` the shader power and `F` the copied framebuffer:

```text
sampleUV = nativeScreenUV + (N.rg - 0.5) * 2 * R.a * P
rgb      = R.rgb * C.rgb * F(sampleUV).rgb * B.rgb
alpha    = N.a * R.a
```

Normal alpha does not scale the displacement. Base alpha, tint alpha and copied
frame alpha do not enter final alpha. No aspect-ratio correction appears in these
fragment programs. The alpha-test variants discard only when `alpha < alphaRef`;
equality survives. The normal map and base image share their supplied UVs.

The quad vertex program divides clip XY by W, maps to screen UV and flips Y before
passing the value through perspective interpolation. On an angled quad this differs
from computing UV directly from `gl_FragCoord`. The browser material preserves
that interpolation, then converts the top-left native copied coordinate to the
bottom-left WebGL framebuffer convention. Geometry and UV preparation remain
caller-owned; full native vertex construction, PushPull and atlas dispatch are
not certified by this material.

The previously pinned external reconstruction's section 2.25 explicitly described
its warp as inferred. Its alpha-scaled displacement, aspect correction and plain
copied RGB differ from the native fragment arithmetic recovered here. The exact
external Git blob and comparison are retained in the reading ledger; these
findings do not certify its native CPU dispatch claims.

## Implemented component

`createParticleDistortionMaterial` implements the default fragment and optional
alpha-test path, with independent uniform or vertex lookup/tint inputs. It does
not implement the decoded colorblind or masked variants. Images are borrowed;
material disposal does not dispose them. Normal alpha and source alpha-test use
the native expressions above.

`ParticleDistortionPass` owns a caller-selected display list and a lazy copy of
the actual canvas framebuffer. It draws over existing color and depth without
clearing either or rendering the main color scene again. The copy uses physical
pixel dimensions, a normalized viewport rectangle, raw color space, clamped
linear filtering and no mipmaps. Filtering is a local choice: the native resource
name attests `Clamp_No_Mip_SharedSampler`, not its complete runtime sampler state.
Opaque RGB canvases use RGB8 copy storage; alpha-bearing canvases use RGBA8.
Using RGBA8 for the game's opaque canvas was rejected by WebGL and produced a
dark rectangle. A real-view identity-copy assertion now catches that failure:
its RGB8 identity copy is byte-exact, and the nonzero-power probe contributes
visible pixels without GL errors. The initial dark capture and failing diagnostic
are retained with the repaired evidence.

Renderer clear, shadow-update and information-reset settings are restored even
on failure. Draw statistics include the color and distortion passes together.

The view has an empty display list by default. Empty or fully hidden lists make
no copy/draw and release any previous copy. Resize replaces the owned copy;
actual graphics loss disposes it and the next active draw recreates it. Effect
owners supply and dispose geometry/materials and must enforce their audience and
fog rules. An offscreen render-target input is rejected because that color-space
path has not been verified.

## Evidence and remaining work

The [verification ledger](reference/particle-distortion-verification.json) retains
native identities, source readings, GPU comparisons, viewport/resize checks and
actual context recovery. Run `node tools/qa/verify-particle-distortion.mjs`.
All **1,401 unit checks across 256 files**, TypeScript, **29 targeted Chrome
cases** and nested-path production validation pass. Twelve fragment probes match
CPU evaluation of the recovered arithmetic exactly at the tested byte samples.
646 angled-quad samples differ by at most one channel value; a naive fragment-UV
implementation differs by more than ten values in that witness. Three viewport
and resize copies preserve every byte. Real opaque-canvas identity copy and
context recovery preserve every byte, report no GL error, and the nonzero-power
probe changes 25,821 framebuffer bytes. A depth-writing occluder remains intact
unless the material explicitly disables depth testing.

The production game/Three chunks are **879.96/658.93 KB**; the build-size warning
remains. The strict simulation fingerprint and schema 110 are unchanged. The
previous four normal-rules diagnostic matches, including 780,762 checked ticks
and 220 exact round trips, are reused rather than described as fresh runs.
The controlled browser fixture is a shared-renderer probe, not a native League
capture or a newly completed E effect.

**All seven E distortion emitters remain deferred.** Native mode values 1/2/3,
CPU render-list selection, framebuffer-copy moments, source-value-to-power
conversion and complete sampler setup remain unresolved. They are not collapsed
into one guessed production stage. E coverage remains 56 rendered records, one
base-skin exclusion and eight deferred records including the nonvisual sound
binding. Native comparison, six complete champions, full objectives/quests,
offline delivery and full-match browser/performance gates remain open.

The later [exact evidence recovery](PARTICLE-DISTORTION-RECOVERY.md) restores
all eight native resources and fifteen Metal/bitcode/text triples against this
original pin, including byte-identical historical disassembly.
