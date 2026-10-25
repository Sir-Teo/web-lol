# Essence Theft development controller and Spirit Rush resets

This document retains its original controller checkpoint. The later
[Ahri player practice scene](AHRI-PLAYER.md) adds human controls, HUD and private
saves at schema 137; NPC-only and unfinished-player statements below describe
that earlier checkpoint. Production selection and role AI remain unfinished.

Target: standard PC Summoner's Rift 26.18, frozen Riot build 16.18.8175716.
The development NPC now has Q/W/E/R and passive controllers. This increment adds
an innate kill counter, returning healing Essence and champion-consumption R
restoration. Ahri remains outside human selection and the production Rift roster.
Native behavior, full presentation, role AI and the full champion delivery remain open.

## Source declarations and limits

`tools/assets/export-ahri-passive.py` uses the existing guarded source loader,
checks both named values and both calculation shapes, and retains the omitted
stat default as an explicit limitation. Normal and optimized checks pass; a
changed existing generated output is rejected.

| Declaration            | Retained observation                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parent/counter         | Character explicitly binds AhriPassive and the separate AhriPassiveCounter component.                                                                                                                              |
| Counter/window         | MaxStacks 9; TakedownWindow 3 seconds.                                                                                                                                                                             |
| MinionHeal             | Level-interpolation endpoints 35 → 95, plus coefficient 0.20000000298023224.                                                                                                                                       |
| ChampionHeal           | Endpoints 75 → 165, plus coefficient 0.30000001192092896.                                                                                                                                                          |
| Omitted defaults       | StatByCoefficient parts omit mStat; level domain/curve are not supplied. AP and linear level 1–18 interpolation below are local policies.                                                                          |
| Essence missile        | AcceleratingMovement: initial 1800, minimum 1200, maximum 8000, acceleration 800; center bones; movement-complete cast/destroy.                                                                                    |
| Separate legacy fields | Generic missile speed 1300 and child cast time approximately 0.425 are retained separately. Legacy coefficient 0.6 and Senna tooltip keys are not the passive heal calculation.                                    |
| Client intent          | Heal after nine minion/monster kills; greater healing on enemy champion takedown. R text links champion Essence consumption to one restored cast, at most three stored, and up to ten seconds of window extension. |

The root buff is descriptive and the counter is tooltip-only. The passive
ability child list contains the root only. No stack, credit, heal, arrival,
death or cleanse callback is recovered; the Essence missile does not explicitly
supply its target/tracking/visibility or a heal callback. R's 1/2/3 buff counter
and the nine-stack passive counter are separate concepts.

The independent cache-only review checks six pinned input identities and
reparses all 64 BIN records normally and under Python optimization. Findings
SHA-256: `fc20ac2ea534bfa75b87ec3216870e273d16a03f7d04c2cb3f2b7f7edd97a5d3`;
checker SHA-256: `fe2fd6bec4bfc4ed78e4a42e295c5506ddfd000a67c68023a63a90c323000e2c`.
No native client, provider activity, network fetch or new extraction was used.

## Explicit local execution policies

- Every Ahri NPC starts with one zero counter, independently of learned spells.
  Living credited enemy lane-minion/monster kills advance it. The ninth kill
  resets it to zero and creates one minion-kind Essence at the victim's death
  point. Dummies, wards, structures and allies do not count. Earned stacks survive
  death/respawn; posthumous kills do not advance them. These death/credit choices
  are local rules, not recovered native buff semantics.
- Enemy champion death creates a champion-kind Essence for each living Ahri
  whose effective damage-owner entry is at most three seconds old, inclusive.
  This uses existing positive-damage contribution facts, including delegated
  credit, without substituting the longer shared assist/support window. No
  acquisition range or visibility gate is added. Native takedown eligibility,
  stale execution credit and non-damage participation remain unverified.
- Heal magnitude captures the owner's current level/AP after death credit and
  XP awards. Local level 1–18 interpolation connects the authored endpoints;
  coefficient parts use AP. Later item/level changes do not rewrite the captured
  amount. These formulas preserve source values while explicitly choosing the
  omitted domain/defaults.
