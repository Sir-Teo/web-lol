# Perseverance source audio

The Garen development fixture now plays the frozen recovery activation and active
sound from its saved healing intervals. The production roster remains Ashe/Lux.
This connects another part of Garen's kit; native dispatch, spatialization, bus
mix, loop-boundary listening and audiovisual comparison remain unverified.

## Source contract

The [graph](reference/garen-p-audio.json) closes all three base-skin
`GarenRecouperate1` events over fourteen hierarchy nodes and two media records.
The existing frozen Riot bank extractor and pinned wwiser parser validate both
banks before mapping events/actions and DIDX/DATA media ranges. The healing
particle resource explicitly names the `buffactivate` event. The separate
`OnBuffActivate` event and its stop are declared by the base skin; their exact
native script dispatch is unavailable, so starting both actions on a recovery
interval remains local policy.

| Action | Media | Frames at 44.1 kHz | Gain | Transition | Attenuation |
| --- | --- | ---: | ---: | --- | --- |
| `buffactivate` | 111098527 | 220,494 | −18 dB | None | 339248780, six points |
| `OnBuffActivate` | 433054605 | 165,832 | −40 dB | 500 ms linear fade-in | 947191947, four points |
| Stop `OnBuffActivate` | Same target | — | — | 1,000 ms linear fade-out | Same active curve |

Both media files lack embedded loop-region markers. The active sound node
explicitly stores `Loop = 0`, which the [pinned wwiser
reader](https://github.com/bnnm/wwiser/blob/71654ed1a2c4642894bd7e7ed79eba66986fb770/wwiser/generator/render/bnode_props.py)
interprets as infinite. The adapter therefore loops the entire 165,832-frame
recording. Missing embedded markers do not turn this sound into a one-shot.
The [reading pin](reference/garen-p-audio-reading.json) preserves that reader's
hash and distinguishes its interpretation from native runtime observation.
The activation master plays once for 220,494/44,100 seconds.

Each container has one equally weighted child, a global four-instance cap,
kill-oldest behavior and one container iteration. That container iteration does
not truncate the infinitely looping child. Both sound nodes explicitly use
priority 60. The parent mixer contributes the broad attenuation, while the
active container overrides it with its own shorter curve. The existing pinned
bank-145 attenuation evaluator preserves those distinct curves. Output bus
1259461568 remains unresolved; the 0.2 monitoring gain is local mix policy.

## Unchanged masters and reproduction

Two public IEEE float32 mono WAVs total **1,545,392 bytes**. They preserve every
source frame without normalization, resampling, gain baking, fade baking or loop
expansion. The activation master retains its approximately 1.1009 peak beyond
±1. Encoded/WAV/PCM hashes, decoder/compiler/static-codec provenance and metadata
are retained in the [decoded pin](reference/garen-p-audio-decoded.json).

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-p-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-p-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-p-audio.py
```

Ordinary Ashe/Lux startup does not load either master or import the passive audio
controller/profile module. Garen presence loads the two-file set. Concurrent
loads share one promise. A failed load remains silent with a named warning,
without a new synthesized cue or frame-driven retries. An explicit `.load()`
retry requests only a missing/failed master, retaining successfully decoded
buffers and all match/settings state. A user-facing pack/retry interface remains
part of the open delivery gate; this increment provides the controller API.

## Lifecycle and saves

Both actions use the original saved recovery start tick. The active sound follows
the same local stop boundary as particle emission: qualifying interruption, full
recovery, death or victory. It fades for one authored second; activation continues
naturally. The active fade-in reaches its original phase on reload, and a stop
partway through it fades from the level reached at the original stop tick.
This overlap policy is explicit reconstruction behavior pending native comparison.

Schema **112** retains the existing `garenPassiveVisuals` fields until the later
of `startTick + 300` and `stopTick + 182`. The 300-tick onset bound derives from
the exact source duration; an immediate full heal cannot delete the last two
seconds of activation audio. The visual particle lifetime is unchanged. Saved
history stays bounded, ordered and strictly validated; birth/audio keys consume
no World RNG or entity IDs. Earlier schemas and fingerprints remain incompatible.

Current listener gain and source fade envelopes use separate nodes, so camera
movement cannot restart or replace a stop ramp. Pause suspends AudioContext time.
Mute releases owned voices; re-enable seeks the same simulation phase. Enemy
sound requires current unit and saved-root visibility. A newly revealed ongoing
recovery seeks its loop; an expired activation never restarts. Global per-action
caps retire oldest local voices, and finished/stolen keys cannot replay while
history remains. Record retirement removes bookkeeping and owned nodes.

After victory, AudioContext time drains the remaining one-shots/fades while the
checkpoint and simulation tick remain frozen. Repeated updates or mute/re-enable
after expiry cannot replay them. New worlds reset this presentation clock.

## Verification scope

The [verification ledger](reference/garen-p-audio-verification.json) records exact
source/runtime/test/log identities and commands. Run
`node tools/qa/verify-garen-p-audio.mjs`. All **1,414 unit tests across 259 files**,
TypeScript, **35 focused Chrome cases** and nested-path production validation
pass. Production retains its existing 32 source recordings, no development hook
and the ordinary Ashe/Lux roster. Game/Three chunks are **884.65/658.93 KB**; the
size warning remains. Unit checks cover source contracts, partial transitions, per-action
attenuation, voice caps, original offsets, retained onset history, strict saves,
missing-file retry and terminal cleanup. Browser checks compare every decoded
float, observe actual Web Audio scheduling, save/reload an elapsed stopped onset,
exercise enemy fog, fail/retry a real request and drain actual victory tails.
Adjacent Garen particles, controls and all four spell-audio adapters are included.

The first browser run exposed scheduling a stop before `start()` when restoring
a fade. Web Audio rejects that order. The controller now initializes its envelope,
starts the source, then schedules the stop; the test double enforces the same
constraint. Initial traces/logs remain retained. Two reload-probe failures were
fixture mistakes: opening the actual pause menu and awaiting the asynchronous
save's success toast are required before reloading. They were corrected without
changing storage behavior.

These checks establish local decoding/scheduling and save continuity, not native
listening or complete Garen fidelity. The boost trail, passive buff icon, basic
attack/voice content, other remaining kit work and full roster/native/full-match
acceptance stay open. No normal-rules match cohort is rerun for this audio increment.
