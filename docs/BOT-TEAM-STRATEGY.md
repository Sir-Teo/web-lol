# Shared team strategy foundation

The five-position match now gives bots a shared set of short-lived jobs:
defend a threatened allied building, join a supported siege, help an ally gank
a visible opponent, contest a visible Rift Scuttler, or advance with a friendly
wave toward a public map objective before seeing it. This is a local policy
for the interim Ashe/Lux roster. It does not reconstruct native bot AI or complete
the project’s strategy, roster or match-quality requirements.

## Observation and selection

Each team plans once per second, staggered by half a second. The pure planner
receives friendly actors and waves, friendly structures, visible living enemy
actors and buildings, visible Scuttlers, remembered intact tower placements and
visible deaths. Friendly wave lanes and public structure placements with
remembered destruction also guide advancement. It receives copied positions and combat stats, rather than the
World, opponent orders, cooldowns, hidden health or neutral respawn calendars.

Only available controlled champions receive jobs. The human keeps control of
movement and attacks. Retreat, healing, recall, committed attacks and immediate
combat safety retain their existing priorities. Every actor receives at most one
job; small score changes preserve offensive commitments, while defense can
preempt an offensive job. All thresholds are explicit in `src/content/bot-team-policy.ts`.

| Job | Eligibility and action |
| --- | --- |
| Defend | Visible champions or a substantial visible wave threaten an allied building. Up to two nearby bots respond to a turret, or four to an inhibitor/Nexus. Normal combat selects enemies after arrival. |
| Push | A visible attackable building has nearby healthy allies and sufficient observed strength. A turret also needs allied minion cover. Healthy level-three bots can join; a jungler may travel farther than a laner. |
| Advance | A clustered friendly wave approaches the first structure not known destroyed in its lane or the base. Healthy level-six bots can travel to a point behind that wave if observed defense and remembered tower danger permit. Ordinary lane towers do not draw an unfinished-companion jungler; inhibitors and Nexus structures permit a base-ending response. |
| Gank | A healthy level-three jungler can help a nearby non-jungle ally against a visible enemy when observed strength is favorable and the target is outside remembered tower danger. |
| River | A healthy level-two jungler can contest a visible, attackable Scuttler when observed strength is sufficient. Normal attacks, spell resources, companion rewards and Smite validation apply. |

An active home-camp clear excludes offensive detours. Team jobs preserve the
jungle route cursor and never assign the jungler a lane. A rejected or completed
job returns to ordinary role decisions. Support farming and ward policy remain
described in [bot roles](BOT-ROLES.md).

## Memory, movement and saves

A lost target leaves only its copied last-seen point for up to three seconds.
Unseen target movement and health cannot update that point. A visible death,
newly unfavorable observed fight or expiry cancels the job. Reobservation renews
the memory clock while preserving the original commitment tick.

An advance job instead refreshes from current friendly-wave positions and the
public structure frontier. It has no hidden health or vulnerability input.
Without a qualifying wave it cancels on the next team decision, even if its
anchor remains unseen. Arrival can become an ordinary visible push; normal
target acquisition still requires sight and vulnerability. A lane rotation
preserves the actor's role and assigned lane.

Movement uses the normal imported navigation grid. Each remaining path segment
is checked against remembered intact enemy towers, including towers under fog.
Allied minion cover can permit siege/defense travel; gank travel always avoids
that danger. An unsafe or unreachable route declines the job’s movement and
resumes the role policy. Finding an alternate route around threat regions remains
unfinished.

Remembered inhibitor and Nexus-turret destruction expires conservatively for
planning on the public respawn calendar. After that deadline, a hidden turret
is treated as a hazard independently of its actual health or respawn state.
Presentation can still retain its last observed destroyed pose until sight
returns; planning does not use that stale pose as proof of safe passage.

Schema 108 introduced each team’s next planning tick and at most five jobs, including
actor/target identity, copied point, kind, score and causal clocks. Validation
rejects foreign actors, wrong target types/factions, duplicate assignments,
missing match plans, future observations and expired memory. Restoring a save
continues exactly without replaying damage or resource use. Older schemas and
ruleset fingerprints remain incompatible.

Current schema 114 additionally permits `advance`, requires its anchor to be an
opposing structure and its actor to remain AI-controlled, and retains the same
bounded point and causal clocks. Companion completion is an observation of
existing friendly state, with no additional saved field.

## Verification and remaining work

