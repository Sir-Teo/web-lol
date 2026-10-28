# Master Yi jungle bots on the source Rift

Open `/?scene=masteryi-rift&bots=masteryi` on the development server. The
initial human is Yi in jungle against an opposing Yi jungle bot. The other
eight bots retain their Ashe/Lux assignments. Using **New match** to choose
Ashe or Lux gives an AI Yi jungler on each team; the human takes bottom or mid.
The chooser still offers Ashe/Lux, and selected summoners persist normally.

Each AI jungler equips normal Smite/Flash and buys Mosstomper for 450 of its
starting 500 gold, leaving 50. The initial human Yi retains 500 gold and must
make their own companion purchase. No free item, rank, faster calendar or stat
bonus is granted. The ordinary route planner and team observations drive
movement; [legal E/Q decisions](MASTER-YI-BOT.md) and [W/R tactics](MASTER-YI-BOT-TACTICS.md)
use existing controllers, resources and validation.

`Battlefield.developmentMasterYiBots` selects fresh NPC jungle identities
inside the existing trusted `developmentMasterYiRift` host. The selector
cannot authorize Yi by itself. Neither context flag is serialized. Ordinary
Rift, practice-only permission, unrelated trials and edited saved flags retain
their rejection boundaries. Both Yi Rift variants share the existing admission
context; selection does not rewrite a loaded match file or add a save format.

The new private slot is `development-masteryi-bots-rift`. Save/reload, restart
and explicit Ashe/Lux choices use it, preserving `rift` and
`development-masteryi-rift`. The original `/?scene=masteryi-rift` keeps its
opposing Ashe jungler. Production ignores the new query and retains its
ordinary roster and asset preparation.

Seven new unit cases cover all three human choices, ten roles/nine bots,
paid companions and ordinary gold, normal loadouts, source-grid movement, own
learning, natural calendar-driven Alpha clears, exact saved futures, trusted
admission and both original Yi/Ahri roster regressions. All 913 focused checks
across 53 files pass, along with TypeScript, all 29 Node QA cases and the build.

The new comprehensive browser case passes without retries. It uses the real
Ashe chooser, checks both paid jungle inventories and all ten scoreboard rows,
then runs normal simulation until the allied Yi begins an actual monster Q.
The source camp stays visible while Yi vanishes and source cast layers render.
Real Save/reload retains the exact checkpoint and 180-tick clear future with
actual monster damage. Real restart reproduces the initial Ashe match exactly,
and returning to the original Yi URL restores its untouched save. The ordinary
save is also preserved. Both source-Rift captures were reviewed at 1440×900;
page errors remain empty.

The quiet broad run passes **3,489/3,495 cases across 411 files**, with only
six independently reproduced baseline failures. An earlier concurrent run
also hit the unchanged wave-clock deadline; its isolated and quiet full runs
pass. The first concurrent production attempt timed out on an unchanged map
control. Both original attempts are retained; no assertion or deadline changed.
Quiet nested production passes all 32 recordings and development gates, with
no unsolicited Yi assets. Fresh offline acceptance passes 978 service-worker
responses, saved network-disabled recovery, a new Lux lane and atomic updates.

Three ten-minute roster diagnostics check 108,000 ticks, 30 checkpoint
round-trips and nine comparisons with the original world's future. Both Yi
junglers use Q/E in each seed; aggregate casts are Q151/W10/E123/R5. No resource
invariant fails or winner is forced. This does not certify complete matches or
balance. Evidence and retained timing attempts are pinned in the
[verification record](reference/masteryi-bot-rift-verification.json).

The matching schema-163 rules fingerprint is
`4d598fc4eaff0482d8fc6800f5f645b39df88124009ad4144155c5c322ce75a2`.
Pack `8fa4f1843412d4c6c3b2c5ef1777a591292fa3963292196280696fb5ce88c7a1`
contains 1,202 files / 538,103,007 bytes. Public assets and spell controllers
are unchanged. This is an integration trial; native fidelity, complete team
strategy and complete-match certification remain open.

```sh
npm run dev
# Open /?scene=masteryi-rift&bots=masteryi
npx vitest run tests/masteryi-bot-rift.test.ts tests/masteryi-rift-trial.test.ts tests/ahri-bot-rift.test.ts tests/lane-match.test.ts --maxWorkers=1
npx playwright test e2e/masteryi-bot-rift.spec.ts
```
