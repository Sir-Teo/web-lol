# Complete private Baron float-master corpus

All82embedded numeric media decode to44,409,644bytes of mono44.1kHz IEEE float32
WAV masters. The same exact decoder binary/toolchain as the frozen eight basic
attack masters is required. Those eight masters match their original WAV/PCM
hashes, frames, rates, channels, metadata and measurements exactly.

The corpus preserves31,258samples outside±1.0, with maximum magnitude
1.5594818592071533. No gain, normalization, fades, resampling or downmix is baked
in. Source sample spans decode without loop expansion; none reports embedded
WEM loop metadata. That does not establish whether hierarchy/event dispatch
repeats a sound. The summed clip duration is251.735seconds, not an event timeline.

Every encoded WEM, decoded WAV and PCM span is hashed, and frame extents,
channel/rate fields, finite samples, peak and RMS are checked. The producer pins
the numeric graph, original basic-master record and immutable decoder helper.
Normal/optimized checks, a fresh second cache and eight isolated corrupt/missing/
symlink/encoded-source rejection probes pass. A complete post-probe check confirms
the original caches are intact.

Masters stay under ignored .cache/baron-audio-decoded-v1. Only the existing eight
basic-attack clips are public/runtime assets; the other74remain private. No new
event meaning, playback, boss kit, native dispatch, global mix or listening parity
is inferred from decoding the bank.

[Decoded record](reference/baron-audio-corpus-decoded.json) ·
[verification](reference/baron-audio-corpus-verification.json).
Check from the repository root:

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-baron-audio-corpus.py --check
```
