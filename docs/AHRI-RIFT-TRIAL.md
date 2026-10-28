# Ahri on the source Rift

The development route `/?scene=ahri-rift` starts a human Ahri in mid on the
imported Summoner's Rift. Nine existing Ashe/Lux bots fill the other roles;
the match contains six Ashe, three Lux and one Ahri. Both teams retain all five
role assignments. Production selection remains Ashe/Lux.

The optional [Ahri bot variant](AHRI-BOT-RIFT.md) at
`/?scene=ahri-rift&bots=ahri` selects an opposing Ahri mid and has its own save
slot. The route without that query retains the roster described here.

Ahri begins with her own level-one stats, ordinary summoners, one skill point
and unlearned spells. She receives no bot orders. Existing source navigation,
terrain, brush, vision, camp calendars, waves and structures remain in use.
The trial adds trusted admission and a role assignment without changing spell
damage, movement rules, resource costs, timing or bot decisions.

The nonserialized `developmentAhriRift` flag is separate from the existing
practice flag. The practice host cannot authorize Rift saves; the Rift flag
cannot authorize a practice player. Ordinary Rift, unrelated trials and forged
saved permissions remain rejected. Rift Ahri states additionally require lane
mode. Existing practice player and NPC contexts retain their earlier behavior.
No new saved fields are added; schema remains 163 with a changed rules fingerprint.
The development runtime identifies this revision as
`c722d7ca3bb84c44a976e8c72eb57887b4d6a9ba529844a795ac080766139b62`.

The private `development-ahri-rift` save is separate from ordinary Rift and
the existing Ahri player practice save. Restart retains Ahri and the summoner
loadout. The ordinary New match chooser remains available, and an explicit
Ashe/Lux choice can survive the trial URL's reload.

Seven new unit cases cover roles, roster, trusted contexts, human idleness,
all-bot movement, source mid navigation, Q's two hit sets, Charm control and
source-wall Spirit Rush endpoints, as well as ordinary/practice regression.
The final focused run passes 123 cases across eleven files; TypeScript passes.

The Q and Charm cases navigate toward the normal opposing mid laner, leaving
the target's bot decisions and the source vision queries intact. The Q case
compares every following tick and restored outward/return checkpoints. Charm
first cancels the target to idle on impact, then forces movement on the next
tick; both phases restore exactly. The first new probe expected movement on
the impact tick and failed. Its correction adds impact and next-tick checks,
retains the movement assertion, and changes no game calculations.

The dash case locates blocked ground in the actual source grid and verifies
the existing bounded, walkable endpoint policy, active-dash restore and free
recast. Its controlled starting position is a test setup, not human movement
or evidence of a recovered native dash policy. The documented local dash
distance and endpoint behavior remain unchanged.

```sh
npm run dev -- --port 5198
# Open /?scene=ahri-rift
npx vitest run tests/ahri-rift-trial.test.ts tests/ahri-player.test.ts tests/ahri-development.test.ts tests/ahri-q.test.ts tests/ahri-e.test.ts tests/ahri-r.test.ts tests/garen-rift-trial.test.ts tests/leona-rift-trial.test.ts tests/masteryi-rift-trial.test.ts tests/lane-match.test.ts tests/snapshot.test.ts --maxWorkers=1
```

Ten distinct browser cases pass across two retained batches. The first run
passes eight cases and records two existing practice-probe failures. The HUD
case reaches its 120-second deadline while taking the aiming screenshot; only
that case receives a 180-second budget. The Q-windup save probe observes null
after live frames pass its short state; pause at the first real pending-cast
tick before retaining its original Q and exact save/future assertions. Both
targeted reruns pass. Every original Ahri assertion remains in order; this is
not a single green ten-case run.

The four new Rift cases pass in the first batch. Real Q input hits the normal
opposing Lux on both legs, reloads an outbound orb with exact continuation,
and captures the returned playfield with the pause backdrop closed. Private
save/restart, ordinary-save isolation, explicit Ashe/Lux choice and ordinary
Rift rejection also pass. The reviewed captures retain Ahri's documented
material/presentation limits; diagnostic HUD updates are not performance data.

The full unit run passes **3,398/3,400 tests across 403 files**, retaining only
the two unchanged baseline failures: the missing original Leona Eclipse evidence
closure and the host-sensitive Lux missile golden digest. TypeScript, all 16
Node QA checks and the production build pass. The nested-path production smoke
passes with all 32 source recordings and the Ahri development URL rejected.
All 102 original production assertions remain in order, with two new entry-gate
assertions. The full offline audit passes with 978 service-worker responses
and zero production page errors. Its accepted pack is
`5aff35be26d9be78e6f660f7eb1b6af5112024b90622034aa3b0f2ab933eced2`
(1,202 files / 538,093,442 bytes). All 1,125 source asset/data file sizes
and mtimes remain unchanged in this checkout.

During this iteration, the original cohort supervisor and all four workers
disappeared without a terminal report or logged error; the cause remains unproved
and the container reports zero OOM kills. All 57 completed results are preserved,
the four interrupted attempts are archived, and seeds 55–58 restart from zero using
the same frozen runner/maps/runtime. A detached recovery supervisor retains the
canonical dispatch/invariant tail byte-for-byte and queues the remaining seeds.
All 539 original source pins remain exact. This records a recovered execution,
not an uninterrupted run or a completed 100-seed gate.

Details are retained in the [verification ledger](reference/ahri-rift-trial-verification.json).

This is a trusted
development integration, not a completed production champion or six-character
bot roster. Existing Ahri material, animation, native effect/audio and timing
gaps remain documented in [player practice](AHRI-PLAYER.md). Mid bot policy,
complete native audiovisual comparison and physical-device performance remain
separate work. The original 100-seed cohort retains its own frozen ruleset and
does not certify this changed revision.
