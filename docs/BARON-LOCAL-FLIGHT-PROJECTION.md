# Local Baron flight projection

The private preview projector starts from the saved authored jaw matrix and the
recorded planar flight. Its muzzle offset decays over the initial planar target
distance, reaching one explicitly supplied elevation above the recorded point's
terrain. Target movement/death after launch cannot change that initial distance.
The source local-Y basis follows the resulting 3D travel and freezes at the stop.

This is a local visual policy. It does not settle the native interaction between
targetHeightAugment and offsetInitialTargetHeight, nor assert native trajectory
parity. The caller must supply elevation and the original target point. The native
source fields remain preserved, and no second height term is silently added.

The raw root sampler now supports private hidden-step reconstruction; the existing
visibility-gated drawing sampler retains its earlier-endpoint audience policy.
Hidden roots must still consume emitter RNG without granting birth visibility.
Missing/retired/future paths reject instead of being extrapolated.

Eight projection/history tests and TypeScript pass, including muzzle/end/fractional
points, stopping, independent reconstruction, caller ownership, hidden trajectories,
overlapping targets and invalid roots/elevations/terrain. See
reference/baron-local-flight-projection-verification.json. Scene binding is pending.
