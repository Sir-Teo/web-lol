# Ahri Fox-Fire particle source

This isolated source checkpoint retains all five W-prefixed resources declared
by the pinned base skin: `Ahri_W_cas`, `Ahri_W_mis`, `Ahri_W_mis_02`,
`Ahri_W_tar`, and `Ahri_W_weap_cas`. Their native records contain 30 complex
emitters (7/8/9/6 in the first four systems). The weapon resource has no authored
simple or complex emitter arrays; that omission is preserved.

The complete selected closure contains 41 native files / 2,579,651 bytes:
four BINs including the skin resource binding, 35 textures and two meshes. It
comes from Ahri's patch `16.18.8175716` WAD via the pinned Riot manifest and
verified chunk ranges. No public runtime assets, renderer or simulation history
are added by this checkpoint.

`docs/reference/ahri/w-particles.json` retains every selected native record,
field, raw unknown hash, omission, curve order and dependency path. Its source
SHA-256 is `c1226324a728137c05062dafc7d4a102a0799a371d233d58e3f81558c26dbb47`.
The unchanged CDTB parser is pinned to the existing Q source parser identity.
Reparsing verifies complete native skin and particle records, with symbolic
FNV aliases only. The retained field/type label files keep their original
identities; field names are not guessed from appearance.

Use the retained decoder environment to check or restore the private sources:

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-w-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-w-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-w-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-w-particles.py
```

Restore preflights every existing output before network or native-parser work.
Conflicts and symlinked inputs reject without repairing or partially publishing
the cache. Guards also reject changed identity/dependency closure, source pins,
invented defaults, boolean/number substitutions, and adding empty arrays to the
weapon resource.

This branch starts from projectile renderer candidate `cf128aa`, schema 177 /
`5e4347ed`; that is source-preparation context, not a new runtime acceptance.
Particle decoding, transport, attachment and callback reading remain separate
steps. Resource names alone do not establish event chronology or variant
selection. Empty authored arrays are not a claim about global native absence.

## Private mip and mesh decoding

The pinned software decoder retains all 35 textures / 292 authored mip levels
as private PNGs (1,539,397 bytes). Two independent generations match exactly.
The two SCB 3.2 flag-2 meshes retain 786 source vertices / 1,143 triangles,
including original indices, per-face UVs/material bytes, BGRA and RGBA vertex
colors, bounds and pivot. Re-encoding the JSON reproduces every native byte.
No normals, winding changes, unit conversion, reflection or pivot correction
are applied.

The [decoded record](reference/ahri/w-particles-decoded.json), SHA-256
`11838eed2092e7301577471d3b28670ebc781194f865eb3a1f642fda483abbca`,
pins compressed mip ranges, decoded pixels/alpha, private outputs and the actual
Pillow/CDTB/layout artifacts. The Q SCB and general TEX helpers remain unchanged.
Normal and optimized checks, exact regeneration and ten decoder/publication
guard cases pass. Guards cover both colored meshes, corrupt headers/indices,
nonfinite geometry, changed metadata/PNG CRC, conflicts and symlinks.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-w-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-w-decode.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-w-decode.py
```

This is private decode preparation, not GLB transport, native GPU appearance,
playback or callback acceptance. The empty weapon resource remains empty.
