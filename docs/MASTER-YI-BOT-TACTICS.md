# Master Yi bot Meditate and Highlander

AI-marked development Yi units now use the existing W/R controllers as well as
the preceding [E/Q foundation](MASTER-YI-BOT.md). Human input, the manual NPC's
default AI setting, production roster and source spell values remain unchanged.

Between fights, an injured bot below 55% health can use Meditate outside its
fountain. Emergency retreat and committed attacks retain priority. Learning,
cooldown, recall and active-cast guards apply. It reserves the rounded-up
upfront W cost, the complete four-second maximum-mana drain and one learned Q
cost before casting; anticipated regeneration is not spent in advance.

Visible hostile units or projectiles within the local 1,150-unit threat
radius, observed turret danger and the existing two-second incoming-damage
history prevent the channel. Dummy/ward/building bodies and returning monsters
are not treated as ordinary attackers. The turret check retains its existing
range policy. Hidden enemy positions do not affect this decision.

During an AI channel, the ordinary eighteen-tick decision deadline checks for
new visible threats or health above 85%. A queued homeward movement order ends
an unsafe channel; a queued idle order ends an adequately healed one. The shared
order path owns interruption, audio/effect ending tails and saved clocks. A
rooted bot retains channel protection while it cannot escape. Human channels
receive no automatic orders. The safety check updates the existing saved
decision deadline rather than adding a new controller or snapshot field.

Highlander can start a visible champion chase within 900 units or support an
ordinary retreat/disengage. It does not spend R on a jungle monster. Offensive
R reserves a currently ready learned Q's mana; a legal combined opening queues
R, E, then Q. Affordable E/Q remains available when R would consume that reserve.
Rooted pursuit waits unless the champion is already in melee range, and escape
waits until movement is possible. Active R is not redundantly refreshed. The
shared controller owns bonuses, slow immunity, Q/W pauses and takedown effects.
These are local tactical choices, not recovered native AI.

All 907 focused checks across 51 files pass, including fourteen new cases for
both orientations, healing/resources, full channels, visible and hidden threats,
queued interruption and exact saved futures, root/manual boundaries, incoming
shots, healed cancellation, R/Q mana, chase/retreat and combined paused clocks.
TypeScript, all 29 Node QA cases and the matching build pass.

The first expanded four-file run passed 104/106 cases. Two new resource
fixtures sampled costs before the AI had learned its ranks; unlearned resource
metadata correctly supplied zero. The setup now lets the actual allocator run
before sampling ranked costs. Original assertions and game code remain intact,
with the original fixture/log retained in `artifacts/masteryi-bot-tactics/`.

The final four-case browser batch passes without retries. It repeats the
preceding E/Q save case and adds a restored Meditate loop reacting to an
arriving visible enemy, a simultaneous R/E/Q save, and a visible R chase whose
following Q pauses the real buff. Every actual Save/reload retains its exact
180-tick future and returned 90-bone model without page errors. The W loop and
visible R captures were reviewed at 1440×900.

The first browser batch passed two cases and failed the new R particle
expectation. Simultaneous R/Q uses the existing Alpha-hidden actor roots,
which suppress R births; the renderer was already explicitly loaded by boot.
The final combo case verifies those hidden roots and zero R births, while an
additional visible chase case retains the positive particle assertion. No
renderer, visibility rule, source assertion or quality setting changes. The
initial trace, fixture and log remain separate from the final clean batch.

The broad run passes **3,482/3,488 cases across 410 files**. Its six failures
remain the independently reproduced source-cache/toolchain and Lux digest
baseline groups, with their assertions intact.

The matching nested-path production smoke passes all 32 recordings, real
cast/purchase/vision/save flows and development URL gates with no Ahri/Yi
preloads or page errors. Offline acceptance is inherited from the preceding
Ahri bot Rift increment; no fresh offline or full-browser run is claimed here.

A normal-rules seed-26018 Yi jungle diagnostic runs ten minutes and then
continues its exact checkpoint to twenty minutes under unchanged rules. The
two segments check 72,000 total ticks, twenty exact round-trips and six restored
180-tick futures against their original continuing worlds. Across both segments
Yi uses Q42/W5/E35/R4 and reaches level 11. No resource invariant fails and no
winner is forced. The bot policy supplies the human jungle slot; this is one
diagnostic, not complete-match balance or natural human-play certification.

Schema remains 163; the matching rules fingerprint is
`25db6bcff003c347e37cbd0977a1e5252cd15ffe39e1c68e666f4ddd7e33dd1a`.
The pack is
`1070d0af40207e5fe7fe4a4153336b7bae095a407e94b3a2285b3423e98f5db3`
(1,202 files / 538,102,827 bytes). Native presentation, complete team strategy,
dedicated Yi bot roster integration and complete-match certification remain open.

Source/build/log identities, retained failed probes and final browser/diagnostic
proofs are recorded in [the verification ledger](reference/masteryi-bot-tactics-verification.json).

```sh
npx vitest run tests/masteryi*.test.ts tests/bot-learning.test.ts tests/bot-jungle.test.ts tests/bot-tower-safety.test.ts tests/ahri-bot-combat.test.ts tests/ahri-bot-rift.test.ts --maxWorkers=1
npx playwright test e2e/masteryi-bot-tactics.spec.ts e2e/masteryi-bot.spec.ts
```
