# Highlander source audio

The private human/NPC fixtures use the frozen Highlander activation and
deactivation recordings. The spell explicitly maps suffix slots 18 and 19 to
`Play_sfx_MasterYi_Highlander_OnBuffActivate` and
`Play_sfx_MasterYi_Highlander_OnBuffDeactivate`; raw suffixes, IDs and parent
hierarchies remain in the [reading](reference/masteryi/r-audio-reading.json).
The adapter dispatches activation at accepted local R and the ending only on
natural buff expiry. Native lifecycle timing and death/recast/victory ending
callbacks remain unverified; those removals retain a finite activation tail
without adding an ending cue. Highlander's trail dispatch remains separate.

The two exact mono 44.1 kHz float WAVs total 852,024 bytes and 212,984 frames.
Activation is 3.011859410430839 seconds with peak 1.2022881507873535;
deactivation is 1.8177097505668933 seconds with peak 1.0587661266326904.
SHA-256 verification and direct float AudioBuffer construction preserve both
masters' headroom without normalizing, clipping, gain baking or resampling.
Source container gain is -10/-14 dB, one finite play, no action delay or pitch
range, a single media variant and global cap four with oldest-voice removal.
The six-point attenuation 339248780 and unresolved output bus 1259461568 are
retained independently of the attack audio profile. Native bus mixing and
equal-priority admission remain unverified; the local master gain is 0.2.

Saved histories capture onset, rank, score and audience. The existing buff owns
effective duration: an awarded takedown extends the same record, and W/Q pauses
do not restart or stretch the finite onset. Natural expiry captures its point,
audience and duration accounting. The onset follows the owner under the existing
creation/current-visibility gate; the ending uses its captured point/audience.
These positioning/visibility rules are local adapters. Schema 147 validates
active links, score/rank eligibility, exact stopped duration, reason/clock
relationships and finite retention (181 onset/110 ending ticks). Histories add
no gameplay IDs or RNG draws.

Pause/mute stops voices; resume and reload seek using saved clocks. Finite
completed sounds do not restart, including after victory. Failed loads retain
verified successes and wait for explicit retry. A generic R fallback suppresses
only that activation, allowing a later separate natural ending after recovery.
The resource loads only for Yi presence; production selection stays Ashe/Lux.

```sh
python tools/assets/export-masteryi-r-audio.py --check
python -O tools/assets/export-masteryi-r-audio.py --check
python tools/assets/test-masteryi-r-audio.py
python -O tools/assets/test-masteryi-r-audio.py
npx vitest run tests/masteryi-r-audio.test.ts tests/masteryi-r-audio-history.test.ts --maxWorkers=1
```

Focused validation passes 205 cases across seven files, including 32 new
Highlander audio/history cases and the existing Q/W/R/mark-assist interactions.
Seven export guards and actual checks pass in normal and optimized Python.
The broad run passes 2,484 cases across 352 files with only the three established
source-audit failures (absent Leona native/research input, original distortion
shader artifacts and unchanged Lux sampler digest discrepancy). TypeScript,
three Node QA cases and the production build pass. The pack contains 1,102 files
and 529,793,761 bytes.

Thirteen distinct browser cases pass across the initial batch and a focused
rerun, covering the seven existing attack-audio regressions plus six R cases:
exact float buffers, real keyboard R with Save match/reload and future expiry,
extension/pause continuity, partial-media retry, victory tails and lazy loading.
The initial batch passed twelve and failed one: a fixed 500-tick observation
landed after the finite ending tail. Only that observation horizon changed to
natural expiry plus 30 ticks; all save, seek, cue and duplicate assertions and
deadlines remain. The focused rerun passes and the original trace is retained.
This does not claim one clean thirteen-case batch.

The production smoke passes beneath `/nested/rift/`, retaining 32 ordinary
recordings, public champion inputs, purchases and restores. Both Yi development
flags stay rejected, and neither attack nor R WAVs preload. Native listening,
hardware/device/FPS, full browser and full offline/service-worker certification
remain open. Exact staged results and hashes:
[verification ledger](reference/masteryi/r-audio-verification.json).
