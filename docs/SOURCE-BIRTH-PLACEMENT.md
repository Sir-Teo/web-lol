# Source birth placement

`sourceBirthPlacement` composes an already sampled shape with emitter-local base
position, an optional emission surface, explicit scale factors and birth vectors.
It retains float32 writes at every stage. Surface position and normal round to
float32 before use. The requested normal replaces each vector's direction with
normal times its magnitude; it is not a rotation of the original direction.
The shape's row-major turn then acts on velocity and acceleration. The sampled
offset is already shape-turned and is not turned again. Inputs stay unchanged
and every output owns its storage.

All 208 placement cases and 202 birth-value cases pass (410 total). There are
204 independent exact-byte placement fixtures, composed from verified external
shape/surface samples and selected external normal/turn functions with the emit
placement writes. They cover native-sphere positions/normals, absent surfaces,
point/sphere/legacy turns, normal routing and explicit offset scales. Float32
input bytes preserve signed zeros. TypeScript passes. See
`artifacts/source-birth-placement-tests.log`; reproduce with
`node tools/assets/export-source-birth-placement-samples.mjs --check`.

This is source-unit placement. Actor/root transforms, handedness, final scene
scale and the native bound-object-size convention remain separate. The caller
supplies offsetScale and surfaceScale explicitly; no gameplay radius is guessed
as a native size. This verifies selected external JavaScript arithmetic, not
native CPU/PRNG/update or visual fidelity. No active renderer changes here.
