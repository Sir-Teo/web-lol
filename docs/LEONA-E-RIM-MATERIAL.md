# Zenith sword rim-only material prerequisite

This document records the first explicit-input material stage. The later
[saved sword integration](LEONA-E-SWORD.md) now uses the rim factory in GameView,
adds the retained PS24 alpha gate and delivers checked source normal bytes.
The200-sample ledger below remains the historical prerequisite result.

`createParticleMeshRimMaterial` now transcribes the retained non-REFLECTIVE
ordinary mesh VS1/PS9 arithmetic. It takes explicit geometry, base/lookup/remap
textures, tint, UV transform, lookup coordinate, already mapped fresnel vector
and depth displacement. It needs no cube, reflection parameters or reflection
color. GameView does not import it; local E coverage remains18/20.

The [native reflection-input pin](LEONA-NATIVE-REFLECTION-INPUTS.md) establishes
source Data defaults, CPU packing and a conditional fresh-object resource guard.
Its source `.15` maps to float32 `.8350000381469727` before the shader. The new
factory accepts this mapped value explicitly. It does not treat the authored
color alpha as opacity, select a native emitter permutation or infer resource
bindings. Native Leona dispatch/reuse/resource upload and frames remain open.

The two factories share normal/UV validation, uniform snapshots and common
vertex/fragment arithmetic. The reflective factory retains its cube behavior
under `SOURCE_REFLECTIVE`. The rim-only factory supplies no reflection uniforms;
Chrome active-uniform inspection confirms its compiled program contains no
reflection sampler/parameters/color. Both require finite nonzero matching
normals and positive finite shader powers. The normal source remains explicit:
this factory neither generates normals nor modifies borrowed geometry/textures.
Disposal releases only its material; blend/raster policy is caller-owned and
starts at NoBlending. The normal uses the upper world matrix, with per-vertex
nonlinear rim evaluation before interpolation.

Six Chrome tests now compare200 samples with independent scalar calculations,
including97 rim-only samples and the103 earlier reflective checks. They cover
source/tint/lookup alpha, nonuniform scale, varying normals, remap alpha,
saturation, camera-ray depth movement/occlusion and exact graphics recovery.
A one-byte channel tolerance covers float32/RGBA8 rounding. The mapped-versus-raw
exponent control differs by more than40 red-channel levels at the chosen probe.
Four material unit cases cover rejected streams/bindings, copied uniform values
and borrowed resources. All1,882 unit tests in309 files, three QA tests and
TypeScript pass.

The first evidence check exposed a probe metadata issue: an occluder's shader
could remain WebGL's current program. The fixture now inspects the particle
material's linked program directly. Six browser tests and TypeScript pass after
that correction; the earlier records/failure are retained. Material arithmetic
did not change.

A local three-panel source-sword diagnostic uses retained GLB/base texture and
the separately derived [native-algorithm normal stream](LEONA-NATIVE-SCB-NORMALS.md).
It compares mapped power, raw source power and zero rim, with5,633 and5,699 changed
pixels respectively. The inspected image includes the complete sword. Tint,
white lookup, zero-alpha remap, sampling, raster state and camera are explicit
local diagnostic inputs. This is not a native cast, resource capture or accepted
E integration.

The [verification ledger](reference/leona/e-rim-material-verification.json)
archives relevant sources, test outputs, extracted shader identities and the
source comparison. Check it with:

```sh
node tools/qa/verify-leona-e-rim-material.mjs
```

Use `--historical` after later source edits. No native game/shader execution,
production/offline delivery, normal cohort or performance result follows from
these material probes. Existing GLBs, public assets, schema126 and ruleset591ddf38
remain unchanged. The next work is explicit source normal delivery and saved
E presentation integration, with native acceptance still separate.
