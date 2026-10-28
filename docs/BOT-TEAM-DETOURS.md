# Remembered-turret detours for team jobs

A team job whose current path crosses a remembered enemy turret can now seek a
safe alternative on the source navigation grid. Previously that crossing vetoed
the job even if a terrain-clear route around the turret existed. Four retained
crossings from the preceding [five-game audit](COMBINED-ROSTER-LONG-GAMES.md)
provide concrete regression geometry, including one stale cached crossing.

The search uses the existing known-turret set and existing friendly minion cover.
A gank still treats a covered enemy turret as a hazard. Each forbidden circle
includes the ordinary turret range, actor radius and existing 150-unit planning
margin. Hidden actual health, target movement and respawn clocks do not enter
this query. Existing knowledge of destruction and its public calendar retain
their original meaning.

The grid checks each search edge, arbitrary endpoint connection and smoothing
shortcut against both terrain and the supplied circles. Query exclusions do
not alter the cached terrain passability used by ordinary movement. Start/goal
points inside danger are rejected, and a disconnected search can retain a safe
partial path for callers that support partial navigation.

The team follower only accepts a complete alternative. It independently checks
the route's continuous terrain clearance and every known hazard, including when
a terrain implementation ignores the optional query constraints. It keeps the
captured goal point, role and target. An invalid alternative retains the old
veto/fallback behavior. Human orders, minions, ordinary lane routes and combat
movement do not request these extra exclusions.

Accepted detours use the existing `path`, `pathTarget`, `pathDestination` and
`nextPathTick` fields. Installing the actual path is necessary: merely allowing
the move order would immediately recompute the original unsafe route. No saved
field or schema revision is added. The rules fingerprint still changes because
bot decisions change, and old fingerprints remain incompatible.

## Validation

All 77 focused navigation/team cases pass, including
both orientations, actual movement, exact saved futures, continuous smoothing,
blocked terrain, overlapping hazards, forbidden endpoints, query cache
isolation, stale paths, friendly cover, hidden health and all four retained Rift
crossings. The broad run passes 3,560/3,566 tests across 414 files, with the same
six reproduced source-cache/toolchain/sampler baseline failures. TypeScript, all
39 Node QA checks, formatting and the matching build pass.

The new Rift browser case passes a real bot decision, continuous safe traversal,
manual human control and actual Save/reload with an exact 180-tick future. The
first fixture placed the actor inside a still-living neighboring Nexus turret
that had been destroyed in the recorded crossing; the bot correctly escaped.
The corrected fixture stages that destroyed turret, including its normal respawn
deadline, and retains the original failed trace. An archived-old-code comparison
fails 24/32 new regressions; no source files were swapped in the running app.

Nested-path production smoke passes all 32 recordings and development gates,
including the exactly-Ashe/Lux public chooser and no unrequested trial assets.
The reviewed captures retain both the accepted and continued route. The four
warm Node route queries have medians from 0.07 to 12.45 ms on this shared host;
those measurements do not certify browser FPS or target-device performance.

Schema remains 163. Rules fingerprint is
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.
Matching pack `a2a97e1b56943afc1b0b7d0afd7453f70c5cf7ffda8906f966784382a7aee3f7`
contains 1,202 files / 538,107,183 bytes. Source spell values, public assets and
saved fields are unchanged. Fresh full-match comparisons are the next step;
prior long-game evidence keeps its original rules identity. No new offline or
hundred-seed acceptance is claimed. See the
[verification ledger](reference/bot-team-detour-verification.json).
