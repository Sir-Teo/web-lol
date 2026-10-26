# Meditate sound playback

The private human/NPC Yi fixtures play the explicitly bound finite W cast and
ending recordings. Accepted W starts the cast; a living channel's natural end,
order, control or mana exhaustion creates the ending. Death and victory close
the history without adding an ending. An already-created finite cue can finish.
This dispatch is a local lifecycle interpretation; native callbacks remain
unverified. The public selector remains Ashe/Lux.

Schema 152 stores separate cast and stop creation points/audiences, rank and
channel clocks. Cast follows the known actor; ending stays at its captured stop
point. A hidden cast cannot be revealed by later vision, while an ending has its
own admission audience. Source recordings keep their own clocks through W's
channel, mitigation linger and particle cleanup. The ending can still be saved
and resumed after both W particle histories expire. Validation links channel,
buff and audio records and rejects mismatched clocks or creation audiences.

Two source WAVs total 895,900 bytes and retain their exact float samples and
headroom. Playback uses finite non-looping AudioBuffers at unchanged 1× rate,
source gains −9/−13 dB, the retained six-point attenuation and independent cast/
ending caps of two/four. Local equal-priority admission sorts event chronology
and discards oldest voices. Pause/mute releases voices; resume seeks the source
recording. A generic fallback suppresses the later duplicate cast, while a
separate ending can play after recovery. Verified load successes survive an
explicit failed-file retry. Ordinary Ashe/Lux startup does not load these masters.

The earlier source-only checkpoint remains documented below and in its immutable
[source ledger](reference/masteryi/w-audio-source-verification.json).

The frozen Meditate spell declares a cast cue, an activation stop command and
an ending cue. The [source reading](reference/masteryi/w-audio-reading.json)
retains those exact suffix strings, five bank playback profiles and two stop
actions. The source-preparation checkpoint retained audio separately from the accepted
[cast](MASTER-YI-W-CAST.md) and [sustained](MASTER-YI-W-BUFF.md) particle effects.

| Spell suffix slot | Exact event |
| --- | --- |
| 12 | `Play_sfx_MasterYi_Meditate_OnCast` |
| 18 | `Stop_sfx_MasterYi_Meditate_OnBuffActivate` |
| 19 | `Play_sfx_MasterYi_Meditate_OnBuffDeactivate` |

Slot 18 explicitly names **Stop**. The bank also contains
`Play_sfx_MasterYi_Meditate_OnBuffActivate` and a foley event; their dispatch
triggers are absent from these retained spell and particle declarations. All
four W particle systems omit `soundOnCreateDefault`. Those omissions remain
explicit; bank existence does not establish native script or animation callbacks.

| Bank profile | Container | Source gain | Global voice limit | Recordings |
| --- | ---: | ---: | ---: | --- |
| Declared cast | 9222 | −9 dB | 2 | 637673445 |
| Declared ending | 9224 | −13 dB | 4 | 584858889 |
| Unbound activation, first layer | 9223 | −12 dB | 4 | 610915723 |
| Unbound activation, second layer | 449614214 | −19 dB | 4 | 795081856, 501197314 |
| Unbound foley | 242685979 | −10 dB | 1 | 136213286 |

All five containers retain one play, random mode 1, global limits,
reset-at-each-play, zero avoid-repeat count and `bKillNewest=0`. Playlist order
and stored weights of 50,000 remain exact. Parent mixer 9221 adds no modifiers;
root 1056413114 supplies priority 60, the six-point attenuation 339248780 and
unresolved bus 1259461568. Leaves add no bus override or voice limit. The
projection checks complete action/node/media membership, inherited properties,
playlist entries, source identities and playback policies.

The two activation Play actions retain **2,000 ms S-curve transitions**, with
stored fade-curve value 5. Their three leaves explicitly author `Loop=0`; the
encoded masters omit loop-point metadata. The two bound Stop actions target
containers 449614214 and 9223, retain **500 ms linear transitions** with curve
value 4, and keep the source object scope, state/dynamic-sequence flags and
empty exception lists. Container looping, leaf looping, encoded loop metadata,
transition envelopes and actual dispatch remain distinct. This preparation
expands no loop and substitutes no linear envelope for the S-curve.

