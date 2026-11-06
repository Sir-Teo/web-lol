# Replayable source emitter schedules

`SourceEmitterSchedule` combines prepared rate values, emitter windows and count
arithmetic without using gameplay IDs or RNG. Callers supply explicit contiguous
steps and a random stream; the scheduler owns copied configuration and replay
state. It retains last-spawn time, emitted status and the wrapping 16-bit ordinal.
Snapshots own their storage. Restoring state reproduces subsequent decisions.

Delayed, ended, inactive or stopped windows do not draw rate probabilities.
Already-emitted single bursts do not repeat. Multiple births share one step
evenly in time; partial pool acceptance keeps the original planned shares.
A positive planned spawn still advances its clock if the pool accepts zero.
Invalid steps/rate draws reject before changing scheduler state.

All 70 cases pass. Independent fixtures join selected pinned external clock,
rate and count functions with the documented emit gates and birth-time formula.
There are 66 schedules / 3,960 supplied steps: all 21 Baron emitters and a
variable-rate probability case, each under no stop and two stop times. Replay
restores every 20 steps. Additional cases cover partial/full pools, input
ownership, ordinal wrap and invalid inputs. The normal fixtures assume no pool
pressure; separate pool tests check the locally composed acceptance contract.

See `artifacts/source-emitter-schedule-tests.log`; regenerate with
`node tools/assets/export-source-emitter-schedule-samples.mjs --check`.
The explicit fixture cadence is 30 Hz; this is not a native cadence or full
external `emit`/particle-pool execution certificate. Rate flex and velocity rates
are outside this definition's scope; both are absent from the current strict
Baron closure. Caller gates disabled/absent emitters and owns the stream/cadence.
Native PRNG, actual particle births, materials and active playback remain work.
TypeScript passes. No gameplay or active renderer changes in this step.
