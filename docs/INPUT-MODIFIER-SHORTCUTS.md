# Keep browser modifier shortcuts out of game commands

Ctrl/Alt/Meta letter chords no longer enter the game's ordinary keyboard
dispatcher. Previously Ctrl+F, Meta+F and Alt+F reached the Heal shortcut and
queued a cast while leaving the browser's default handling available.

Ctrl+Q/W/E/R remains the explicit learning exception. During active gameplay,
its default action is prevented even on repeated keydown, but a learn command
is enqueued only for the first keydown. Paused/modal input keeps its existing
browser pass-through. Text-entry fields and ordinary game keys retain their
existing behavior.

The isolated browser regression uses the actual input class and real modifier
chords. It records delivered key events, default prevention, commands and audio
activation requests. Three original failures retain the unintended Heal
commands. Corrected checks cover Ctrl/Meta/Alt+F, all four learning chords,
normal F and paused behavior. Synthetic repeats exercise default prevention
without repeatedly asking the browser to close or reload its own tab if the
reservation regresses.

```sh
npx playwright test e2e/input-modifier-shortcuts.spec.ts e2e/spell-learning.spec.ts
```

The [verification ledger](reference/input-modifier-shortcuts-verification.json)
records fresh browser/type/build checks and inherited full-unit/production
certificates. This is local browser/input validation, not a native-client
keyboard comparison. No simulation, asset or save-schema change is needed.

The ward command-boundary fixture now renders its complete initial scene and
holds continuous rendering while testing input dispatch. All input steps,
assertions and its 120-second deadline are unchanged. Two earlier deadline
failures are retained; the initial batch passes seven other cases. Acceptance
reports passing runs across batches, rather than a clean eight-case batch.
Actual rendered game-flow and packet comparisons remain separate checks.

Fresh acceptance passes TypeScript, eight Node QA checks, the build and the
focused compiled-entry controls/audio check, with no page errors, failed
requests or requests outside the host prefix. All eight distinct browser cases
have passing runs across batches. All 543 asset/data files retain their bytes
and modification times; schema 163 and the ruleset fingerprint are unchanged.
