# Shared team strategy foundation

The five-position match now gives bots a shared set of short-lived jobs:
defend a threatened allied building, join a supported siege, help an ally gank
a visible opponent, or contest a visible Rift Scuttler. This is a local policy
for the interim Ashe/Lux roster. It does not reconstruct native bot AI or complete
the project’s strategy, roster or match-quality requirements.

## Observation and selection

Each team plans once per second, staggered by half a second. The pure planner
receives friendly actors and waves, friendly structures, visible living enemy
actors and buildings, visible Scuttlers, remembered intact tower placements and
visible deaths. It receives copied positions and combat stats, rather than the
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

Movement uses the normal imported navigation grid. Each remaining path segment
is checked against remembered intact enemy towers, including towers under fog.
Allied minion cover can permit siege/defense travel; gank travel always avoids
that danger. An unsafe or unreachable route declines the job’s movement and
resumes the role policy. Finding an alternate route around threat regions remains
unfinished.

Schema 108 retains each team’s next planning tick and at most five jobs, including
actor/target identity, copied point, kind, score and causal clocks. Validation
rejects foreign actors, wrong target types/factions, duplicate assignments,
missing match plans, future observations and expired memory. Restoring a save
continues exactly without replaying damage or resource use. Older schemas and
ruleset fingerprints remain incompatible.

## Verification and remaining work

The [verification ledger](reference/bot-team-verification.json) records source
hashes, simulation tests, targeted Chrome checks, production smoke and reviewed
captures. The [seeded audit](reference/bot-team-match-audit.json) retains normal
full-match runs with the human carry automated for diagnostics. It checks every
tick for finite positions and bounded health/mana, validates and round-trips
minute checkpoints, and independently checks the defeated base at victory.
An unfinished 60-minute horizon is retained without forcing a result.

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

The new strategy does not establish faster or more reliable match completion.
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
Current extended runs are recorded in the
[late-match ledger](reference/late-role-match-audit.json).

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