- Essence follows the living caster, including through Flash/dashes, without
  terrain/body interception. Travel integrates the clamped accelerating profile
  analytically each 60 Hz step. Arrival at the caster's center consumes it, heals
  up to missing health and emits the existing common heal feedback. Full-health
  arrivals still consume. Root/stun/silence do not prevent passive healing.
- Source death cancels in-flight Essence; a local eight-second pursuit limit
  prevents immortal objects. Spent outcomes remain for thirty ticks, then retire.
  Terminal settlement clears Essence and freezes counters. Native lifetime,
  target geometry, timing and death/cleanse behavior remain open.
- Champion Essence consumption during an active R window restores one stored
  cast, capped at three. It ensures at least ten seconds remain, adding at most
  ten seconds; it does not always add ten. The one-second cast lockout remains.
  Minion Essence never restores R. Consumption after R expiry still heals without
  reactivating R. This exact refresh/ordering rule is a local interpretation of
  client intent, not recovered native script behavior.
- R now retains indexed consumption history and can have more than three total
  casts while storing at most three. Saves replay casts before consumption at
  equal ticks and reconstruct every charge/window update. A later record cannot
  retroactively legalize a cast or consumption after an already expired window.
- Friendly Ahri displays `ESSENCE n/9` while stacks are nonzero. Green/cyan spheres
  are named development return markers. Native passive VFX/audio, icon placement,
  animation behavior and material/dynamic-bone fidelity remain open. The client
  passive icon identity is retained in the table; no unused image is imported.

## Saved continuation and verification

Schema 136 requires one counter per Ahri, strict `ahriEssences`, and R consumption
history. It validates source/victim eligibility, captured heal parameters, clocks,
movement bounds and spent outcomes; reset records validate ownership and replay
charge/window relations. Existing schemas intentionally reject under the same-build
policy. Completed Essence can remain in R history after its short presentation
record retires; stable global IDs preserve its historical identity.

The full check passes 2,173 tests across 337 files, TypeScript and three Node QA
checks. Nineteen passive tests cover innate and kill-counter state, all levels/AP,
clamping/full health, target kinds, inclusive takedown timing and multiple owners,
R storage/extra casts/window refresh/expiry, death/respawn and controls/Flash,
edited-save rejection, retroactive-reset rejection, terminal/pursuit settlement
and exact 300-tick continuation from birth, flight, consumption and R reset.
The 105-case focused Ahri suite also retains prior Q/W/E/R/NPC coverage.

Forty-two targeted Chrome scenarios pass in one run without failures, skips or
retries. Four passive cases verify the visible friendly 8/9 counter, champion
Essence marker/consumption, 165 healing and one R restoration at level 18, then
a ninth minion kill with 95 healing and no R restoration. The three actual Save
match/reload phases preserve counter, flight and consumed/reset state with exact
saved bytes and 300 future ticks. Return/consumption screenshots were reviewed at
1440×900. The other cases retain NPC/Q/W/E/R, rig/recovery, controls, selection,
animation and match-file coverage.

Nested-path production smoke passes 32 recordings with no development hook, no
Ahri fixture and no unrequested Ahri preload. Offline checks pass with 963
service-worker responses and no production errors. Pack `88b45529ea4615c8251d666bd3607a61cfe4688dad22b23d9b95d35473d1eb42` has
1,065 files / 520,052,838 bytes. Ruleset:
`d55a5651959f56c24965e327a1f10e5159de9f3fe0699fcb70973a88f5587605`.

All 1,015 prior public files are byte-identical. No public asset or champion option
is added. Frozen evidence is [passive-verification.json](reference/ahri/passive-verification.json),
checked by `node tools/qa/verify-ahri-passive.mjs` (or `--historical` after later edits).
Manual NPC Q/W/E/R/passive controller integration is true. Full Ahri kit delivery,
production roster expansion, native behavior/presentation, performance and
full-project completion flags remain false. The next increment is a development-only
Ahri player scene with proper input and resource feedback.
