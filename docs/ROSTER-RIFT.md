# Combined development roster on the Rift

Open `/?scene=roster-rift` on the development server. You start as Ashe in
bottom lane, with Garen top, Master Yi jungle, Ahri mid and Leona support.
The enemy team has the same five-position composition. **New match → Lux**
puts you in mid in place of the allied Ahri, bringing all six implemented
champion identities into one match. Ashe and Lux remain the human choices in
the menu. Existing separate human champion trials remain available.

All nine bots use the ordinary source navigation, vision, role plans,
learning, combat, purchases and clocks. NPC Yi junglers buy Mosstomper for
450 of their 500 starting gold and equip Smite/Flash. Human purchases and
learning remain manual. The trial adds no ranks, resources, stat bonuses or
faster calendar. Shared combat uses the existing champion controllers.

`Battlefield.developmentRosterBots` selects Garen top and Leona support only
when both existing Ahri/Yi bot selectors and all four champion Rift permissions
are present. The individual selectors and ordinary roster keep their original
top/support identities. The host permissions and selectors are not serialized;
loaded checkpoints keep their own roster and require the existing admissions.
Restart preserves an admitted human champion, including imported trial saves.

The private slot is `development-roster-rift`. Normal, separate Ahri and
separate Yi slots retain their matches. The production build ignores this URL
and keeps its ordinary roster and asset preparation.

All 41 focused roster/old-trial unit cases pass, including six internal human
assignments, ten roles/nine bots, paid companions, trusted admission, untouched
ordinary assignments, source-grid walking and exact independent saved futures.
The initial new test incorrectly expected Ashe to learn Q; it now checks her
ordinary W opening while the other roster bots learn Q. Runtime learning is
unchanged, and that initial result remains retained.

The new comprehensive browser case passes without retries. It uses the real
Lux and Ashe menu choices, renders all six portraits across ten scoreboard rows,
and waits for a natural allied Yi monster Alpha. The source camp and Q cast
render while Yi's body is hidden. Real Save/reload retains the exact checkpoint
and 180-tick damage future; real restart reproduces the initial selected Lux
match. It checks separate save preservation and reopens the original Ahri bot
trial unchanged. Both 1440×900 captures were reviewed; page errors are empty.

The broad run passes **3,499/3,505 cases across 412 files**, retaining the same
six reproduced baseline failures. TypeScript, all 29 Node QA checks and the
build pass. Schema remains 163; the rules fingerprint is
`1e2014d2447c76d16f1b9fc55253e90e6bd49cfc4aff321c31d9ba7d14a05e5b`.
Matching pack `2c9509b34aa7c0309cd064571c8da0ce62a5bcf044bed7f85fa69463df36ea86`
contains 1,202 files / 538,103,525 bytes. Public assets, resource rules and
champion controllers are unchanged.

A frozen normal-rules diagnostic automates Lux in mid for seed 26018. It ends
naturally in a **Red victory at 47:03.5** (169,409 ticks), with 48 exact
checkpoint round-trips and 47 original-world future comparisons covering
2,820 ticks. Per-tick resources, 5,216 accepted structure-damage contacts,
victory dependencies and terminal-state freezing pass. The independent verifier
checks 49 retained snapshots and all frozen runner/map/source identities.
All six champion identities use Q/W/E/R in aggregate. Red Leona uses Q/W but
finds no permitted E/R follow-up under the existing immobilized-target policy;
complete support engages remain open. This selected headless seed does not
satisfy the 100-seed, full-browser, native-fidelity or performance gates.

Nested production passes all 32 recordings and development gates, including
the exact new URL and zero unrequested Ahri/Yi/Leona preloads. Fresh offline
acceptance is not repeated for this development-only roster. The
[verification record](reference/roster-rift-verification.json) pins the build,
browser captures, first fixture correction, complete diagnostic and production.

```sh
npm run dev
# Open /?scene=roster-rift
npx vitest run tests/roster-rift.test.ts tests/lane-match.test.ts tests/masteryi-bot-rift.test.ts tests/ahri-bot-rift.test.ts tests/leona-rift-trial.test.ts tests/garen-rift-trial.test.ts --maxWorkers=1
npx playwright test e2e/roster-rift.spec.ts
```
