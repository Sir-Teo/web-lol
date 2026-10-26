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
