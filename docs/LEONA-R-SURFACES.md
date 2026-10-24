# Solar Flare saved-phase source surfaces

GameView draws 35 of R's 44 enabled source families: cast, contact, one area
alternative and supported impact surfaces. Each viewer sees 30 families across
these phases; the other five belong to the opposite area color. All nine disabled
declarations remain disabled. Source meshes/images, authored offsets, UVs,
lookup inputs and particle lifetimes are preserved.

## Saved placement and explicit scope

The cast root follows saved caster frames. The local cast emitter stop is actual
release, or cancellation before release. One fixed area burst starts at accepted
cast time, using the green alias for the caster's team and red for the opponent.
One impact burst starts at actual impact, including a released posthumous cast.
Each recorded participant receives a contact burst on its saved root. Impact
placement does not follow a moving caster or target. These alias/timing/root
choices are local reconstruction, not recovered native script callbacks.

Creation audiences, historical birth audiences and current point vision are
independent. Area/impact use saved point vision rather than caster visibility.
Saved poses remain detached from live animation and respawn. Only finite bursts
may borrow a terminal frozen frame for delayed births; display age retires them
without stepping gameplay. Save schema 126 stays unchanged.

Nine enabled families remain outside this surface path: the complete four-family
weapon buff, two planar projections and three early distortion quads. An initial
root-binding probe put both weapon-glow quads below terrain and produced zero
pixels. Their authored Y=-90 offsets were retained; they now await an explicit
weapon attachment frame with the attached skin. `Activate` still lacks a base
texture. No white texture, raised offset, substitute primitive or normal is
invented for these records.

Ground quads use the existing local vertical projection with navmesh masking
where authored. Source stencil reference 7 has no authored mode; this path keeps
its existing no-stencil policy. Ordinary meshes retain the source vertex streams
and reflected frame. Session images/samplers/mesh geometry are borrowed; each
particle owns its material and any dynamic ground/ray geometry. R authors no soft
particles, so no soft-depth target is allocated.

## Orbital and distortion revision boundaries

The [kernel readers](reference/leona-r-kernel-readers.json) pin revision 65a7.
The two orbital billboards apply that revision's world-axis `RyRxRz` after root
orientation, about current origin, then add world acceleration unturned. The
source-X reflection is exactly `S R S`, quaternion `(x,-y,-z,w)`. Direction rotates
before camera projection; raw travel/speed/stretch stay independent. W/E supply
no orbital input and retain their prior arithmetic path.

The [new static reading](reference/leona-r-surface-reading.json) and
[28 exact primary files](reference/leona-r-surface-readers.json) distinguish a
newer external revision 2adda. Its emitter-local pool composes orbit before the
captured birth frame when particle-local orientation is false, and after current
yaw but before the definition transform when true. Its direction includes
orbital displacement. The existing 65a7 reconstruction is therefore explicitly
version-specific; the two orderings cannot be interchanged by reflection.

Revision 2adda also interprets distortion mode bits as `all=1` and
`noCharacter=2`, with override/HUD/ground/custom-material precedence and a Medium
quality gate. The actual three R mode 2 quads have none of those overrides and
select an early pass excluding characters. They remain excluded until that
stage has a separate implementation. The two default mode 1 impact quads use the
existing late canvas-copy pass and native-derived distortion arithmetic with
authored strength, under the existing local sampler/render-state bindings.

The frozen four native TOCs/15 programs have alpha-test, color-palette and mesh
mask defines, but no mode permutation proving CPU phase dispatch. The newer
reader's handwritten warp differs from native shader arithmetic. These static
readings establish reconstruction candidates, not 16.18 native CPU/frame parity.
No native client or Metal shader was executed during this increment.

## Verification

The full 1,849 unit cases/304 files plus three Node QA cases pass. Seven Chrome
cases cover all 35 supported families across both area alternatives, localized
pixel contribution, exact Save/reload and graphics recovery at two phases, six
hit/miss cleanup cycles, all 44-family kernel seeks and the existing E kernel.
Separate W and E comparisons each preserve 63 frames byte-for-byte in pixels
and source state against their frozen renderers.

Fresh production passes 32 recordings without development hooks or unrequested
Leona preload. The fresh 1,008-file offline pack contains 513,235,759 bytes and
passes all controls with 963 service-worker responses and no production errors.
No new normal-match cohort or CPU benchmark is claimed. Schema 126 stays fixed;
ruleset cfa7ca3a identifies this increment.

The verification record below retains initial failures as well as final checks.
The initial zero-pixel weapon probes led to the explicit attachment exclusion.
A test copied from E incorrectly expected a soft-depth target even though every
R profile has `soft=null`; the final cleanup probe instead checks the actual
distortion copy lifecycle. Zero-size authored ground births may have an empty
draw range before their grid exists; capture code treats that as empty geometry.

The [verification record](reference/leona/r-surface-verification.json) freezes
source, readers, native streams and checks. Browser pixels establish local GPU
contribution and restoration, not correspondence to a native reference frame.
Projection/weapon/early-distortion integration, native CPU/material/frame gates,
player Leona/support and the full six-character match remain open. Nothing is
pushed; the full project goal stays active.

```sh
npm run check
npx playwright test e2e/leona-solar-surfaces.spec.ts
node tools/qa/verify-leona-r-surfaces.mjs
```

## Subsequent attached-skin integration

The [owner-skin increment](LEONA-R-SKIN.md) adds the single R attached-mesh family
with independent multiplier UVs and saved private poses, bringing integration to
36 enabled families across both area alternatives. The two unbound weapon quads,
missing-texture Activate, planar receivers and early distortion remain separate.
The 35-family counts and archive above remain the historical surface increment.
