# Development Leona's Zenith follow-up

Practice Leona AI can queue the ordinary E point cast at an isolated, visible
champion already held by a root or stun. The existing command and simulation own
mana, cooldown, flight damage, root, dash, Sunlight and source presentation. This
extends the local [bot setup](LEONA-BOT-SETUP.md), [W defense](LEONA-W-BOT-DEFENSE.md)
and [Q reset](LEONA-Q-BOT-RESET.md); native AI and full support behavior remain open.

## Decision boundary

The target must be beyond ordinary melee reach and within the 900-unit cast
range. Its observed control must cover next-tick dispatch, the 15-tick windup
and the complete outward flight. The planner copies the observed point, so a
later hidden displacement can cause a paid miss. It does not track hidden targets.

An additional observed champion within 1,000 units of the predicted landing, or
intersecting the complete outward sweep, rejects the cast. The near-edge landing
must avoid visible turret danger, have a walkable approach and require at most
one unit of terrain correction. Hidden enemies and later arrivals can still
change the result. This deliberately narrow policy does not attempt wall crossing,
mobile-target prediction or group initiation.

Existing retreat, tower, disengage, recall, committed attack and team-goal paths
run first. E also requires learned/ready resources, no disabling control or active
cast/dash/own Zenith flight, and sufficient mana after already queued casts. Accepted E stops movement through the ordinary order path, holding the
reviewed origin through next-tick dispatch.
Defensive W keeps priority: 90 mana funds W alone; 150 funds W and E.

## Verification

Thirteen new cases cover both teams, actual paid damage/root/dash/Sunlight, exact
queued and dashing saved futures, visibility, control duration, resources,
committed attacks, isolation, turret/terrain rejection, existing flights and W
mana priority. The focused Q/W/E set passes 51 tests. An initial damage assertion
ignored continued regeneration; its retained failure is corrected with an
appropriate bound while the existing spell tests retain exact damage checks.
A later moving-actor regression caught a 5.58-unit advance after the decision;
the launch hold fixes it. The failed reproduction and pre-fix sources are retained.
The earlier full/browser/production/offline runs are superseded by final checks.

Ten Chrome cases pass the new follow-up, Q reset, W defense, bot setup, source E
and existing Zenith surface checks. The new encounter queues no E for a hidden
target and one copied point for the visible target. Saved futures match, mana is
paid, damage is approximately 50 before regeneration, contact creates Sunlight,
and the dash arrives at the 70-unit near edge. Sampled source surface draws change
26,541, 36,312 and 24,196 pixels at three active ages, with zero GL/browser errors.
The inspected screenshot shows source presentation at arrival. This encounter
uses controlled navigation; unit cases exercise terrain rejection. These pixel
samples do not certify every E family or a native frame.

The final standard check passes 1,925 tests in 314 files, TypeScript and three
Node QA checks. Production passes 32 nested-path recordings with no development
hook or unrequested Leona preload. All 966 public files remain byte-identical.
Schema 126 uses ruleset
`dee8bc705b6d627e44d75b76a936185b3ec9ddeeeb082859f7ee643bb60ce64c`.
Offline pack
`70c1d32fec010f3333dbfe59f906c1d731ce1882b7c16fbe73ffe9c534638064`
contains 1,012 files / 513,312,607 bytes. Integrity, repair, saved offline boot and
atomic-version controls pass with 963 worker responses and zero production errors.

The [verification ledger](reference/leona/e-bot-followup-verification.json)
records the exact source, build and acceptance evidence. Player and ordinary Rift
selection, full E/R tactics, complete support/roster behavior, native frames and
performance acceptance remain open.
