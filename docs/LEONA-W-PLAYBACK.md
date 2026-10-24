# Eclipse playback reconstruction

The initial increment described here added saved W histories, a seekable sampler
for all 30 enabled source emitters, and playback of four attached-character
material descriptions. The subsequent [surface increment](LEONA-W-SURFACES.md)
now draws the remaining 26 ray, mesh, billboard and quad families. All 30 enabled
families have draw paths; full W/native presentation acceptance remains open.

## Source and emission

`tools/assets/export-leona-w-particles.py` compiles the five standard-mode
systems from the retained source definitions. It checks every enabled field and
preserves the other 20 emitter declarations verbatim as disabled. The normalized
381,115-byte table has SHA-256
`a773927145276b35bd0c5dd530637f36f9a8021cc8dc04e15e52e1d60a031b73`.
The [profile audit](reference/leona-w-particle-profiles.json) records the field
routes and local choices. The [reader pin](reference/leona-w-emission-reader.json)
retains twelve separately hashed LeagueToolkit reconstruction files at revision
`65a7d2a746b9d02d65dab788b5f7b8198d5e555e`; these are not native CPU execution.

The sampler owns no gameplay IDs or random-state mutations. Independent cosmetic
hashes select correlated per-birth probability tables, lookup rolls and box
coordinates. It handles delayed/single/continuous births, emitter-keyed birth
color, fixed-grid motion and integrated UV scroll, independent texture layers,
volume-box spawn, collision-size coefficients, linger color and finite stopped
effects. Long seeks visit only potentially live continuous births.

The negative `-1` lives on two continuous attached layers use an explicit local
phase-owned interpretation. Stopped particles use the existing reconstruction's
absolute lifetime cap, rather than extending every particle by a new remaining
life. First-update timing, random routing, missing defaults, stop semantics,
source-to-shader routing and native scheduling remain unverified. Disabled
projection/trail records are not replaced by arbitrary primitives.

```sh
python3 tools/assets/export-leona-w-particles.py --check
python3 tools/assets/export-leona-w-particles.py --check --readers
```

The second command additionally verifies the retained reader bytes in the local
cache. Repository-only regeneration needs no network or original archive.

## Saved histories and rendering

Each activation records its rank/radius, source poses and per-tick viewing
teams. The initial and successful extension phases keep separate clocks. A real
detonation captures its pre-movement point/facing, result, creation audiences
and eligible target metadata before damage. Contact histories retain their own
rigs, radii, poses, audiences and death/removal endpoints. No burst is invented
when death or victory stops an armed W before detonation.

The decoder rejects contradictory ownership, clocks, phase outcomes, duplicate
contacts, mismatched rigs/radii, invalid death/recast/victory endpoints and
noncontiguous or changing detached histories. Histories retire against generated
conservative bounds: 212 initial-tail ticks, 242 extended-tail ticks, 77 burst
history ticks and 81 target-history ticks. The retained source record may remain
longer than its initial phase's actual rendered particles.

The render adapter separates the two buff phases, successful/missed caster
bursts and per-target contacts. Historical birth audiences prevent replay of
unseen births. Creation audiences also gate finite bursts. Only finite bursts
may use a frozen winning endpoint for delayed births beyond the final saved
tick. Native script attachment/origin routing remains a local policy.

The attached layers borrow source geometry/images and render private historical
skeletons, preserving the imported root transforms and source scale. Every
source birth gets its own material/skeleton, including both authored continuous
copies. Initial and extended continuous layers use the preceding verified
Fresnel material; both burst descriptions use their original erosion maps,
colors, drive curves and feather values. The private pose interpolates saved
placement and the shortest facing turn, then samples the saved animation clock.
Detached and terminal clocks freeze. The live actor is never advanced by an
effect.

