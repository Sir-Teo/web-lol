# Activate audio from keyboard and HUD input

A first keyboard action or HUD pointer gesture now requests the game's audio
context. Previously only battlefield pointer-down did so: a keyboard Heal could
execute successfully while `GameAudio.context` remained null.

Pointer activation now belongs to the existing window pointer-down handler,
covering both battlefield and HUD without double activation on the canvas.
Nonrepeating printable keys and native-button Enter also request activation
before dispatch. Text-entry keystrokes and Ctrl/Alt/Meta shortcuts do not request
it. Native button Space still receives its normal default action. Existing
audio pause/mute/resume policy is unchanged.

Two original browser failures retain the missing keyboard activation request
and an actual first-keyboard Heal with a null context. The corrected isolated
input test checks keyboard, HUD pointer, canvas pointer, button Space/Enter,
repeats and typing. The real-game test executes Heal without a prior pointer
gesture and checks its cooldown and running context.

Six browser cases pass, retaining native Space controls, focus interruption and
pointer/Space/Enter ward replacement. TypeScript, eight Node QA checks and the
build pass. The nested production check observes native audio-context creation
through a test-only constructor proxy: zero contexts before input, one running
context after the first keyboard action. Its existing sound, pause/resume and
ward-replacement checks also pass, with no page errors, failed requests or
requests outside the prefix. This verifies readiness, not physical audibility
or native-client mix/timing parity.

```sh
npx playwright test e2e/input-audio-activation.spec.ts
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/input-audio-production-new
```

All 543 asset/data files retain their bytes and modification times. Audio
masters, synthesis, gains and scheduling remain unchanged. Schema 163 and the
ruleset fingerprint are unchanged. The [verification ledger](reference/input-audio-activation-verification.json)
separates fresh checks from the inherited full-unit and broad-production
certificates of the preceding renderer/UI checkpoints.
