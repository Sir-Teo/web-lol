# Meditate audio declarations

The frozen Meditate spell declares a cast cue, an activation stop command and
an ending cue. The [source reading](reference/masteryi/w-audio-reading.json)
retains those exact suffix strings, five bank playback profiles and two stop
actions. This checkpoint prepares audio separately from the accepted
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

No public media, runtime dispatch, simulation state or save schema changes in
this source preparation. Audio playback can build on the explicit finite
bindings while retaining the missing loop and foley callbacks.

Actual normal/optimized checks and replays preserve the reading and all six
selected WAVs in bytes and timestamps. Schema 151, its ruleset and production
pack remain identical to the preceding graphics checkpoint. Exact source and
evidence identities are recorded in the
[source verification ledger](reference/masteryi/w-audio-source-verification.json).
The prior full unit/browser/production acceptance remains historical evidence
for that unchanged application; this source checkpoint adds bounded Python and
master-integrity checks rather than repeating those suites.
