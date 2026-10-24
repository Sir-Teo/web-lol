# Zenith Blade nonreflective surfaces

E's contact, dash and flight now draw fifteen enabled nonreflective mesh, quad
and billboard families through a shared source-surface renderer. The arrival
skin remains separate. Two arbitrary trails, the reflective sword and source E
audio still require integration. The empty sound-carrier billboard has no visible
draw.

## Shared renderer and source ownership

`SourceParticleSurfaces` contains the existing W surface material, placement,
ground projection, depth and disposal code. Small W/E programs supply their
profiles, saved phase groups, particles, birth audiences and poses. W retains
its previous origin/frame policies. E uses retained missile/target/caster
histories, so tails do not switch to a live actor after impact, dash completion,
death or a reload. Cosmetic seeks consume no World RNG or IDs.

The two nonreflective SCBs use their byte-checked source GLBs, raw UVs and vertex
BGRA where present. No normals, replacement mesh or source pivot are generated.
The contact cylinder has no vertex-color stream; the shared cone retains its
source BGRA alpha. Geometry and sampler clones are session-owned, with decoded
images shared through the existing texture loader. Each active particle owns its
material and any projected ground grid. Expiry releases these owned objects.
The source loader filters out the sword, skin, trails and sound carrier.

## Missile frame and world terms

[The reading record](reference/leona-e-frame-reading.json) binds six existing
external reconstruction files to their historical pins. Its `flightInto` matrix
places missile local Y along horizontal travel, local X to the side and local Z
down. Arbitrary quads expand source XY through the particle basis; the ground
shader then flattens world Y. A Z=90° birth rotation therefore keeps a missile
quad horizontal, as does the BG family's zero rotation. Applying W's upright
frame instead collapses these ground quads during projection.

The E weapon phase adopts that missile-frame policy. Contact/dash keep upright
unit-root placement. Particle-local orientation selects the current facing;
other particles retain their birth facing. Birth rotation always applies—the
external reader's `rotationEnabled` gates an additional integrated rotation rate.

World acceleration stays outside the attachment turn. The binding splits its
displacement and velocity from the prepared raw particle sample, rotates the
local terms, then adds the world terms. Direction-oriented billboard stretching
uses the resulting world velocity. This avoids turning Bokeh's upward world
acceleration into forward motion when the missile frame is applied. Kernel
outputs and saved clocks remain unchanged.

These are source-backed local binding choices. The exact native Leona object
matrix/script dispatch remains unrecovered. The existing source-X reflection,
bound-object radius, neutral lookup/global bindings, blend/depth state, soft
controls, vertical terrain projection and 2-cm ground lift remain local policies.
The external shader's constant ground level does not establish native terrain
sampling. No native frame or shader execution is claimed.

## Verification scope

Focused unit cases cover all fifteen families, unchanged snapshots, saved
flight/contact/dash futures, borrowed SCB geometry, owned ground buffers,
historical/current visibility, expiry, full missile ground-plane area and
unturned world acceleration/velocity. Chrome isolates each family against a
synchronously drawn source-off baseline, then tests exact source state and
whole-frame restoration through ordinary Save/reload and graphics loss.

The initial diagnostic omitted the missile frame and placed contact targets out
of historical sight. A later diagnostic put the vision provider exactly on top
of the target, obscuring the small contact cylinder and producing an unstable
overlapping-actor frame. Keeping that ally 100 cm away in the same brush preserves
contact visibility without changing source scale, depth or color. The retained
failed runs document these distinctions. The corrected fixture observes all
fifteen source families, including the authored small cylinder.

W's existing browser surface/skin cases and E's arrival cases are rerun because
the renderer is shared. Native attachment/material/frame comparison and the
remaining E families stay open.

The direct frozen-W comparison covers 63 hit/miss frames at three accumulator
positions, with zero differing framebuffer bytes and identical source transforms,
material values and owned ground vertices. The world snapshot remains unchanged.
This compares two local implementations using shared source assets; it is not a
native client comparison. Repeated E hit/miss rounds release every observed
material and ground grid, dispose the soft-depth target, and settle at the same
22 geometries/34 textures in this fixture.

Final validation passes TypeScript, 1,797 unit cases/296 files and three Node QA
cases. Sixteen unique Chrome cases cover fifteen combined source/regression
checks plus the six-round surface resource test. Fresh nested production passes
32 recordings without a development hook or unrequested Leona preload. The fresh
945-file / 506,716,756-byte offline pack passes integrity, cancellation/retry,
repair, saved/new-match boot and atomic activation with 963 service-worker
responses. No new normal-match cohort or CPU benchmark is claimed.

The [verification record](reference/leona/e-surface-verification.json) freezes
source inputs, generated delivery files and retained successful/failed evidence.
Run `node tools/qa/verify-leona-e-surfaces.mjs` for current-input verification, or
add `--historical` after later changes. Schema 125 and ruleset 3f5f13be remain
unchanged. Sixteen visible E families now draw including the separate arrival
skin; two trails, the reflective sword, source E audio, native acceptance and
Leona player/support integration remain open. The full project goal stays active.
