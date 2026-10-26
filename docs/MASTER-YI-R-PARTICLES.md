# Highlander particle sources

The frozen patch 16.18.8175716 base skin declares five Highlander resources:
three sustained variants, the cast system and a takedown system. This source
checkpoint retains all five bindings and their complete 21 emitter records.
Two native BINs, 20 TEX textures and four SCB meshes close the dependency set:
26 files, 1,989,049 bytes and 773,590 compressed source bytes read.

| Resource | Emitters | System sound declaration |
| --- | ---: | --- |
| `MasterYi_R_Buf` | 3 | Persistent `Play_sfx_MasterYi_Highlander_trail` |
| `MasterYi_R_Buf_Lvl2` | 3 | Same persistent event |
| `MasterYi_R_Buf_Lvl3` | 4 | Same persistent event |
| `MasterYi_R_Cas` | 8 | Omitted |
| `MasterYi_R_OnBuffKill` | 3 | Omitted |

All five systems omit system flags. The sound omissions stay distinct from null,
empty or inferred defaults. The persistent trail declaration is retained as a
source binding; its event, loop/fade policy and runtime lifetime need their own
audio reading. Existing finite Highlander activation/expiry playback does not
by itself implement this persistent cue.

The cast has mesh cones/fireball, glow/lens quads, delayed speed, distortion and
flash emitters. Sustained variants include local quads, a dash mesh at higher
levels and a locked attached-mesh overlay in the third variant. The takedown
resource retains its flash, native trail mesh and bubble. Rank-specific creation,
attachment, stop/extension behavior, shader controls and native callbacks remain
separate integration work. Resource names alone do not prove their dispatch.

The [source pin](reference/masteryi/r-particles.json) retains complete definitions,
original fields/omissions, exact native BIN identities and every referenced asset.
Native re-parsing uses the pinned CDTB code and separately retained name inputs;
unknown hashes and types remain raw. No latest dictionary or missing parsed JSON
is substituted. Numeric/Boolean distinctions survive the native comparison.

Restore/check tools preflight existing destinations, stage archive data, check the
frozen manifest/WAD provenance, compare complete skin/resource definitions and
create only missing identical files. Conflicts reject without replacement. Check
mode writes nothing. This checkpoint changes no simulation, rendering, public
asset, selection, save schema, ruleset fingerprint or production pack.

Reproduce with `tools/assets/extract-masteryi-r-particles.py` and its `--check`
mode, and `tools/assets/test-masteryi-r-particles.py`, using
`PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python`, including `-O`.
[Source verification](reference/masteryi/r-particle-source-verification.json)
indexes exact source/restore identities, guards and unchanged application identity.
