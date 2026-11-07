# Charm visual history implementation

The observer will record existing Charm gameplay without changing casting,
linear collision, damage, forced walking, tenacity or replacement policy.
The native producer reading joins cast, missile, hit and two persistent-buff
systems; it does not provide native callback code or attachment transforms.

## Frozen baseline

The independently verified schema-178 / ff8abc1b development-roster archive at
.cache/ahri-w-rendering-roster-seed1 retains 659 source/harness files, Blue victory
at tick 157,116, 44 round trips and 43 future comparisons over 2,580 ticks. Its
original identity remains unchanged. The new reference producer verifies this
archive before compiling its World through explicit archive-only aliases.

The focused reference contains 17 scenarios / 273 complete state projections:
hit/miss, canceled windup, posthumous flight and buff ownership, target death,
lethal hit, movement, post-release Flash, independent overlapping casts, latest
Charm replacement, hidden/revealed flight, Courage tenacity and terminal
settlement during windup, flight and buff. Every saved checkpoint round-trips;
105 restored future comparisons cover 5,600 additional ticks. All 18 tests pass
before observer integration. The frozen helper, producer and expected hashes
must remain unchanged after this baseline commit.

Only version, ruleset and the proposed ahriEVisuals field are excluded from each
projection. Existing Charm audio, W visuals and every other saved field remain
in the comparison. This is an archived gameplay baseline, not native-client or
hundred-seed validation.

## Required observations

Use source ID / accepted cast tick as the pre-launch identity, then retain the
existing projectile ID. Allocate no World IDs or random values. Save the accepted
aim, facing, source pose, rank and release deadline. Keep launch origin separate
from end-of-step moved samples: release and first movement can share one tick.
Record actual linear flight samples and the swept contact before damage hooks.
Impact contact and target-center roots must remain separate.

Capture whether control actually attached after damage. A lethal or immune hit
must not invent a buff. Retain the exact sampled Charm source/rank/start/end and
tenacity flag, plus consecutive target poses while control and visible tails
need them. Preserve source and target facing/radius without inventing bone
transforms. Death, natural expiry, replacement and match settlement are distinct
endings. Replacing a Charm in the same tick must close the older ownership.
Direct damage or replacement APIs must leave immediately serializable histories.

Record source, missile-point and target visibility separately. Target-bound
buff visibility must not inherit unconditional caster-team knowledge. Refresh
current-tick audiences after the normal sight update. Hidden samples must remain
available as separators for later ribbon rendering.

## Integration order

1. Add optional pure observer operations and focused tests. Keep gameplay hooks,
   schema changes and rendering out of that preparation commit.
2. Add hooks at acceptance, release, projectile contact/movement, actual control
   attachment/replacement/death and terminal cleanup. Refresh/prune separately.
3. Add strict schema-179 admission and cross-check live pending casts, projectiles,
   Charm ownership, audio links, clocks, endpoints, IDs and audience shape. Replay
   the existing linear flight math from saved samples without changing it.
4. Keep bounded source/target pose histories with an explicit local retention
   policy. Particle linger caps total lifetime; it is not added to it. Native
   missing lifetimes and attached selection remain unresolved source data.
5. Pass every frozen old-state projection and restored future, then compare a
   new natural seed-one archive with the baseline, retaining all older histories.
6. Integrate observer acceptance before connecting the E particle renderer.

Post-rotation arithmetic, omitted attached selectors, native skin sampling,
fresnel, frame conversion and actual buff-effect stopping remain separate
renderer/source tasks. The existing north body-clip binding and all current
combat policies stay within their documented local scope.

## Pure observer preparation

The optional observer module now separates accepted casts, immutable launch
origins, moved flight frames, pre-damage contact/target-center anchors and actual
sampled Charm control. Source and target poses retain facing, radius and distinct
sight audiences. Same-tick replacement can close a zero-length older ownership;
posthumous control remains owned by the living target. Terminal removal does not
invent a moved flight sample. Missing actors receive no fabricated pose samples.

