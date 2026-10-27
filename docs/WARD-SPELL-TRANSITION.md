# Clear a ward preview when a spell replaces it

Pressing an instant spell while previewing a ward now clears the ward reticle
and aiming cursor. Previously, spell keydown cleared the ward-gesture flag but
left the view in `ward` mode. Releasing 4 could no longer clear that stale
preview because the gesture flag was already false.

The input handler now uses its existing `cancelAim()` path when a spell
replaces an active ward gesture. It clears the gesture, view mode and cursor
together. Spell dispatch still uses the same point and validation. Other
held-spell transitions, attack-move policy and simulation rules are unchanged.

The real-input regression first fails against the accepted runtime: holding 4,
pressing F and releasing 4 queues Heal, preserves the single ward charge, but
leaves `aimMode` equal to `ward`. The corrected run checks both holding 4 and
clicking the trinket. Each queues only Heal, clears the preview and preserves
the charge. A fresh 4 gesture then queues exactly one ward placement.

The fixture holds simulation stepping at the command boundary so the test can
inspect accepted commands without depending on frame speed. It uses actual
keyboard and pointer input and the real input handler, HUD and renderer.
This is local UI behavior verification, not a native-client input comparison.

```sh
npx playwright test e2e/ward-spell-transition.spec.ts
```

The [verification ledger](reference/ward-spell-transition-verification.json)
retains the original failure, final source snapshots, command proofs, browser
regressions and broader acceptance results. No source asset or save-schema
change is needed.

The 49 focused unit cases, TypeScript and six Node QA checks pass. The full
unit suite records 3,140 passes out of 3,142 across 395 files, with the same two
baseline failures. Five browser cases pass, covering the new transition,
attack-move cancellation, Lux aim/recast behavior, focus interruption and
actual Rift ward placement through exact Save/reload. All 543 asset/data files
preserve their bytes and modification times.

Nested production validation passes 32 recordings, eight fresh screenshots and
zero unintended private-asset preloads. Save schema 163 and the ruleset
fingerprint remain unchanged.
