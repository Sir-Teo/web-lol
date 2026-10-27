# Tab navigation within the HUD

Tab and Shift+Tab now move focus normally between HUD controls, including
focusable buff details. Tab on the battlefield retains its held scoreboard
behavior. The game input handler returns before intercepting Tab when its event
target belongs to the HUD.

Previously the window handler prevented Tab's default action and opened the
scoreboard even on a focused button. The original-code browser reproduction
failed when focus stayed on the first button instead of moving to the next
focusable detail. The same scenario now verifies forward/backward traversal,
no scoreboard opening from the HUD, and scoreboard press/release on the canvas.

A second case loads the actual game, moves from the camera button to sound with
Tab, activates sound with Space, and returns with Shift+Tab. Its fixture retains
a complete initial scene, then stops continuous rendering and simulation while
checking trusted keyboard events and accepted commands. It is an interaction
check rather than a rendering-performance or pixel comparison.

The compiled nested-host check now reaches sound from camera with Tab and
verifies Shift+Tab before retaining its existing audio activation, Space/Enter,
ward replacement, pause/resume and request checks. Production code exposes no
development hook.

```sh
npx playwright test e2e/input-hud-tab.spec.ts e2e/input-space-key.spec.ts e2e/input-modifier-shortcuts.spec.ts e2e/input-audio-activation.spec.ts
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/hud-tab-production-new
```

The [verification record](reference/hud-tab-navigation-verification.json) pins
fresh browser, type, Node QA, build and focused production evidence. The full
unit-suite and broad 32-recording production certificates are inherited from
[Gromp raw color acceptance](GROMP-RAY-RAW-COLOR.md), with their two baseline unit
failures retained. No simulation, asset or save-schema change is involved; local
browser focus behavior is the acceptance scope.
