# Saved-pose Baron hit effects

The private encounter now draws all twelve source hit profiles. Loading begins
only after a historically visible contact: the pinned program and sixteen hit
textures load, while missile textures and mesh transports stay cold. Normal
practice/Rift retains its existing availability. The separate missile still uses
its explicitly provisional marker while flight-height routing remains open.

A private skeleton resolves the authored C_BUFFBONE_GLB_CHEST_LOC joint from saved
target poses, with saved facing and terrain. Endpoint matrices preserve the rig's
reference scale; fractional endpoints interpolate position/rotation/scale. The
renderer converts the metre translation to source centimetres and extracts unit
orientation so actor transport scale is not applied twice. Root placement never
reads a later live target. Death/removal uses the already saved detached pose.

The deterministic playback cache supplies the source births/motion/materials.
Birth visibility and current particle visibility both gate the draw. World
replacement rebuilds caches; expiry disposes private samplers, instance buffers
and materials. Renderer disposal owns shared texture resources exactly once,
including disposal during asynchronous loading. Authored negative polygon offsets
are applied to the two relevant hit emitters.

Nineteen focused cases pass. Six real-input Baron browser cases pass, including
exact save/reload centres/tints/UVs and retirement. The final depth-bias/console-
error case passes separately. The reviewed screenshot shows the purple contact
burst at Ashe's chest without covering the HUD. The isolated all-emitter preview
and 84 external fragment pixel cases still pass. Production build passes. See
reference/baron-source-hits-verification.json.

Native bound-object-size calibration remains uncertified: explicit neutral
factors match the external reader's omission. This is a source-driven hit preview,
not native-client visual/PRNG/cadence or device-performance certification. Earlier
offline acceptance records keep their original pack identities; this new build
requires its own delivery checks.
