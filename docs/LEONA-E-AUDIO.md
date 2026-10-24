# Zenith Blade source SFX

The development Leona fixture plays six finite E SFX roles from the frozen
16.18.8175716 base banks. All 21 mono 44.1 kHz float32 masters retain every sample
and source headroom. Voice-over is outside this SFX increment. Native event
callbacks, omitted-property defaults, global shuffle/priority, listener/bus mix
and listening comparison remain unverified. Production Leona selection stays
gated; the reflective sword still requires native normals/bindings.

## Source graph and masters

The [graph](reference/leona-e-audio.json) traces all eight declared E play/stop
events through 45 selected/inherited nodes to 21 WEMs (153,551 bytes) in the
already frozen Leona SFX banks. It retains every parameter path, type, value and
parser annotation. Output bus 1259461568 remains unresolved. Inherited attenuation
339248780 is byte-identical to W's verified table; master gain and listener
placement remain local policies.

| Local role | Play suffix after `LeonaZenithBlade` | Variants | Gain | Cap |
| --- | --- | ---: | ---: | ---: |
| Cast | `_OnCast` | 4 | −9 dB | 2 |
| Arrival | `Dash_hit` | 4 | −8 dB | 2 |
| Dash | `Dash_missilelaunch` | 1 | −11 dB | 0 |
| Generic contact | `Missile_hit` | 4 | −11 dB | 3 |
| Champion contact | `Missile_hitchampion` | 4 | −10 dB | 4 |
| Flight | `Missile_OnMissileLaunch` | 4 | −14 dB | 4 |

Generic contact authors +300 cents and kill-newest. The other positive limits
use local equal-priority kill-oldest admission. Dash is a direct sound; its
zero cap is explicitly interpreted locally as unlimited, without a cap loop.
The five random containers author equal weights, reset-on-play, no avoidance and
one play; the local indexed variant choice does not reproduce native shuffle.

The dash Stop action authors **250 ms DelayTime** and no transition. Flight's
Stop authors **250 ms TransitionTime**, a linear fade, and no delay. Missing
fields use explicit local zeros, including absent pitch and Play transition.
No native default is inferred. PCM is neither pitch-shifted nor faded offline.

Pinned wwiser maps the banks; pinned vgmstream `-i -W 4` preserves float32 without
gain, normalization, clipping, resampling, looping or fades. The 21 WAVs total
3,041,668 bytes / 760,186 frames. Three samples exceed unit range, with maximum
absolute value 1.0784260034561157. [Decoder provenance](reference/leona-e-audio-decoded.json)
retains encoded/WAV/PCM hashes, frames, durations, peaks/RMS, endpoint deltas and
complete decoder/static codec metadata. All masters are finite with no decoded
loop metadata; source particle linger does not extend the recording or create a
loop.

## Local saved dispatch

Accepted cast starts the cast cue. Saved launch/dash starts their respective
finite cues. Every eligible saved contact gets a generic hit cue, with an extra
champion-contact layer only for champion targets. Successful arrival starts the
arrival cue; interrupted dash creates none. The particle declarations support
contact/dash/arrival associations. They do not establish native script timing,
champion gating or generic/champion layering; cast and weapon launch are bank
declarations without those five particle systems' direct sound binding.

Keys include source/cast/role and contact target. Each cue requires its saved
birth audience and current point visibility. Cast and attached phases follow
saved root histories; generic contact stays at its saved impact point, while the
champion contact follows retained target poses. Stopped flight/dash positions
freeze at their saved endpoint. The launched flight survives its owner's death.
Terminal presentation drains on the AudioContext clock without changing the
winning snapshot. Existing history bounds cover every source recording.

Pitch uses `2 ** (cents / 1200)`. Media seek offset is elapsed world seconds times
playback rate; natural wall-clock duration is media duration divided by that
rate. Mute/visibility resume creates fresh sources at the current offset.
An active flight stop cancels prior gain automation, applies the current linear
fade fraction and reschedules its stop. Dash delays its stop without fading.

Natural completions, stolen/rejected voices and synthesized fallback casts stay
remembered while their history exists, preventing duplicate playback on reveal
or mute. One controller serves a forward-running World. Save/import/restart
construct a fresh GameAudio through page reload; arbitrary rewind of an existing
controller is outside its contract. Sources/envelope/spatial nodes disconnect on
completion, suppression or mute. Failed assets settle readiness and retain
fallback cast feedback, without retrying each frame. Ordinary Ashe/Lux startup
does not fetch this table/controller or its masters.

## Validation scope

TypeScript, all 1,811 unit cases/298 files and three Node QA cases pass. Thirteen
unique Chrome cases pass across the initial audio run and two added lifecycle/
failed-file cases, including the existing W audio regressions. Chrome verifies
every decoded E float sample, exact saved variant/offset/rate and the in-flight
fade, hidden birth silence, a frozen winning snapshot, finite completion,
fallback identity, actual failed files and lazy startup. These validate local
Web Audio playback and source samples; no native client or native audio mix is
executed or compared. The first unit fixture checked dash admission before dash
start; corrected timing and both logs remain retained.

Snapshot schema remains 125. The new audio table/state joins the compatibility
fingerprint: `0f7b3e3b7db7a36777db878a46f376efae271e0e7de097892e12870ff4f7ef55`.
Earlier audits remain historical. No fresh normal-match cohort or CPU benchmark
is claimed. Delivery and evidence records are finalized with this increment.

Fresh nested production passes all 32 recordings without development hooks or
unrequested Leona preloads. The fresh 969-file / 509,786,617-byte offline pack
passes integrity, cancellation/retry, repair, saved/new-match boot, scope removal
and atomic two-version activation with 962 service-worker responses and no
production errors. [The verification record](reference/leona/e-audio-verification.json)
freezes source, media, decoder inputs, generated files and all retained checks.
Run `node tools/qa/verify-leona-e-audio.mjs`, adding `--historical` after later
canonical changes. `python3 tools/assets/export-leona-e-audio.py --check` verifies
retained inputs/generated outputs offline without a decoder or network call.
