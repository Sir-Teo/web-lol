# Master Yi base SFX source preparation

The checkpoints below retain source extraction and decoding evidence. Current
ordinary/critical runtime playback is documented in [primary attack audio](MASTER-YI-AA-AUDIO.md),
with [Highlander activation/expiry audio](MASTER-YI-R-AUDIO.md) added separately.

The frozen base skin declares 31 SFX events in two banks, separately from its
voice-over banks. The selectively extracted audio/events banks total 751,976
bytes and match the retained archive, chunk and file hashes. No voice bank was
fetched. The [extraction](reference/masteryi/audio-extraction.json),
[inventory](reference/masteryi/audio-inventory.json),
[static event graph](reference/masteryi/audio-graph.json) and
[reading notes](reference/masteryi/audio-reading.json) retain the evidence.

The banks contain 69 media entries and 31 events. Their declared-event closure
retains 223 hierarchy nodes, including 101 sound objects, 39 random/sequence
containers, 32 play actions, three stop actions, three switches, eleven actor
mixers and three statically referenced attenuations. The raw bank inventory has
five attenuations; the graph records the selected dependency walk, not a claim
that native runtime can never use other authored records.

All 69 embedded media records are referenced. Their 737,501 encoded bytes retain
exact DIDX/DATA ranges, original RIFF/WAVE extents and SHA-256 identities. The
media remain WEMs in the private cache. No sample was decoded, normalized,
resampled, mixed or added to public assets.

Q launch has two play actions; Double Strike hit has two switch actions. The
Meditate stop event targets two containers. The graph preserves their separate
actions, children, native parameters, switches, playlists, loop/range/fade data
and inherited records. It does not merge branches into an arbitrary random pool.
Three unresolved external IDs are explicitly referenced through `OverrideBusId`:
211064428, 1259461568 and 2232828494. Native global mix remains unverified.

The clean wwiser checkout is pinned to
`71654ed1a2c4642894bd7e7ed79eba66986fb770`. The mapper checks both repository root
and revision and refuses modified tracked parser files. It calls the parser and
dumper directly without loading optional name databases. Each declared name's
local lowercase UTF-8 FNV-1 identity is independently compared with the pinned
parser, then resolved to an actual bank event. Original fields retain their
native IDs, values, types and parser formats; optional names are not invented.

The root's ordinary/extra/critical attack slots remain separate in the reading
notes. Omitted names/probabilities remain omitted. A skin event and matching bank
ID prove availability, not current script dispatch. In particular, this stage
does not infer a complete ordinary-attack pool or promote legacy Wuju event names
to verified active bindings.

