# Oracle Lens source audio

Oracle Lens loads three original mono recordings when equipped or restored with
an active scan or retained ending. Ordinary Ashe/Lux startup still loads its
existing 17 recordings. The selected Oracle masters add 1,729,952 bytes of float
WAV data. This is a local playback reconstruction; native dispatch and mix are
not certified.

## Source evidence

The frozen 16.18.8175716 / 29CE6E781C3B6368 manifest supplies the shared item
banks from `Common.wad.client`. The [extraction pin](reference/oracle-audio-extraction.json)
retains original archive, entry and bank hashes. The
[binding pin](reference/oracle-audio-bindings.json) preserves the original preload,
typed legacy Troy records, field labels and empty audio Lua chunk.

The naming distinction is intentional: `TrinketSweeperLvl3` preloads
`trinketlenslvl3audio.troy`, whose `System.SoundPersistent` names
`Play_sfx_TrinketLensLvl2Audio_buffactivate`. The modern child Death declaration
names `Play_sfx_TrinketLensLvl1Audio_buffdeactivate`. A preload dependency does not
establish an executed callback. The legacy emitter's nine-second lifetime does
not replace the current eight-second gameplay policy.

The [bank-145 graph](reference/oracle-audio.json) retains all selected and
inherited node fields, parsed by pinned wwiser revision
`71654ed1a2c4642894bd7e7ed79eba66986fb770`. Direct DIDX/DATA extraction is
cross-checked against the parser's media headers.

| Layer | Sound | Media | Frames at 44,100 Hz | Gain |
| --- | ---: | ---: | ---: | ---: |
| Intro | 974527692 | 296489751 | 77,366 | −10 dB |
| Loop | 42688719 | 13033176 | 238,136 | −11 dB |
| Child ending | 649835072 | 1051782150 | 116,953 | −8 dB |

The activation event contains two concurrent Play actions. Both active sounds
have base pitch 1 cent plus a −200 to +200 cent range. The loop has unlimited
HIRC loop count and no embedded media loop markers; the local adapter repeats
the entire master. Both Stop actions declare 750 ms and curve 6 (Exp1).
The ending has no pitch modifier. Death declares it through a persistent-sound
field; the bank's one-shot does not establish whether native VFX retirement
cancels that recording. Keeping its full decoded tail is an explicit local policy.
Inherited attenuation uses the bank's stored normalized dB curve. No explicit voice cap is declared on these sounds/parents.

The loop has an additive Volume GameParameter, ID 745018932. Its four-point
curve is retained. The selected banks do not establish the parameter's native
value or update path. Local playback holds it at zero, corresponding to 0 dB;
the curve's inputs are **not** interpreted as elapsed seconds. Output bus
2149849771, native bus processing, spatialization and final listener mix remain
unresolved.

[Decoded evidence](reference/oracle-audio-decoded.json) records the pinned
vgmstream build, static codec dependencies, compiler, encoded/WAV/PCM hashes,
frame counts and sample statistics. The decoder exports IEEE float32 without
normalization, gain, resampling, loop expansion or fades. Browser decoding is
checked against every original float sample.

## Local playback and checkpoints

Both active layers begin at accepted activation. A stable cosmetic draw keyed
by owner, activation tick and layer selects pitch within the source range without
consuming simulation RNG. Seeking multiplies elapsed time by playback rate and
wraps only the loop. Saved expiry, recast and match-end clocks stop both active
layers; the Exp1 adapter follows pinned wwiser's `1 − (t + 1)t / 2` interpretation.
The child ending begins on the same derived child birth as the visual Death
system, at its captured point. These dispatch and interpolation choices need a
native listening comparison.

Current owner sight gates active audio; sight at the saved child point gates its
ending. Offscreen sources can remain audible through source distance attenuation.
Fog loss releases voices; returning to sight seeks the current phase. Mute stops
voices, unmute seeks current eligible phases, and pause suspends AudioContext
while preserving nodes. Natural completion is remembered while the saved history
exists, preventing repeated frozen-clock playback. The result tail can advance
on AudioContext time without mutating the terminal checkpoint; the Victory/Defeat
menu keeps gameplay frozen while short audio tails finish.
Other menus, hidden tabs and graphics recovery still suspend AudioContext.

Schema 106 retains the same presentation fields for up to 190 ticks after a
normal stop: 30 ticks to child birth plus 160 ticks covering every ending sample.
Particles still retire at their existing visual bound. Tail-only checkpoints
prepare audio even with Ward equipped. Missing recordings mark this optional
controller failed, preserve usable trinket gameplay and do not retry every frame.

## Reproduction and validation

Run from the repository root with the pinned tool checkouts available:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-oracle-audio.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/pin-oracle-audio-bindings.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/map-oracle-audio.py
.tools/cdtb-venv/bin/python tools/assets/decode-oracle-audio.py
.tools/cdtb-venv/bin/python tools/assets/export-oracle-audio.py
```

The [verification ledger](reference/oracle-audio-verification.json) records current
checks and their limits. Source masters, green behavior tests and deterministic
seeks do not certify a native audible mix, full-match performance or the full
project goal.
