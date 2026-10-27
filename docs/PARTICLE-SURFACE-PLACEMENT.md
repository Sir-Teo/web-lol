# Exact particle placement with less repeated work

The shared source renderer now skips the full Euler-derived source quaternion
for camera-facing billboards that have no joint orientation frame. That branch
uses camera roll or travel direction; the full source quaternion was unused.
Joint-oriented billboards, rays, meshes and other quads retain their complete
source rotation path. Position-only bone attachments retain their existing path.

Directional billboards reuse one camera inverse quaternion per update, calculated
lazily and reset for the next camera. Ordinary billboard roll uses Three's existing
scratch-backed `rotateZ` method. Color values copy directly into the owned uniform
vector, where the existing additive RGB premultiplication occurs. Borrowed source
and caller-packed tint arrays remain unchanged. Draw order, geometry, shader
expressions, texture resources and particle samplers retain their existing values.

A source reference freezes the complete pre-change import graph at commit
`6fd50c9aad1aac17891df3bc88e1db32d21b99b4`. Seventy-two cases cover all primary-hit
families, four times, three cameras and default/caller-packed tint. The 714 source
particles produce exactly equal mesh transforms, uniforms, geometry, visibility,
ordering fields and metadata. Input values and signed zeros are checked. Mutable
particle arrays are used for timing; frozen input ownership is checked separately.

The independent GPU oracle loads the authored textures and compares old/new
renderers byte for byte. All 72 cases match, including 60 nonempty renders, with
no GL error. It starts on an empty document and does not boot the game. The
permanent browser case reconstructs its old source directly from Git.

```sh
node tools/qa/benchmark-surface-placement.mjs \
  --output-dir .cache/fresh-surface-placement
npx playwright test e2e/particle-surface-placement.spec.ts
```

The benchmark requires a fresh output directory, verifies the reference lockfile,
retains source/module/producer hashes and raw timings, and checks exact placement
state before measurement. Seven warmed trials alternate order. Each trial updates
20,000 pre-sampled particle groups, with results retained by the renderer. Sampling,
asset decoding and GPU work are excluded. These are placement timings, not game
FPS or full-match throughput measurements.

| Runtime | Previous median | Updated median | Placement time reduction |
| --- | ---: | ---: | ---: |
| Node 24.19.0 | 331.8 ms | 228.1 ms | 31.3% |
| Chromium 154 | 231.0 ms | 175.3 ms | 24.1% |

The three new unit cases cover caller-owned tint, camera changes on one renderer,
and complete reflected rotation for joint-oriented billboards. The same-renderer
camera check guards against reusing a stale inverse. Full validation and retained
sources are in the [verification ledger](reference/particle-surface-placement-verification.json).
Saved schema remains 163; the renderer change updates the ruleset fingerprint.
All fourteen accepted primary-hit exports retain identical bytes and timestamps.

The full suite records 3,077 passing tests out of 3,079 across 389 files, with
only the two existing baseline failures. The original wave deadline passes.
The focused suite passes 36 checks; the strengthened camera/ownership suite
passes all three cases. Node QA passes all six cases. Browser coverage includes
the independent pixel oracle, real Save/reload and 130 exact future ticks, all
93 authored GPU mip readbacks, startup/retry/visibility/death paths, isolated
sword batching, and combined passive/E/R effects across camera angles.

Strict production validation passes 32 recordings with eight fresh screenshots
and zero unintended private-effect preloads. The offline pack remains 1,200
files and grows by 59 bytes. No public asset changes.

The later [ray scratch optimization](RAY-PLACEMENT-SCRATCH.md) removes per-frame
ray descriptor/vector allocations and temporary finite-check arrays. Its explicit
reference commit isolates that change from this earlier billboard optimization.
The benchmark now supports ray-only and packed-color cases, freezes particle
inputs, and includes packed color attributes in its equality snapshots. Earlier
timings above retain their original fixture and source provenance.
