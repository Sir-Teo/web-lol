# Baron history playback

The playback cache owns committed whole-tick source state and a separate fractional
draft. Sequential updates, skipped frames and reconstruction from the complete
saved prefix produce identical packets. Fractional samples and caller mutation
cannot change later whole-tick results. Rewinds replay from the initial state.
The maximum clock span is bounded by the full-history envelope.

The root callback supplies source-unit position, orientation, stop state and
historical visibility for every requested tick. It must retain immutable historical
answers; an owner replacing a World/history creates a new cache. Bone placement,
height and actor-size calibration remain explicit caller responsibilities.
No attachment fallback or native random-stream claim is introduced here.

Hidden births still run through the source emitter/RNG but retain their hidden
status after reveal. The packet serial records that status immediately at the
step, avoiding float32 birth-clock rounding at visibility boundaries. Consumers
combine the owned bornVisible set with current visibility. For ribbons, hidden
serials split runs in the batch renderer.

Six tests pass across both roles: sequential/skipped/fractional/rewound playback,
reveal resistance, caller ownership and invalid clock/root rejection. TypeScript
passes; source fingerprint remains ae3da0 / schema 166. See
reference/baron-history-playback-verification.json. Scene binding remains pending.
