# Garen on the source Rift

The development route `/?scene=garen-rift` starts a human Garen in top lane on
the imported Summoner's Rift, with nine existing Ashe/Lux bots. Both teams keep
all five roles; the trial has five Ashe, four Lux and one Garen. The human starts
unlearned, receives no automatic lane order and keeps resource-free spell costs.
This is a trusted development trial, rather than a production roster expansion.

The trial uses the existing Rift terrain, navigation, brush and sight queries,
22 turrets, jungle calendars, waves and structural progression. It exercises the
existing Garen kit in that context without changing damage, costs, timings,
source assets or bot decisions. Ordinary champion selection remains Ashe/Lux.

A nonserialized `developmentGaren` host flag admits the Garen player. Saved
Garen Rift states additionally require lane mode and that trusted host context.
A save cannot grant its own flag. Ordinary Rift and the separate Leona trial
continue rejecting a Garen player. The existing Garen practice fixture remains
available. No new snapshot fields are added; source changes give this revision
a new ruleset fingerprint, and incompatible saves retain the existing rejection
behavior.

The browser uses `development-garen-rift` as its save key. Save/reload and restart
preserve the Garen top-lane state and summoner loadout while keeping the ordinary
`rift` save intact. Choosing Ashe or Lux through New match remains available,
and the explicitly selected champion survives the development route's reload.

The captured development state retains schema 163 and uses ruleset fingerprint
`74942d93a2bc384af0eef175c78a9033a050c87a2d3445b04d51d08ac6c5f86d`.

Six new unit cases cover role ownership, the ten-champion roster, context and
save rejection, resource-free active Q/W/E continuation, source navigation,
human idleness, bot movement and ordinary Ashe/Lux regression. Together with
existing Garen, Leona, lane, snapshot and Rift checks, 47 focused tests pass.
The full run passes 3,385 of 3,387 tests across 401 files. Its two unchanged
baseline failures retain the missing original Leona Eclipse evidence closure
and the host-sensitive Lux missile golden digest. TypeScript, all 16 Node QA
checks and the production build pass.

The browser checks real input, navigation, private saves, restart, champion
choice and ordinary-save rejection. Existing Garen and Leona combat probes now
pause immediately after the real simulation reaches the short state they inspect.
This avoids software-renderer timing skipping a silence, pending cast or mana
cost before the browser reads it. All 47 existing Garen and 25 Leona assertions
remain in order. The R probe restores its original target-HP fixture at the cast
boundary after the live aim checks; gameplay calculations and assertions remain
unchanged. Original failures and captures are retained with the final evidence.
Eight distinct browser cases pass across two recorded batches: seven pass in
the scoped run, its final Leona save/restart case exceeds the original
120-second budget during cold reloads, and that case passes alone with a
180-second budget. This is not a single green eight-case batch.

The nested-path production smoke passes with all 32 source recordings,
no development hook and the Garen trial URL rejected. The full offline audit
passes with 978 service-worker responses and zero production page errors,
including integrity/retry, network-disabled restore, a new lane match and
atomic version activation. Its accepted pack is
`66b0b2091ba6e9d3ad414cff1826fa652d6936049bd0567b1e927268eb9885da`
(1,202 files / 538,093,030 bytes). All 1,125 source asset/data
file sizes and mtimes remain unchanged in this checkout.

```sh
npm run dev -- --port 5198
# Open /?scene=garen-rift
npx vitest run tests/garen-rift-trial.test.ts tests/leona-rift-trial.test.ts tests/garen-player.test.ts tests/lane-match.test.ts tests/snapshot.test.ts tests/rift-world.test.ts --maxWorkers=1
```

This iteration was developed in an isolated checkout while the original
100-seed, normal-rules cohort remained frozen at its own ruleset and 539 source
inputs. That cohort is baseline evidence; it does not certify this changed
ruleset or complete the six-character human-playable milestone. Garen bot
policies, full native audiovisual comparison and physical-device performance
remain separate work. Validation details and application identity are recorded
in the [verification ledger](reference/garen-rift-trial-verification.json).
