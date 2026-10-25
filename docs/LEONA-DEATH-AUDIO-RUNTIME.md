# Saved Leona death facts and layered playback

Each accepted Leona death now retains its clock, fixed point and emitted audience
through the complete 338-tick source tail. Capture copies the existing death
event immediately after emission, without allocating another gameplay identity
or consuming RNG. Transient lookalike events, nonlethal damage and repeated damage
against a corpse create no additional fact.

The required `leonaDeathVisuals` field is empty for other champions. Its single
retained entry must match the current death clock, position and lifecycle, include
the owner's team, and keep a unique canonical audience. The 338-tick horizon ends
before every champion's minimum respawn. The fact retires at that bound and a
later death gets its own clock and point. Strict decoding rejects missing,
duplicated, future, expired, foreign and contradictory data. Snapshot schema is
129; old saves are rejected instead of reconstructing a missing birth audience.

Playback starts both direct source layers. The first starts immediately; the
second preserves its authored 1.75-second Play delay using a future Web Audio
start. Both use their full untouched masters, authored −10 dB gain and separate
four-voice caps. Absent pitch/transition bind locally to zero, without a loop or
fade. The fixed recorded point and birth audience govern the complete cue. Losing
live sight preserves an accepted death's tail, including when the player was the
only vision source. Later reveal cannot expose a death hidden at birth.

Mute/pause cancels active and pending nodes. Resume seeks each layer independently
or schedules its remaining action delay. Save/reload works before that delay and
after the 150-tick event log has expired. Completed layers cannot replay at a
frozen tick. Match-end layers drain on the audio clock without advancing the
winning saved world. Profile, controller and two masters load lazily when Leona
is present. Failed loads settle quietly without per-frame retries; death had no
prior synthetic cue to retain.

Dispatch at accepted death, fixed root placement, omitted-field defaults, local
master/listener mix and cap admission at scheduling time are reconstruction
policies. Both authored layers remain independent. Native caller/animation,
cancellation, effective inheritance, global arbitration and listening equivalence
remain unverified. Full ordinary Rift Leona and project acceptance remain open.

## Verification

Two missing-history regressions fail before implementation and pass afterward.
Ten history tests cover exact event facts, immutable audience/point copies,
hidden births, non-consuming inputs, identity/RNG preservation, finite retirement,
respawn cycles, terminal saves and strict schema129 forgeries. Nine audio cases
cover both layers, exact delayed starts, post-log restore, gain/stops, mute and
visibility cleanup, independent caps, completion and ready/failed loading.

The first typecheck caught a Vec2 import from a module that does not re-export it;
it now imports the defining math module. Two initial offset expectations differed
by one floating-point rounding step; expected offsets now use the elapsed tick
count. All 2,028 units in 327 files, TypeScript and three Node QA checks pass.

All eight new Chrome cases pass real Save/reload at ages 60 and 151 ticks,
identical snapshots and 400-tick futures, source phases and delayed starts,
hidden-death silence, finite completion, terminal draining, independent caps and
two failed-master requests without retries. The isolated player retains both
layers after losing its own live sight. Each new case checks page errors.
The initial 74-case broader run passed. An additional isolated-player regression
then reproduced two voices being cut off when the player's own sight disappeared.
Fixed-point death playback now retains its saved birth audience throughout the
finite tail. The updated broader run passes all 75 Chrome cases with no skipped,
flaky or failing cases. All 32 nested-path production recordings pass, with
development Leona excluded and no ordinary Leona preload. All 1,010 public
assets remain byte-identical.

Schema 129 ruleset is
`97151ada3e641df932b6600393d231d2580270ce04e59705b2a7544584ca640e`.
Pack `bead28e91772c49bcb4665fbf937a85e8b7b4a31787e83fa282c0805ffa32dce`
contains 1,060 files / 519,947,988 bytes. Offline integrity, repair, saved
boot and atomic version switching pass with 963 worker responses and no
production errors.
The [frozen acceptance ledger](reference/leona/death-audio-runtime-verification.json)
binds the source, generated files, initial failures and corrected evidence.
