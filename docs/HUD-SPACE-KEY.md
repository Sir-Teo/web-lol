# Preserve native Space activation on focused HUD buttons

A focused HUD button now receives its normal browser Space activation. The
battlefield's Space shortcut still recenters the camera while held.

Previously the window keydown handler prevented the default action for every
Space key outside a modal, including Space on a focused button. It then ran the
camera shortcut. The isolated real-DOM reproduction records zero button clicks
and one camera recenter after a single Space press.

The change returns from the game keydown handler when Space targets a native
HTML button. Its browser behavior remains responsible for click timing and
repeat handling. Other game shortcuts and text-field handling remain unchanged.

Validation uses the actual input class with real browser events in an isolated
DOM, followed by the full game HUD sound button. The full-game case checks
Space and Enter activation without camera movement or game commands, then
focuses the battlefield and verifies Space still recenters normally.

Local keyboard/DOM behavior is the scope; no native-client comparison is
claimed. This change requires no asset, simulation or save-schema update.

```sh
npx playwright test e2e/input-space-key.spec.ts
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/hud-keyboard-production-new
```

The focused production check serves the compiled entry beneath a strict nested
host path. It checks native Space/Enter sound-button activation, Space pause
and resume, the closed development hook and absence of failed/out-of-prefix
requests. It saves a pause screenshot and an inspectable JSON result.

The [verification ledger](reference/hud-space-key-verification.json) records
fresh browser, type, Node QA, build and focused production checks. The full
unit-suite and 32-recording production certificates come from the immediately
preceding [ward fix](WARD-SPELL-TRANSITION.md); they are inherited evidence,
not fresh broad runs for this two-line input guard.

Fresh acceptance passes four browser cases, TypeScript, six Node QA checks,
the production build and all four compiled-entry keyboard actions. The
production check records no page errors, failed requests or requests outside
the host prefix. All 543 asset/data files retain their bytes and modification
times; schema 163 and the ruleset fingerprint remain unchanged.
