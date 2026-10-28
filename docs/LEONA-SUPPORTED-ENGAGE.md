# Supported Leona Zenith engages

Leona support bots can now join an allied attack on a visible champion without
waiting for a root or stun. Try `/?scene=roster-rift`, which has two AI Leonas.
The existing isolated E and held-target R follow-ups retain priority. Human
casts and the source E controller keep their existing behavior.

The new decision requires at least 65% Leona health, an available or already
armed Q, and an ally with at least 45% health actively attacking the same target
in ordinary attack reach. A committed windup also qualifies. Dead, stunned,
charmed and retreating allies cannot support it. One plus the number of such
allies must cover the observed champions within the existing 1,000-unit landing
neighborhood. Only support-role bots receive this additional decision.

The bot reserves E, follow-through Q and a learned ready W. Already queued casts
are counted once, and an armed Q needs no second payment when at least two seconds remain.
An expiring Q requires a ready and funded replacement. Existing defensive W
retains its queue priority. No ranks, resources, cooldowns, damage or spell
geometry are changed; the health thresholds are explicit local AI tuning.

Eligible targets lie beyond melee reach and within the existing E cast range.
The observed target must be the last champion contact on the complete outward
ray. Earlier contacts may be pierced. A later observed champion vetoes that
landing forecast; unseen units cannot supply a veto. The copied point can miss
a displaced target, and actual contacts remain owned by the projectile/dash
controller. This decision does not add homing or moving-target prediction.

The landing must remain directly walkable and need no terrain correction.
Known towers add the target's current normal movement through dispatch, windup
and full outward flight to the ordinary safety cushion. Remembered structure
state comes from existing team knowledge. Future mobility and hidden
interceptions still resolve through the normal live controllers.

All 74 focused checks pass: 29 new unit cases and 45 adjacent Leona cases.
They cover both teams, actual unheld target movement, paid E/root/dash,
Sunlight and Q follow-through, independent saved futures, allied availability,
Q/W reserves, already queued W, prepared Q, numbers and visibility, contact
ordering, terrain, towers and a copied aim that can miss.

The new browser case passes real midflight Save/reload and its exact 180-tick
future on the original practice geometry, with a manual human carry and support
bot. It checks absent idle/hidden decisions, source flight/landing draws, actual
root/Sunlight/dash/Q and zero GL/page errors. The original E and R follow-up
cases also pass in a clean three-case batch.

The old E visual fixture originally timed out at 30 seconds on this Chromium
host; the parent commit reproduces that result. It now seeks to its four
asserted visual ages while advancing all 70 ticks in all three simulations.
Assertions, sampled ages and the deadline remain unchanged. The old and parent
traces are retained. The first new landing image included the restored pause
menu; the corrected capture passes with it closed and the simulation paused.
Both final source flight/landing views were reviewed.

The final broad run passes **3,528/3,534 unit cases across 413 files**, leaving
only the six independently reproduced baseline failures. TypeScript, all 29
Node QA cases and the final build pass. Schema stays 163; final rules fingerprint
`42e156074f8039d55a6149207abf4c280dce65798da8354c8e25f62357c1841d` matches
pack `fdf9593396b39f485e42208a38a9141e706347678d8452bd711ab1b6496c27d4`,
1,202 files / 538,105,726 bytes. Public assets, source spell values, controllers
and saved fields are unchanged.

The final frozen seed 26018 uses a Lux-mid AI proxy and ends naturally in a
**Blue victory at 40:16.1**: 144,967 checked ticks, 41 exact checkpoint round-trips
and 40 original-world future comparisons covering 2,400 ticks. Independent
verification passes 42 retained states, protected-building damage, valid frozen
victory and all 542 archived source/QA inputs plus the runner/maps. Blue Leona
casts E 14 times and Red Leona 11; the preceding roster run had 2/0. Both supports
use Q/W; R remains the existing held-group/finisher policy (Blue 1, Red 0).
The first candidate remains separately archived. Its final state matches the
corrected version after normalizing only the rules fingerprint, so the new
expiry unit case supplies coverage beyond this selected seed. These results
do not close the 100-seed, full-browser, native-fidelity or performance gates.

Final nested production passes all 32 recordings and development gates, with
zero unrequested Leona preloads or browser/resource errors. Fresh offline
acceptance is not repeated for this private AI change. The
[verification record](reference/leona-supported-engage-verification.json) pins
both candidate corpora, final captures, expiry failure/correction, the retained
parent visual timeout and all final checks.

```sh
npx vitest run tests/leona-supported-engage.test.ts tests/leona-e-ai.test.ts tests/leona-r-ai.test.ts tests/leona-support-ai.test.ts --maxWorkers=1
npx playwright test e2e/leona-supported-engage.spec.ts e2e/leona-e-ai.spec.ts e2e/leona-r-ai.spec.ts
```

A real expiring-Q regression retains the initially wrong W/E admission at 105
mana. The corrected planner keeps W alone there, while 140 mana funds W/E and
a new Q after arrival with exact saved continuation. The two-second credit
window is local bot tuning; source Q duration and cooldown remain unchanged.
