# Development Leona's recovery Daybreak

AI-controlled practice Leona can now queue the ordinary Q self-buff during basic
attack recovery against an observed champion within her normal melee reach.
Command dispatch pays mana and starts cooldown; the existing empowered attack
then supplies physical/magic damage, stun, Sunlight and source presentation.
This extends the local [bot setup](LEONA-BOT-SETUP.md) and
[defensive W](LEONA-W-BOT-DEFENSE.md). It is not recovered native AI or complete
support/engage/peel behavior. Player and ordinary Rift selection remain gated.

## Decision boundary

The decision runs after the existing retreat, tower safety, committed-windup,
role and safe-target selection paths. It requires attack recovery with no pending
release, a learned/ready Q, no silence and no already active Daybreak. It does not
spend Q before a ready first swing or replace a committed ordinary swing. Root
permits the existing self-buff. Global action guards keep accepted E windups,
dash and R casts outside this ordinary decision path; stun skips it too.

The selected target must be a visible champion within normal attack reach. This
adds no Q farming/structure/monster spender, speculative chase or hidden-target
tracking. The existing attack order is retained or directed at that selected
champion, and the ordinary next-tick command resets recovery. No direct stun,
attack timer or defense state mutation is added to the planner.

Any already queued self cast reserves its normal mana cost before Q is queued.
In particular, defensive W retains priority:75 mana can fund W but not W plus Q;
150 mana can fund both. Normal dispatch still validates each command.

## Verification

Eight new unit cases cover both teams, actual paid reset damage/stun/Sunlight,
exact queued saved futures, a ready first swing, preservation of an existing
windup, visibility/range/resources/control/retreat/unlearned/nonchampion guards,
root, active Q and simultaneous W/Q mana priority. The focused set passes36 cases
with existing W AI, melee/Q and bot setup tests. An initial unlearned fixture
allowed normal AI skill allocation to grant Q; it now legally spends that point
on W before testing the unlearned-Q guard. The original failure log is retained.

Six Chrome cases pass the new recovery encounter, existing W defense and bot
setup, and all three Q particle save/reload/recovery/audience/lifecycle cases.
In the new encounter the hidden opponent yields zero Q commands, the visible target
queues one and exact saved futures match. The empowered hit releases48 ticks
before the old next-attack deadline, deals approximately67 additional damage
against its no-Q control, and leaves the target stunned and marked by Sunlight.
Eight sampled source models contribute11,146 isolated pixels with no GL errors;
this is a sampled model observation, not all-family/native-frame acceptance.
The source screenshot is inspected.

The first broader browser run exposed an older single-frame particle assertion:
a thin SparksBurst birth could project below one pixel. That failure and trace
are retained. The Q particle fixture now restores a consistent camera after
reload and also samples three saved future ticks without advancing the reviewed
match. Every enabled contact family must contribute pixels somewhere in that
four-frame interval, and the original saved geometry must still restore exactly.
No effect dimensions, source curves or drawing policy are changed.

The full standard check passes1,912 units in313 files, TypeScript and three Node
QA tests. Production passes32 nested-path recordings with no development hook or
unrequested Leona preload. All966 public files remain byte-identical. Schema126
uses ruleset`de9c47cb340f6217eb666b186270d839b85ca2773966478a8c36909edc2155e7`.

Offline pack`5a22adeb359d2998dda53851b1905c9db6611582687d89c1a460839a2775dd3b`
contains1,012 files/513,311,138 bytes and passes integrity, repair, saved offline
boot and atomic-version checks, with963 worker responses and zero production
errors.

The [verification ledger](reference/leona/q-bot-reset-verification.json) records
source, standard/browser, production, public-asset and offline-pack checks.
Complete Q tactics, E/R bot decisions, playable/support Leona and native/full-
roster acceptance remain open; no new normal-match cohort or performance claim
follows from this practice fixture.
