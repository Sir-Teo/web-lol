# Solar Flare early distortion

R impact families 27/30/33 now use a separate early framebuffer capture. Their
source geometry, timing, normals, lookup, tint and strengths remain unchanged.
This adds three families to the prior 38, bringing the integrated total to 41 of
44 enabled families across both area alternatives. Two weapon quads with no
verified attachment frame and [unnamed-base Activate](LEONA-R-ACTIVATE.md) remain separate.

## Observed phase contract

The [seven exact readers](reference/leona-r-early-distortion-readers.json) pin
2adda mode mapping: 1 is late/all, 2 is early/noCharacter, and 3 is both. The
[reading record](reference/leona-r-early-distortion-reading.json) separates this
external reconstruction from native 16.18 CPU code. Exact Passes.tsx draws the
SCENE_LAYER before early distortion, and frame.ts explicitly puts characters in
that layer. Thus this preview's early capture includes actors. The enum name
alone does not establish an actor-free capture.

With late distortion active, that external preview draws scene, early warp,
UNDER particle color, late warp and OVER particle color. Without late distortion,
both color phases follow early warp. It captures once per warp phase. Its
handwritten distortion fragment differs from retained native fragment arithmetic;
only the phase observations are adopted here. An initial environment-only
proposal made before Passes.tsx was available is retained as superseded evidence.
The exact retained reader is separate from an initial transport copy with one
extra trailing newline; both hashes and that correction are explicit.

## Local composition

The local renderer registers source surface, attached erosion skin, multiplier
skin and decal materials as particle color. Ordinary geometry and actors remain
in the base scene, as do legacy effects that have not been registered. This is a
bounded local classification; it does not implement every global native phase or
a separate OVER list.

When early particles exist, the renderer draws the base scene and its ordinary
actor shadows, captures once for all early quads, then draws registered color
without clearing or redrawing the base/shadow maps. The existing late copy follows.
The base depth remains available. With no early particles, the existing single
full-scene render is retained. Registered particle materials may not cast shadows;
unsupported membership fails before visibility changes. Existing private source
skins already disable shadow casting.

Borrowed material visibility, scene background/matrix update policy and renderer
clear/shadow/accounting flags are restored even when a pass throws. Objects are
not reparented. Early and late copies have separate ownership and retire when
empty. Geometry, images and source material arithmetic retain existing ownership.
The source program routes mode 2 only when an explicit early scene is supplied;
unsupported routing fails before allocating a new material. Mode 3 is not admitted.

## Source and native arithmetic

The three ArbitraryQuad emitters live 0.1800000072 seconds and share rotation
[90,0,90], source offset [0,10,0], white base, circle normal and Lux distortion
lookup. Source strengths are 0.0700000003, 0.1500000060 and 0.1000000015. Uniform
birth sizes are 500/700/700 before their lifetime curves. Alpha reference is
explicitly zero. Local source blend 1 uses SrcAlpha/OneMinusSrcAlpha; misc flags 1
disable depth testing. Depth writes are disabled and quads are two-sided.

Retained native distortion fragment arithmetic offsets copied UV by
(normal.rg - 0.5) * 2 * lookup.a * DistortionPower, multiplies copied RGB by base,
lookup and tint RGB, and emits normal.a * lookup.a. Authored tint alpha does not
fade displacement or output alpha; no extra aspect factor is inserted. Supplying
source strength directly as DistortionPower remains a local binding. Actual
native CPU mode/technique choice, capture audience, sampler/state/defaults,
strength conversion, full phase ordering and frame correspondence remain open.

The static verifier checks all four retained TOCs, fifteen Metal programs and
45 Metal/AIR/text streams, including exact bundle slices and bitcode ranges.
Optional --hashes recomputes define keys with the existing xxhash environment.
No host shader compiler/disassembly run, native client or Metal execution is
claimed for this static audit. The GPU probes compile the local WebGL adapter.

```sh
python3 tools/assets/verify-particle-distortion-inputs.py
.tools/cdtb-venv/bin/python tools/assets/verify-particle-distortion-inputs.py --hashes
npm run check
npx playwright test e2e/particle-color-phase.spec.ts e2e/leona-solar-surfaces.spec.ts
```

## Verification

The full 1,881 unit cases in 309 files plus three Node QA cases pass. Seven new
phase cases cover the inactive single-render path, actor/shadow inclusion,
background/depth preservation, state restoration after failures in each stage,
unsupported shadow membership and layer/material/empty-geometry activity.

Twenty-four Chrome cases cover the new phase boundary, all 38 source surfaces,
R skin/planar receivers, W/E skins and retained distortion arithmetic/copy/depth.
The blue-actor/red-particle probe distinguishes early from late capture and
reproduces exact results after graphics recovery. The actual impact probe counts
one early and one late copy and confirms all three early materials share the
same captured frame. Removing each quad while the other two keep the stage
active changes 14,788/40,524/39,828 pixels. Rendering preserves the saved World.

Save/reload and graphics recovery reproduce exact source state/pixels at ages
12 and 46, including active early distortion. Six hit/miss casts retire both
copies and settle at 25 geometries/49 textures. Frozen W and E comparisons each
preserve 63 frames with bytewise-identical pixels and source state.

Initial diagnostics remain retained. An older unit expectation still required
mode2 exclusion; it now checks the separate destination list. The copy-count
probe initially selected age42, before the delayed late quads existed; age46
exercises both phases without changing source timing. A QA-only TypeScript
background union check was corrected to use instanceof Color. Neither correction
changed shader arithmetic or simulation behavior.

Fresh production passes 32 recordings without development hooks or unrequested
Leona preloads. The fresh pack contains 1,011 files and 513,276,637 bytes; no
source assets were added or resized. Schema126 stays unchanged, and ruleset
a051ddc6 includes the explicit phase/routing inputs. No new normal-match cohort
or CPU benchmark is claimed.

All fresh offline controls pass, including repair, saved offline boot, new match,
atomic update and scoped removal, with 963 service-worker responses and no
production errors. The [verification record](reference/leona/r-early-distortion-verification.json)
freezes source, native streams, exact readers, generated build and diagnostics.

```sh
node tools/qa/verify-leona-r-early-distortion.mjs
```
