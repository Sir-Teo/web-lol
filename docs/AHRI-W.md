# Fox-Fire development controller

Ahri's W can now be manually learned and cast by the development NPC at
`/?scene=fixture&npc=ahri`. It has its own metadata/icon, captured magic payload,
three orbiting fires, committed homing shots, a decaying movement boost and
strict continuation. This document retains its schema-133 checkpoint. The later
[E controller](AHRI-E.md) advances to schema 134, [R base](AHRI-R.md) to 135 and
[Essence Theft](AHRI-PASSIVE.md) to 136. Human Ahri, role policy and native
presentation remain open.

## Source observations

The [complete character package](AHRI.md) retains all 64 actual records from the
30,475-byte BIN, plus original client data. An independent W audit reparses the
entire closure and verifies its committed input identities normally and with
Python optimization. Its retained findings are
`.cache/ahri-w-contract-static-review-v1-20261025/findings.json`, SHA-256
`5375a7cf687aa9e1d0b2f4d79387c9b1a021c6b803f49bb66c51880c91add872`.

The versioned client explicitly describes three fires, magic damage with reduced
damage beyond the first, and movement speed decaying over two seconds. The BIN
has **13 named values and no fire-count field**. Its ability child list is not
evidence of three runtime objects or dispatch ownership.

| Declaration        | Retained value                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root cast          | 0.25 seconds, winding cancellation guard, stealth-break flag, SelfAoe targeting, empty animation name. No disabled/dead/move-cast/channel permission is inferred from absent fields.               |
| Rank resources     | Five ranks; cooldown 9/8/7/6/5 seconds; mana 30 at every rank.                                                                                                                                     |
| Root damage        | 40/60/80/100/120 plus named AP ratio 0.4. The modified repeat calculation multiplies the entire single-fire calculation by 0.4. Exact float32 values remain unrounded.                             |
| Movement boost     | Named fraction 0.4, duration 2 seconds. A separate speed-buff spell authors persistent `Ahri_Q_Speed` VFX, rather than a stat/decay rule. It is not in the ability's child list.                   |
| Acquisition        | Named normal range 550, bonus 725, initial delay 0.25 seconds, secondary delay 0.4 seconds and orbit radius 150. No executable priority/cadence is recovered.                                      |
| Lifetimes          | Named flame duration 2.5 seconds differs from the CircleMovement lifetime of 5 seconds.                                                                                                            |
| Movement records   | Root generic speed 1800; orbit linear velocity 900/angular velocity −2.65; five angle-selected damage splines all declare speed 1400.                                                              |
| Other distinctions | Display range 700 differs from raw range 600 and radii 1000/315. Orbit legacy damage 40/90/…/340 and coefficient 0.7 differ from root named damage. All legacy child data remain in the reference. |

The exporter checks the source hashes, rank arrays, all named values, calculation
links, constant tables, client fire count and child movement contracts. Run
`python3 tools/assets/export-ahri-w.py --check` and the same command with
`python3 -O`. Existing differing output is rejected. No W mode override is folded
into the standard Rift table.

## Explicit local policies

- Acceptance pays mana and starts the hasted cooldown, cancels recall and an
  ordinary attack, creates three orbit states and starts the movement boost.
  A 15-tick committed body windup uses the imported `spell2` clip. New casts obey
  ordinary stun/silence gates; an accepted windup completes through later stun.
  Q/W windups use the shared pending-cast exclusion. These are local control
  choices, rather than proof that the root's authored time is enforced natively.
- Three equally spaced planar fires use the captured facing, radius 150 and
  angular velocity −2.65. Their center follows the living caster. The named
  2.5-second duration bounds unspent orbits; the legacy five-second circle field
  is retained separately. Native spawn angles, binding and linear velocity use
  remain unverified.
- Delays are measured from activation, not added together. After 15 ticks, the
  current visible ordered attack target can use the bonus range. After 24 ticks,
  ordinary candidates use the normal range. Source seconds are rounded to 60 Hz.
  Distances are measured from each fire center. Visible vulnerable champions
  precede other eligible units, then distance and ID break ties. Allied units,
  structures, wards and protected emerging monsters are excluded. No Charm or
  recent-attack priority is claimed recovered.
- Committed shots home linearly at 1400 units/second, ignoring terrain and other
  units. Arrival clamps to the target center. They can finish after caster death
  or later vision loss. A dead, removed or untargetable target spends the shot
  without retargeting/refund. A local four-second pursuit bound prevents an
  indefinitely chased target; it is not an extracted lifetime.
