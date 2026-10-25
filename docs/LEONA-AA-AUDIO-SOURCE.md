# Leona ordinary and critical attack audio sources

Ten declared attack SFX events now have a verified graph and 28 untouched mono
44,100 Hz float32 masters. This prepares source data; ordinary attack playback,
saved attack history, native invocation and target-switch selection remain open.
Seven masters reuse existing Q WAVs by exact hash. Twenty-one new WAVs add
2,366,276 bytes while all 984 previous public files retain their exact bytes.

## Distinct source policies

All four normal cast aliases target random container 2419, gain -11 dB and cap
two. BasicAttack and BasicAttack4 play actions author 40 ms delay; BasicAttack2
and BasicAttack3 omit DelayTime. Critical cast uses a distinct container 2425 at
-9 dB/cap two with the same four ordered media and different sound objects.
Shared media does not merge containers, voice caps or unknown shuffle history.

Normal hits 1/2/4 share switch 474813184 at -14 dB with ranged Pitch -300…+300.
Group 1559186049 defaults to value 1153642577/container 6307; the other three
numeric values select 6308/6309/6310. Every branch has four ordered sounds.
Semantic names, caller selection and random-pitch distribution are unverified.
The branch stop-on-switch and zero fade parameters remain raw source facts.

BasicAttack3 hit instead uses container 483073156: LPF20, gain -9 dB, priority56,
cap zero, normal random mode and avoid-repeat three. The other seven random
containers use shuffle mode and avoid-repeat zero. All eight preserve source
global/reset/noncontinuous flags, equal ordered weights and loop count one with
disabled transition mode. LPF20 is retained without inventing a frequency transfer.
Critical hit uses container 2426 at -12 dB/cap two, sharing four Q-hit masters.

Child sound priorities remain distinct: 24 author 56, four critical-hit sounds
author 60, and four special-hit sounds omit the property. Override flags remain
available; authored values alone do not establish effective inheritance.
No selected sound authors Loop. None of the five retained-bank stop targets
matches the 65 selected/inherited nodes. This bounded absence does not establish
that native scripts never cancel playback.

Attack inheritance uses parents 2418/2424→644758313, attenuation134343538 and
unresolved bus211064428. Its three-point scaling-two table is (0,0,constant),
(1350,0,linear), (2412,-1,linear). It differs from the six-point spell table.
Native bus/listener mix, voice arbitration and virtualization remain unverified.

## Provenance and checks

The canonical graph exactly matches an independent static audit of the pinned
16.18.8175716 banks/XML: ten events, 32 sound objects, 28 unique raw-bank WEM
slices and 65 nodes. Both graph checkers pass under normal and optimized Python.
Pinned vgmstream decodes one untouched float32 pass without gain, normalization,
resampling, loop expansion or fades. The 782,277 frames total 3,130,340 bytes.
All 82 samples above unit range are retained; maximum absolute peak is
1.182897686958313. No decoded loop-region metadata is present.

`map-leona-aa-audio.py --check` compares canonical graph and encoded outputs.
`export-leona-aa-audio.py --check` checks bank/XML provenance, decoded bytes,
format/frames/PCM hashes/peaks/headroom, action delays, switch/range/filter values,
raw priorities, policies, reused bytes and all generated outputs without a
decoder or network. Both preserve their guards under `-O`. The decoder refuses
to overwrite existing masters; normal and optimized rejection checks leave all
29 retained output/provenance files unchanged.

Four units check aliases, ordered variants, source policies, switch/attenuation,
all PCM identities and reuse. Two Chrome cases compare every decoded float
sample of all 28 masters and confirm ordinary Ashe requests no attack audio
source table or new master. Sixteen isolated mutations are rejected under normal
and optimized export checks: changed WAV, shared Q WAV, profile/action delay,
ranged pitch, LPF, child priority and WEM. Both pristine baselines pass.

The first exporter assumption incorrectly expected empty child properties;
validation caught their priorities before any public output was written. The
corrected table preserves them. A nested switch-parameter path and a new unit's
union typing/expected-value mismatch were also corrected. Original source,
logs and failed checks remain in the frozen evidence.

The standard, production and offline results are pinned by
`docs/reference/leona/aa-audio-source-verification.json`. Schema127 remains;
the unused source table changes the ruleset fingerprint. No native game, REA
provider or listening comparison was run. Verify this preparation with:

```sh
node tools/qa/verify-leona-aa-audio-source.mjs
# After later project changes:
node tools/qa/verify-leona-aa-audio-source.mjs --historical
```

Source-preparation ruleset is `9fe85fb04fa6718a206225b9bc0bab747fd3a056371b5a5b2d5a5da3929097de`. Pack
`14b49932982865d3b9f01c016205366821c682dbc8201cbbdb166400508438d8` contains 1,052 files / 518,230,169 bytes.

Offline integrity, repair, saved boot and atomic version-switch controls pass
with 963 worker responses and zero production errors.