Six previously decoded private mono 44.1 kHz float masters total 2,373,652 WAV
bytes. Two retain samples above one; the largest absolute peak is
1.110612154006958. Source WAV/PCM identities, rates, channels, frames and headroom
are checked without clipping, normalization, resampling, mixing or seam repair.
The finite cast and ending recordings require 151 and 155 local 60 Hz retention
ticks respectively at 1× playback speed. These are recording bounds rather
than recovered native callback durations. Canonical software decoding remains
separate from official-client decoder, bus and listening calibration.

```sh
python3 tools/assets/prepare-masteryi-w-audio.py
python3 tools/assets/prepare-masteryi-w-audio.py --check
python3 -O tools/assets/prepare-masteryi-w-audio.py --check
python3 tools/assets/test-masteryi-w-audio.py
python3 -O tools/assets/test-masteryi-w-audio.py
```

Existing differing readings are rejected; use a separate reviewed output path
for a changed projection. Thirty-one guards pass in each Python mode, including
Stop-versus-Play suffix substitution, missing/duplicate events, fade duration and
curve, leaf loop policy, caps, playlist/source identity, stop scope/media closure
and master format/integrity.

The source-preparation checkpoint added no public media, runtime dispatch,
simulation state or save schema changes. Playback now uses the two explicit
finite bindings while retaining the missing loop and foley callbacks.

Actual normal/optimized checks and replays preserve the reading and all six
selected WAVs in bytes and timestamps. At that source-only checkpoint, schema 151, its ruleset and production
pack remained identical to the preceding graphics checkpoint. Exact source and
evidence identities are recorded in the
[source verification ledger](reference/masteryi/w-audio-source-verification.json).
The prior full unit/browser/production acceptance remains historical evidence
for that unchanged application; that source checkpoint added bounded Python and
master-integrity checks rather than repeating those suites.

Runtime reproduction adds:

```sh
python3 tools/assets/export-masteryi-w-audio.py --check
python3 -O tools/assets/export-masteryi-w-audio.py --check
npx vitest run tests/masteryi-w-audio.test.ts tests/masteryi-meditate-audio-history.test.ts --maxWorkers=1
```

The runtime focused run passes 248 checks across 14 files, including the new
history/voice checks and existing Q/R audio, W controller, particles and loaders.
The full suite passes 2,722 of 2,725 cases across 366 files; the three recorded
source-artifact baseline failures remain. The original 111,600-tick wave-clock
check passes its unchanged five-second limit. TypeScript/production build and
three Node QA checks pass. Actual normal/optimized export checks and replays
preserve all four delivery files in bytes and timestamps.

The final Chromium/SwiftShader batch passes all 19 cases with retries disabled:
five W audio, six Highlander audio, five sustained-particle and three W channel
cases. Both W AudioBuffers retain every source PCM sample and their headroom.
Real W Save/reload restores the exact future, and its ending still resumes 125
ticks after the channel ends, after particle cleanup. A failed cast master uses
one fallback, retries only the failed file and keeps the separate ending.
Terminal onset drains once without a new ending or saved-world mutation.
Ordinary startup requests zero W masters; late Yi presence fetches each once.
Highlander W pauses/takedowns, source PCM, natural expiry, recovery and terminal
behavior retain their original checks alongside the new audio.

The strict production `/nested/rift/` audit passes all 32 recordings. It verifies
zero development W WAV, cast-texture/mesh and buff-texture/mesh preloads alongside
real production Lux, ward, Oracle, companion, restart/restore and opacity checks.
Development hooks and private Yi selection remain absent.

The schema-152 ruleset is
`dd5481cb4f6ac5b874808ea491363354f218cbafbc3757af34052287be996962`.
The verified pack is
`f08060335b38d8fb3ee2e6d32fe9602245a011fb5723a2f957ac414bb45e33f8`,
with 1,140 files and 533,993,541 bytes. Exact source archives, staged diagnostics
and evidence identities are retained in the
[runtime verification ledger](reference/masteryi/w-audio-verification.json).
These checks establish source-memory/API behavior and bounded regression
coverage; physical listening, native bus/output calibration, device FPS, the
entire browser suite and offline installation remain unverified.
