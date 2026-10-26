# Double Strike composite audio declarations

The [source reading](reference/masteryi/double-strike-audio-reading.json) retains
the passive's composite cast event and both hit actions, their four material
branches and nineteen private source masters. This checkpoint adds no playback;
it prepares the declarations separately from the accepted
[Double Strike controller](MASTER-YI-PASSIVE.md).

The explicit audio suffixes belong to
`Characters/MasterYi/Spells/MasterYiPassiveAbility/MasterYiPassive`:
slot 12 names `Play_sfx_MasterYi_MasterYiDoubleStrike_OnCast`, and slot 13 names
`Play_sfx_MasterYi_MasterYiDoubleStrike_OnHit`. That parent record omits
`mApplyMaterialOnHitSound`. The separate `MasterYiDoubleStrike` record omits the
audio-suffix map, explicitly enables that material flag and names animation
`Passive`. All presences and omissions stay separate. They do not establish
native callbacks, default-event resolution or material propagation between
records, and do not justify copying ordinary primary-AA dispatch onto the child.
The separate [trail-source reading](MASTER-YI-ATTACK-TRAILS.md) retains Passive's
two explicit particle events at literal frames 6.0 and 9.0. Those visual
declarations do not establish audio callback timing or suffix propagation.

| Phase/action | Target | Source behavior |
| --- | ---: | --- |
| Cast | 3840 | Three original playlist entries, −11 dB, ±100 cents, global cap 2 |
| Hit, first action | 391185571 | Four material branches; no authored delay modifier |
| Hit, second action | 391185571 | Same material branches; explicit 200 ms action delay |

The cast playlist remains 425476853, 271120929, 860189031, each with stored weight
50,000. The material switch retains group ID 1559186049, default Flesh and the
four original one-target branches. Its stored maximum-instance limit of zero
remains raw. Each branch declares a global cap of four, and **both hit actions
share those same branch containers and caps**. They are not separate voice pools
and must not be deduplicated into one action. Action fade-curve value 4 remains
stored; the first hit's absent delay is distinct from the second's explicit
`DelayTime=200` property. The projection uses zero for that absent delay.

| Material | Container | Original playlist order | Total inherited gain |
| --- | ---: | --- | ---: |
| Flesh | 1022689189 | 112126905, 16380216, 33081959, 7394909 | −11 dB |
| Metal | 139790345 | 142894910, 789302, 52272044, 95976721 | −12 dB |
| Stone | 1030627532 | 84648135, 204395837, 33473320, 21301409 | −11 dB |
| Wood | 700954476 | 126775659, 31491481, 116463815, 19763561 | −11 dB |

All finite containers retain one play, random mode 1, reset-at-each-play,
zero avoid-repeat count and `bKillNewest=0`. The hit switch adds −11 dB;
Metal's branch adds another −1 dB. Leaves add no modifiers, voice limits or
bus overrides. Mixer 3839 adds no properties. Root 1056413114 supplies priority
60, six-point attenuation 339248780 and unresolved bus 1259461568. Ordinary
primary attack audio instead uses priority 56, attenuation 134343538 and bus
211064428. That distinct routing remains preserved, with no native mix assumed.

Nineteen unique mono 44.1 kHz float WAVs total 1,654,340 bytes. Sixteen contain
samples above one; the largest absolute peak is 1.3174407482147217. WAV/PCM
identities, format/statistics and omitted encoded loop points are checked against
the retained canonical software decode. No clipping, normalization, resampling,
loop expansion or mixing is baked into masters. Finite bounds include the
slowest cast pitch endpoint and delayed hit action: 43 cast and 63 hit ticks on
the local 60 Hz retention grid. Those bounds do not recover native callback time
or align the composite automatically with either local physical contact.

```sh
python3 tools/assets/prepare-masteryi-double-strike-audio.py
python3 tools/assets/prepare-masteryi-double-strike-audio.py --check
python3 -O tools/assets/prepare-masteryi-double-strike-audio.py --check
python3 tools/assets/test-masteryi-double-strike-audio.py
python3 -O tools/assets/test-masteryi-double-strike-audio.py
```

Forty-three source guards pass per Python mode. They cover parent/secondary
omissions, missing/extra/duplicate events, hit action count/order/delay, switch
identity/default/branches, source gains/pitch, shared limits, original playlists,
leaf/source identities and master integrity. Existing differing readings reject.
This source audit changes no public media, runtime events, simulation state,
save format or application identity. Native composite timing/material callbacks,
shuffle/admission, official decoder and bus/listening parity remain unresolved.

Actual normal/optimized checks and replays preserve the reading and all nineteen
unique selected masters in bytes and timestamps. Schema 153, its ruleset and the
production pack remain unchanged. Exact source archives and staged identities
are recorded in the [source verification ledger](reference/masteryi/double-strike-audio-source-verification.json).
The preceding E runtime acceptance remains historical evidence for the unchanged
application; no new runtime suites are claimed by this source-only checkpoint.
