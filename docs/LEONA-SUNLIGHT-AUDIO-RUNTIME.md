# Sunlight source playback from accepted consumptions

Each accepted ally consumption now plays one prepared Sunlight source master,
including a lethal proc. Existing saved Sunlight records supply the cosmetic
serial, start clock, target poses and birth audience. Marks, expiry and Leona's
own damage create no consumption record and no cue. No gameplay or snapshot
fields were added.

The cue follows the saved target position and detached lethal endpoint. A fixed
birth audience plus current point visibility prevents later reveal from exposing
a hidden consumption. Media choice is indexed by the saved serial and start
clock, independent of gameplay IDs and random draws. Multiple same-tick hits
retain distinct keys; numeric serial order implements deterministic local
oldest-first admission under the authored two-voice cap.

The controller uses the untouched finite float32 masters, −12 dB authored gain,
shared spell attenuation and existing local master/listener policy. Absent pitch
is locally zero, with no invented loop, delay or fade. The existing 65-tick
history covers the longest 42-tick audio horizon. Mute/pause releases owned nodes
and resume seeks the saved age. Completed voices cannot replay at a frozen tick.
Match-end tails drain using the audio clock without advancing the saved world.

Profile, controller and three masters load lazily when Leona is present. A failed
load settles readiness without per-frame retries. Sunlight previously had no
synthetic cue; source failure remains silent and preserves the accepted visual
history. Q and ordinary-attack fallback policies are unchanged.

These are explicit reconstruction policies. Event declarations do not establish
native invocation, target emitter placement, global shuffle history, effective
priority inheritance or listener/bus mix. No native game execution, source
listening comparison or full Leona/project acceptance is claimed. Schema remains
128; the compatibility fingerprint now includes Sunlight's audio state rules.

## Verification

Seven focused units cover accepted versus non-consuming damage, clocks, moving
poses, saved media choice, hidden starts, lethal detachment, distinct same-tick
serials, caps, gain, scheduling, mute/visibility cleanup, completion and failed
loads. The first fixture's unsupported neutral generic-spawn call was corrected
to the neutral-monster API after TypeScript caught it. Focused units and
typechecking pass.

The first browser run passes six of seven new cases. Its cap assertion assumed a
zero startup tick; actual keys correctly retained the captured tick 55. That test
now derives its expected keys from the saved consumption clock. The corrected full 65-case Chrome run passes all seven new cases and the
existing Q/ordinary attack/E/R, player controls, Sunlight graphics, Garen and bot
save regressions, with no skips or retries. Both live and lethal contacts restore
through actual Save/reload with identical snapshots, selected media, source
phases and 90-tick futures. Browser checks also cover hidden consumption, frozen
finite completion, terminal draining, numeric same-tick cap admission and three
failed-master requests with no per-frame retry or synthetic fallback. Every new
case checks page errors.

TypeScript, all 2,006 unit tests in 324 files and three Node QA checks pass. All
1,008 public files remain byte-identical. All 32 nested-path production recordings pass without development hooks or
unrequested Leona preloads. Ruleset is `5c2d23798008b80f63cb764c99b3209cd0c9005b97d971aefb2f2549bd59e068`.
Pack `bb67de04c6f068b2114e50016167e67c652348f7c72051c19c124733b3c1cf8a` contains 1,057 files / 518,616,608 bytes.
Offline integrity, repair,
saved boot and atomic version switching pass with 963 service-worker responses
and no production errors.

The [acceptance ledger](reference/leona/sunlight-audio-runtime-verification.json)
binds exact working sources, generated output and retained evidence:

```sh
node tools/qa/verify-leona-sunlight-audio-runtime.mjs
# After later project changes:
node tools/qa/verify-leona-sunlight-audio-runtime.mjs --historical
```
