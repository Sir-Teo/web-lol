# Eclipse rays, meshes, billboards and quads

The remaining 26 enabled W families now have real renderer paths alongside the
four attached-character descriptions. Both buff phases, successful and missed
caster bursts and target contacts draw their retained textures and primitives.
This is local reconstruction, not completed native presentation acceptance.
The subsequent [source-audio increment](LEONA-W-AUDIO.md) adds all five finite
SFX roles. Native dispatch/bindings/frame comparison and full-match performance
remain open.

## Retained shader evidence

[The surface shader pin](reference/leona-w-surface-shaders.json) retains four
native TOCs, seven bundles and 22 selected Metal/AIR programs from the existing
frozen 16.18 manifest. All define-combination hashes in each TOC are checked.
Original programs, extracted bitcode, Clang IR and compiler metadata remain in
`.cache/leona-w-surface-shaders-v1-20261023`. Clang retargets textual IR to the
host with LLVM passes disabled. No native shader or client was executed.

The selected code establishes these fragment/vertex calculations:

| Path | Observed arithmetic |
| --- | --- |
| Mesh product | Base texture × particle/vertex tint × color lookup; mesh MULT_PASS replaces lookup with the multiplier at separate mesh UVs. |
| Quad product | Base × tint × lookup; MULT_PASS also samples its multiplier at the lookup coordinates. |
| Separate alpha | RGB uses translated UVs; alpha retains the transform's linear part but omits its translation. |
| Vertex color | The vertex program swizzles packed BGRA before multiplying the particle tint. |
| Erosion | A clamped channel dot feeds the two feather ramps; their difference changes alpha, preserving RGB. |
| Soft particles | Reciprocal reconstructed scene/fragment depth gives the gap. Two cubic smooth ramps form a difference, with independent unsoftened/softened RGB and alpha controls. |
| Mesh output | RGB saturation follows the soft stage. |
| Global remap | Positive sampled remap alpha replaces RGB while preserving the original output alpha. |

