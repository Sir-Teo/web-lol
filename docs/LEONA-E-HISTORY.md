# Zenith Blade saved presentation histories

October 24, 2026. This increment records E's accepted casts, moving flights,
ordered contacts, homing dashes, successful arrivals and terminal tails. It is
preparation for source effect and audio playback. It does not yet draw or play E,
verify native behavior, enable production Leona selection, or complete the kit.

## Saved phases and ownership

`leonaEVisuals` belongs to the actual champion state and is required in schema
125. Capture does not allocate shared identities or consume combat randomness.
The accepted cast keeps its original direction, rank, body radius, momentary
position/facing and viewing audience. A separate launch anchor captures the actual
missile origin after a windup Flash. Flight frames record each post-movement
position, remaining range and audience. All 27 flight updates remain available.

Each swept contact records its ordered fraction, exact projectile contact point,
target identity/kind/team/rig/radius, original audience and posed target history.
Capture starts before damage and settles the same tick after combat/animation.
Dead or removed targets detach; subsequent frames retain the endpoint and pose.
A later reveal cannot rewrite an earlier audience.

The dash records the actual last champion selected by gameplay. Cast and dash
anchors survive independently of the rolling source history, including unusually
long homing pursuits. Successful arrival is distinct from root/stun interruption,
target loss, Flash, source death and match end. The stop event preserves the
attempted body-contact point before reachable-ground correction, the corrected
endpoint before a possible blink, target state and the CC deadlines causing the
stop. Immediate control application retains the existing landing/CC assignment
order. Arrival poses follow the actual settled body pose; they are not fabricated
from a frozen landing point.

A launched missile survives its owner's death. The cast stores that life's first
death, level, independently derived respawn clock and endpoint. Old source frames
remain frozen there through respawn and a subsequent cast. A match-ending update
closes live phases before gameplay projectile removal and freezes the saved tick.

## Retention bounds

The generated [bounds](../src/content/leona-e-history-bounds.json) bind all twenty
enabled declarations from the pinned five-system E source package. The exporter
sums positive authored emitter lifetime, particle lifetime upper bound, particle
linger, emitter linger and emission delay, then adds two settlement updates.
Probability-table maxima multiply the particle lifetime bound. An omitted particle
lifetime uses an explicitly local one-second default. These are conservative
local retention rules, not evidence of native scheduling/defaults or overlap.

| Role | Retained updates |
| --- | ---: |
| Weapon | 770 |
| Dash | 39 |
| Arrival posed body | 209 |
| Contact posed target | 132 |
| Sound carrier | 722 |
| Whole cast after ending | 770 |
| Rolling source points | 771 |

The longest bound includes Bokeh's float32 lifetime/probability upper value of
1.600000023841858 seconds and its authored linger. Source positions are bounded
with a rolling window; event anchors and the finite flight/contact/arrival windows
remain separate. Ending histories retire at `endTick + 770` exactly.

## Strict import and deterministic continuation

The schema rejects missing/malformed fields, duplicate audiences and oversized
histories. Semantic validation checks accepted-cast ordering and ownership,
release/range clocks, projectile identity/path/remaining distance, swept contact
ordering and geometry, posed-frame continuity/detachment, dash/arrival causes,
source life/respawn consistency, active-phase ownership and expiry. A winning
flight may end before or after its movement within the terminal update. Historical
audiences and momentary anchors are retained evidence, not recomputed from current
vision. Internal consistency does not prove the authenticity of an otherwise
self-consistent hand-edited save; deleting an ended history cannot always be
inferred from live gameplay alone.

The tests cover windup Flash, lethal ordered contacts, last-champion selection,
phase checkpoints/futures, misses and exact retirement, root/stun, target death,
pre-blink endpoints, death in each active phase, posthumous flight, respawn,
victory in each phase, later visibility, a scripted 1,200-update pursuit, malformed
phase/contact data and forged arrival/respawn causes. The long pursuit is a bounded
history stress test, not certification of a production movement tactic.

## Delivery and remaining acceptance

The final verification ledger is [e-history-verification.json](reference/leona/e-history-verification.json).
Read-only verification uses `node tools/qa/verify-leona-e-history.mjs`; use
`--historical` after subsequent source changes. The isolated suite passes **1,721 unit tests across 288 files**, TypeScript and
three Node QA cases with unchanged deadlines. Forty-five new history cases join
nineteen existing E mechanics cases. Four real Chrome phase saves/reloads preserve
exact saved bytes and 90-update futures; seven adjacent bot, Garen and Leona
browser cases also pass. The browser test file also typechecks independently.

Two normal-match seeds run 72,000 checked ticks, twenty strict round trips and
eighteen following-state comparisons without invariant failures. All twenty
checkpoints match the preceding schema-124 smoke after removing only schema,
ruleset and the new empty history arrays. Both matches remain unfinished at the
ten-minute horizon. This is a smoke test, not the full current cohort or a
Leona gameplay certification.

The production build and nested hosting pass 32 recordings and zero unrequested
Leona preloads. The fresh full offline audit passes 939 files/506,610,912 bytes,
963 worker responses, integrity/repair/version/removal flows, saved-tick boot and
a new Lux local match, with zero production errors. Pack ID:
`788ee79f3d67cba36d08e5479e5f643f31dbf1adc5ee357bd792c5c084058724`.
The existing bundle-size warnings and full-match performance gate remain open.
Delivery/normal evidence uses unchanged runtime inputs from V4; the final V7
changes only test assertions. An explicit file comparison records that scope.

V7 retains 1,568 inputs and fifty original E source files. V1–V6 preserve each
input revision, first contact/terrain-stop failures, outdated schema assertion,
concurrent-load timeouts, browser startup-clock assumption and completed-history
rejection probe. Immediate CC capture and scripted-move settlement were repaired;
no test deadline was increased. The final browser probe corrupts a required
retained frame, which is verifiably inconsistent in every phase. All owned
validation handles were confirmed terminal before canonical repairs. Earlier
source-package integrity also passes in historical mode. Current schema is 125;
ruleset is
`8b6d8b1a04e78a42582021d4639bf3effc722550ca9c7514a9c6dd02121b47ee`.

E's nineteen enabled visual declarations still need source samplers/materials,
mesh/trail/attached-skin drawing, phase dispatch, actual attachment/visibility
bindings, context recovery, disposal and frame comparison. Source audio also
remains unimplemented. The lifetime default, dash speed, timing and collision
policies still need native evidence. R presentation, complete player/support
integration, the current full seeded cohort, all six champions and full-match
browser/offline/performance/native acceptance remain required. The complete
project goal remains active; nothing is pushed.

## Subsequent kernel preparation — October 24, 2026

The [emission/history/trail samplers](LEONA-E-KERNELS.md) now consume these saved
phases, including historical birth audiences, detached poses and the complete
flight odometer. The preceding history evidence remains revision-scoped. The
source mesh/quad/billboard/trail/skin renderer and E audio remain unimplemented;
kernel preparation does not establish native playback or complete the Leona kit.
