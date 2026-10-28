# Master Yi on the source Rift

The development route `/?scene=masteryi-rift` starts a human Master Yi in the
jungle role on the imported Summoner's Rift. Nine existing Ashe/Lux bots fill
the remaining positions. Both teams retain top, jungle, mid, bottom and support;
the roster has five Ashe, four Lux and one Yi. Production selection remains
Ashe/Lux.

The optional [Yi bot variant](MASTER-YI-BOT-RIFT.md) at
`/?scene=masteryi-rift&bots=masteryi` selects an opposing Yi jungler and uses
a separate private save. The route without that query retains the roster here.

Yi begins with his own level-one stats, unlearned spells and Smite/Flash. He
receives no automatic movement, skill learning or companion purchase. The shop
uses the existing jungle starter purchase rules. Existing source terrain,
navigation, brush, sight, camp calendars, structures and waves are retained.
This increment changes admission and role assignment rather than Q damage,
vanish timing, Smite or companion calculations.

The nonserialized `developmentMasterYiRift` host flag is separate from the
existing practice flag. The practice flag cannot authorize Rift states; the
Rift flag cannot authorize a practice player. Ordinary Rift, unrelated trials
and forged saved permissions remain rejected. A trusted Rift save additionally
requires lane mode. Existing practice player and NPC contexts retain their
earlier behavior. No new serialized fields are added.

Schema remains 163. This revision changes the rules fingerprint to
`806ec24d8b7eb71ba35d868ed3adba66e305dab913ee697a5fa606b96b6327b3`;
the existing incompatible-save rejection remains in force.

The private `development-masteryi-rift` save is separate from ordinary Rift and
the existing Yi player/NPC practice saves. Restart preserves Yi's jungle role
and the chosen summoner loadout. The ordinary New match chooser remains usable
from the trial and can persist an explicit Ashe/Lux choice across reloads.

Six new unit cases cover roles and roster, distinct trusted contexts, human
idleness, all-bot movement, source navigation, normal companion purchase and
Smite, active Alpha Strike against the scheduled source Gromp, every vanished
checkpoint's exact continuation, and ordinary/practice regression. The focused
run passes 121 cases across nine files; TypeScript passes.

The Gromp cases advance the real camp calendar and move Yi along the source
navigation paths. They retain normal sight, monster state and targetability.
The active Q is then restored and compared tick by tick through reappearance;
the tests do not replace the map queries or grant a new combat policy.

Seven browser cases pass in one batch: three existing Yi practice cases and
four new Rift cases. Real Q input targets the scheduled Gromp after source
navigation, reloads an exact vanished checkpoint and retains the same future
through reappearance. Private save/restart, ordinary-save isolation, explicit
Ashe/Lux selection and the ordinary Rift rejection gate also pass. All 47
existing Yi browser assertions and their original deadlines remain unchanged.
The production smoke retains all 100 existing assertions and adds two for the
new development entry's rejection.

```sh
npm run dev -- --port 5198
# Open /?scene=masteryi-rift
npx vitest run tests/masteryi-rift-trial.test.ts tests/masteryi-player.test.ts tests/masteryi-development.test.ts tests/masteryi-alpha-strike.test.ts tests/garen-rift-trial.test.ts tests/leona-rift-trial.test.ts tests/lane-match.test.ts tests/smite.test.ts tests/snapshot.test.ts --maxWorkers=1
```

A separate exact-state visual check reloads the same vanished checkpoint,
compares its restored snapshot and 120-tick future, closes the pause backdrop
and verifies the returned model is visible with 90 finite bone matrices. The
first return screenshot behind the pause menu is retained alongside the clear
playfield capture; gameplay and the seven passing browser cases are unchanged.

The full unit run passes **3,391/3,393 tests across 402 files**, retaining only
the two unchanged baseline failures: the missing original Leona Eclipse evidence
closure and the host-sensitive Lux missile golden digest. TypeScript, all 16
Node QA checks and the production build pass. The nested-path production smoke
passes with all 32 source recordings and the Yi development URL rejected.
The full offline audit passes with 978 service-worker responses and zero
production page errors. Its accepted pack is
`355d93a562bfb96a067d8f4bcc8e635b71d32ce989c97e3fa6772baa7e26d8b5`
(1,202 files / 538,093,273 bytes). All 1,125 source asset/data file sizes
and mtimes remain unchanged in this checkout.

Validation details are retained in the [verification ledger](reference/masteryi/rift-trial-verification.json).

This is a development
integration trial, not a completed production champion or six-character roster.
Yi jungle bot policy, complete native audiovisual comparison and physical-device
performance remain separate work. The original 100-seed cohort retains its
original checkout and ruleset; it does not certify this changed ruleset.