The historical [verification ledger](reference/bot-team-verification.json) records source
hashes, simulation tests, targeted Chrome checks, production smoke and reviewed
captures. The [seeded audit](reference/bot-team-match-audit.json) retains normal
full-match runs with the human carry automated for diagnostics. It checks every
tick for finite positions and bounded health/mana, validates and round-trips
minute checkpoints, and independently checks the defeated base at victory.
An unfinished 60-minute horizon is retained without forcing a result.

At `9adb40e`, those four runs recorded:

| Seed | Outcome | Match clock |
| --- | --- | --- |
| 26018 | Red victory | 57:31.783 |
| 719 | Unfinished horizon | 60:00 |
| 1 | Red victory | 53:41.733 |
| 927 | Red victory; repaired winning save restores | 57:32.233 |

The strategy audit at `9adb40e` checked 823,545 ticks and 230 exact checkpoint round trips
without a detected invariant failure. Recorded minute samples and terminal
ticks/winners match the initial strategy runs. Wall times include an explicit
suspension during browser/unit/production checks and are not performance data.

```sh
npx vite build --ssr tools/qa/role-match.ts --outDir .cache/team-match-runner --emptyOutDir
node .cache/team-match-runner/role-match.js 26018 719 1 927
```

Reports/checkpoints use `.cache/role-match-audit/<ruleset-prefix>/`, preserving
the earlier [role-foundation audit](reference/bot-role-match-audit.json).
Assignment time and arrival/attack counters count actor-ticks and can exceed the
match clock. They describe policy activity without proving every job succeeded.
In particular, a defense target is a friendly building,
so attacking that target is not a defense-success metric.

Unseen river scouting, major objectives, alternate safe routes, richer ally
commitment and enemy threat estimates, coordinated engage/peel, wave management,
adaptive builds and role quests remain unfinished. The six-champion roster,
100-seed acceptance gate, natural human-play quality, full-match browser
performance, offline delivery and native audiovisual/input comparison also
remain required work. These checks establish progress without certifying the
full project goal.

The foundation strategy audit did not establish faster or more reliable match completion.
Seed 26018 finishes at 57:31.783, later than its historical role-only run, while
seed 719 remains unfinished at the 60-minute diagnostic horizon. The latter keeps
normal fights, captures and exact checkpoints without proving eventual victory.
Late-game objective conversion requires further investigation and tuning.

