# Modal keyboard focus

Shift+Tab from an initially focused dialog now reaches its last available button.
Tab reaches its first button, and traversal between buttons still wraps in both
directions. Offline files and Graphics recovery initially focus the dialog
container; the old calculation treated its missing button index as an ordinary
index and skipped the last control on reverse traversal.

Two actual-HUD browser cases reproduced that failure before the change. The
handler now distinguishes container focus before applying the existing button
index arithmetic. Hidden and disabled buttons remain excluded. No input binding,
world command, game rule or simulation state changes.

The new cases cover each dialog's initial focus, forward/reverse traversal, every
available button and wraparound, plus no queued world commands or page errors.
The graphics case deliberately sets a HUD state after the complete first scene;
it does not claim a fresh WebGL recovery test. Existing HUD Tab and Space cases
run separately, preserving focused-button activation and battlefield recentering.

```sh
npx playwright test e2e/modal-focus.spec.ts e2e/input-hud-tab.spec.ts e2e/input-space-key.spec.ts
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/modal-keyboard-production-new
```

The production keyboard audit additionally opens Offline files under a nested
static host, checks initial container focus, reverse traversal to Back, forward
wrap to Close, and Space activation back to the pause menu. Its earlier sound,
Tab, audio-context, ward-preview, pause and resume assertions stay intact.
The [verification record](reference/modal-keyboard-focus-verification.json)
retains both original failures, source freezes, fresh targeted checks and the
scope of inherited broader acceptance.

The accepted UI repair passes six browser cases across two batches (four modal/Tab
cases, then two Space cases), TypeScript, all 14 Node QA checks, the build and the
nested production keyboard audit. Both production captures were inspected.
The pack is `6d9e13b2bb8bbdf6de5400f2a6ae4fe9bcc4cfe1096f1e01fdd7a6b8d91627fc`
(1,202 files / 538,092,175 bytes). All 1,125 public asset/data files retain their
sizes and modification times; all 539 active-cohort source pins remain exact.

The 3,324 unit passes/two baseline failures, broad 32-scenario production run and
offline acceptance are inherited from the rendering checkpoint at `8332f5a` and
its pack `273e1d8e…`. They were not rerun for this focused UI repair. The graphics
recovery fixture and software browser results do not certify device performance
or native game appearance.
