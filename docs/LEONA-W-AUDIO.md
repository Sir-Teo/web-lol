# Eclipse source audio

Eclipse now plays all five source SFX roles from the frozen base soundbank in the
development Leona fixture. Eighteen unchanged float WAVs retain complete source samples
and headroom. This is local playback reconstruction: native event dispatch, listener/bus
mix, shuffle, global voice priority and listening comparison remain unverified.
Production Leona selection remains gated.

## Frozen source graph

The skin declares two SFX banks. The pinned Riot 16.18.8175716 manifest yields 1,015,870
bytes of audio bank and 17,539 bytes of event bank; voice-over banks are excluded.
Pinned wwiser revision `71654ed1a2c4642894bd7e7ed79eba66986fb770` reports version 145,
91 media entries, 102 sound objects and 39 events. All seven declared SolarBarrier
play/stop events resolve through 40 selected/inherited nodes to eighteen distinct WEMs
(320,521 bytes). Output bus `1259461568` remains unresolved. The graph retains every
selected parameter path, value, type and parser annotation, including inherited
attenuation and action policy.

| Event suffix | Local role | Variants | Container gain | Global cap |
| --- | --- | ---: | ---: | ---: |
| `LeonaSolarBarrier_OnCast` | Accepted cast | 4 | −10 dB | 2 |
| `LeonaSolarBarrier_OnBuffActivate` | Initial buff | 3 | −9 dB | 4 |
| `LeonaSolarBarrier2_OnBuffActivate` | Successful extension | 3 | −20 dB | 4 |
| `LeonaSolarBarrier_hit` | Successful caster burst | 4 | −9 dB | 2 |
| `LeonaSolarBarrier_hitwhiff` | Missed caster burst | 4 | −13 dB | 4 |

The two corresponding Stop events each author **500 ms DelayTime**, with no authored
TransitionTime. Their curve is linear. They do not author a 500 ms fade. The first buff
Play action separately authors a **5 ms TransitionTime** and a linear curve. Other Play
actions author no transition. All containers use equal weights, random/shuffle
selection, reset-on-play, no avoidance and one container play. Children carry Priority
60 and no authored Loop property; decoded media has no loop metadata. The runtime plays
each recording once, stopping the originating buff phase 500 ms after its local stop
callback. Missing stop TransitionTime is explicitly bound locally to an immediate stop
after the delay; no native-default claim is made.

Pinned vgmstream revision `e6afeaacf433bfafd38d873f80c94517e09d5b96` decodes using `-i
-W 4`, retaining IEEE float32 masters without gain, clipping, normalization, resampling,
loop expansion or fades. The eighteen 44.1 kHz mono WAVs total **6,748,852 bytes** and
**1,687,015 samples**. Eight samples exceed the unit range; the maximum absolute sample
is 1.0674080848693848. The ledger keeps encoded/WAV/PCM hashes, exact frames, duration,
peak/RMS, endpoint deltas and complete decoder/static codec/compiler provenance. Real
Chrome compares every decoded sample and checks the complete WAV hash against the
committed profile.

## Local dispatch and saved continuation

Cast and initial-buff recordings start at accepted W activation. A successful detonation
starts one hit recording at the saved caster explosion point and the extended-buff
recording on the caster. A miss starts one whiff recording and no extension. There is
one hit sound per caster burst, even for multiple contacts. No separate natural-expiry
ending sound is invented. These are explicit local script/attachment policies; the event
bank establishes dependencies, not native callback ownership or timing.

The first buff stops at detonation or an earlier recast, death or victory. Extension
stops with its own saved buff. The two source stop delays remain attached to their
original phase identity; cross-recast native object/global stop scope is unverified.
Cast and explosion one-shots finish naturally. Buff sounds remain finite, even if a
local interval is held longer than its recording. Caster sounds follow saved caster
frames; hit/whiff stay at the saved pre-movement explosion point. A camera-ground
listener, local 0.2 master, source attenuation and 20 ms distance smoothing provide
distance gain. Panning, native listener placement, bus processing, virtualization and
global priority remain open.

The existing schema-124 W phase/contact histories already outlive every source recording
and delayed stop, including immediate death/recast. No additional saved field or
retention extension is needed. Tests prove every ended record has no active audio before
its actual history-retirement boundary, preserve strict saved bytes, and compare
restored phases/futures. Cosmetic indexed variant choice never consumes simulation RNG.
The audio state kernel joins the traversed presentation module roots, so its phase
interpretation and profile changes affect same-build compatibility. Exact native shuffle
is not claimed.

