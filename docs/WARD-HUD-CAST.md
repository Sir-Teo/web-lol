# HUD instant casts replace ward previews

Activating an instant spell from its HUD button now cancels an active ward
preview before enqueueing the cast. This makes pointer, Space and Enter button
activation consistent with the existing spell-key transition.

The HUD exposes a small notification before its existing instant-cast enqueue.
The input controller clears only an active ward gesture through its shared
cancellation path. Accepted commands, cast points, simulation validation and
other held-spell/attack-move transitions keep their existing behavior.

The real-input regression arms the trinket and activates Heal through pointer,
Space and Enter. Each activation must clear both reticle and aiming cursor,
queue only Heal, and preserve the ward charge. A fresh ward gesture must still
queue one placement. Simulation stepping is held at the command boundary to
inspect the commands without depending on frame speed.

This is local UI/input behavior validation. Native-client input parity is not
claimed. No asset or save-schema change is needed.

The original browser reproduction queues Heal while leaving `aimMode` equal
to `ward`. The corrected regression also verifies that cancelling a later
preview preserves the ward command already accepted. Existing queued-Heal
Save/reload and exact first-resumed-state checks remain intact.

```sh
npx playwright test e2e/ward-hud-cast.spec.ts e2e/ward-spell-transition.spec.ts e2e/queued-hud-cast.spec.ts
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/ward-hud-production-new
```

The focused production check now also arms the trinket, activates the actual
Heal button, checks that the aiming cursor clears and confirms the charge is
preserved. Its Space/Enter sound and Space pause/resume checks remain enabled.
The [verification ledger](reference/ward-hud-cast-verification.json) separates
fresh input/browser/build checks from the preceding full-unit and broad
production certificates.

Fresh acceptance passes four browser cases, TypeScript, eight Node QA checks,
the build and the compiled-entry ward-replacement/keyboard checks, with no page
errors, failed requests or requests outside the host prefix. All 543 asset/data
files preserve their bytes and modification times. Schema 163 and the ruleset
fingerprint are unchanged. The preceding full suite (3,191/3,193, two baseline
failures) and 32-recording production closure are inherited evidence.
