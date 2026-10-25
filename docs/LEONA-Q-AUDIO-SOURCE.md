# Daybreak source audio preparation

Thirteen source SFX masters are exported as untouched mono 44,100 Hz float32 WAVs.
This increment prepares media and authoring data; Q runtime playback and saved
attack attempts are the next step. The existing Q synthesized fallback remains.

## Observed source data

The pinned 16.18.8175716 Leona banks declare five Daybreak events. Three finite
random containers provide four ordered variants each: activation at -8 dB with
cap two, empowered attack at -11 dB with cap four, and hit at -9 dB with cap two.
The buff event plays sound 394358931, media 526766817, at -17 dB with an authored
100 ms linear play transition. Its matching stop action targets that sound with
a 500 ms linear transition and no authored delay. All raw graph properties,
random policies and override flags are retained.

The buff sound authors `Loop=0`; the pinned wwiser reader interprets this as
infinite. This is an external format interpretation, not native playback evidence.
The decoded master is 2.499773 seconds and contains no decoded loop-region metadata.
Finite master length therefore does not establish finite buff playback. The
three random containers have loop count one and disabled transition mode; their
retained 1,000 ms transition field does not become a play delay.

No Q role authors Pitch. The generated table explicitly labels local zero pitch,
zero absent play transitions and zero absent stop delay. Cap zero is locally
unlimited. The inherited six-point attenuation table is retained, while output
bus 1259461568 is unresolved. Native invocation times, shuffle history, effective
voice arbitration, loop phase/region and listener/bus mix remain unverified.

## Extraction and verification

`map-leona-q-audio.py --check` verifies the canonical graph and thirteen encoded
WEM slices against pinned bank/XML bytes. `export-leona-q-audio.py --check`
verifies decoded provenance and all exported bytes without running a decoder or
using the network. Both checks retain their guards under Python `-O`. The separate
decoder uses pinned vgmstream with `-i -W 4` for a single untouched pass; its
assertions are not claimed as optimized-mode validation.

An independent source audit reconstructs exactly the same 29-node graph and
checks the loop/stop distinction. Its scripts, findings, graph and inputs are
frozen with this acceptance. No native game or REA provider session was run.
The 13 exports total 2,474,956 bytes. Eight samples in three masters exceed unit
range, with maximum absolute peak 1.084255576133728. They are preserved without
normalization or clipping.

Three units check provenance, all float PCM hashes and authored policies. Two
Chrome cases compare every decoded float sample for every master and confirm
ordinary Ashe requests no Q audio table or master. Ten isolated negative controls
reject changed WAV bytes, generated loop policy, bank loop property, stop fade
and WEM bytes under normal and optimized Python; both pristine baselines pass.
The first isolated baseline caught a copied E URL prefix. The corrected Q URLs
are explicitly checked; the original exporter, output files and failure logs
are retained as superseded evidence. No previously shipped E file changed.

TypeScript, all 1,952 tests in 317 files, three Node QA tests, 32 production
recordings and the 1,030-file offline pack pass. These checks are recorded in
`docs/reference/leona/q-audio-source-verification.json`. All 971 previous public
files remain byte-identical; only thirteen Q WAVs are added. Snapshot schema
stays 126. The source table changes the ruleset fingerprint, even though runtime
integration is deferred. Frozen evidence can be verified with:

```sh
node tools/qa/verify-leona-q-audio-source.mjs
# After later project changes:
node tools/qa/verify-leona-q-audio-source.mjs --historical
```

The longest activation master is 1.890975 seconds, longer than the current visual
retention after an early consumption. Runtime integration must retain sound
history long enough and record attack starts independently of later contact,
including canceled attempts, before using these masters.
