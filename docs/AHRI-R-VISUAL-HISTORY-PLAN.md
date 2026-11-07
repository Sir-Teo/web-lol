# Spirit Rush saved visual observations

The frozen pre-observer baseline executes the verified schema-180 / d625c0ee
archive from the accepted Charm renderer. All 676 archived source/harness files
are checked before compiling World through archive-only aliases. Node and V8
must match the archive. The helper, producer and expected hashes are frozen
before adding new observations.

Twenty-one scenarios contain 357 complete state projections: contact/miss,
multiple targets, recasts, dash/window death, target loss, moving targets,
hidden/revealed selection, root/Charm interruption, Flash, Essence extension,
rejected casts, lethal contact, late recast, overlapping casters and victory
during dash, flight and window. Only version/ruleset and the prospective
ahriRVisuals field are excluded. Every existing audio and visual history remains
in the comparison. All 357 hashes match the unchanged current World.

Restore verification exposed an existing admission defect: Lux E can kill an
active R bolt target after R advances in the same completed tick. The validator
now permits that pending target-loss state only when the target died at the
saved tick. Stale/future deaths and missing targets still reject. Damage,
movement, target selection and target-loss update timing are unchanged. The
completed-tick Lux E interaction restores and advances identically.

All 357 complete projections now round-trip exactly. There are 148 restored
future comparisons over 17,089 ticks and three terminal immutability checks.
All 56 focused checks in five files and TypeScript pass. The frozen helper,
producer and golden retain their 5de09022 identities. This is an archived
local-gameplay baseline, not native-client or hundred-seed validation. See
[baseline verification](reference/ahri/r-visual-baseline-verification.json).

The d93ef6c8 admission-fix checkpoint passes 9,239/9,241 full-suite cases in
570 files, with only the same missing historical Leona reader and Lux sampler
golden mismatch. All 257 Node QA cases pass. Tests ran in a fixed committed
checkout with every tracked asset included, reusing installed dependencies and
native fixtures/tools. Tracked bytes remained unchanged; the disposable checkout
was removed after retaining its evidence. Its schema-180 ruleset is 14c7ccb4;
this checkpoint has not refreshed production/offline delivery or been integrated
into primary. See [admission verification](reference/ahri/r-same-tick-admission-verification.json).

The observer will use existing rush IDs, burst indices and bolt indices. It must
allocate no gameplay IDs or random draws. Record actual window/charge changes,
bursts, paths, contacts, target/body lifetime, visibility and terminal settlement.
Owned animation timelines and observed rigs must support historical attachment
sampling after the live Unit discards a transition. Stop tails and historical
retention are explicit local presentation policies.

Native producer joins remain separate: eight systems have explicit references,
three remain unjoined, Transform_Out is null, TextureSwaps has no emitter arrays
and indicator comparison operators are omitted. Recording local remaining casts
does not certify native buff-counter semantics or fill missing dispatch rules.
Source preservation, observation correctness and native pixel calibration remain
separate claims.

## Unconnected observation data layer

The data API records actual rush/burst/bolt identities, window changes, dash and
flight paths, pre-damage contact rigs/poses, body endings and terminal anchors.
Every pose owns its animation timeline, primary pose and outgoing layers.
Window-ending poses stay separate from later body motion: an accepted dash can
continue after expiry. Flash ends its dash before teleport; committed bolts keep
their actual independent paths. Terminal settlement adds no unexecuted movement.

The local retention window is twelve seconds, covering the largest authored
finite linger of 10.35 seconds. Recent source/target pose paths retain at most
721 entries. Independent birth poses and charge-change anchors support long-lived
fully bound single particles; old completed bursts expire independently of a
continuously extended window. These are explicit local storage/presentation
policies, not native constructor or callback claims.

Eight module cases use actual R commands and intercept the cast notification
before movement and damage before contact callbacks. Checks cover owned nested
poses, lethal contact, Flash, source/target body endings, hidden births, a real
2,400-tick repeated-Essence window, optional observation and terminal settlement.
The long window retains exactly 721 source poses and discards its old burst.
The combined selection passes 32 tests in three files plus TypeScript.
See [module verification](reference/ahri/r-observer-module-verification.json).

The module is not connected to World or save serialization yet. Strict schema,
motion/clock validation, current-state coverage and actual hook wiring are next.
