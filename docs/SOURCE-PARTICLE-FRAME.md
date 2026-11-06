# Source particle frames and binding

`SourceParticleFrame` composes emitter-space translation, optional current-system
orientation, supplied orbit and world transforms, float32 drift, positive travel
binding and final draw position. Fresh births use zero effective delta in both
motion and frame stages, so they add no binding travel. Other particles keep the
birth frame unless particle-local orientation selects the current system frame.
World acceleration is integrated twice and added unturned, scaled by the current
lifetime squared. Returned standing frame remains separate from primitive basis.
All coordinates stay in source units; actor/scene conversion is caller-owned.

All 852 tests pass. The 848 independent samples execute selected external place,
carry, drawn-place and standing-frame functions with supplied orbit/world frames.
They cover all 21 Baron configurations plus synthetic emitter-space/local-frame,
binding, acceleration, HUD, orbit, fresh and finite/unbounded lifetime cases.
Every placed/drift/bound/travel/draw/frame float32 byte matches. Source moved and
world-offset values retain their double inputs before pool writes. Prepared
curves, caller state and all outputs own their storage. TypeScript passes.

See `artifacts/source-particle-frame-tests.log`; reproduce with
`node tools/assets/export-source-particle-frame-samples.mjs --check`.
Caller retains the original fresh flag until every substage of that step ends.
The helper accepts an explicit orbit matrix rather than computing orbital motion.
It does not choose actor-size, camera or projectile height conventions, nor
certify native CPU/PRNG/cadence or visual fidelity. No active renderer changes.
