# Alpha Strike particle source preparation

The [frozen source pin](reference/masteryi/q-particles.json) retains every Q
resource declared by the base skin, re-parsed directly from the patch
16.18.8175716 Riot BINs. This stage adds source data and restore/check tools;
gameplay, presentation, schema 147, ruleset and production pack remain unchanged.

| Resource | Authored complex emitters |
| --- | ---: |
| `MasterYi_Q_Cas` | 2 |
| `MasterYi_Q_Mis` | 5 |
| `MasterYi_Q_AP_Mis` | 3 |
| `MasterYi_Q_Tar` | 4 |
| `MasterYi_Q_Crit_tar` | 3 |
| `MasterYi_Q_End` | 2 |
| `MasterYi_Q_AlphaStrikeMissileBegin_audio` | 1 |
| `MasterYi_Q_Hit` | no emitter list |

All eight bindings retain their exact target record, complete definition and
native BIN identity. The 20 emitters refer to 23 TEX textures and two SCB meshes.
Seven BINs, including the complete skin/resource table, close the source set:
32 files, 2,028,605 bytes and 713,334 compressed bytes read. Texture and mesh
conversion, primitive/birth sampling, shaders, attachment, lifecycle and native
visual comparison remain downstream work.

`Q_Hit` contains only particle name/path and object identity. It does not justify
an invented flash or even an inserted empty emitter list. The audio-labelled
resource retains its actual black-texture dummy emitter; its name does not prove
current sound dispatch or a visible cue. The AP missile variant is retained
without treating it as an active ordinary Q effect.

Five emitter fields retain unknown identifier `{9b111ae4}` and their original
10/30 values. Eight spawn-shape records retain type `{ee39916f}`. Neither hash is
renamed or replaced with an assumed default. Existing point-shape interpretation
research is described separately in [Light Binding](LUX-BINDING.md); its hash
crack does not establish an attested native type name. Omitted fields remain
omitted, and numeric/Boolean distinctions survive native re-parsing.

Discovery reads the base skin's complete 15-link BIN closure plus the skin root.
The eight Q definitions are then selected from those native records. Field/type
labels come from retained source files and exact hash identities; their input
hashes are recorded. Long shared-skin candidate JSON URLs returned 404s, as did
the tested hash aliases. No missing parsed JSON or latest dictionary was
substituted. Native source bytes and the pinned CDTB reader provide the record
proof. Six zero-valued emote/recall references in the wider resource map remain
explicit zero references; they are unrelated to Q's complete nonzero closure.

The tools verify the frozen model/pin and all existing outputs before archive
access. Restore stages files in a temporary directory, checks exact provenance
and complete native definitions, preflights every destination, then creates only
missing identical files. Conflicts reject without replacement. Check mode writes
nothing. All 32 source-file identities and native WAD path hashes are checked.
Native parser path and code checksum are pinned independently.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-q-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/extract-masteryi-q-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-masteryi-q-particles.py
```

Twenty guards pass per Python mode, including closure loss, wrong bindings,
unresolved paths, altered native identities, invented defaults, Boolean/integer
substitution, output conflicts and flat-cache path escape. Actual native checks
and restores pass normally and with optimization. This establishes source
identity and omission preservation; it does not certify native particle runtime
or frame matching.

Exact inputs, restored-file identities, failure diagnostics and staged results:
[source verification ledger](reference/masteryi/q-particle-source-verification.json).
