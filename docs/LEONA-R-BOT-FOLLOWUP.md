# Development Leona's Solar Flare follow-up

Practice Leona AI can queue the ordinary R point cast against an observed held
group, or a held ranged target whose current health and shields fit the local
magic-damage estimate. Existing command dispatch owns mana, cooldown, delayed
impact, damage, center stun, outer slow, Sunlight and source presentation.
This extends the [E follow-up](LEONA-E-BOT-FOLLOWUP.md); native AI, complete tactics
and support-role match integration remain open.

## Decision boundary

Eligible targets must be visible, alive, vulnerable champions held by root or
stun through next-tick dispatch and the existing 38-tick impact delay. Candidate
centers are their observed positions within 1,200 units. A group requires at
least two eligible targets touching the outer area. Candidates sort by eligible
count, ranged-finisher status, distance and unit identity. This searches observed
target centers rather than solving an arbitrary best-fit circle.

The ranged-finisher estimate uses current magic resistance, temporary mitigation
and shields. It does not predict future heals, movement or new defenses. A lone
target in normal melee reach retains ordinary attack/Q follow-through. Existing
E runs first, preserving its cheaper isolated catch where eligible.

Existing retreat, tower safety, disengage, committed attack, recall, team and ward
paths run first. R excludes silence/stun, missing rank/resources/cooldown, existing
cast/dash/own outward E flight, and reserves mana for already queued casts.
At 150 mana defensive W can proceed alone; 200 funds W and R. A rooted caster
can use the ordinary R cast. An accepted decision stops movement through the
normal order path until dispatch. The copied point can miss a later displaced
target; hidden state cannot update the aim or qualify another group member.

## Verification

Fifteen new cases cover both teams, actual payment and center/outer outcomes,
queued/released saved futures, current mitigation/shield estimates, observation,
control duration, resources, E priority, root, committed attacks, existing E/R,
turret escape, W priority, copied aim, movement and dead targets. All 68 focused
Q/W/E/R and Solar Flare tests pass.

The initial unit fixtures placed Lux outside her ordinary attack range for the W
reservation case and measured mana after regeneration; corrected fixtures use an
actual committed attack and sample payment at dispatch. Review then found a real
planner bug: a dead champion could retain a control clock and qualify for R.
The alive guard fixes it. Failed reproduction and pre-fix sources are retained.

Twenty Chrome cases pass the new decision, adjacent Q/W/E/setup behavior, all
three R save/reload phases, both-team surface families, graphics recovery,
lifecycle/warp controls and six audio/recovery/failure cases. The new encounter
queues no R while targets are hidden and one copied point after observation.
A moving caster holds the origin until dispatch; saved futures match. Both
contacts take approximately 150 damage before regeneration, the center is
stunned, and the outer target receives an 80% slow; both receive Sunlight.
Four sampled surface ages change 182,636 / 60,529 / 57,310 / 321,978 pixels with
zero GL/browser errors. The source screenshot is inspected. These are controlled
navigation and sampled local draws, not a native frame or all-family acceptance.

The standard check passes 1,940 tests in 315 files, TypeScript and three Node QA
checks. All 966 public files remain byte-identical. Schema 126 uses ruleset
`61c5e51ac925b80aa33dec49e1c2d4834a10c241b8fb226c31e88f44443e5254`.

Production passes 32 nested-path recordings without development hooks or
unrequested Leona preloads. Offline pack
`89760b191f9baf08da40b202b796ac7cb0f3cf4dac6d3c279a6f13f0ff16499c`
contains 1,012 files / 513,313,916 bytes. Integrity, repair, saved offline boot and
atomic-version controls pass with 963 worker responses and zero production errors.

The [verification ledger](reference/leona/r-bot-followup-verification.json)
records exact source and acceptance evidence. Player/ordinary Rift selection,
mobile-target prediction, peel/engage strategy, full support/roster behavior and
native frame/performance acceptance remain open. Existing R presentation still
supports 41 of 44 enabled source families; this decision adds no missing family.