Private skeleton bone textures and materials are disposed when particles retire;
shared geometry/images survive. `TargetPoseSampler.renderRoot` exposes the
private renderable hierarchy, and sampler disposal now retires each unique
private skeleton and removes its root from its parent. Optional W loading is
restricted to worlds containing Leona; production selection remains gated.

The initial histories/skin stage used schema **124**, with ruleset
`a626cd285109ed77c22f6e9b927748087a20930aa9a29f5cea327f715f213898`.
The explicit W sampler/material module roots now traverse runtime imports, so a
changed curve or motion helper cannot escape the compatibility fingerprint.
The isolated fingerprint fixtures cover both transitive discovery and missing
runtime modules. Earlier saves are not migrated.

## Remaining acceptance

The [surface increment](LEONA-W-SURFACES.md) adds the remaining primitives,
material/depth/distortion routes and lifecycle/recovery/resource checks. Native
CPU dispatch, attachment/culling/face-color semantics, missing palette/global
bindings and frame comparisons remain unverified. Source sound dispatch,
E/R presentation, player/support integration and the full six-champion match,
browser, offline and performance gates remain required.

## Validation record

The final runtime at `.cache/leona-w-playback-validation-v7-20261023` passes
TypeScript/build, all **1,660 tests across 284 files**, and three focused real
Chrome cases. The unit command uses two workers without changing test timeouts.
Three Node QA checks pass at v6. The preceding v6 runtime passes twelve Chrome
cases spanning W skins, Q particles, Leona's source rig and Sunlight; the final
v7 changes only fingerprint traversal and its fixtures, then repeats W's three
browser cases with the final compatibility identity.

All four attached material descriptions visibly change framebuffer pixels.
Private walking-pose bone matrices match the live source actor within `1e-7`.
Real Save/reload restores the exact skin state, and context recovery restores
the exact framebuffer/save. Death and victory freeze the private endpoint,
retire four material/bone-texture instances, and preserve borrowed assets. Six
cast/retirement rounds return to the same 18-geometry/16-texture controlled GPU
storage count. Startup and extension screenshots were inspected. These are
local renderer checks, not a native-frame or full-match performance comparison.

Two ten-minute normal-rules seeds pass 72,000 per-tick resource/structure checks,
20 exact round trips and 18 following-minute future comparisons (1,080 ticks).
All twenty checkpoints equal the preceding Q-stage smoke after removing only
the new empty W history arrays and normalizing version/ruleset. Both seeds are
unfinished at the smoke horizon. This is not the required full 100-seed cohort.

The production subpath gate passes 32 recordings and reports zero unrequested
Leona preloads. A fresh real Chrome offline audit verifies the entire
879-file/499,219,179-byte pack, saved-tick boot, a new Lux 5v5 match, corruption,
cancel/retry/repair, multi-tab refusal, explicit version activation, missing-entry
revocation and scope-only removal. It observes 963 service-worker responses and
zero production errors. Pack ID is
`1ecb940787f9fc4eabf590ad1c6d32ffe9fc805acf1f01a383830ee743bc7131`.
The existing bundle-size warning remains; the new optional skin chunk is
146.18 kB (16.18 kB gzip). Full delivery/performance acceptance remains open.

The v7 archive preserves 1,470 source/QA inputs, twelve reader files and 29
generated frontend files. Earlier v1–v6 archives and failed logs remain intact.
The v2 failures were older fixtures changing W ownership or position outside
normal lifecycle updates. The v4 findings were a missing pose-fixture field and
no surviving observer after source death. The v6 full run retains four missing
fingerprint-fixture failures and five five-second timeouts while build/browser
validation overlapped. V7 closes transitive W module pinning and all unit cases
pass with two workers and unchanged deadlines. No decoder guard or gameplay
rule was relaxed for these repairs.

See the [verification ledger](reference/leona/w-playback-verification.json).

```sh
node tools/qa/verify-leona-w-playback.mjs
```

Use `--historical` after later canonical changes. Recorded results and archived
bytes remain evidence for their exact scope, not full W or project completion.