An additional continuation of that retained seed reached Blue victory at
63:29.5 and exposed a separate Lux E winning-checkpoint failure. The
[Lucent result fix](LUX-E.md#winning-checkpoints-and-finite-result-playback--october-22-2026)
cancels active E gameplay state and finishes existing burst visuals on a separate
presentation clock. The one-hour completion gate still counts seed 719 as
unfinished; extending diagnostics does not turn that horizon into a game rule.
Those extended runs are recorded in the
[late-match ledger](reference/late-role-match-audit.json).

Lux's later [observed E wave-clear policy](LUX-BOTS.md#observed-e-wave-clearing--october-22-2026)
adds local minion-group decisions after champion combat, with mana/last-hit
restraint, ordinary support farm protection and an observed inhibitor/Nexus
pressure exception. It changes neither shared job selection nor spell/economy
rules. The [wave-clear audit](reference/lux-wave-match-audit.json) records fresh
matches and compares them with the earlier extended runs. Four seeds remain
insufficient for the roadmap's 100-seed gate or a general match-quality claim.

| Seed | Wave-clear outcome | Match clock | Earlier extended run |
| --- | --- | --- | --- |
| 26018 | Red victory | 50:03.383 | Red, 57:31.783 |
| 719 | Blue victory | 57:01.2 | Blue, 63:29.5 |
| 1 | Blue victory | 53:07.1 | Red, 53:41.733 |
| 927 | Red victory | 56:41.017 | Red, 57:32.233 |

All four fresh runs pass terminal validation, 780,762 per-tick invariant checks
and 220 exact minute/terminal checkpoint round trips. All four finish within an
hour, compared with three in this earlier sample. No spell damage, cooldown,
cost, economy or camp calendar was changed. These are four controlled QA seeds,
with the human carry automated; the duration change is not a universal claim.

The first wave-clear audit also exposed a missile released on the exact winning
tick before a later melee hit. Its empty birth history lacked x/y/facing. Both
Lux and Gromp now capture the actual release pose immediately; normal projectile
advancement replaces it, and terminal cancellation preserves it. The original
failed checkpoint, corrected frozen-build reproduction and post-repair sample
comparisons are retained in the [wave-clear ledger](reference/lux-wave-clear-verification.json).
All 219 recorded pre-repair samples and all four winners/ticks match the repaired
runs. The failed seed-26018 terminal state matches after changing only the
fingerprint and complete Lux birth history.

The headless runner accepts `--minutes 80` for an extended diagnostic (1–120
minutes; the default remains 60). Nondefault horizons write beneath
`<ruleset-prefix>/horizon-<minutes>/`, preserving default-horizon reports. Each
report separately records whether victory occurred within 60 minutes.

The initial seed-927 audit exposed an invalid winning checkpoint: a melee Nexus
kill returned before an unrelated Lux missile’s history received its final frame
and stop tick. Early victory paths now share the same Lux/Gromp history update
as ordinary projectile advancement. Cancelled missiles keep their last position,
stop on the winning tick and cannot resolve damage afterward. Two simulation
regressions and a real browser release/victory/restore case cover this boundary.
The original failed report/checkpoint remains linked in the verification ledger;
the fixed ruleset is audited separately.

## Friendly-wave advancement — October 23, 2026

The completed old 100-seed baseline retained 30 unfinished horizons, including
cases with exposed bases in offline analyst state. The new `advance` job uses
friendly-wave positions, public map geometry and remembered destruction to
approach a lane's next structure without requiring that structure's current
visibility. It supplies no hidden health or vulnerability to the planner.
Three adjacent minions within 2,400 units of the objective are required; the
staging point is 350 units behind the front of the wave. Health, level, observed
strength, travel distance, camp commitment and tower/path checks can reject it.
These thresholds are local tuning, not measured native bot rules.

An unrestricted prototype completed four fixed seeds but repeatedly diverted
unfinished junglers from their camps. The retained revision checks the owner's
existing companion stage before ordinary lane-tower travel. Visible pushes,
river contests and defensive responses retain their earlier eligibility;
inhibitor/Nexus pressure can still invite an unfinished jungler that is not
actively clearing a camp. A top-lane browser fixture demonstrates a real
rotation to an unseen mid tower, exact UI save/reload, retained role/lane and
normal attacks after arrival. The human remains under human control.

Three separate from-zero pilots used the same four seeds, runtime, map inputs,
QA carry automation and 60-minute horizon:

| Seed | Pre-advance `3d05c1…` | Unrestricted `adfa2d…` | Retained `18dae6…` |
| --- | --- | --- | --- |
| 1 | Red, 46:27.6 | Red, 37:27.9 | Red, 41:45.9 |
| 8 | Unfinished, 60:00 | Blue, 50:05.9 | Red, 51:53.3 |
| 38 | Unfinished, 60:00 | Red, 38:32.9 | Red, 42:50.6 |
| 719 | Unfinished, 60:00 | Red, 42:21.9 | Red, 38:21.3 |

All eight retained-revision junglers completed companion growth between 17:08.7
and 19:37.6, versus 22:30.7–31:50.3 in the unrestricted prototype. At matched
20-minute checkpoints their combined deaths fell from 38 to 15; the pre-advance
baseline had 10. Farming and levels recovered substantially, but seed 719's
junglers remained two levels behind its baseline at 20 minutes, and seed 8
retained elevated deaths. Final actor totals have unequal match exposure; the
ledger retains every minute checkpoint and matched 10/20/30-minute comparisons.
The new policy is not a general balance, safety or human-play certification.

Independent verification passed all three corpora. The retained revision checked
629,460 ticks, 176 strict round trips and 172 restored-future comparisons with
no detected invariant failure. `npm run check` passed TypeScript, all 1,474
Vitest tests across 267 files and three Node QA tests with default timeouts.
Seven targeted Chrome cases, the production build and nested-host smoke passed;
the complete browser suite was not repeated. The first concurrent unit run's
two timeouts remain retained, followed by the unchanged successful standard
command after other owners drained. No timeout or assertion was weakened.

Exact source/map/runner bytes were archived for each pilot, and every owner
exited before further runtime edits. Earlier captures and generated builds
remain separate. The [wave-advance ledger](reference/bot-wave-advance-verification.json)
pins these inputs, reports, comparison, logs and captures. A warm checkpoint
diagnostic that was slightly slower with the prototype also remains separate;
it did not rescore the original horizon.

The [completed 100-seed result](NORMAL-COHORT-RESULTS.md) still belongs only to
`6466566…`: 70 victories, 30 censored horizons. Four selected seeds do not pass
a new 100-seed gate. The six complete champion kits, broader objectives and role
quests, richer threat/path planning, native comparisons and full-match browser,
offline and performance requirements remain open.
