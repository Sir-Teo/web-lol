# Wall-time frame-rate readout

The minimap FPS label measures accepted presentation callbacks over elapsed
wall time. Slow rendering includes the full interval between callbacks, even
when the simulation limits catch-up to 0.1 seconds and six ticks per frame.
The initial label is `— FPS` until a half-second observation window completes.
Pausing retains the last measured value; isolated menu/resize repaints do not
contribute samples. Resume and graphics/visibility recovery start a new window
so time spent asleep does not depress the next reading.

The former counter accumulated the capped simulation delta. Five frames per
wall second could consequently appear as ten. Its label also refreshed only
when the match clock crossed a second. The label now updates independently
of match time, including after a result freezes that clock.

Eight focused counter cases cover slow and ordinary cadence, active stalls,
partial windows, resume and the existing presentation pacer. Together with
the existing pacer suite, all fifteen tests pass. A controlled browser check
drives real frame callbacks at 250 ms intervals: the current HUD reads `4 FPS`,
each active frame advances at most six ticks, and paused repaints advance zero.
The exact same browser test fails against source `87c1209`, displaying `12 FPS`
in that startup observation. The original trace and failure remain retained.
The existing paused/hidden/resize/resume browser regression also passes.

The controlled timestamps test clock accounting. It does not measure hardware
throughput, GPU duration, physical display refresh or an optimization gain.
The earlier [renderer observation](CONTROLS-RENDER-OBSERVATION.md) remains
scoped to its original build and software backend.

Simulation schema, rules fingerprint and save fields are unchanged. Selected
current-ruleset match runs use their already frozen runners; both earlier
hundred-seed audits also retain their original sources. Quiet browser checks
pause and resume those owned processes with a retained receipt.

Production validation and build identity are recorded in the
[verification ledger](reference/frame-rate-verification.json).
