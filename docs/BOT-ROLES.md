# Five-position 5v5 foundation

**New match → Start 5v5 match** assigns top, jungle, mid, bottom and support to
each team. One human controls Ashe in bottom or Lux in mid; nine bots fill the
remaining positions. The scoreboard shows these public assignments.

This remains an interim Ashe/Lux roster. It does not complete the planned six
champions, role quests, major objectives, complete team strategy or native
fidelity. The full project goal remains unchanged.

| Position | Current champion | Behavior foundation |
| --- | --- | --- |
| Top | Ashe | Existing lane farming, safe attacks, combat and recalls |
| Jungle | Ashe | Home clears, Smite/companion, visible ganks/Scuttlers, siege/defense help |
| Mid | Lux | Existing lane farming and Q/W/E/R combat policy |
| Bottom | Ashe | Existing last hits, attack uptime, kiting and combat |
| Support | Lux | Carry proximity, leaving nearby farm, shielding and brush wards |

## Jungle decisions

Each jungler equips Smite/Flash and buys Mosstomper through ordinary purchase
validation: 450 of its starting 500 gold, leaving 50. There are no free companion
grants, stat boosts or accelerated camp/economy timers. Selected match assets
prepare both companions before play; practice without a companion keeps its
previous loading behavior. Later purchases avoid the incompatible Doran starter.

The local route is Blue → Gromp → Wolves → Raptors → Red → Krugs on the owner's
side. This route is a tuning policy, not recovered native bot AI. Navigation uses
the same imported grid as player movement. The bot approaches within 300 units
of the camp anchor before engaging, avoiding ranged attacks that pull a camp
past its leash. It uses existing attack/cast validation, spends Focus on monsters,
uses Volley against groups and saves Smite for an eligible monster in kill range.
Visible nearby champions can still trigger existing combat and retreat policies.
[Shared team jobs](BOT-TEAM-STRATEGY.md) can interrupt route travel for observed
ganks, visible Scuttlers, supported sieges or threatened allied buildings. They
preserve the route cursor and use normal combat/resources. Unseen river scouting,
major objectives and complete coordination remain unfinished.

The pure planner receives known map locations, the public initial spawn calendar,
visible living monsters and sight of camp homes. Actual respawn deadlines,
hidden population/health and pending split schedules are not planner inputs.
A two-second quiet window (extended for longer declared split delays) protects
Krug offspring. An observed empty camp receives a local 30-second revisit delay;
that is scouting memory, not knowledge of its actual respawn time. A returning or
protected monster is not attacked. All camps keep simulating offscreen.

## Support decisions

A support leaves minion last hits and basic attacks available when its living
carry is within 1,400 units, while retaining farming when alone. Existing Lux
shielding, binding, zone, ultimate and retreat decisions remain active. Outside
the fountain, a separated support can follow its carry while avoiding observed
tower danger. These are local tactical foundations, not complete engage/peel,
rotation or team-planning behavior.

Support wards select static brush within placement range, favoring riverward
coverage, and avoid overlapping allied wards. They spend existing trinket stock
through queued Ward commands and normal validation. No hidden enemy location
selects a ward destination. Role quests and support-item economy are not granted.

## Checkpoints and validation

Schema 108 also saves bounded shared team jobs and observation clocks. The role
state introduced in schema 107 saves each champion's role and the jungler's
selected camp, cursor, quiet clock and at most six observed-empty records. Validation checks one of each
position per team, lane assignments, Smite eligibility, home-side camp membership,
unique observations and causal clocks. Older schemas/fingerprints are incompatible.

A real-grid clear scenario runs 6:40 of normal simulation with other champions
idle. Both junglers visit all six home camps, reach level 5 with 36 CS and no
deaths, and restore their routes exactly. Separate tests cover support farm
eligibility, paid wards, hidden-health/respawn-clock independence and malformed
saved roles/memory.

The [role-foundation ledger](reference/bot-roles-verification.json) records the
historical schema-107 unit, Chrome, production and seeded headless evidence.
Current shared-strategy evidence is in the [team ledger](reference/bot-team-verification.json).
The headless runner supplies the human carry's actions through the same bot policy, keeps the normal
rules and retains a checkpoint at victory or a 60-minute diagnostic horizon:

```sh
npx vite build --ssr tools/qa/role-match.ts --outDir .cache/team-match-runner --emptyOutDir
node .cache/team-match-runner/role-match.js 26018 719 1 927
```

Current reports/checkpoints use `.cache/role-match-audit/<ruleset-prefix>/`.
A horizon does not force a winner. Small seed cohorts do not satisfy the roadmap's
100-seed regression gate or certify balance, the complete roster, natural
human-play quality or full-match performance.
