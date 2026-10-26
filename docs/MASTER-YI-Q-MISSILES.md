# Alpha Strike missile source transports

The ordinary `MasterYi_Q_Mis` resource contains five emitters; the separate
`MasterYi_Q_AP_Mis` resource contains three. This checkpoint retains complete
raw definitions and privately stages all 11 textures with their 99 authored mip
levels, plus the shared native dash mesh. It creates no runtime missile, AP
selection, public asset or sound callback.

The ordinary system has two dash-mesh emitters, a ground glow quad, a streak
quad and a ray. The AP system has one dash mesh, a ring quad and a distortion
quad. Omitted system flags and sounds stay omitted. Per-emitter omissions,
Boolean/integer distinctions, UV modes, colors, spawn data, multiplier textures,
bind weights and orientation controls remain in the raw definitions. No reader
or renderer defaults are substituted by this source projection.

The raw `{9b111ae4}` fields match the `frameRate` name candidate. Ordinary mesh
emitters retain rates 10 and 30, each with two frames on a 2×1 atlas. The AP mesh
retains rate 30 and **two frames on a 1×4 atlas**. The frame count and grid-cell
count are distinct source values; neither is normalized. Native random-start,
advance and wrapping behavior for that AP declaration remain unresolved.

The AP distortion retains mode 2, strength 0.03500000014901161 and its separate
`common_distortion_soundwaves_01.tex` normal texture. This does not establish a
native CPU phase or power binding. Source emitter lifetime also does not prove
the owning missile's lifetime, stop/destruction behavior or particle tail policy.
Resource naming and presence do not establish when the ordinary/AP branches run.
Target/retarget dispatch and missile transform axes still need an explicit
implementation policy and native comparison.

The source dash SCB has 27 vertices and 24 triangles, flags 5 and a 24-byte
uninterpreted tail. The private GLB expands 72 source corners with exact source
UV/corner order and an explicit 0.01 position scale. Face RGB is a custom audit
attribute; no black material tint, normals, pivot offset, reflection or winding
change is invented. Original bounds, pivot, material slots, unused vertices and
tail remain in the source/transport records. The GLB validates with zero errors
or warnings and round-trips all three exported attribute arrays exactly.

The [raw Q pin](reference/masteryi/q-particles.json),
[texture transport](reference/masteryi/q-missile-texture-transport.json),
[mesh transport](reference/masteryi/q-missile-mesh-transport.json) and
[complete selected reading](reference/masteryi/q-missile-particle-reading.json)
remain separate. Exact inputs, guards, output replay and unchanged application
identity are indexed by [source verification](reference/masteryi/q-missile-source-verification.json).
Canonical software decoding and lossless transport do not certify native GPU or
physical-device behavior.

Reproduce with `python tools/assets/prepare-masteryi-q-missile.py --check`,
`python tools/assets/test-masteryi-q-missile.py`, their optimized Python modes,
and `node tools/assets/convert-masteryi-q-missile-mesh.mjs` for exact geometry
replay. All generated assets remain private.
