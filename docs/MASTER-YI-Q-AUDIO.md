# Alpha Strike sound declarations

This source preparation follows the [contact renderer](MASTER-YI-Q-CONTACTS.md).
It does not add runtime playback, public WAVs or a snapshot revision.

The complete frozen Q particle package declares `soundOnCreateDefault` on exactly
two of its eight resources. `MasterYi_Q_Cas` names
`Play_sfx_MasterYi_AlphaStrike_missilecast`; `MasterYi_Q_Tar` names
`Play_sfx_MasterYi_AlphaStrike_hit`. The critical target, empty hit resource and
audio-named missile-begin dummy omit this field. Those omissions remain explicit
in the [reading](reference/masteryi/q-audio-reading.json); no critical, dummy or
other callback is inferred from names. Native script timing/creation remains
unverified, separately from these serialized on-create declarations.

| Resource/event layer | Container | Source gain | Pitch modifier | Global voice limit | `bKillNewest` |
| --- | ---: | ---: | --- | ---: | ---: |
| Cast, first action | 8847 | −12 dB | ±100 cents | 3 | 1 |
| Cast, second action | 8848 | −10 dB | ±100 cents | 3 | 0 |
| Ordinary target | 8846 | −11 dB | none | 2 | 0 |

Both cast actions contain one finite recording. The ordinary target retains its
five source playlist entries in their original order, each with stored weight
50,000. Source play actions have no delay/gain modifiers; each container uses one
play, no loop modulation, global limits, random mode 1, reset-at-each-play and
zero avoid-repeat count. The reading retains those raw policies, rather than
substituting a single shared eviction rule. Native RNG and voice arbitration
still require explicit runtime interpretation/calibration.

All three containers inherit through mixer 8845 into 1056413114: priority 60,
six-point attenuation 339248780 and unresolved output bus 1259461568. This is the
same root as Highlander, distinct from the attack-audio root/attenuation. Leaves
add no gain, pitch, bus override or voice limit. The graph event hashes, action
closures, ancestry, properties, playlist order/weights, leaves, media and curve
are independently checked against the frozen graph.

Seven already-decoded private mono 44.1 kHz float masters total 1,300,172 WAV
bytes. Three retain values above one; the largest absolute peak is
1.039229393005371. Samples remain unchanged, with no clipping, normalization,
resampling or embedded-loop interpretation. The slowest authored pitch endpoints
require at most 144 cast-history ticks and 42 hit-history ticks on the local
60 Hz grid. These are finite recording-retention bounds, not native dispatch
durations or recovered spell callbacks.

```sh
python tools/assets/prepare-masteryi-q-audio.py
python tools/assets/prepare-masteryi-q-audio.py --check
python -O tools/assets/prepare-masteryi-q-audio.py --check
python tools/assets/test-masteryi-q-audio.py
python -O tools/assets/test-masteryi-q-audio.py
```

The reading is immutable: a conflict fails before writing; another reviewed
profile needs a separate `--output` path. Twenty-five guards pass in each Python
mode. Helper controls cover missing/ambiguous fields, scalar/ranged properties,
nonfinite values and parent chains. Semantic mutations intentionally bypass the
outer graph checksum to exercise rejection of altered events, media, caps,
eviction flags, weights, routing, action modifiers and invented critical bindings.
Normal/optimized actual source checks also pass. Runtime, schema, ruleset and
production pack stay at the contact-renderer checkpoint. There is no new browser,
native listening, physical-device, FPS or native callback certificate here.

Immutable identities and source/check evidence:
[verification ledger](reference/masteryi/q-audio-source-verification.json).
