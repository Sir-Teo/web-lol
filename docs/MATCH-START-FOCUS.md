# Keyboard focus while starting a match

Starting practice or a 5v5 match disables every menu button while the new match
is being saved. Focus previously fell outside the dialog. The start flow now
focuses the dialog container and announces **Starting match…** through a status
region, keeping keyboard users oriented while controls are unavailable.

Both modes reproduce the original focus failure. Their final probes hold the
actual HUD start action pending, check the loading announcement and Tab in both
directions, then reject the action. The old world stays byte-identical with no
game commands. Recovery retains the existing dialog-container focus policy;
Tab reaches Close, Resume and Save in order.

The initial post-fix probes incorrectly expected Resume to be focused directly
after recovery. Both pending-focus/status checks passed, but that new expectation
failed in a seven-pass/two-failure batch. The corrected probes preserve every
pending assertion and check the intentional container focus plus full navigation.
No application change was made for that probe correction. The final nine-case
batch passes, including existing import, HUD Tab, Space and modal coverage.

TypeScript, all 16 Node QA checks and the build pass. Pack
`1ba020013994733d8bc4f11dc43ec3a313492d4e93e0d4e8b74b80af874a9377`
contains 1,202 files / 538,092,904 bytes. Schema 163 and rules fingerprint
`1a1c286c5148bc1fef511cbf6ac28915e3638c0cd8834faed99ee2bc10fbb7d6`
are unchanged.

The compiled keyboard audit holds a native IndexedDB completion callback after
the real write of a new Lux lane match, checks pending focus/status, releases
the callback, then checks the exact restored snapshot, champion, clock and
exported file. Its existing import path and all 25 previous assertions remain
in order; the expanded audit has 37 assertions and no development game hook.
The compiled audit passes with no page errors, failed requests or requests
outside the static-host prefix. The
[verification ledger](reference/match-start-focus-verification.json) records
that targeted production result, five captures, source freezes and pause/resume
intervals for the owned match cohort.

Full-unit, 32-scenario production and full-offline acceptance are inherited from
the [preceding rendering checkpoint](GROMP-ATTACK-COLOR.md), with 3,379 passing
unit tests and two unchanged baseline failures. Those results belong to pack
`556315eb1be84a02ce411b2e5aa339a80c0990e5913b80f6820f8e9e206edf88`;
they were not rerun for this focused UI change. The 1,125 source asset/data file
sizes and mtimes and all 539 simulation input hashes remain unchanged.

```sh
npx playwright test e2e/match-start-focus.spec.ts e2e/import-focus.spec.ts e2e/modal-focus.spec.ts e2e/input-hud-tab.spec.ts e2e/input-space-key.spec.ts --workers=1
node tools/qa/production-hud-keyboard.mjs --output-dir .cache/fresh-start-focus
```

The recorded cloud run uses system Chromium/SwiftShader through a private copy
with only the Chrome launch configuration changed. It does not establish
physical-device performance or completion of the running 100-seed cohort.
