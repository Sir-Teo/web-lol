# Authored attack trail source closure

The frozen base animation graph explicitly binds five trail systems through four
parallel parents. Each parent retains its default atomic clip and separate
masked/track atomic clip; the latter contains the particle events. All twelve
entries remain complete, including opaque mask/track hashes.

| Parent | Effect key | Literal start frame | Particle lifetime | Raw blend mode |
| --- | --- | ---: | ---: | --- |
| `Attack1` | `MasterYi_BA1_Trail` | 5.0 | 0.28999999165534973 | omitted |
| `Attack2` | `MasterYi_BA2_Trail` | 5.0 | 0.2199999988079071 | 4 |
| `Crit` | `MasterYi_Crit_Trail` | 8.0 | 0.15000000596046448 | omitted |
| `Passive` | `MasterYi_P_Trail_1` | 6.0 | 0.2199999988079071 | 4 |
| `Passive` | `MasterYi_P_Trail_2` | 9.0 | 0.1899999976158142 | 4 |

Every event declares `mIsLoop=false` and attachment
`C_Buffbone_Glb_Center_Loc`. That name matches one actual retained GLB skin joint,
node 85, case-insensitively. Both spellings remain in the reading. These clips
omit `mTickDuration`; frame-to-time conversion, speed scaling, mask/track behavior,
callback ordering and cancellation remain uncalibrated. The two passive trail
events do not establish two spell-audio callbacks or child suffix resolution.

The five systems contain one emitter each, named `WeaponTrail`. All author
single-particle integer 1, bind float 1.0 and no-cull Boolean true. Source offsets,
optional rotations/scales, lifetimes and UV scroll remain literal. Missing blend,
local-orientation, particle-local and other fields do not acquire defaults. All
five systems omit both default sound declarations; no audio is inferred.

The complete native closure has twelve files: three BINs, four original ANMs,
four TEX assets and one SCB. They total 549,752 bytes from 265,918 compressed
archive bytes. Shared model, animation and particle inputs match existing frozen
identities. Complete skin and animation BINs and all five particle records reparse
against the retained definitions.

The shared weapon-trail SCB has 250 source vertices, 500 triangles and 1,500
expanded corners, flags 5 and a 24-byte tail. The existing byte-preserving reader
round-trips it exactly, retaining UVs, material slots, face colors and tail bytes.
The four textures are the common rampdown and three distinct white weapon-trail
images. This checkpoint creates no decoded texture transport, GLB or renderer.
Native shader, sampler, inherited transform, reflection and VFX scale behavior
remain separate work.

The current private controller still selects its existing ordinary/critical body
animations and audio. This source-only checkpoint changes no gameplay,
presentation, public asset, schema or app identity.

See the [complete native pin](reference/masteryi/attack-trail-particles.json),
[event and rig reading](reference/masteryi/attack-trail-binding-reading.json) and
[verification](reference/masteryi/attack-trail-source-verification.json).
Reproduce in the pinned CDTB environment:

```sh
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/extract-masteryi-attack-trails.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/prepare-masteryi-attack-trails.py --check
PYTHONPATH=.tools/cdtb:tools/assets .tools/cdtb-venv/bin/python tools/assets/test-masteryi-attack-trails.py
```

Repeat with Python `-O`. Omit `--check` to restore frozen source files or create
the reading; existing conflicts fail before publication, and correct outputs
retain their bytes and timestamps. The separately pinned ANMs remain outside the
shared particle verifier's stricter allowed-extension guard.
