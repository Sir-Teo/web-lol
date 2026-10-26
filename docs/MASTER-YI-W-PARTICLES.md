# Meditate particle source preparation

The [frozen source pin](reference/masteryi/w-particles.json) retains every
`MasterYi_W_` resource declared by the base skin, with complete definitions
re-parsed from Riot build 16.18.8175716 BINs. Gameplay, presentation, schema 149,
ruleset and the production pack remain unchanged at this source-only checkpoint.

| Resource | Authored complex emitters |
| --- | ---: |
| `MasterYi_W_Buf` | 4 |
| `MasterYi_W_Cas` | 7 |
| `MasterYi_W_Dmg` | 2 |
| `MasterYi_W_Tenacity` | 2 |

All 15 emitters and their dependencies are retained: 18 TEX textures, two SCB
meshes and four BINs including the complete skin/resource table. The 24 native
files total 1,779,581 bytes; frozen compressed reads total 797,807 bytes. Shared
BIN identities match the earlier complete skin-link discovery. No candidate
parsed JSON, current dictionary or latest-patch substitute is used.

The native definitions retain ray, mesh, attached-mesh, arbitrary-quad and
omitted primitive records, along with their source probability tables, curves,
attachment flags and lifetimes. Unknown types `{0a94f3d4}`, `{1a7617fd}` and
`{ee39916f}` remain raw identities. Existing retained field/type labels resolve
exact native hashes; their source files and hashes are listed separately. That
resolution does not make unknown type names or omitted defaults attested.

All four systems omit `soundOnCreateDefault`. Their names do not authorize an
invented on-create sound. The spell's separate audio suffix table also remains
literal: slot 12 declares `Play_sfx_MasterYi_Meditate_OnCast`, slot 18 declares
`Stop_sfx_MasterYi_Meditate_OnBuffActivate`, and slot 19 declares
`Play_sfx_MasterYi_Meditate_OnBuffDeactivate`. The stop entry is not replaced
with a play event inferred from its slot or name. Script/animation/particle
dispatch and the foley/activation bank events need separate evidence.

## Reproduce

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-w-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/extract-masteryi-w-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-w-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-masteryi-w-particles.py
```

Omit `--check` to restore missing frozen source files. Every existing conflict
is rejected before archive access; correct existing outputs are never replaced.
Twenty-one guards pass per mode, covering closure loss, bindings, emitter counts,
patch/identity changes, unresolved dependencies, inferred sounds, invented
defaults, Boolean/integer substitutions, file conflicts and cache path escape.
All 20 original Q guards also pass per mode after the shared native verifier's
summary was made data-derived. Its full-record equality checks remain intact.

Actual checks and restores pass in both modes; all 24 existing source files
retain exact bytes and timestamps. The [verification ledger](reference/masteryi/w-particle-source-verification.json)
records the source archive, native file identities and staged evidence. This
source-only checkpoint does not claim another build/browser/production run.

Texture decoding, byte-preserving mesh conversion, primitive/shader behavior,
attachment/lifecycle timing and native visual comparison remain downstream work.
No effect is published or dispatched by this checkpoint.

## Private decoded assets

The [decoded record](reference/masteryi/w-particles-decoded.json) retains all
153 authored mip levels from all 18 textures: 1,195,452 PNG bytes and 7,231,144
decoded RGBA bytes. Each mip retains native compressed range/hash, dimensions,
pixel/PNG hashes and alpha statistics. There is no resizing, generated mip chain,
gamma conversion or premultiplication. The pinned LeagueToolkit reader confirms
smallest-first TEX storage; each mip is decoded separately. Pillow 12.3.0
provides the canonical BC1-with-alpha/BC3 software decode, with the interpreter,
codec/plugin binaries and zlib versions recorded. This is not native GPU parity.

Both SCB 3.2 meshes retain complete original bytes through their private JSONs
(total 287,109 bytes). The shared torus has 180 vertices/320 triangles, flags 1
and no tail; the heal mesh has 403 vertices/733 triangles, flags 5 and an opaque
24-byte tail. The pinned reader tests the face-color bit independently; both
records have that RGB block and no vertex-color array. Their explicit layouts
are accepted separately. Flag bit 4 and the nonzero tail are not renamed or
interpreted. Q retains its original flags-5/24-byte-tail default guard.

Points, indices, per-face UVs, material padding, RGB, unused vertices, signed
zero, pivot and zero header bounds survive byte-exact round trips. No normals,
pivot shift, coordinate/unit scale, winding/reflection or material tint is added.
The initial bounded Q reader rejected the torus's flags and then its zero-tail
extent; both diagnostics are retained. Support was added only for the observed
flags-1/zero-tail profile, with explicit reject tests for mismatched tails and
unknown flags.

```sh
python tools/assets/decode-masteryi-w-particles.py --check
python -O tools/assets/decode-masteryi-w-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-masteryi-w-particles.py
PYTHONPATH=tools/assets python tools/assets/test-masteryi-w-decode.py
PYTHONPATH=tools/assets python -O tools/assets/test-masteryi-w-decode.py
```

Independent checks import neither Pillow nor CDTB. Seventeen Meditate decode
guards and all 34 existing Q decode guards pass in each mode, including exact
shared texture pixels/PNGs, closure/range/hash/alpha corruption and preflight
output conflicts. Actual Q/W checks and decoder replays pass normally and with
optimization, preserving all 357 existing decoded files/records in bytes and
timestamps. Unreviewed producer/profile changes fail the frozen record checksum;
a different profile requires separate output/record paths and a reviewed digest.

Source and decoded artifacts remain private. GLB conversion, authored mip GPU
transport, shader/attachment/lifecycle sampling and dispatch are still separate
work. Exact source archive and evidence: [decode verification ledger](reference/masteryi/w-particle-decode-verification.json).
