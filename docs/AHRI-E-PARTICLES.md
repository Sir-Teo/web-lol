# Ahri Charm particle source

This isolated source checkpoint retains all four E-prefixed resources declared
by the pinned base skin: Ahri_E_buf, Ahri_E_cas, Ahri_E_mis and Ahri_E_tar.
Their complete native records contain 26 complex emitters: four buff, four cast,
twelve missile and six target emitters. Omitted simple-emitter arrays remain
absent. Resource aliases alone do not establish callback chronology.

The selected closure contains 25 native files / 1,764,654 bytes: three BINs
including the skin resource binding, 20 textures and two meshes. It comes from
Ahri's patch 16.18.8175716 WAD through the pinned Riot manifest and chunk ranges.
The source record is docs/reference/ahri/e-particles.json, SHA-256
cdf8ed963d051e9517443949c5a4b30b924d5c7ba9fed36aecccf6bdb5a1a756.
It preserves complete records, unknown hashes, omissions, curve order and asset
paths. No unresolved native asset-path hashes occur in this selected closure.

The unchanged CDTB parser and retained field/type labels have the same pinned
identities as Q/W. Reparse checks compare the complete skin binding and every
selected particle record, allowing only verified symbolic FNV aliases. Nine
guards pass in normal and optimized Python, including altered closure/identity,
changed pins, invented defaults, boolean/number substitutions, added empty
arrays, conflicting cached bytes and symlinked inputs. Restore preflights every
existing output before network/parser work and never repairs conflicts.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-e-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-e-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-e-particles.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-e-particles.py
```

This stage requires the retained native sources and decoder installation; it is
not a cache-free CI claim. It adds no public assets, runtime effect bindings or
save fields. The accepted W renderer remains schema 178 / ff8abc1b; its current
archived cohort verifies unchanged. Decode, transport, spell/animation joins,
particle history, playback and native visual calibration remain separate steps.

## Private texture and mesh decode

The decoded record retains all 20 textures / 170 authored mip levels as private
PNGs (992,516 bytes), with compressed-range and straight-RGBA pixel identities.
It generates no resized mips, color-space transforms or premultiplication.
The SCB 3.2 flag-2 meshes retain 993 native vertices / 1,568 triangles. The heart
mesh has 390 vertices / 776 triangles without vertex colors; the swirl mesh has
603 vertices / 792 triangles with native BGRA and separate RGBA. Bounds, pivots,
indices and per-face UV/material bytes round-trip exactly. No normals, winding
changes, reflection, scale or pivot correction are introduced.

The record SHA-256 is
db521bcff91bf5d9bbccd99f6a8495be9825320789edf3e9487ffe53090cf96b.
A fresh generation reproduces every retained output and the record. Normal and
optimized checks and ten guard cases pass, covering native corruption, indices,
nonfinite coordinates, color metadata, PNG CRC, changed pins, symlinks and whole
publication preflight. Existing Q/W helpers and source artifacts remain intact.

```sh
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/decode-ahri-e-particles.py --check
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-e-decode.py
PYTHONPATH=tools/assets:.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-e-decode.py
```

These are private software-decoder outputs, not native GPU appearance or
runtime acceptance. Public transport and playback remain separate work.
