# Sustained Highlander source reading

The three frozen sustained R systems retain all ten emitters and six textures
with 56 authored mip levels. This checkpoint preserves source definitions and
private transports for later integration. The private runtime currently renders
[R cast](MASTER-YI-R-CAST.md) and [takedown](MASTER-YI-R-KILL.md) effects separately.

| System | Source emitters |
| --- | --- |
| `MasterYi_R_Buf` | `side`, `large_streaks`, `large_streaks2` |
| `MasterYi_R_Buf_Lvl2` | `side`, `large_streaks`, `ground_movement` |
| `MasterYi_R_Buf_Lvl3` | `side`, `large_streaks`, `ground_movement`, `overlay` |

The resource names alone do not establish native rank switching, restart or
removal callbacks. Side emitters declare a 20-second emitter lifetime; large
streaks and ground movement omit it. Those fields do not establish the active
buff's lifetime or behavior after extensions and Q/W pauses.

Each side emitter retains Color times `[0, 0.5, 0.4000000059604645, 1]` in that
original order. The reading does not sort keys or infer native interpolation.
Rate and other probability tables remain complete. The two ground-movement
emitters retain raw `{9b111ae4}=2`, `numFrames=2`, `texDiv=[2,1]`, `uvMode=2`, random
starts and an independently scrolling secondary texture. A name-hash match for
`frameRate` does not establish native atlas/sampler semantics.

Ground movement reuses the exact private Q missile dash transport: 27 source
vertices, 24 triangles and 72 expanded corners, with native UV order and a custom
face-RGB audit attribute. Its source flags and 24-byte tail remain separate from
an explicit 0.01 transport scale. No normals, reflection, winding change or tint
is invented.

The third variant's overlay uses `VfxPrimitiveAttachedMesh` with
`mLockMeshToAttachment=true`, rather than a standalone SCB. Its bind curve runs
from 0.5 to -1.5. Actor geometry/skin sampling, shader mapping and lifecycle need
separate investigation before rendering it.

All three systems explicitly declare the same persistent trail sound. Native
start/stop/fade callbacks and the retained Wwise RTPC input remain unresolved;
[the audio reading](MASTER-YI-R-TRAIL-AUDIO.md) preserves those facts separately.

See [raw definitions](reference/masteryi/r-buff-particle-reading.json),
[private mip transports](reference/masteryi/r-buff-texture-transport.json) and
[verification](reference/masteryi/r-buff-source-verification.json).
Reproduce with `python tools/assets/pack-masteryi-r-buff-textures.py --check`,
`python tools/assets/prepare-masteryi-r-buff.py --check` and
`python tools/assets/test-masteryi-r-buff.py`, including optimized Python.
No public asset, simulation schema or runtime dispatch is added by this source
checkpoint. Exact software-decoded transports do not certify native GPU or frame
parity.
