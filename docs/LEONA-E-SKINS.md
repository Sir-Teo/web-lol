# Zenith Blade arrival skin

GameView now draws the single enabled `Avatar_Burst` attached-character family
from `Leona_E_cas_arrive`. The other E mesh, trail, quad and billboard families
and source E audio remain unfinished. The reflective sword is still excluded;
its unresolved bindings are described in [the reflection prerequisite](LEONA-E-REFLECTION.md).

## Source and placement

The generated E profile retains the source's one birth, approximately 0.35-second
life, gold birth tint, color/alpha curve and authored erosion. The complete
Leona GLB, including its original transforms, geometry, normals, skin weights and
animations, is borrowed through a private `TargetPoseSampler`. Each birth owns
its skeleton and material. The current attached-skin declaration has identity
size/offset and full binding; those inputs are explicitly checked in the
renderer fixture rather than replacing the character with a new mesh.

The arrival's saved history selects position, facing and absolute animation
layers. Rendering does not advance or read a live actor's animation mixer.
Creation and birth audiences remain authoritative when sight returns; current
visibility can hide a previously visible birth. Death freezes the recorded pose,
while color and erosion continue along the particle clock. Frozen terminal
presentation drains the tail without changing simulation state.

The same `leona_base_r_buf_mult` image supplies base color and erosion. Separate
texture objects share the decoded image: base addressing is repeat and erosion
addressing is mirrored repeat. This avoids changing the session-owned texture or
another effect's sampler. Address dispatch follows the existing local surface
adapter; native sampler setup remains unverified.

## Material and loading

The existing skin-capable base/tint/erosion material is reused. Archived native
skin VS5/PS34 retains a Fresnel uniform even without `REFLECTIVE`; PS34 clamps RGB
and erodes only alpha. The E declaration has no authored reflection. Binding that
missing rim to zero, omitting a global remap, using source-alpha additive blending
and mapping authored depth bias to WebGL polygon offset are explicit local
policies. Native CPU defaults, variant dispatch and framebuffer parity are not
established by this integration.

The module and source table load only for Leona content. Boot waits for the
module when restoring a Leona match, and the lazy wrapper also handles Leona
appearing later. Failed loads can retry. A disposed wrapper cannot recreate its
renderer after a pending load. Model expiry/disposal releases private skeleton
textures and materials while preserving shared geometry and source images.

## Validation status

Focused unit cases cover the source declaration, sampler separation, private
ownership, snapshot equality, repeat seeks, visibility, death and terminal
expiry. Browser checks exercise the actual source mask and rig, visible pixels,
ordinary Save/reload, graphics recovery, private-resource disposal and repeated
casts. The browser inspection uses a fixed presentation clock so whole-frame
comparison does not depend on time spent loading the page.

The initial browser fixture incorrectly expected the GLTF root to carry a 0.01
scale; this export's root is identity and retains its converted source geometry.
The fixture now checks the actual identity root, while a separate nonidentity
unit rig verifies that the sampler preserves supplied source transforms. A
TypeScript capture-field omission was also corrected; the browser and compiler
failure logs remain retained. The death unit fixture needed surviving allied
vision to inspect the frozen pose after the caster stopped providing sight.
Native frame/audio comparison and the remaining E families stay open.

Evidence review also caught the visibility probe reading a drawing buffer that
the browser could clear between callbacks. Both source-on/source-off frames are
now redrawn synchronously. The check requires over 100 changed pixels confined
to less than ten percent of the viewport, excluding the original whole-frame
false positive. The original record remains retained.
The corrected source mask changes 15,028 of 1,296,000 viewport pixels.

The accepted increment passes TypeScript, all 1,790 unit cases/295 files and
three Node QA cases. Ten unique Chrome cases cover the three arrival-skin cases,
four E saved phases and three W skin regressions. Nested production delivery
passes with 32 recordings and no development hook or unrequested Leona preload.
The fresh offline pack verifies 942 files / 506,711,186 bytes, with 963 service
worker responses, offline save/reload/repair and atomic two-version activation.
This does not add a production Leona selection. Schema 125 and ruleset
`3f5f13befd26234c86d0603e8fcc4b3236eb6e43b1e4ebf5e47a968d46007653`
remain unchanged. See the [verification record](reference/leona/e-skin-verification.json).
