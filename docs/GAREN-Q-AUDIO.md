# Decisive Strike source audio

The frozen Garen soundbank now has a complete Q/QAttack source pack: five declared
events, six play/stop actions, thirty-two retained hierarchy nodes and thirteen
unaltered float masters. This is source preparation and audition tooling. Q's
live gameplay audio remains the existing fallback; no Q sound dispatch or save
schema is changed by this increment. Garen remains outside production selection.

## Frozen event and media contract

The mapper selects every declared `GarenQ_` and `GarenQAttack_` event from the
base skin audio bank unit in `reference/garen-model.json`. Those names resolve
through pinned wwiser lowercase UTF-8 FNV-1 hashes to the actual Wwise events.
Bank extraction is the existing Riot 16.18.8175716 reference, manifest
`29CE6E781C3B6368`; the mapper re-verifies both original bank hashes before reading
their hierarchy and DIDX/DATA media ranges.

| Source action | Variants | Container gain | Action delay | Global voice limit |
| --- | ---: | ---: | ---: | ---: |
| Q OnCast | 3 | −12 dB | 0 | 2 |
| Q OnBuffActivate | 2 | −12 dB | 0 | 4 |
| Q OnBuffDeactivate | 1 | −14 dB | 0 | 4 |
| QAttack OnCast, first action | 3 | −12 dB | 0 | 2 |
| QAttack OnCast, second action | 4 | −14 dB | 230 ms | 2 |

The attack event has two distinct play actions. Its delayed action's authored
`DelayTime = 230` is not inferred from the local attack release frame, merged
into the immediate layer or represented as a confirmed hit event. Native script
dispatch and interruption of pending delayed actions remain unverified.

One cast variant has −2 dB sound-level makeup gain and another has −1 dB. One
active variant has −4 dB; these are separate from container gain. The source
containers retain random/shuffle mode, equal weights, no avoidance, reset-at-play,
global scope, one container iteration and kill-oldest policy. This records the
bank settings, not an implementation of its native shuffle scheduler.

`Stop_sfx_Garen_GarenQ_OnBuffActivate` targets only the active container and
declares a 250 ms linear fade. All thirteen WEMs have no embedded loop region;
the sound nodes declare no Loop property, and containers are noncontinuous.
The two active masters contain 340,041 and 346,185 frames: approximately 7.71068
and 7.85 seconds at 44.1 kHz. These lengths do not establish Q's gameplay buff
duration or justify looping/shortening a master. The existing ranked speed and
empowered-attack deadlines remain independent.

The shared parent contributes priority 60 and attenuation record 339248780. The
profiles preserve its six distance points, interpolation and scaling, plus the
two explicit attack-container priority overrides. Output bus 1259461568 is still
unresolved in these two banks; native bus mix/listener/spatialization are open.

## Exact float assets and audition

`reference/garen-q-audio.json` records the graph and encoded media ranges/hashes.
`reference/garen-q-audio-decoded.json` pins vgmstream and its static codec builds,
encoded/WAV/PCM hashes, frame counts, peak/RMS/headroom and decoder metadata.
`src/content/garen-q-audio.ts` retains five separate action profiles. The exporter
requires all thirteen media IDs exactly once across those profiles.

The thirteen public WAVs total **7,630,148 bytes**. They retain mono 44.1 kHz
IEEE float32 samples without normalization, resampling, gain baking, fades or
loop expansion. There are 8,092 samples outside ±1; the largest peak is about
1.7954. Original float headroom is preserved, with playback gain applied later.

The development page `/tools/qa/garen-q-audio-preview.html` decodes all thirteen
masters, permits explicit variant selection, and auditions either an individual
action or both QAttack actions with the authored delay. Active playback is a
one-shot with a separate source stop-fade control. The monitor defaults to 0.2
at nominal distance and applies container plus sound makeup gain; it is not a
native mix calibration. Each audition replaces the prior one, so the page does
not implement native overlapping-voice limits or shuffle. Source profiles remain
inspectable below its controls.

Ordinary Ashe/Lux and current Garen startup do not request these WAVs or import
the Q profiles. Live Q cast/buff/attack history, interruption/end policies,
on-presence loading, fallback coordination and saved playback are the subsequent
integration work. Source Q particles, basic/voice audio and complete native and
production acceptance remain open.

## Reproduction and verification

Use the pinned asset environment documented in [ASSETS.md](ASSETS.md):

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
.tools/cdtb-venv/bin/python tools/assets/map-garen-q-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-garen-q-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-garen-q-audio.py
npm run check -- --maxWorkers=4 --testTimeout=30000
npm run test:browser -- e2e/garen-q-audio-source.spec.ts
```

Source checks require the complete event/action/media closure, both attack
actions and their distinct timing/gains, all WAV/PCM hashes, frame counts,
finite floats and original headroom. Browser checks compare every decoded sample
against the WAV data and observe actual Web Audio calls for dual-action timing,
nonlooping playback, sound gain and the stop fade. These checks establish local
decoding/scheduling, not native event dispatch or listening parity. Full
verification scope is recorded in [PROGRESS.md](PROGRESS.md).
