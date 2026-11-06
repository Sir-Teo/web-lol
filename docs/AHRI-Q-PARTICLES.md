# Ahri Q particle source preparation

The frozen [source pin](reference/ahri/q-particles.json) retains all seven Q-prefixed resources from the base skin, reparsed directly from patch16.18.8175716 Riot BINs. This source checkpoint changes no gameplay, rendering, saved schema175, ruleset `08e106da` or accepted Recall pack.

| Resource | Authored complex emitters |
| --- | ---: |
| Ahri_Q_Cas | 3 |
| Ahri_Q_mis | 16 |
| Ahri_Q_mis_02 | 20 |
| Ahri_Q_Speed | 2 |
| Ahri_Q_tar | 5 |
| Ahri_Q_tar_02 | 7 |
| Ahri_Q_Orb_Cast | 8 |

All61 emitters retain complete source definitions, omissions, unknown hashes, curve order and native dependencies. Both missile/contact variants remain separate; no undocumented variant-selection policy or callback clock is inferred. The exact closure has46 files /2,319,684 bytes: five BINs (the complete base skin and four linked multi-skin files),37 TEX textures and four SCB meshes. All dependency names resolve without opaque native PATH hashes.

Several remote linked-BIN JSON URLs return404. The authoritative set therefore comes from the pinned Riot archive, with manifest/chunk/file hashes and exact extents. Discovery confirms all23 linked BINs exist in that archive; only four required linked files enter this Q closure. Flat source filenames use their verified64-bit WAD path hash to retain long virtual paths safely. Field/type label dictionary hashes are recorded; native scalar values and unresolved field/value aliases remain unchanged. Known record names join their verified32-bit hashes.

The pinned CDTB decoder reparses the entire base skin/resource table and all seven particle definitions exactly. Equality distinguishes booleans from numbers and preserves missing fields. Seven rejection tests run in normal/optimized modes, including twelve structural mutations, invented defaults, source corruption and leaf/parent symlinks. A fresh46-file restoration and optimized recheck pass without replacing conflicting files.

```sh
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-q-particles.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/extract-ahri-q-particles.py --check
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python tools/assets/test-ahri-q-particles.py
PYTHONPATH=.tools/cdtb .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-q-particles.py
```

Native texture decoding, mesh transport, materials/distortion, bone attachments, actual callback clocks and browser comparison remain separate work. The current Q development marker is unchanged; source retention is not a visual-fidelity claim. Audio and older cohort evidence retain their original scope.

The source-stage receipt is [q-particles-source-verification.json](reference/ahri/q-particles-source-verification.json). It records all46 source hashes/extents in original and freshly restored directories, complete native reparse, both seven-test guard modes and the unchanged runtime fingerprint. Texture/mesh decoding follows in a separate commit.

## Complete private texture and mesh decode

The separate decode retains312 authored mip levels from37 TEX files (12 BC1-with-alpha and25 BC3), plus four SCB3.2 flag-2 meshes. The316 transport files contain1,102,195 PNG bytes and365,404 mesh JSON bytes. Each mip retains its exact native compressed offset/extent/hash, dimensions, straight RGBA hash and alpha statistics. There is no resizing, generated mip, gamma conversion or premultiplication. An independent stdlib PNG replay verifies every CRC/filter/pixel extent.

The pinned LeagueToolkit reader distinguishes flag2 (local origin/pivot) from face-color flag1. Three meshes retain optional per-vertex BGRA and separately derived RGBA; the sphere has no vertex colors. All1,127 source vertices and1,636 triangles preserve original coordinates, indices, per-face UV/material bytes, bounds and central points. No face colors or unparsed tails are invented, and all four JSON records re-encode to the exact original181,432 SCB bytes. Normals, winding, reflection, pivot offset and unit scale remain unapplied. The frozen Master Yi decoder/helpers and reference hashes are unchanged.

Record `q-particles-decoded.json` SHA `7b040643c0361810c60e3d467af5c27e47f4d1ca3024b023582f132539628bc9` pins the native source, reader revision/layout hashes, decoder artifacts and build environment. The first regeneration caught relative versus absolute helper artifact paths; normalization fixes that metadata difference. The final CLI regeneration reproduces the complete record and all files. Optimized checking and ten rejection tests in each mode pass, covering malformed meshes, out-of-range indices, nonfinite coordinates, optional color typing/channels, complete mips, PNG CRC, record identity, whole-publication preflight and symlinks. Representative orb/trail textures were reviewed.

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/decode-ahri-q-particles.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/decode-ahri-q-particles.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-ahri-q-decode.py
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python -O tools/assets/test-ahri-q-decode.py
```

This is canonical software decode and byte-preserving private transport, not native GPU appearance certification. Public assets, Q renderer/history, particle attachment and material/shader calibration remain unbound.

The private decode receipt is [q-particles-decode-verification.json](reference/ahri/q-particles-decode-verification.json), including316 verified transports, exact four-mesh round trips, successful regeneration/check logs and both ten-test guard modes. The runtime fingerprint remains `08e106da`.

## Animation and attached-mesh source reading

The portable [binding reading](reference/ahri/q-particle-bindings.json) joins two Spell1 particle events to their native systems and11 emitters. `Ahri_Q_Cas` explicitly starts at frame5 on `C_Buffbone_Glb_Center_Loc`; `Ahri_Q_Orb_Cast` declares end frame7 on `BUFFBONE_GLB_WEAPON_1`, with its start frame omitted. Raw missing frame fields remain absent. The transport has unique case-insensitive matches for both bone names, including `Buffbone_Glb_Weapon_1`; this does not establish native attachment sampling or frame conversion.

Cast emitter2, Avatar2, declares a locked attached mesh with two raw selectors. Lowercase FNV-1a matching against the retained native four-draw SKN table joins `{07c39130}` to `Tails`. `{62579b4c}` has no match in that retained table. The reading preserves both selectors and the no-match result without inventing another draw or a fallback. Native materials, attachment locking and broader resource presence remain open.

The reader checks complete model/source/SKN-table/GLB hashes, and its exact output reproduces without private caches or native tools. Six rejection probes pass in both Python modes, plus both Node wrappers. A focused CI workflow checks the portable reading separately from private native-source decoding. No runtime timing, attachment policy, renderer or saved state is added.

The [binding verification receipt](reference/ahri/q-particle-bindings-verification.json) records three passing clean-checkout commands (two guard modes /six rejection probes each), no private caches/tools/dependencies, and all194 Node QA passes. This scope is separate from native-source/transport checks and the accepted runtime.
