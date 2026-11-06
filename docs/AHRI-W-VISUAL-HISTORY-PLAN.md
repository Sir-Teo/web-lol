# Fox-Fire visual history implementation plan

The next runtime change will observe the existing Fox-Fire simulation. Native
particle aliases identify orbit, flight and hit resources; they do not replace
local acquisition, movement, damage or cancellation policy.

## Existing lifecycle

A cast allocates one existing cast identity and three indexed fires. Orbit roots
follow the caster through `foxFireOrbitPoint`. Release permits acquisition;
dispatch records the orbit endpoint and then advances flight in the same fixed
step. Flight uses the existing linear homing policy, including after caster
death or lost vision. A hit records its endpoint before the damage callback.
That callback can cancel other casts' orbiting fires during iteration.

Caster death cancels orbits while committed flights survive. A target becoming
ineligible stops its flight. Expiry and match settlement are distinct terminal
paths. Cast retention also covers the movement-speed window after fires stop;
visual retention must not prolong gameplay casts.

## Observer contract

Reuse cast identity plus fire index. Allocate no simulation identities or random
values. Save cast source/team, start/release clocks, original facing and origin.
For each fire preserve the initial orbit anchor, consecutive fixed-step samples,
phase, actual position, source position and sight audience. Preserve dispatch
and terminal anchors separately: dispatch and movement can share a tick, so a
single end-of-step position cannot reconstruct the flight birth root.

Record termination before damage callbacks, and settle match-end records before
gameplay arrays are cleared. Refresh visibility after the normal sight update.
Own-team roots stay known; enemy unbound births require saved birth visibility,
and bound roots can enter sight later. Hidden samples break ribbon continuity.

Presentation retention belongs to a separate bounded history. Derive its window
from the complete particle projection and explicit stop/linger policy. Missing
native lifetimes require documented local phase stop rules, not invented finite
source values. Retained ended identities must remain reserved during restore.

## Verification and implementation order

1. Preserve a real pre-observer development-roster seed-one source archive and
   replayable result. Keep its original schema, ruleset and runtime identity.
2. Freeze focused lifecycle scenarios using that archived World: orbit expiry,
   priority/ordinary acquisition, same-tick dispatch and movement, repeated hits,
   owner movement/Flash/death, target death, overlapping casts, hidden birth,
   later sight entry and match settlement during each phase.
3. Add pure observation hooks, history pruning and strict snapshot validation.
   Compare complete old-state projections, excluding only version identity and
   the new presentation history. Keep every earlier presentation history.
4. Require save/restore and future replay checks plus corruption probes for
   clocks, phase transitions, endpoints, identities, visibility shape and links.
5. Implement lazy asset ownership and orbit/flight/hit rendering only after the
   observer comparison passes. Keep cast and weapon resources explicitly
   unjoined until their dispatch is supported by separate evidence.

The profile reading still lists unresolved palette, field, attached-submesh,
falloff, bound-object scaling and shared-random bindings. Resolve each with an
explicit adapter and evidence before claiming complete W rendering acceptance.

## Frozen focused reference

The [focused reference](reference/ahri/w-visual-gameplay-reference.json) contains
14 scenarios and 149 complete old-state projections from the independently
verified pre-observer archive: 645 archived files, including its QA harness.
Its ruleset remains `5e4347edd208087bb82b7ad33f2d5ba3f77d6a9767da24a6c32c305cbbe7e694`.
The helper excludes only snapshot version, ruleset and the future `ahriWVisuals`
field. Existing W audio, Q projectile history and all other saved state remain
in every digest. The current-World comparison passes before observation hooks.
The natural seed-one roster run reached victory at tick 157,116 with no
reported failure. Independent archive verification is recorded separately.

## Pure observer preparation

`src/simulation/ahri-w-visual-history.ts` defines optional cast/fire history
operations without World hooks or snapshot serialization. Dispatch anchors are
separate from end-of-step samples. Copied positions prevent later gameplay
mutation from rewriting history; terminal anchors are idempotent. Visibility
refresh touches only anchors and samples from the current tick. Five focused
tests cover these contracts, optional observers and duplicate/gapped samples;
the archived gameplay comparator also passes.

This is a preparation module. World integration, retention-policy selection, strict
restore validation and a schema change remain pending; no W renderer consumes
this history yet.

The pure pruning operation retains partially active casts and expires complete
casts from the last fire endpoint. Its positive integer retention window remains
an explicit caller policy, pending renderer integration.
