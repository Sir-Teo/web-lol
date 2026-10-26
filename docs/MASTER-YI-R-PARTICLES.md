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
[audio reading](MASTER-YI-R-TRAIL-AUDIO.md). Existing finite Highlander activation/expiry playback does not
by itself implement this persistent cue.

The cast has mesh cones/fireball, glow/lens quads, delayed speed, distortion and
flash emitters. Sustained variants include local quads, a dash mesh at higher
levels and a locked attached-mesh overlay in the third variant. The takedown
resource retains its flash, native trail mesh and bubble. Rank-specific creation,
attachment, stop/extension behavior, shader controls and native callbacks remain
separate integration work. Resource names alone do not prove their dispatch.

The [sustained source reading](MASTER-YI-R-BUFF.md) retains all ten buff
emitters, six private textures/56 authored mips and the reused private dash mesh.
Its unsorted Color keys and attached-mesh fields remain unchanged.

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

## Private decoded assets

The [decoded record](reference/masteryi/r-particles-decoded.json) retains all 177
authored mips of the 20 textures: 1,130,814 PNG bytes and 8,104,616 RGBA bytes.
Every level has its native compressed range/hash, dimensions, PNG/hash, pixel
hash and alpha statistics. There is no resizing, generated mip chain, gamma
conversion or premultiplication. The canonical Pillow BC1-with-alpha/BC3 decode
remains distinct from native GPU decoding.

| Native SCB | Vertices | Triangles | Flags | Uninterpreted tail |
| --- | ---: | ---: | ---: | ---: |
| Pulsefire muzzle cone | 1,440 | 480 | 1 | 0 bytes |
| Hecarim trail | 750 | 1,500 | 5 | 24 bytes |
| Highlander fireball front | 161 | 300 | 5 | 24 bytes |
| Yi dash | 27 | 24 | 5 | 24 bytes |

The four private mesh JSONs total 724,983 bytes. Points, signed zero, source
indices, face UVs/material padding/RGB, pivot, original bounds, unused vertices
and tail re-encode to every original SCB byte exactly. No normals, unit scale,
reflection, winding change or material tint is applied. The two previously
retained Q meshes and nine shared Q textures keep identical geometry/pixel/PNG
identities.

The shared decoder now accepts an explicit mesh-count profile. Its Q/Meditate
default stays two meshes; Highlander requests four with the same reviewed
flags-1/no-tail and flags-5/24-byte-tail layouts. This adds no inferred meaning to
flag bit 4. Original Q and Meditate guards and complete actual output replays
verify their unchanged profiles.

Use `tools/assets/decode-masteryi-r-particles.py` and `--check` with the pinned
CDTB virtual environment above, including optimized Python. The checker replays
native ranges, RGBA/alpha statistics and byte-exact mesh serialization without
importing Pillow or CDTB. [Decode verification](reference/masteryi/r-particle-decode-verification.json)
indexes producer identities, shared-profile controls and every output replay.
This stage remains private and changes no runtime, save schema or production pack.
