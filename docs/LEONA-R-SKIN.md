# Solar Flare attached owner skin

R's `Cas_WeaponGlow` now overlays a private complete Leona rig from saved source
poses. It uses the authored sword mask, independent multiplier, scale
1.0099999904632568, birth scroll and color/lifetime curves. This adds one attached
family to the [35 source surfaces](LEONA-R-SURFACES.md), for 36 enabled families
integrated across both area alternatives. Eight enabled families remain separate.

## Static shader evidence

The [shader pin](reference/leona-r-skin-shaders.json) retains eight exact selections
from existing frozen 16.18 TOCs/bundles: skin VS34/56, PS0/4/23/41 and quad VS8/PS4.
Original Metal and AIR bytes remain canonical; local clang decoded textual LLVM
with passes disabled. No native client or Metal shader was executed.

For the no-FOW multiplier skin, the fragment arithmetic is:

```text
U = base(baseUV) * multiplier(multUV)
T = U * tint
discard if T.a < alphaRef                 // alpha-test candidate only
RGB = remap.a > 0 ? remap.rgb : T.rgb
RGB = clamp(RGB + interpolatedRim * U.a, 0, 1)
alpha = T.a
```

Equality at the alpha threshold survives. Tint alpha does not carry the rim;
pre-tint base/multiplier alpha does. Remapping preserves alpha. RGB saturates,
while alpha remains raw. Native FOW variants additionally multiply RGB by sampled
FOW alpha before saturation; that binding is not implemented by this material.
These skin variants sample no particle color-lookup texture. The global remap
texture is a separate input.

VS34 uses position, authored normal, four weights/indices and UV. Separate affine
rows transform base and multiplier UVs. VS56 additionally multiplies vertex color
by tint. The prepared source GLB has position/normal/UV/weights/indices and no
COLOR_0, so the local material uses the VS34 input contract and supplies no
fabricated vertex color. Missing normals fail closed. The native 256-entry
float3x4 bone palette establishes shader input shape; CPU palette construction
and native attachment transforms remain unverified.

The [static finding record](reference/leona-r-skin-reading.json) and
[16 exact readers](reference/leona-r-skin-readers.json) distinguish executable
external reconstruction from native code. Revision 2adda concretely reuses the
current owner skin/skeleton and scales about its parent; it does not read the
source attachment-lock flag or apply particle translation/orientation on this
path. The private local rig follows that bounded owner-skin policy using saved
frames and existing Three skinning. It preserves the source GLB root transform
and applies particle scale on an outer parent.

## Local bindings and remaining families

R0 has no authored alpha reference, lookup or reflection definition. The existing
compiler's 5/255 alpha threshold, zero rim with Fresnel power 1, no fragment FOW,
optional global-remap bypass, Repeat/linear/no-mip samplers, front-face culling,
no-stencil, depth-test/no-write and source blend 4 SrcAlpha/One are explicit local
bindings. Actual native CPU variant choice, defaults, bone palette, samplers,
render state and frame parity remain open. The local material exposes explicit
alpha-test/remap/rim inputs rather than claiming those defaults came from the
shader inventory.

The buff starts at acceptance and stops births at actual cast end. Its initial
birth follows the existing local first-update emission policy. Historical birth
vision and current point vision are independent. Source death poses stay frozen;
terminal display age drains the tail without stepping the World. Each particle
owns its private skeleton/bone texture and material; source geometry, images,
samplers and clips remain borrowed. Repeated updates reuse the private rig.

The two arbitrary weapon-glow quads still have no explicit bone/socket/frame
binding in the inspected R/model/reader pins. The model's weapon idle binding
belongs to `Leona_Idle_Sword`, and its emote joint events belong to other clips.
Neither justifies moving R's authored Y=-90 quads. Missing-texture `Activate`,
two planar receivers and three early distortion quads also remain separate.

## Verification

The [verification record](reference/leona/r-skin-verification.json) retains source,
native streams, readers and initial diagnostics. A copied test initially used an
erosion-style uniform name and the wrong birth tick; it was corrected to the
independent multiplier UV and existing first-update policy. The alpha-discard
probe initially left Three's premultiplied clear policy implicit; the harness
now explicitly disables premultiplied alpha. Runtime shader behavior did not
change for that correction. One full-suite scheduler case exceeded its default
five-second wall-clock timeout; its isolated retry and final checks are retained.

The final full 1,858 unit cases/306 files plus three Node QA cases pass. Seventeen
Chrome cases cover the attached rig, existing 35 R surfaces, W/E skins and the new
material. Eighty-four product probes plus alpha-boundary, independent UV and
float/context-recovery probes pass. Save/reload and graphics recovery reproduce
exact posed state/pixels; six R casts return to stable settled GPU storage and
retire each private material/bone texture without releasing borrowed resources.

Fresh production passes 32 recordings without development hooks or unrequested
Leona preload. The fresh 1,010-file offline pack contains 513,243,693 bytes and
passes all controls with 963 service-worker responses and no production errors.
Ruleset 8de37836 includes the new multiplier material root.

GPU arithmetic and local restoration are verified separately from native frame
correspondence. No new normal-match cohort or CPU benchmark is claimed. Schema 126
stays unchanged. Native acceptance, remaining R bindings, player Leona/support
and full six-character match work remain open; the full project goal stays active.

```sh
python3 tools/assets/verify-leona-r-skin-shaders.py --check
npm run check
npx playwright test e2e/leona-solar-skins.spec.ts e2e/particle-skin-mult-material.spec.ts
node tools/qa/verify-leona-r-skin.mjs
```