- Captured rank/AP damage does not change with later items. The first actual hit
  on a target is full damage; additional hits from that cast use the repeat
  multiplier. Low-health lane minions receive the named multiplier of 2 when
  their pre-impact health fraction is at or below the source threshold 0.2.
  This threshold operator, per-cast repeat domain and impact-time evaluation are
  explicit local choices. Neutral monsters and dummies do not receive that bonus.
- Movement speed decreases linearly over 120 ticks. It uses the maximum active
  W fraction, adds to the existing Heal/Garen movement policy before shared slows,
  and grants nothing after death. Native decay/softcap/stacking behavior remains
  unverified. Death cancels unspent orbits and the boost; launched shots remain.
  Match end clears the cast array at the ordinary terminal boundary.

The client establishes intent for three fires and reduced repeat damage, not
these state transitions. Native script callbacks, exact target eligibility,
acquisition origins, Charm/attack overrides, minion conditions, ownership and
movement evaluation remain open.

## Saved state and presentation

Schema 133 requires `ahriFoxFires`. Each cast retains a global ID, owner/team,
rank/damage, start/release/latest clocks, captured facing, release/death state and
exactly three indexed fires. Each fire retains orbit/flight/spent phase,
previous/current points, target, dispatch/stop clocks, outcome and repeat/minion
facts. The decoder checks ownership/rank, pending-cast association, phase clocks,
exact orbit positions, flight limits, participant eligibility and hit ordering.
It rejects missing, duplicate or incompatible state. Ahri remains a development
NPC; E/R state remains blocked. Earlier schemas remain incompatible.

Retention is decided after every impact callback. This prevents a later cast's
lethal hit from reinserting an earlier owner's already canceled orbits. The
negative death-frame checkpoint and its repair are retained. W and Q now both
respect the shared emerging-monster protection gate: W keeps its fires instead
of prematurely spending them, and Q records no protected contact. Positive
checks verify acquisition and return-only hits after protection ends.

Three small purple spheres distinguish orbit/flight states. They are explicit
development markers with shared point visibility and immediate cleanup, not
source particles. Native orbit planes, spline selection, bone attachment,
materials, impacts, source sound and frame/listening comparisons remain open.
The original unlit body-preview limits still apply. Source metadata/icon come
from the retained 16.18.1 cohort; no new archive extraction was needed.

## Validation

Eighteen W tests cover resources/decay, three-shot repeat damage, priority delays
and ranges, champion preference, vision, minion thresholds, caster death, lost
targets, Q overlap, Heal stacking, all ranks, terminal settlement, phase saves,
malformed data and protected-emergence transitions. Q adds two corresponding
protection cases. Sixty-seven focused checks also include NPC, snapshots and
Gromp's existing source lifecycle. A fixture originally copied entire units into
navigation points; it now returns only coordinates, preserving strict decoding.

TypeScript, **2,110 unit tests in 334 files** and all three Node QA checks pass.
Normal and optimized source checks pass. A single Chrome run passes **30/30**
scenarios, including W's three rendered fires, reduced repeated hits, complete
checkpoint futures and actual Save → reload during orbit, committed flight after
caster death, and spent fires with an active speed boost. Every reload preserves
the boost and 300 future ticks. Q, existing NPC/Leona rigs, Garen/Lux controls,
selection, animation and match-file regressions pass. Orbit/flight captures were
visually reviewed. This remains controlled development evidence.

Production build/nested hosting pass with 32 recordings, no development hook and
no ordinary Ahri model preload. Offline checks pass with 963 worker responses,
including saved offline startup, integrity repair and atomic version switching.
The pack has **1,063 files / 520,014,071 bytes**, ID
`615473ae3e2b8c174ff7b840680934f4ea9b3a54eade890f17f7f87250379a1f`.
Ruleset:
`3189941362620dddce36fb83291b6e53d372d99484a98be1db5d98d8ae1134d3`.
One W icon and its manifest entry are added; all 1,011 other prior public files
remain byte-identical, bringing the public count to 1,013. Delivery/performance
and the existing large-bundle warning remain open.

The [verification ledger](reference/ahri/w-verification.json) binds the complete
source closure, generated files, failed attempts, successful checks and captures.
Run `node tools/qa/verify-ahri-w.mjs`; add `--historical` after later changes.
The full Ahri kit, player/role integration, native behavior/presentation and
overall project acceptance remain open.
