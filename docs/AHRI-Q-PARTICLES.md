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
