# Bone Euler CPU experiment

October 24, 2026. The deferred-Euler experiment was **excluded from production**:
its whole-game measurements did not establish a consistent CPU benefit, while
retained heap increased and the implementation depended on runtime internals.
The accepted [unit visibility improvement](CPU-UNIT-VISION.md) remains.

The CPU profile attributed substantial animation time to deriving Euler angles
after quaternion writes. Imported clips and rendering use the quaternion directly.
The candidate delayed Euler calculation on live unit rigs and private target-pose
samplers until an Euler component was read or written. Its implementation and
evidence remain archived for review; the application keeps its ordinary Euler
behavior.

The candidate kept the original Euler object in place. Retained references, component
setters, order changes, iteration, serialization, copy/reorder/conversion methods
and ordinary quaternion updates kept their existing values. Partial Euler edits
first settle the pending quaternion conversion. Synchronization uses a separate
scratch matrix so a lazy read cannot overwrite a Three conversion already in
progress. Accessor functions are shared across bones; only each bone's state and
quaternion callback are private. Other objects retain ordinary behavior.

This adapter relies on the pinned Three 0.186 Euler-field and quaternion-callback
contracts. It runs on fresh skeleton clones, before their animation bindings are
created. Nonstandard classes or field layouts opt out. Library upgrades require
rechecking these contracts and the retained pose evidence.

## Measured tradeoff

Eleven alternating pairs of controlled animation/matrix batches use 30 actual
imported rigs, 60 updates per batch and two normal-blend actions. Median duration
falls from **40.2 to 37.0 ms (8.0%)**. These batches exclude drawing, simulation,
GPU work and temperature measurement.

After explicit garbage collection on the same 117-unit saved Rift match,
renderer JavaScript used heap rises from **71,592,676 to 74,824,640 bytes**:
3,231,964 additional bytes. Backing storage stays approximately 466.6 MB.
The initial implementation retained separate accessors per bone and added about
5.1 MB; shared accessors reduce that cost. These are single retained-heap
observations, not a complete memory budget.

The whole-game timings are mixed. The first implementation's short serial pair
observed 4.4% less mean render time and 2.2% less renderer CPU per wall second.
The final implementation's pair observed **8.4% more mean render time and 6.9%
more renderer CPU per wall second** (6.02 to 6.52 ms mean render). Its animation
stack was cheaper in the sampled profile, while WebGL rendering was more
expensive. Both pairs are retained. No overall CPU, heat, energy or full-match
performance improvement is established by these short observations.

Paused and synthetic-hidden matches performed zero renders and simulation
steps. The pose/frame checks below found no differences in their tested cases;
that correctness evidence did not establish a net performance improvement.

## Correctness evidence

Nine experimental unit cases cover all six Euler orders, retained references, every
public edit/conversion path, interrupted animation/restore, parent placement,
unsupported layouts and idempotent installation. The initial fixture mixed
parented/unparented matrices, constructed/cloned initial Euler values and
unrelated callback identities; those diagnostic failures are retained.

Independent previous/current loaders compare all 30 rigs and 1,602 bones through
3,710 clip samples/blends: **7,420,032 local/world matrix scalar comparisons**
match exactly, including signed zero. Later Euler reads also match. Before those
reads, the original implementation performs 429,583 bone Euler derivations;
the adapter performs zero. That count belongs to the controlled clip-seeking
audit, not an ordinary game frame.

Sixty-four paired Chrome frames preserve every framebuffer byte, bone matrix,
Euler observation, label and snapshot through loops/blends, hide/reveal, Lux
field/burst effects, attack, death and respawn. The comparison shares untouched
GLTF assets and restores the ordinary eager Euler fields/callback on the
reference unit rigs; the independent loader audit provides the separate source
check for private samplers too.

The earlier proposed static-local-matrix optimization found zero eligible bones
across all 30 rigs. It was removed; its source and observations remain retained.
Every bone has a remaining binding somewhere in its full clip set.

The candidate passed TypeScript, 1,791 unit cases/294 files and three Node QA
cases. Its 28-case Chrome run passed 26 cases. Both failures also reproduced with
the accepted renderer: a manually paused late-Garen fixture needed a draw after
its pending lazy load, and a structure-clock fixture read intentionally sleeping
offscreen bones. The repaired fixtures explicitly settle the load/draw and bring
each inspected structure into view. Both pass on the accepted renderer without
relaxing assertions or deadlines. The adapter and its nine tests were removed.

The profiler now records renderer retained heap after explicit collection before
active warmup. This profiling change and the two fixture repairs are retained.
The final accepted sources pass TypeScript, all 1,782 unit cases/293 files and
three Node QA cases. Read-only evidence verification uses
`node tools/qa/verify-bone-euler-experiment.mjs`; add `--historical` after later
canonical changes.
Candidate production/offline validation was not run because the candidate was
rejected. The preceding accepted production build belongs to its own ledger.

The [verification ledger](reference/bone-euler-experiment.json) pins candidate
sources, raw timings, matrices/frames, runtime contracts, original failures and
accepted-fixture checks. Schema 125 and current working ruleset
`3f5f13befd26234c86d0603e8fcc4b3236eb6e43b1e4ebf5e47a968d46007653`
remain unchanged. No fresh full browser, offline or normal-match cohort is
claimed. Deferred Zenith work is preserved and the full project goal remains active.
