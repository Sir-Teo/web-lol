# Ahri development bot Q and Charm decisions

Development Ahri NPCs can now choose Q or E against an observed hostile
champion. They use the ordinary cast queue and existing spell controllers;
the planner does not apply damage or control directly. Learning and mage
purchases retain the preceding [progression policy](AHRI-BOT-PROGRESSION.md).

The planner checks team sight before reading enemy health, position,
targetability or movement. It chooses the nearest observed living targetable
champion within the local source range, breaking ties by unit ID. A queued aim
copies the observation; it does not follow a later hidden position.

Charm is preferred when the target is the first observed hostile collider in
its source-sized corridor. Observed minions can block that decision. Q remains
available through those minions because its existing controller pierces lane
units. The actual projectile still collides with hidden units: the planner
cannot use their hidden positions to decide whether to cast. Allies,
structures, wards and returning monsters do not count as hostile Charm
colliders, matching the existing projectile controller.

Retreating Ahri can use Charm within the locally tuned 700-unit peel radius;
she does not substitute an offensive Q. Silence, unlearned ranks, cooldowns,
available mana including already queued costs, recall and committed windups
retain their existing boundaries. Offensive planning yields to tower danger.
The ordinary world control path handles stun, Charm and active dashes before
tactical planning. Human Ahri remains manual.

This is local tactical tuning, not recovered native AI. The subsequent
[mobility step](AHRI-BOT-MOBILITY.md) adds close W and defensive R decisions.
Offensive R, lane wave spell use, prediction and a full Ahri Rift bot trial remain unfinished.
No champion is added to ordinary production selection or its roster. Existing
practice and trusted human Rift trial boundaries remain intact, and no public
asset, renderer or spell controller changes.

All 107 focused checks across 11 files pass, including 18 new combat cases.
They exercise both team orientations, real auto-learned E impact and forced
walking, both Q hit legs, hidden/observed blockers, copied fog aim, resources,
range, retreat, committed attack/cast windups, tower safety, an actual vanished
Alpha Strike target, human control and exact saved futures. TypeScript passes.

The first expanded run passed 106 and failed one fixture precondition: Yi
started 800 units away, outside his valid Alpha Strike range, and never
vanished. Moving him within a legal 500-unit cast distance makes the actual
untargetability interaction pass. The original test bytes and failure log are
retained; no ability range or targetability rule changed.

The first browser batch failed both new probes. Charm reached combat but
checked its body clip after the bot had already begun the Q follow-up, observing
`spell1`. The body assertion is now taken during the actual Charm windup;
flight, control, actual Save/reload and exact future checks remain. The Q probe
reached the 180-second test deadline during initial page loading, before game
setup. Both original traces and source inputs are retained. The new probes use
DOM readiness followed by the game readiness flag, with 420 seconds for the
two-load Charm save case and 300 seconds for Q. The measured first navigation
and game-readiness wait alone took about 169 seconds on this software-rendered
host. These are test budgets, not changes to game time or performance claims.

The longer rerun exposed an explicit Vite JavaScript heap failure near 4 GB
during reload; Q then received a refused connection. This was a development
host failure. Vite's dependency scanner already uses the two configured game
entries, so no dependency-entry restriction was added. The dev file watcher
now ignores `.cache`, `.tools`, generated artifacts and test-report trees.
Retained evidence includes fixture/toolchain symlinks; those trees are not
live application inputs. Ordinary `src`, `public` and `tools` inputs keep the
existing watch configuration.

With those exclusions, the complete Charm Save/reload case passes in 36.1
seconds. Sampled Vite RSS is roughly 650–690 MiB, with a recorded high-water
value of 729 MiB, through the additional Q scene load. These are host process
measurements, not physical-device game performance or native pixel evidence.
The Q probe then observed `attack1` during orb flight: the bot had resumed its
ordinary basic attack. Its body assertion likewise moves to the actual Q
windup, retaining the orb, both-leg and exact-future checks.

An intermediate targeted tool session disappeared without a final result.
Its partial artifacts are retained and its cause is unproved. All 539 original
cohort source pins and exact owned process identities were checked before
resuming the four workers and supervisor. The orphaned dev server was cleaned
up after checking its process group and project/tool-wrapper working
directories. Subsequent browser and acceptance supervisors launch detached;
failed browser results refuse the full acceptance stage.

The final Q-only rerun passes in 17.0 seconds. The two distinct new browser
cases pass across a one-pass/one-fail watch-fixed batch and that passing Q
rerun; no single all-green two-case batch is claimed. Exact source comparison
preserves the accepted Charm helper/case and all four shared pinned files.
Both own-body spell assertions occur during their actual committed windups.
The Charm case verifies a real Save/reload and its exact 180-tick future; Q
records both target hit sets and an exact restored flight future. Both finish
with zero page errors. Clear flight/control captures are retained.

A separate actual watcher inspection observes `world.ts`, the Ahri policy and
public assets within 36 watched directories, while the excluded trees are
absent. It does not disable watching live application inputs. The source UI,
renderer, public assets, storage and offline worker remain unchanged. Their
latest production/offline browser acceptance is inherited from `61392b0`:
32 recordings, 978 service-worker responses and zero production errors. Fresh
production/offline browser acceptance is not claimed for this iteration.

The final full run passes **3,423/3,425 tests across 405 files**, retaining only
the two unchanged baseline failures: missing original Leona Eclipse evidence
and the host-sensitive Lux missile digest. Their assertions remain intact.
TypeScript, all 29 Node QA checks and the build pass. All 1,125 source asset/data
file sizes and mtimes remain unchanged. Schema stays 163; rules fingerprint:
`bf458f8bbb5c0b55cd72d393d09bbc57b921572e1c4844f807480c9527b3e411`.
The new build pack is
`3096bfe6416e55e5ba198eb4605bb783c6c28750f9c34889dba89f52312adae0`
(1,202 files / 538,094,767 bytes). Source, build and retained attempt hashes are
recorded in [the verification ledger](reference/ahri-bot-combat-verification.json).
