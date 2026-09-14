# Constant bone-channel removal

The runtime now omits **1,295 of 19,458 source clip channels** whose values always equal the loaded bone's rest transform across the complete clip set. Across one instance of each of the 16 source rigs, Three.js cached property bindings fall from **2,448 to 2,112**. No source GLB files are modified. This removes provably redundant bindings; it has not demonstrated a frame-tail improvement.

## Conservative rule

`src/render/constant-bone-tracks.ts` groups tracks by resolved bone and position/quaternion/scale property. A group is removed only when every key in every track for that property exactly equals the loaded rest value. No epsilon, quantization or key reduction is used. A changing key, a different rest value, unsupported interpolation or incompatible value layout retains the whole property group. Indexed/object bindings and additive clips disable this optimization for the clip set. Non-bone channels remain untouched. Empty resulting clips retain their original names, durations and blend modes.

The filter runs once per loaded reference asset, before per-unit mixers/actions are created. Structure animation bounds are still computed from the complete original clips. Remaining track objects are shared unchanged and original clips are retained unmodified by the helper. Default bone transforms supply removed channels; world transforms, animation clocks, blends, visibility, death and recall code are unchanged. Future procedural bone overrides, additive animation layers or animation-set extension must revisit this contract rather than assume that removed constant channels will overwrite those changes.

The current strict rule removes no channels from Ashe or Lux. It benefits selected minions and structures, including red melee, both super minions, towers and base structures. The per-asset counts are retained in [the verification record](reference/constant-bone-tracks-verification.json). This is not offscreen animation skipping, and it does not reduce the temporal fidelity of moving actors.

## Pose, pixel and integration verification

All 16 source rigs and 114 source clips are compared against the originals. Each clip is sampled at 17 positions (1,938 isolated pose pairs), followed by real sequential cross-fades. Every compared node world-matrix element matched exactly: worst observed difference **0**. Each clip's midpoint is also rendered against the original in the same frozen scene, including shadows; **all 114 framebuffer-image comparisons match exactly**. The original and optimized mixers expose their actual cached-binding counts in the report. These finite samples support the conservative algebraic rule; they do not substitute for native-reference calibration of the underlying assets.

Three new simulation-side tests cover strict rest matching, a conflicting clip, unchanged original clips/durations, additive/indexed/smooth fallback and continued dynamic poses. All 598 checks pass. The source comparison browser case and 14 focused browser scenarios pass across source champions, attack cycles, recall, spell windups, bounds, base destruction and terminal animation. Production smoke passes. The populated-match capture was inspected. The full 201-case browser audit remains the earlier recorded run; this change used the described affected-system checks.

## Performance observation

The benchmark can bypass only this filter through the test-side `--raw-bone-tracks` module override. The override is intercepted in Playwright, checked for actual use, and recorded in the output; no product toggle or shipped alternate mode is added. Both variants restore the same checkpoint and run the same 1,800-frame encounter protocol. The first baseline overlapped production smoke and was excluded; the following optimized run and clean baseline ran separately.

| Measurement | Clean original tracks | Filtered tracks |
|---|---:|---:|
| Callback delivery median | 16.6 ms | 16.6 ms |
| Callback delivery p95 | 20.2 ms | 20.1 ms |
| Callback delivery p99 | 21.6 ms | 22.2 ms |
| Render-call median | 4.2 ms | 4.0 ms |
| Render-call p95 | 8.0 ms | 6.9 ms |

Fog time also varied despite unchanged fog code. These limited runs do not isolate an FPS gain, and the worse filtered p99 must not be hidden by the lower render-call p95. The deterministic gain is fewer channels/bindings with equivalent tested output. These historical values used callback delivery time, not the animation-frame timestamp, and do not establish missed frames. See the corrected cadence and GPU measurements in [MATCH-RENDER-PROFILE.md](MATCH-RENDER-PROFILE.md). The full-match performance gate remains open; these runs do not certify it.

```sh
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/constant-tracks-baseline-clean --raw-bone-tracks
node tools/qa/benchmark-rift.mjs http://127.0.0.1:5198 artifacts/rift-lost-chapter-simulation.snapshot.json artifacts/constant-tracks-optimized
```

Run performance samples without concurrent browser tests or production smoke. The evidence record pins both reports, source/assets and validation logs. These measurements concern the specified mixed lane encounter, not completed role AI, jungle fights, other hardware/browser targets or final effects.