Birth eligibility uses the saved activation or detonation audience. Each sound also
requires current point visibility. A hidden activation stays silent after reveal; a
newly visible explosion can begin its own sound. Result tails advance on AudioContext
time while the saved winning tick stays frozen. Menu suspension pauses that clock.
Mute/hiding disconnect owned sources and gains; resume seeks the saved age. Natural
completion/stolen voice identities persist until their original history retires,
preventing repeated one-shots at a frozen simulation tick. Equal-priority kill-oldest
handling uses each source container's independent cap.

Controller/profile/masters load only on Leona presence. Initial fixtures await
readiness; a late Leona requests one eighteen-file load. Missing files settle readiness
as failed and retain one synthesized cast without repeated per-frame requests. If a cast
was synthesized while loading, its later source cast is suppressed while the appropriate
buff/burst phases remain eligible. Ordinary Ashe/Lux startup makes no Leona recording
request.

## Reproduction

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-leona-audio.py
.tools/cdtb-venv/bin/python tools/assets/inspect-leona-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-leona-w-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-leona-w-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-leona-w-audio.py --check
```

The final command verifies committed profile and WAV bytes without writing them. The
extraction/graph/decode commands reproduce source preparation and retain versioned raw
caches; use preserved archives to inspect the recorded attempts. No native client, sound
engine or shader was executed. Only the pinned decoders/parsers and the local browser
implementation run here.

 ## Validation record — October 24, 2026

All **1,672 unit tests in 286 files**, TypeScript, three Node QA checks and production
build pass. All **36 real Chrome cases** pass, including six new Eclipse audio cases and
the adjacent source-audio, surface/skin, rig, Q, Sunlight and shared depth regressions.
Chrome preserves all 1,687,015 source samples exactly. Real Save/reload restores clip
choice/offset and strict saved bytes; mute, hidden activation/newly visible burst,
finite completion at a frozen tick, result retirement, late loading and failed files
pass. The eighteen WAVs and profile reproduce byte for byte with `--check`.

Two ten-minute normal seeds pass 72,000 invariant-checked ticks, twenty exact round
trips and eighteen following-minute comparisons. All twenty checkpoints match the
preceding surface-stage smoke after normalizing only ruleset identity. Both matches
remain unfinished at that smoke horizon; this does not replace the current full
hundred-seed gate.

Production subpath passes 32 recordings, zero unrequested Leona preloads and no
development hook. A fresh full Chrome offline audit passes **901 files/506,000,253
bytes**, 963 worker responses, integrity/cancel/retry, saved-tick boot, repair, new Lux
5v5, multi-tab refusal, explicit version activation, missing-entry revocation and
scope-only removal, with zero production errors. Pack ID is
`38fd31d3a273bbd748751be648f80b691ddd98c74cc5574b7a14efc4b6055108`. The generated
frontend has 33 files; the optional W audio chunk is 11.87 kB (4.71 kB gzip). Existing
bundle-size warnings and full-match performance remain open.

Schema remains **124**, with ruleset
`d69c16c0407a5b436ef8cd078c989535ae38e72e9ed42778d60b77c9dacecdb2`. V4 freezes **1,514
source/QA inputs and 39 native/decoded files**. It differs from V3, which ran the 36
browser cases and normal smoke, only by correcting the isolated fingerprint fixture's
render-only expected roots. Runtime and browser bytes are identical. The isolated
fixture had included the new audio root in a render-only expected list; all explicit
roots remain independently checked. V3 also preserves four unit deadlines exceeded
during concurrent normal/browser work. Once those processes drained, the unchanged full
unit suite passed with two workers and its original five-second deadlines. No timeout or
acceptance budget was relaxed.

V1/V2 preserve the early Save-menu/late-model fixture investigation and failed traces;
V2's corrected four cases pass. The initial inventory's missing-extraction-file failure
and interrupted export log remain separate from the completed attempts. The initial
browser runner was drained before editing, after its actual fixture failures; no
observation timeout was treated as process termination. Full archive/output hashes and
limits are retained in the [verification
ledger](reference/leona/w-audio-verification.json).

```sh
node tools/qa/verify-leona-w-audio.mjs
```

Use `--historical` after later canonical changes. Native callback/default/global stop
scope, object attachment, shuffle, listener/bus/listening calibration, E/R and other
missing champion presentation, player/support integration, current full cohort and
six-champion match/browser/offline/performance acceptance remain open. The full project
goal remains active.
