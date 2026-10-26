# Sword glow draw batching

The private sword renderer can draw its live E/R particles in a single instanced
quad draw. The logical source surfaces keep their original poses, uniforms and
texture objects for inspection and reference rendering. The sampled particles,
visibility histories, buff clocks and current schema 161 payload are unchanged. The
renderer dependency changes the ruleset fingerprint as usual.

Particles retain Three 0.186's default transparent depth/id order across all
source families, attachment slots and casters. Per-instance data carries the
same CPU-computed float32 model-view matrices and UV matrices that individual
draws upload, plus color, lookup and texture selections. Canonical quad UVs also
represent the source billboard layout. The shader retains source alpha locking,
lookup products, multiplier products and alpha rejection. All current sword
families use the same additive raster state.

Grouping by source family was rejected: it reduced 205 steady-state draws to
seven, but two of 15 isolated comparisons changed one channel byte by one due
to blend ordering. The ordered texture-selection batch preserves that ordering.
Known transparent draws at the same render order split the sword sequence into
contiguous depth segments. Each segment preserves the original source order and
keeps the complete current sampler set, source shader operations and exact CPU
float32 values. Multiple
interleavers in one gap share one boundary. Exact depth ties retain the original
individual draws because a new draw cannot reproduce the source object IDs.
Sprites and transparent draws with object-owned or unknown bounds keep that
conservative fallback. The next eligible frame resumes batching.

Preparation runs after all effects, selections and aiming visuals update, before
depth/color rendering. A changed render camera requires preparation; an explicit
guard prevents using stale view matrices. The batch's sorting position matches
the farthest source particle in its segment. Capacity grows geometrically, shrinks through
instance count, and hides on an empty frame. Removed interleavers merge segments;
unused segment draws are hidden with zero instances. Batch disposal releases its own
geometry/material while preserving source geometry, materials and verified
page-owned textures.

The GPU comparison uses the current individual renderer as its reference, with
exact byte comparisons across mixed-particle poses, camera angles, isolated
families, full scene rendering and a forced transparent interleaver. Draw-call
counts are measured directly. Seventy comparisons match exactly, with visible
coverage for all 11 bound families. The sampled steady state uses one sword
draw instead of 205; the corresponding full scene uses 16 draws instead of 220.
The forced interleaver retains 222 draws in both versions. These are measured
samples, not universal scene budgets. Headless Chromium/SwiftShader results do not
establish physical-device frame rates or native-client frame parity.

The additional [segmented-order verification](reference/masteryi/sword-segmented-order-verification.json)
retains all 70 comparisons and adds three real combined E/R plus Double Strike
scenes. Both actual passive trail meshes remain present. With 205 logical sword
surfaces, reference rendering uses 233 full-scene draws at each sampled angle.
The segmented renderer uses 31, 30 and 29 draws with three, two and one sword
segments respectively, matching every target byte. The preceding renderer used
233, 233 and 29 in those same scenes. These counts do not certify device FPS.

See [sword presentation](MASTER-YI-SWORD-GLOWS.md), the
[original verification](reference/masteryi/sword-instancing-verification.json)
and [Double Strike trails](MASTER-YI-PASSIVE-TRAILS.md).
