# Ahri mid bots on the source Rift

Open `/?scene=ahri-rift&bots=ahri` on the development server to try the Ahri
combat and farming policies in a normal five-position match. The initial human
is Ahri in mid, facing an opposing Ahri mid bot. The other eight bots retain
their existing Ashe/Lux roles. Using **New match** to choose Ashe gives the
human bottom and an Ahri bot mid on each team. Choosing Lux keeps the human in
mid with one opposing Ahri bot. The chooser still offers only Ashe/Lux.

The bot roster uses ordinary source-grid movement, team sight, lane waves,
camps, structures, economy, own-kit learning and mage purchases. Ahri uses
[Q/Charm combat](AHRI-BOT-COMBAT.md), [Fox-Fire/defensive Spirit Rush](AHRI-BOT-MOBILITY.md)
and [Q wave farming](AHRI-WAVE-CLEAR.md). No stat bonus, free item, accelerated
calendar, revealed enemy state or direct planner damage is introduced. The
human keeps manual learning and control.

`Battlefield.developmentAhriBots` selects NPC mid identities only inside the
existing trusted `developmentAhriRift` host. The bot selector cannot grant that
permission itself. Neither flag is serialized. Ordinary Rift and unrelated
practice permission still reject Ahri Rift checkpoints, including edited
permission fields. The two Ahri Rift variants share the existing admission
context; the new selector controls fresh rosters rather than rewriting a
loaded match file or inventing a separate save format.

The route uses the private `development-ahri-bots-rift` browser slot. Manual
Save/reload, restart and explicit Ashe/Lux choices use that slot, preserving
both `rift` and `development-ahri-rift`. Restart retains the selected human
identity, normal summoners and bot composition through the ordinary match
factory. The original `/?scene=ahri-rift` keeps its opposing Lux. Production
ignores the additional query and keeps its ordinary roster, assets and chooser.

Seven new unit cases verify all three human choices, five roles per team,
nine AI units, normal jungle loadouts, source-grid walking, own Q learning and
paid mage purchases, natural mid-bot encounters/casts, exact restored futures,
trusted admission and original-roster regression. All 249 focused checks across
21 files pass. TypeScript, all 29 Node QA cases and the build pass.

Both new browser cases pass without retries. The first walks the human through
the source lane until the ordinary opposing Ahri chooses Q, then checks the
own body clip and visible orb. An actual in-flight Save/reload reproduces the
checkpoint and 180-tick future, including a real outward hit on the human.
The ordinary and original Ahri trial saves remain exact. The second uses the
real Ashe chooser and restart controls, verifies two AI Ahri mids, and checks
all ten scoreboard rows. Both reviewed 1440×900 captures retain the source
terrain. Both cases finish with zero page errors.

The full run passes **3,456/3,462 cases across 408 files**. The six failures
remain the source-cache/toolchain and Lux digest checks independently reproduced
on untouched `5d90742` during the mobility step. Their assertions are intact.

Three ten-minute headless diagnostics (seeds 26018, 719 and 927) preserve normal
rules, with the existing bot policy supplying the human carry's orders. They
check 108,000 total ticks, thirty exact checkpoint round-trips and nine restored
180-tick futures against the original continuing worlds. All six Ahri mids
use Q/W/E/R, learn and farm normally; resources remain finite and within bounds.
The horizons retain their unfinished matches without forcing a winner. These
are short diagnostics, not a complete-match seed gate or natural human-play
certification. The runner's first external build needed its installed package
link; a preliminary report capture was restarted to copy rank histories. Those
attempts are retained separately from the final three accepted reports.

The matching nested-path production smoke passes all 32 recordings and the new
exact bot-trial URL rejection, with no Ahri preloads or page errors. The full
offline audit passes integrity/retry, saved network-disabled restore, a new lane
match and atomic version activation, recording 977 service-worker responses
and no production errors. Frozen source/build/log/proof identities are in
[the verification ledger](reference/ahri-bot-rift-verification.json).

No public asset or spell-controller change. Schema remains 163; the matching
rules fingerprint is
`2ec308dd0a16a79620c2e828754c87b07c1d08a25ce8ff64aa3c45f0e59605bf`.
The build pack is
`74c78def07086558f2a21ddd7c1d0436aa05bd3211aa8a71475ee12f7fac84f5`
(1,202 files / 538,098,723 bytes). This is an integration trial. Native
presentation, offensive R tactics, complete team strategy and complete-match
certification remain open.

```sh
npm run dev
# Open /?scene=ahri-rift&bots=ahri
npx vitest run tests/ahri-bot-rift.test.ts tests/ahri-rift-trial.test.ts tests/lane-match.test.ts tests/ahri-bot-development.test.ts --maxWorkers=1
npx playwright test e2e/ahri-bot-rift.spec.ts
```
