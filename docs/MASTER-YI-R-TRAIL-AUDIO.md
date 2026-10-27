# Highlander persistent trail audio source

All three sustained Highlander particle systems explicitly declare
`Play_sfx_MasterYi_Highlander_trail` through `soundPersistentDefault`. Cast and
takedown systems omit persistent/on-create sound fields. The [source reading](reference/masteryi/r-trail-audio-reading.json)
retains those five bindings separately from the existing finite activation and
natural-ending cues. This checkpoint adds no runtime audio or public WAV.

The event has one immediate linear Play action targeting container 9115, with no
authored delay, transition time or ranged action modifiers. Its single playlist
leaf is sound 802209755/media 560618281, weight 50000. The container authors
MakeUpGain -13, cap 4, global scope and killNewest 0. Its finite playlist count
stays distinct from the sound's explicit `Loop=0` property. The encoded master
has no loop-point metadata; it is retained without expansion or seam repair.

One canonical mono 44.1 kHz float master contains 336,807 frames, 7.637346938775511
seconds and 1,347,272 WAV bytes. Peak 1.0218539237976074 and four samples outside
[-1,1] remain unchanged. No clipping, normalization, resampling or mixing is baked
into the master. The mixer hierarchy is 9115→9114→1056413114, with inherited
priority 60, attenuation 339248780 and unresolved output bus 1259461568.

The container also has an additive volume RTPC, parameter 745018932, curve
751387390 and scaling code 2. These are **raw stored graph ordinates**, not
literal decibel values:

| Input | Stored value | Native interpolation code |
| ---: | ---: | --- |
| 0 | -0.5533164143562317 | 5 / SCurve |
| 0.6000000238418579 | 0 | 9 / Constant |
| 8 | 0 | 5 / SCurve |
| 10 | -0.5533164143562317 | 9 / Constant |
| 20 | -0.5533164143562317 | 4 / Linear |

The retained graph has no definition/default for game parameter 745018932.
Its input meaning, units and live values remain unresolved; curve shape does not
justify treating it as elapsed buff time, movement speed or a constant. Native
rank selection, client persistent sound start/stop/fade callbacks and output-bus
processing remain separate runtime acceptance work. No stop event is inferred
from the independently declared finite deactivation cue.

Reproduce with `python tools/assets/prepare-masteryi-r-trail-audio.py --check`
and `python tools/assets/test-masteryi-r-trail-audio.py`, including optimized
Python. [Source verification](reference/masteryi/r-trail-audio-source-verification.json)
indexes exact particle/bank/master identities, guards, output replay and unchanged
application identity. Canonical decoding and source declarations do not certify
native decoder, bus, resampling, device output or listening equivalence.
