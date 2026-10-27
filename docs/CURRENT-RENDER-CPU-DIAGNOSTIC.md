# Current-rules rendering diagnostic

A scoped profile at `ddc0888` restored the exact current-rules, ten-champion
20-minute checkpoint from seed 8 of the [normal-rules pilot](CURRENT-NORMAL-MATCH-PILOT.md).
The camera followed blue Ashe ID 1, selected by nearby visible opponents. The
final capture shows a bottom-lane turret encounter; it was visually inspected.

System Chromium 154 used SwiftShader on the cloud Xeon at 1920×1080, retaining
application quality. The ignored benchmark copy changed only browser launch,
match warmup (120 to 30 frames), and samples (1800 to 180). No runtime change
was made. The owned cohort workers paused for the measurement and resumed
successfully afterward; their wall times include this pause.

The 253.47-second instrumented profile classified 243.71 seconds as `program`.
Application render sampling was 4.98 seconds inclusive; scene matrix propagation
was 0.46 seconds inclusive. These overlapping sampled categories must not be
added. The profile does not attribute `program` time to a particular GPU pass.
Software rendering dominated wall time: animation-frame timestamp median was
1033.3 ms and p95 2300 ms, while measured application render calls had median
20.0 ms and p95 62.2 ms. Simulation made six fixed steps per measured frame;
this diagnostic advanced only 20.9 simulation seconds including warmup.

This is evidence of this software-rendered fixture, not native GPU performance,
physical FPS, a before/after improvement, or the complete-match performance
gate. Audio remained not unlocked. No additional animation/matrix optimization
is justified from this run alone. The earlier hardware observations in
[MATCH-RENDER-PROFILE.md](MATCH-RENDER-PROFILE.md) retain their own fixtures and limits.

The [record](reference/current-render-cpu-diagnostic.json) retains the full
measurements, profile summary, source/evidence hashes, benchmark adaptations and
pause interval. Raw checkpoint, profile and screenshot remain in the named local
cache. Application validation is explicitly inherited from the latest input
certificate; no app checks were rerun for this evidence-only addition.