Seven contract tests check copied ownership/positions, same-tick sampling,
visibility without hidden-birth rewrites, expiry/death/replacement, cancellation,
terminal anchors, optional observers, duplicate/gapped observations and no
changes to gameplay objects, RNG or IDs. All 25 contract/baseline tests and
TypeScript checking pass. The frozen 17-case reference reproduces byte for byte.
All 659 prior archived source/harness files remain identical; only the new
simulation module enters compatibility collection (655 files / 80dc7370).

World hooks, serialization, retention-policy selection and strict schema-179
admission remain pending. This preparation defines no runtime observer field on
World and no renderer consumes it.

## Independent motion and control admission

The motion validator replays the existing 60 Hz linear sweep from the retained
launch and previous points, including first-step travel, exact range exhaustion
and fractional contact against the saved target center/radius. It keeps launch
and terminal anchors distinct when settlement occurs before a moved sample.
Sampled Charm duration uses the existing rank and Courage/floor policy; expiry,
replacement, source/target poses and canonical audience ownership are checked
without introducing gameplay calculations into the observer.

A separate adapter observes real World objects for hit, range, canceled windup,
posthumous flight, terminal settlement and tenacity. Every observer operation
leaves the complete core snapshot unchanged. Twenty mutations reject altered
clocks, geometry, control ownership, deadlines, poses and audience shape. All 33
preparation/baseline/admission tests and TypeScript checking pass. World hooks,
live cross-links and schema integration remain pending.

## Target body lifetime boundary

A separate target-ending anchor now records actual death or removal with its
last observed pose and sample tick. Target pose sampling stops at that boundary,
so a later respawn of the same unit does not extend the old body path. The ending
also closes that body's buff ownership, without extending presentation retention.
Missing actors retain an explicit last-known anchor rather than a fabricated
current pose sample.

The real-World adapter covers target death and an actual dummy respawn. Four
ending-anchor mutations reject rewritten poses, clocks, late samples and missing
endings. The contract test also checks that a relocated new body cannot rewrite
the old ending. All 37 tests and TypeScript checks pass before World integration.

## World integration candidate

World now owns the optional serialized ahriEVisuals history under schema 179.
Hooks observe accepted casts, release, actual moved missile samples, pre-damage
contacts, successful control application, replacement, expiry, death and match
settlement. Surviving flight samples are captured next to the existing movement
assignment, so a later projectile's victory callback cannot erase this tick's
movement. Settlement before that movement produces only a terminal anchor.

Strict admission checks phase clocks, linear sweeps, live pending/projectile/
control links, retained audio, source and target poses, target lifetime endings,
audience shape and global identity domains. Both retired projectile IDs and
removed target IDs remain reserved. Target endings stop old-body pose sampling
and do not extend the 300-tick local retention window. Empty histories omit the
new field. The renderer remains unchanged and consumes none of this history.

Ninety-seven focused tests across 19 files and TypeScript checking pass. They
include the frozen 273 complete projections, exact restores and 105 future
comparisons, eight save-admission cases, 32 changed-field probes, genuine dummy
respawn, removed-minion identity protection and both mid-projectile victory
orders. Older reference helpers/producers/goldens remain unchanged; only current
comparison wrappers remove the new E field. Two current-schema assertions move
to 179. Full regression, clean CI, natural-cohort comparison and delivery gates
remain pending before observer acceptance.

## Natural-match comparison

The observer candidate completed seed one with Blue victory at tick 157,116,
44 exact save round trips and 43 restored futures covering 2,580 ticks. All 45
complete archived state projections match the frozen schema-178 baseline after
excluding only version, ruleset and the new ahriEVisuals field. The source delta
changes World and snapshot admission, adds four observer/timing modules, removes
no archived files and preserves 657 archived files byte for byte.

The 45 saves include seven with retained E history, at most one record per
sampled save and a largest serialized history of 103,601 bytes. These are sample
measurements, not worst-case bounds. The comparison, source delta and individual
payload measurements are retained under docs/reference/ahri/e-visual-history-*.json.

Full tests pass 9,120 of 9,122 checks across 557 files; the two existing failures
remain the missing archived Leona reflection reader and the Node-24 Lux sampler
golden mismatch. All 251 Node QA checks pass. A clean committed export without
private cache/tools passes all 72 scoped workflow commands, including 780 tests
across 100 files. Browser and production/offline delivery checks remain pending.
