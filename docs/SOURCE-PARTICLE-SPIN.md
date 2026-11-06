# Source particle spin and drawing basis

`SourceParticleSpin` combines birth angle, angular velocity and half angular
acceleration times age squared into float32 degrees. Enabled finite-life
particles then add the integrated rotation in a separate float32 write, using
the source factor of 60. Explicit linger rotation replaces that integral with
a direct sample. Unbounded lifetime keeps birth spin but adds no integral.
`sourceParticleBasis` builds the source Ry * Rx * Rz row-major basis, including
an optional extra roll. Caller input and returned buffers own their storage.

All 388 cases pass. The 384 independent samples execute selected external turn
and basis functions across all 21 Baron rotation-enable settings and synthetic
constant, keyed and linger curves. They cover ages, finite/unbounded lifetime,
linger routing and extra roll. Float32 angles and both basis variants match
exactly. A composed-axis assertion distinguishes this order from default XYZ.
TypeScript passes. See `artifacts/source-spin-tests.log`; reproduce with
`node tools/assets/export-source-spin-samples.mjs --check`.

This is complex-particle spin and the local drawing basis. Primitive/actor/view
orientation, scale, binding and final shader transforms remain separate stages.
The explicit linger replacement follows the external turn route rather than
being integrated again. No native CPU/PRNG/cadence or visual fidelity certificate
is implied, and no active renderer changes here.