The material also retains the previously inspected quad palette equation: clamp
the source dot before adding scroll, then replace RGB without replacing alpha.
These programs do not establish the native CPU variant chosen for each emitter,
sampler setup, global resources or source-to-uniform conversion.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-w-surface-shaders.py --check
```

The check verifies retained source/program/bitcode/IR bytes without downloading,
regenerating or executing a native shader. A first extraction requires a fresh
cache root and the pinned source archive route.

## Runtime routes and explicit local choices

The renderer draws two rays, ten SCB mesh families, seven billboards and seven
arbitrary quads. Four distinct enabled SCB geometries are borrowed from their
retained GLBs; the other two prepared meshes belong to disabled declarations.
Raw positions, vertex BGRA and face RGB remain on the source geometry. There are
no substitute primitives or generated normals for the custom meshes.

The source vertex format selects the observed BGRA path on the smoke, cone and
Praxis families. Their alpha streams contain real zero/partial/full fades. The
separate all-zero Praxis face stream is retained without multiplying it into
visible RGB. Exact native color-flag dispatch and face-stream meaning remain
unverified. Non-skin surfaces currently use double-sided single-pass rendering;
native culling dispatch remains open.

Source-space positions and rotations are reflected into the local world frame.
Mesh scale stays dimensionless over already converted metre geometry; simple
primitive dimensions convert centimetres to metres. Rays use six actual camera
facing vertices, including their near-edge displacement. Their bounding sphere
is refreshed after each update: Three uses its centre for transparent sorting
even when frustum culling is disabled. Camera-facing particles retain authored
roll and directional stretching. Ground quads use the existing local 50 cm
projection grid and explicit render stage; authored navmesh masks reject blocked
triangles. Ground mesh vertices retain their authored vertical shape.

UV layers retain independent scale/offset/atlas transforms and the sampler's
fixed-grid integrated scroll. Mesh multipliers use their own transform; the two
rays author identity multiplier layers and use the native quad shared-coordinate
path. Base, lookup, multiplier, normal and erosion samplers borrow decoded images
with separate address-state objects, without changing another effect's textures.

The unit root is the local attachment origin. Historical placement/facing and
per-birth audiences come from the schema-124 histories. Caster bursts retain the
actual pre-movement detonation origin. Native script attachment points and
orientation dispatch remain unverified.

Blend modes 0/1/4 use the existing local One/One, SrcAlpha/OneMinusSrcAlpha and
SrcAlpha/One routes. Mode 0 premultiplies particle RGB by its sampled alpha.
Soft parameters convert authored centimetres into the metre depth field; zero
deltas disable their ramp. The blend-aware local control applies the fade to
RGB for additive draws and alpha for SrcAlpha draws, avoiding a squared fade.
The material supports independent native channel controls, but their CPU values
remain unverified.

Two distortion declarations use the retained normal map and existing canvas-copy
pass, with their authored 0.02/0.08 strengths bound directly. That conversion and
native dispatch remain local choices. The Glow palette declaration authors no
palette texture. It remains explicitly unbound; no invented replacement image
is supplied. Global palette/remap bindings and native rendering remain open.

## Startup and recovery repairs

The new loader filters absent texture slots before requesting images; the common
white fallback is supplied by the shared loader. The first browser startup
attempt had requested the HTML root as an image. Its interrupted trace, network
record and frozen inputs remain preserved. It was stopped after identifying the
actual loader defect, not because an observation timeout was mistaken for exit.

A restored active burst can request scene depth before the first regular frame
has initialized shadow maps. The depth capture now disables shadow sampling,
while retaining the original depth-writing materials, skinning and alpha tests,
then restores both shadow flags in `finally`. This removes the observed WebGL2
sampler/texture mismatch without changing the main lighting pass. Source depth
and distortion buffers are released on context loss and ordinary retirement.

A separate exact-frame investigation found different raw bytes in the seeded
procedural fixture's 4096² Canvas2D paint texture after reload. The fog canvas,
actor poses, camera, saved uniforms and current geometry matched. A base-only
capture differed at 744/1,296,000 pixels by at most six channel levels. The
fixture paint canvas now requests the stable CPU drawing path through
`willReadFrequently`; its raw texture bytes and complete framebuffer match
across reload. Production Rift terrain uses retained image assets. No pixel
budget was relaxed to hide this discrepancy.

The exact comparison retains complete framebuffer, per-layer partitions, source
geometry/bounds/uniforms, saved world, camera, actor poses and canvas hashes.
Opaque material IDs and first-pose sort bounds are retained as diagnostics,
rather than treated as saved state. Graphics recovery also requires exact bytes.
All failed/intermediate archives remain separate from passing output.

## Validation record

Current runtime validation passes **1,666 unit tests in 285 files**, TypeScript,
three Node QA checks, and **23 unique real Chrome cases**. V15 runs 22 cases
covering all W surfaces/skins, Q, Leona's rig, Sunlight and shared Hawkshot smoke
with normal/high-density depth captures. V16 adds the full-cycle/recast resource
case; its only source delta from V15 is that browser test. All runtime bytes
remain identical. The existing GPU arithmetic bound stays one channel level;
all 39 product/UV/erosion/palette/remap/BGRA/soft probes meet it.

Every enabled non-skin family draws visible source pixels, and all six families
with authored vertex BGRA select that path. Armed, hit and miss screenshots were
inspected. Real Save/reload and context recovery preserve the exact framebuffer,
world, source transforms/bounds/uniforms, per-layer images and actor poses. Fog
checks suppress hidden births/contacts while allowing later visible rays.
Winning-frame delayed bursts use frozen poses, then release owned materials,
ray/ground geometry, scene depth and the distortion copy without changing saved
bytes or disposing shared assets. Early recasts retain both phase histories.
Six complete alternating hit/miss cycles return to **25 geometries/46 textures**
after both outcomes have warmed, with no surviving skin/surface instances or
depth/distortion buffers. This is a controlled resource test, not a full-match
performance certificate.

Two ten-minute normal seeds pass 72,000 per-tick checks, twenty exact checkpoint
round trips and eighteen following-minute comparisons (1,080 ticks). All twenty
checkpoints equal the preceding W history/skin smoke after normalizing only the
ruleset. Both are unfinished at the smoke horizon; the required current full
100-seed cohort remains open.

The production subpath gate passes 32 recordings with zero unrequested Leona
preloads. A fresh real Chrome audit verifies the entire
**882-file/499,237,703-byte** offline pack: saved-tick boot, new local Lux 5v5,
integrity/cancel/retry/repair, multi-tab refusal, explicit version activation,
missing-entry revocation and scope-only removal. It observes 963 worker responses
and zero production errors. Pack ID is
`ca6f4494cc59dd0b33e2659e4f5c37ca4030c6317357ab2a48cdf387b9175b1b`.
There are 32 generated frontend files. Optional surface/skin chunks are
16.93/6.34 kB plus the shared 140.03 kB history/profile chunk; existing bundle-size
warnings and full delivery/performance acceptance remain open.

Schema remains **124**; the surface arithmetic joins the traversed presentation
module roots, producing ruleset
`67a9ea30c6ceb0ed42fe4ca72146b78f1b8c0f005271394332393ed59d6c7987`.
The final source archive is
`.cache/leona-w-surfaces-validation-v16-20261023` (1,479 inputs and 77 native
files); V15 retains full unit/build/delivery evidence and 22 browser
cases. Earlier V1–V14 archives preserve typing, loader, sampler, sphere and
Canvas2D investigations, failed traces and intermediate results. V14 also keeps
the misplaced vertex-color option finding; the final source-color guard passes.
All frozen evidence remains separate from the final passing output.

See the [verification ledger](reference/leona/w-surfaces-verification.json).

```sh
node tools/qa/verify-leona-w-surfaces.mjs
```

Use `--historical` after later canonical changes. No native shader/client was
executed, no source-audio or full-roster/performance gate is certified here, and
the full project goal remains active.
