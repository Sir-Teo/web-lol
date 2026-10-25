# Master Yi base SFX source preparation

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
