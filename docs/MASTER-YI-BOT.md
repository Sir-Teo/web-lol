# Master Yi development bot foundation

AI-marked development Master Yi units now learn their own legal skills and
choose Wuju Style/Alpha Strike through ordinary cast commands. The manual NPC
fixture still starts with AI disabled, and human Yi keeps manual learning and
input. Production selection and roster remain Ashe/Lux.

The local learning policy opens Q, E, W, Q, Q, R and then prioritizes R, Q, E,
W through the shared rank validator. Both team orientations reach Q5/W5/E5/R3
at level 18 without Ashe Focus or Hawkshot charges. A dead AI can allocate
accumulated points without reviving. W/R tactical decisions remain separate
work, and the existing physical/jungle purchases are unchanged.

The subsequent [tactics step](MASTER-YI-BOT-TACTICS.md) adds safe Meditate and
resource-aware Highlander decisions without changing these E/Q controllers.

The combat policy considers the nearest visible eligible champion within the
ordinary 600-unit Q range, with deterministic ID ties. It rejects observed
turret danger at both the caster and champion target. For jungle use it can
instead cast on a visible eligible monster already selected by the ordinary
attack order; it does not select hidden camps or replace the route planner.

Ready E precedes Q in the command queue. E alone is reserved for a target in
ordinary melee range, and it does not duplicate an active buff. Q uses a
captured target ID and copied point, holds the evaluated caster origin until
dispatch, and retains ordinary target/sight/range validation. Both commands
validate independently: losing target sight can reject Q after a legal E;
silence arriving before dispatch rejects both. The existing controllers own
mana, cooldowns, marks, repeats, E on-hits, hiding, buff pauses and reappearance.

Committed melee windups remain intact. Recall, active Q/W, silence, stun,
retreat and turret safety keep their existing boundaries. Root or insufficient
mana prevents Q; a rooted melee Yi can still use the existing free E. No
planner applies damage, grants items or changes controller/source numbers.
These are local development choices, not recovered native AI.

All 893 focused checks across fifty files pass, including twelve new bot cases
and the existing Master Yi ability, source-presentation, save and neighboring
bot checks. New coverage includes both teams through level 18, E-before-Q,
real marks/damage and saved continuations, hidden observations, resources,
control, committed attacks, tower danger, independently rejected commands,
selected jungle targets, dead allocation and manual control. TypeScript,
all 29 Node QA checks and the build pass.

The broad run passes **3,468/3,474 cases across 409 files**, retaining the same
six source-cache/toolchain and Lux digest failures independently reproduced on
untouched `5d90742`. No existing assertion is relaxed. Matching nested-path
production smoke passes all 32 recordings, real cast/purchase/save/vision flows,
and development URL rejection with no Ahri/Yi preloads or page errors. Offline
acceptance is inherited from the preceding Ahri bot Rift revision;
this step changes neither UI, storage nor worker code and does not claim a new
offline run.

The actual browser case passes without retries. Own learned E/Q produce source
cast layers while the body is hidden and untargetable. Real Save/reload retains
the vanished checkpoint and exact 180-tick future; the returned model has all
90 finite bones and actual target damage. Both 1440×900 captures were reviewed,
and page errors remain empty. System Chromium is selected through an external
host launcher; repository Chrome settings are unchanged.

A ten-minute source-Rift diagnostic uses the bot policy as a proxy for the
human Yi jungle slot with normal Smite, purchases and rules. It checks 36,000
ticks, ten exact round-trips and three restored futures against the original
continuing world. Yi reaches level 6 with 23 accepted Q and 19 E casts, and no
resource invariant fails. The horizon retains the unfinished match without a
forced winner. This single diagnostic does not certify complete-match balance,
natural human play or full role AI.

Schema remains 163; the matching rules fingerprint is
`166548c6c2e172a2b8b088d8f82a38f8cbf1062b88c86166bbcd5dc2a6c6ad95`.
The build pack is
`eaf3a58267e1b7413cfddb766220730f53b00dd27b127fcb8ec9b5d5523d2310`
(1,202 files / 538,099,995 bytes). Public asset bytes, saved fields and spell
controllers are unchanged. Native fidelity, W/R tactics, a dedicated bot Rift
roster and complete-match certification remain open.

Source/build/log identities and the diagnostic/browser proofs are retained in
[the verification ledger](reference/masteryi-bot-verification.json).

```sh
npx vitest run tests/masteryi*.test.ts tests/bot-learning.test.ts tests/bot-jungle.test.ts tests/bot-tower-safety.test.ts tests/ahri-bot-combat.test.ts tests/ahri-bot-rift.test.ts --maxWorkers=1
npx playwright test e2e/masteryi-bot.spec.ts
```
