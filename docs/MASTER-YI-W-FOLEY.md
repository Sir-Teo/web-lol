# Meditate foley source connection

The frozen base animation supplies the missing foley declaration chain. Its
`Spell2_In` atomic clip declares particle event `{875c32d5}` with literal
`mStartFrame=1.0`, `mEffectKey=MasterYi_w_foley_sound`, `mIsLoop=false` and one
otherwise empty `ParticleEventDataPair`. The base skin maps that exact key to
`Characters/MasterYi/Skins/Skin0/Particles/masteryi_base_w_foley_sound`.
That system explicitly declares
`soundPersistentDefault=Play_sfx_MasterYi_Meditate_foley`.

The earlier W source/audio checkpoint covers the four case-sensitive
`MasterYi_W_` systems and spell suffixes. Its unbound foley label describes that
scope. This additional lower-case `MasterYi_w_foley_sound` resource and retained
animation event provide a concrete declaration connection. They do not change
slot 18's explicit Stop binding or establish a binding for the bank's separate
OnBuffActivate Play event.

The native closure contains five files: the complete skin BIN, animation BIN,
shared multi-skin particle BIN, the 25,492-byte entry ANM and 36-byte black TEX.
They total 43,548 bytes from 136,291 compressed archive bytes. Shared inputs match
the original frozen model and linked-resource extraction. Both complete model
BINs and the complete foley particle definition reparse against retained records;
the original ANM remains byte-exact.

The particle's single emitter is named `empty`. Its authored rate is 1.0,
particle linger is 10.0, flags are 180, and both texture slots name the same black
TEX. Omitted lifetimes, primitive, attachment and on-create sound fields remain
omitted. Those declarations do not determine invisible rendering defaults or
voice repetition and destruction behavior.

The existing bank profile is event 3748379910, Play action 1002732503, container
242685979, leaf 553860281 and media 136213286. It retains −10 dB gain, one global
voice with oldest replacement, a one-item playlist and the inherited attenuation
and unresolved bus. The verified float master retains all 30,827 mono frames at
44,100 Hz: 0.6990249433106576 seconds, 123,352 WAV bytes and peak
0.9212883710861206. The leaf omits a Loop property and the encoded file omits
loop-point metadata.

This is a source-only checkpoint. The entry clip omits `mTickDuration`; the raw
frame value is not converted into seconds or simulation ticks. Native animation
frame sampling, particle creation/removal, persistent component voice policy and
listening/bus parity remain uncalibrated. No public media, playback, simulation
state, schema or application identity changes are introduced.

See the [complete native source pin](reference/masteryi/w-foley-particles.json),
[literal binding reading](reference/masteryi/w-foley-binding-reading.json) and
[verification](reference/masteryi/w-foley-source-verification.json).

Reproduce with the pinned CDTB environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-w-foley.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/prepare-masteryi-w-foley.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-w-foley.py
```

Repeat with Python `-O`. Omit `--check` to restore frozen source files or create
the reading; existing conflicts fail before publication and correct outputs keep
their bytes and timestamps. Native source verification treats the separately
pinned ANM as an animation input, preserving the shared particle verifier's
stricter allowed-extension guard.
