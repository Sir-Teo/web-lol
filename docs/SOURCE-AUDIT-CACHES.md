# Restoring source audit inputs

A clean cloud checkout has the shipped game assets and frozen reference tables,
but omits ignored original archive/toolchain caches. The Garen attack, recovery
audio and recovery-particle audit cases require those original bytes. Converted
WAVs and PNGs cannot recreate their encoded-source hashes.

Install the [pinned extraction tools](ASSETS.md#rebuild-on-the-current-macos-arm-development-environment)
first. The source-only Garen steps also work in this Linux cloud environment:
CDTB commit `ba981db2a2c814a0d78e55f6483e0636b527850f`, the exact Python
requirements and the frozen Riot manifest. They selectively fetch source ranges
and leave existing reference pins unchanged.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-audio.py
python3 tools/assets/restore-garen-audio-media.py
python3 tools/assets/restore-garen-audio-media.py --check
python3 -O tools/assets/restore-garen-audio-media.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-garen-passive-particles.py
npx vitest run tests/garen-aa.test.ts tests/garen-p-audio.test.ts tests/garen-passive-particles.test.ts
```

The media restore selects attack and recovery by default. `--ability` can be
repeated for `aa`, `p`, `q`, `w`, `e` or `r`. It verifies the frozen bank hash,
graph-to-extraction/model/reader identities, graph-to-decoded-table hash,
every selected offset/extent and both encoded-media hashes before writing any
file. It also checks RIFF extent and numeric identities. Check mode requires a
complete byte-identical cache; a differing existing file is always an error.
Guards run under optimized Python. This restores original WEM slices; it does
not decode audio, regenerate event graphs or alter public recordings.

Ten offline mutation cases run without CDTB, network or any original caches:

```sh
python3 tools/assets/test-restore-garen-audio-media.py
python3 -O tools/assets/test-restore-garen-audio-media.py
```

The October 25 cloud restore recovered both original Garen banks, 36 exact WEMs
(328,799 bytes), three particle BINs and three textures. All 20 unchanged cases
in these three audit groups pass. The [restore record](reference/source-audit-garen-restore.json)
preserves byte identities and logs. Runtime code, schema 142, Highlander ruleset,
public assets and production pack are unchanged.

This does not certify the complete source suite. The preceding broad run also
reported absent distortion Metal/bitcode/disassembly caches, missing Leona
native/research inputs and an unchanged Lux sampler digest discrepancy.
Those separate groups remain unresolved by this restore. The distortion
reference records Apple clang 21 output; substituting host compiler output or
rewriting its golden hashes is not part of cache restoration.
