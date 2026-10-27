# Focus while importing a match

Starting an import now moves focus to the dialog container after disabling its
buttons. Tab and Shift+Tab stay inside the loading dialog. If the write fails,
the existing error path re-enables and focuses Load this match so the player can
retry or go back.

The original actual-HUD case reproduced focus leaving the modal as its focused
load button became disabled. One focus call fixes that transition without
changing import validation, persistence, replacement locking, match data or
simulation rules. The preceding [initial dialog traversal fix](MODAL-KEYBOARD-FOCUS.md)
continues to handle forward/reverse navigation from the container.

The new case holds a controlled load failure after real file validation. It
checks the disabled state, both Tab directions, exact retained world state,
failure focus restoration and no world commands or page errors. Existing modal,
Tab and Space cases run alongside it. The separate import/recovery cases retain
storage failures before and after a real forced WebGL context restoration.
These are browser scenarios, not physical-device recovery certification.

The nested-host production keyboard audit uses a file downloaded from the real
paused game. It delays only the completion callback of a real IndexedDB write,
checks the loading dialog's focus and Tab containment, then releases completion
and verifies the exact stored state and clock after application reload. No game
development hook is exposed. Its earlier sound, audio, ward, pause, resume and
modal traversal assertions remain intact.

```sh
npx playwright test e2e/import-focus.spec.ts e2e/modal-focus.spec.ts e2e/input-hud-tab.spec.ts e2e/input-space-key.spec.ts
npx playwright test e2e/match-files.spec.ts -g 'import write failure'
npm run build
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/import-focus-production-new
```

The [verification record](reference/import-dialog-focus-verification.json)
retains the original failure, source freezes, browser evidence, compiled-game
checks and the explicit scope of inherited broader acceptance.

Nine browser cases pass across a seven-case focus/keyboard batch and a separate
two-case import/recovery batch. TypeScript, all 14 Node QA checks and the build
also pass. The focused build pack is
`d4d63558d110ea46b158a316651fc32fc1fe6677456cc328fcc3ce7cfafd546c`
(1,202 files / 538,092,203 bytes). Broader unit, full production and offline-pack
acceptance remain inherited at their recorded earlier identities; they are not
presented as fresh results for this one-line UI repair.

The compiled production audit passes both new import checks and every earlier
keyboard/audio assertion, with no page errors, failed requests, outside-prefix
requests or game development hook. Its pending-import capture was inspected.
All 1,125 public asset/data sizes and modification times, schema 163, the rules
fingerprint and 539 cohort source pins remain unchanged.
