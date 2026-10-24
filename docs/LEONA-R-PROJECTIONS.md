# Solar Flare planar receivers

R's green/red `Focused_Sun` families now draw on clipped terrain triangles. Saved
area placement, birth vision, current vision, source lifetime/scale/rotation and
color lookup drive profiles 12/18. This adds two alternatives to the 36 integrated
families, for 38 of 44 enabled families across both area colors.

The receiver query copies actual selected triangle positions into world space,
folding mesh and parent transforms once. It clips those triangles to an explicit
rotated XZ footprint and preserves their interpolated height. It uses no generated
ground plane, invented normals, heightfield or screen-depth reconstruction.
Fixture terrain and imported Rift terrain supply separate explicit roots.

## Evidence and local choices

The [static reading](reference/leona-r-projection-reading.json),
[12 pinned readers](reference/leona-r-projection-readers.json) and existing
[16.18 decal shader selections](reference/leona-r-decal-shaders.json) keep native
observations separate from reconstruction. Native UNLIT_DECAL transforms supplied
positions by an explicit world matrix; UV comes from rows 0/2 of a separate
world-to-UV matrix, with the final V coordinate flipped. The vertex shader
computes height fade, and the fragment shader multiplies diffuse, lookup and tint
with alpha-only fade. It does not select terrain or reconstruct position from
depth. Its no-FOW PS0 has no alpha test.

The exact external 2adda renderer substitutes one flat footprint quad. Its plan
claims an older 16.17 CPU implementation queries map triangles; that claim has
not been independently verified against retained 16.18 CPU code. The local
receiver query is therefore an explicit geometric reconstruction. Native receiver
eligibility, clipping, matrix construction, state and frame correspondence remain
open. No native client or Metal shader was executed for this increment.

Local eligibility selects visible static meshes under the terrain root with
opaque, depth-writing materials. Fixture receivers require alphaTest=0. Every
imported Rift material uses alpha masking, so that artifact instead selects its
explicit Ground_, HOL2026_Ground_ and Earth Gromp material names; vegetation and
props remain excluded. Treatment of holes in ground textures is unverified.
Skinned, instanced, batched and
actively morphed meshes are excluded. Actors are outside these roots. Spatial
cells are eight render units. The index is lazy and invalidated when its roots
change; callers must also invalidate after changing geometry, transforms,
visibility or eligibility. Source geometry/materials remain borrowed.

The footprint uses the exact external basis indices 0/6, equivalent to Three
matrix indices 0/2. An arithmetic audit confirms authored rotation [-90, theta, 0]
produces footprint turn -theta modulo one revolution. Reading Three index 8 here
would silently erase the sampled yaw. The local binding uses identity outer
particle frames, an explicit source-X reflection and the algebraic inverse of
that footprint. These are candidate bindings rather than recovered native CPU
matrices. Pretransformed receiving vertices take an identity world matrix.

Source mYRange=500 and mFading=500 become five render units each; the center is the
saved area point at the existing terrain-height query. Source half extents and
lifetime curves remain unchanged apart from the established 0.01 unit scale.
Source blend 0 uses One/One with tint RGB premultiplication; miscRenderFlags bit 1
locally disables depth testing. Depth writes/stencil/FOW are disabled, and the
effect uses the existing ground display stage with two-sided rendering. Native
CPU render state and resource bindings remain unverified. External preview alpha
reference, fade epsilon, depth bias and ordinary particle UV transforms are not
transferred into the native-derived decal arithmetic.

Each projected particle owns its geometry/material and borrows its image
samplers. Buffers grow in complete-triangle capacities and update active bounds;
a shrinking footprint can increase clipped topology, so allocation follows
required triangle count. Expiry retires owned resources. Rendering does not step
or mutate the World, consume simulation RNG, or allocate simulation IDs.

Six enabled R families remain separate: two weapon quads without a verified
attachment frame, missing-texture Activate and three early distortion quads.
Native acceptance, player Leona/support and the full match roadmap remain open.

## Verification

The full 1,874 unit cases in 308 files and three Node QA cases pass. The receiver
suite covers sloped triangle clipping, reflected/transformed parents, UV bounds,
material groups/draw ranges, visible-material changes, static invalidation,
borrowed ownership, active bounds and invalid input domains. The masked Rift
ground regression prevents silently selecting an empty map.

The actual Rift geometry probe uses a development fixture World with the Rift
renderer. It does not enable Leona in a normal match. At the selected point it
indexes 2,967 ground triangles, considers 201 candidates and draws 99 clipped
corners with heights from 0.3181 to 0.5020 render units. The result contributes
75,304 pixels and leaves the simulation snapshot unchanged. These are geometric
QA observations, not a native performance or frame-parity measurement.

Initial browser diagnostics are retained: instanced fixture scenery was wrongly
selected; a copied uniform name was wrong; replacing a World without releasing
its old unit-ID presentation cache reused another champion's rig; and filtering
Rift by alphaTest=0 selected no map. The fixed probe preserves the product gate,
releases old private rigs and selects named masked ground patches. Save/reload
also exposed a stale fixture fog overlay: it refreshes every eight ticks, while
the initial test teleported observers then captured after only seven. Reload
sampled current vision immediately. Paired images localized the difference to
fog, with identical bone matrices and projector geometry/uniforms. The final
probe captures at tick 12, after both views have refreshed fog. This does not
claim full-canvas equality at arbitrary intermediate fog-cache ages. Initial
mismatches and the three earlier repeated diagnostic restores remain retained.

The final 13 Chrome cases cover both color alternatives, exact saved state/bone
matrices/framebuffer at the refreshed fog age, graphics recovery, six-cast owned
resource retirement, Rift receivers, existing R surfaces/skin and 640 native-derived
decal arithmetic samples. The planar alternatives contribute 12,190/12,265 pixels
at tick 12. Settled repeated-cast GPU storage stays at 18 geometries/28 textures;
owned geometry/materials retire once and borrowed textures stay resident.

Fresh production passes 32 recordings without development hooks or unrequested
Leona preloads. The fresh pack contains 1,011 files and 513,275,022 bytes. Schema
126 stays unchanged; ruleset 6f1e1711 includes the projection frame and receiver
policy. No new normal-match cohort or CPU benchmark is claimed.

```sh
npm run check
npx playwright test e2e/leona-solar-projections.spec.ts e2e/particle-decal-material.spec.ts
node tools/qa/verify-leona-r-decals.mjs --historical
node tools/qa/verify-leona-r-projections.mjs
```

All fresh offline controls pass, including integrity failure/cancel/retry,
paused saved boot, complete repair, new match, other-tab refusal, atomic update
and scoped removal. There are 963 service-worker responses and no production
errors. The [verification record](reference/leona/r-projection-verification.json)
freezes source inputs, exact reader/native bytes, generated build and diagnostics.