Restore/check with the prepared pinned CDTB environment, then supply a clean
checkout of the exact wwiser revision:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-audio.py
python tools/assets/extract-masteryi-audio.py --check
python -O tools/assets/extract-masteryi-audio.py --check
python tools/assets/map-masteryi-audio.py --parser-root /path/to/pinned/wwiser
python -O tools/assets/map-masteryi-audio.py --parser-root /path/to/pinned/wwiser --check
python tools/assets/test-masteryi-audio-source.py
python -O tools/assets/test-masteryi-audio-source.py
python tools/assets/test-masteryi-audio-graph.py
python -O tools/assets/test-masteryi-audio-graph.py
```

The tools reject changed model/pin/bank bytes before archive access and refuse
differing graph/media outputs. All outputs are preflighted before any missing
file is created. Check mode never creates files; repeated identical outputs
retain their timestamps. The eleven source guards and eighteen graph/output
cases pass in normal and optimized Python. The actual source/graph checks pass
in both modes. An initial inspection safely rejected the incomplete local parser
path; the pinned checkout was prepared separately and inspected successfully.

This is source preparation only. Gameplay audio, public bytes, schema 145 and
its ruleset remain unchanged. Native dispatch, source-master decoding, runtime
loading, material/variant selection, stop/linger/seeking and listening/mix
comparison remain separate acceptance work. Evidence:
[audio-source-verification.json](reference/masteryi/audio-source-verification.json).

## Decoded source masters

The next checkpoint decodes all 69 media records into private IEEE float32 WAV
masters: mono 44.1 kHz, 3,798,546 frames, 15,197,220 bytes. None is silent.
Thirty-five retain samples outside the unit range; the largest peak is
1.3174407482147217. No clipping, normalization, resampling, channel mixing, gain,
pitch, loop expansion or fades are baked into these files. The source files have
no embedded sample loops; authored container looping remains in the bank graph.

The [decoded record](reference/masteryi/audio-decoded.json) pins each encoded,
WAV and PCM identity, original frame/rate/channel metadata, peak/RMS, endpoint
deltas and samples outside the unit range. It separately records the pinned
vgmstream/Ogg/Vorbis revisions, actual binary and static-library hashes, compiler,
CMake flags/cache identity and Linux platform. These are this build's artifacts;
the earlier macOS decoder identities are not reused or rewritten. Different build
profiles must use separate output/master paths and an explicitly reviewed record
checksum for independent checking.

The decoder sources are pinned to vgmstream
`e6afeaacf433bfafd38d873f80c94517e09d5b96`, Ogg
`fa80aae9d50096160f2b56ada35527d7aee3f746` and Vorbis
`2eac96b03ff67953354cb0a649c08aa3a23267ef`. The current Release build uses Debian
GCC 14.2, CMake 3.31.6 and static codec libraries; the CLI links libc/libm.
Decoding uses `-i -W 4` and checks source inputs before accessing the decoder.
All output conflicts reject before creation. Independent check mode verifies the
frozen record, source identities, raw WAV/PCM and format/statistics without
requiring the decoder binary.

```sh
python tools/assets/decode-masteryi-audio.py --decoder-root /path/to/vgmstream --ogg-root /path/to/ogg --vorbis-root /path/to/vorbis
python tools/assets/decode-masteryi-audio.py --check
python -O tools/assets/decode-masteryi-audio.py --check
python tools/assets/test-masteryi-audio-decode.py
python -O tools/assets/test-masteryi-audio-decode.py
```

Thirty offline decode guards pass per Python mode. Actual checking and a complete
repeat decode pass normally and with optimization; all 69 WAVs remain exact and
their timestamps are untouched. Runtime loading/bindings, bank gain/pitch,
material/variant selection, fades, looping, pause/seeking and listening/native mix
remain separate acceptance work. No public files, runtime rules or save format
change in this checkpoint. See
[audio-decode-verification.json](reference/masteryi/audio-decode-verification.json).

The later [Q source reading](MASTER-YI-Q-AUDIO.md) retains the two explicit
particle on-create bindings, three playback profiles, seven private float masters,
distinct voice-limit policies and missing critical/dummy bindings. That reading
prepares Q playback separately from the accepted attack and Highlander audio.

The [Meditate source reading](MASTER-YI-W-AUDIO.md) retains five bank playback
profiles, six private float masters and two stop actions. Its spell activation
suffix explicitly binds Stop; the bank activation Play and foley events retain
their absent spell/particle dispatch bindings. Source S-curve play transitions,
linear stop transitions and leaf loop policy remain separate from runtime work.
The later [W foley connection](MASTER-YI-W-FOLEY.md) retains the entry animation's
explicit particle event, the skin resource mapping and the particle's persistent
sound declaration. It narrows the earlier missing-binding claim; frame-time
conversion and native component/voice callbacks remain uncalibrated.

The [Wuju Style source reading](MASTER-YI-E-AUDIO.md) retains three explicit
spell cues, their original two-entry playlists, six private float masters and
the cast container's explicit priority. It prepares finite playback separately
from E's five-second empowerment and its W/Q pause clocks.

The [Double Strike composite reading](MASTER-YI-PASSIVE-AUDIO.md) keeps parent
passive suffixes separate from the secondary record's omitted suffixes and
explicit material flag. It retains the two hit actions, shared branch caps and
distinct 200 ms delay, plus the different mix root and nineteen private masters.
Native composite callback/material propagation remains separate work.
