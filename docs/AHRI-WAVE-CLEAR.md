# Ahri bot Q wave farming

Development Ahri bots can spend Q on a useful corridor through at least three
observed enemy lane minions. Champion combat retains priority. The planner
leaves ready basic last hits alone, excludes minions already claimed by earlier
visible allied minion/turret shots, and preserves the greater of 30% maximum
mana or the learned W/E costs after Q. Nearby carry farm, jungle assignment,
retreat, silence, recall, committed windups and observed turret danger prevent
the wave cast. This first step has no base-defense exception.

The planner receives copied visible minion observations, never a World or
hidden population, health, orders or future spawn calendar. Changing an unseen
minion cannot alter the aim. The ordinary cast queue owns payment and next-tick
control validation. The bot holds its evaluated origin until dispatch, and a
later hidden movement cannot rewrite the captured aim.

At most 24 nearest eligible minions enter geometry evaluation, with distance/ID
ordering. Each observation defines an angular interval for Q's finite outward
capsule, using the source collision radius plus the minion radius and an
eight-unit planning margin. Tangent intervals are clipped by the circular
range endpoint. Centers and interval midpoints cover shared corridors that
aiming at one body can miss, including angular wraparound. Circles containing
the origin are handled without a zero-length cast. The returned aim stays at
the ordinary 1,000-unit endpoint.

Candidates prioritize useful mitigated outward damage, then kills, body count
and deterministic angle. Useful damage caps each contribution at current
health plus shields and must total at least 1.5 unmitigated outward payloads.
Only the outward magic leg is valued; return true damage remains ordinary
controller behavior and is not promised by the decision. No spell number,
collision, timing, damage rule, source asset or production roster changes.
This remains local tactical tuning, not recovered native AI or prediction.

All 243 focused checks across twenty files pass, including fifteen new cases.
An independent finite-segment projection search samples 1,440 directions for
each of 24 rotated waves; the chosen analytical aim meets or exceeds its useful
damage. Other geometry cases cover narrow shared corridors, range caps,
wraparound, overlapping origins, shields/resistance, excess candidates,
enumeration independence and resource/farm boundaries. Both team orientations
farm actual waves through paid Q with exact 180-tick restored futures. Hidden
observations, champion combat, tower danger, committed last hits, copied fog aim
and new silence at dispatch retain their boundaries.

The first unit run passed 46/47 cases across the three selected files. Its
narrow-corridor precondition accidentally placed the center aim inside the
actual collision width. A slightly wider fixture now proves that each center
misses a body while the shared aim still hits all three; the original assertion
and application geometry remain unchanged. The original fixture and log are
retained in `artifacts/ahri-wave-clear/`.

The two-case browser batch passes without retries. It repeats Fox-Fire/retreat-R
save behavior and adds a real AI-learned Q wave cast, own body clip, visible
outbound orb, paid mana and actual Save/reload. Restoring the orb produces the
exact 180-tick future, all three farm credits and actual outward/return contacts,
with zero page errors. The 1440×900 flight capture was reviewed. System Chromium
is selected through an external host launcher; the repository Chrome default
is unchanged.

TypeScript, all 29 Node QA checks and the build pass. Schema remains 163;
rules fingerprint is
`d1730911df3294be71b7d3f7d6b664221083f3419c45a195ce44bc370d5478c9`.
The matching production pack is
`4c3c425266fea0f0438fc420eb19375f9bb97c810be454489c56801a5d9f1cca`
(1,202 files / 538,098,562 bytes). Native presentation, offensive R, full Rift
bot integration and complete-match certification remain open.

The broad run passes **3,449/3,455 cases across 407 files**. Its six failures
are the same source-cache/toolchain and Lux digest failures independently
reproduced on untouched `5d90742` during the preceding mobility step. No source
assertion, deadline or quality setting changes.

The matching build passes the complete nested-path production smoke with all
32 recordings, real spell/purchase/ward/Oracle/save flows, development admission
gates and no failed or out-of-prefix requests or page errors. Fresh offline
and full-browser certification are not claimed. Source/test/build/log identities
are retained in [the verification ledger](reference/ahri-wave-clear-verification.json).

```sh
npx vitest run tests/ahri*.test.ts tests/lux-wave-clear.test.ts tests/bot-disengage.test.ts tests/bot-flash.test.ts tests/bot-tower-safety.test.ts tests/lane-match.test.ts tests/snapshot.test.ts --maxWorkers=1
npx playwright test e2e/ahri-bot-mobility.spec.ts e2e/ahri-wave-clear.spec.ts
```
