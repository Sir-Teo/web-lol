# Browser integration audits

## Current complete run: 221 scenarios and audio-resume repair

The final Chrome run passed **all 221 scenarios** in one complete run, with one worker and no retries, in 9.8 minutes. The baseline was `870badd`; final source adds the audio-resume repair described here. No files changed during this final run. The 612 source/simulation checks and nested-path production smoke also passed on the repaired source.

The initial complete run passed 219 of 220 cases and found a stale pause-menu focus expectation: it skipped the newly added Match files button. The test now checks every button in both forward and reverse Tab order. A subsequent run exposed a timing-dependent tooltip assertion after closing the shop with the pointer still over Volley. The browser can correctly send a fresh hover event when the button is uncovered; the test now moves the pointer away before closing to isolate clearing of old ownership. Both corrected UI cases passed five consecutive focused runs. These were test repairs, not removals of keyboard or tooltip behavior.

A later audit attempt found a real audio race: `GameAudio.update` advanced its event cursor while the context was awaiting `resume()`, silently consuming the arrival event before audio could play. The mixer now defers live event consumption during the asynchronous resume, while deliberate pause/mute continues to discard history. A deterministic delayed-resume browser case failed before the fix and now verifies unchanged event identity while pending, one source-buffer voice after resume, no duplicate voice on repeated update, and normal paused-history consumption. All nine audio cases passed before the final complete audit. Intermediate runs were explicitly stopped after their failures were diagnosed; none is counted as a successful full run.

The final all-source animation report again contains zero sampled matrix error across 16 rigs, 114 matching pixel comparisons and no failures. Fresh laptop, ten-champion scoreboard and full-Rift recovery-dialog screenshots were inspected. Expected asset/recovery fault injections and diagnostic module-import warnings remain in the raw log; this is not a blanket console-clean claim.

This is an integration baseline for the current implementation, not proof of a complete five-role match, native pixel parity, cross-browser deterministic replay, offline asset delivery or sustained full-match performance. See [final audit evidence](reference/browser-regression-221-verification.json).

## Earlier complete run after scoreboard and checkpoint integration

At runtime revision `b01bb24`, all **205 Chrome scenarios passed** in one complete run with one worker and no retries, taking 7.4 minutes. No source edits or repairs were made during this audit. This is the first full suite run since the constant bone-channel optimization, accepted-command pause repair and observed scoreboard level/CS/inventory integration.

The run covers the new scenarios together with existing combat, spell, animation, source asset, input, shop, vision, audio, recovery and save cases. The all-source animation comparison again measured zero sampled matrix error and 114 matching pixel comparisons. Fresh fixture, laptop and full-Rift recovery-dialog captures were inspected; controls were readable, and the recovery backdrop intentionally obscures the battlefield. Deliberate asset/recovery failure injections produce expected console diagnostics; the result is not a claim that every log line is error-free.

The current source hashes match the preceding 603-check and nested-path production-smoke verification. Those checks were not redundantly rerun in this documentation-only audit. The complete browser result replaces the older 201-case run as the current integration baseline. It still does not cover a finished production role match, native pixel parity, cross-browser parity, offline delivery or sustained full-match frame budgets. [Current complete-run evidence](reference/browser-regression-current-verification.json)

## Earlier mage-item audit and repairs

The complete Chrome suite was run from gameplay revision `40dbded` after the Lux kit, shields, independent slows, mage recipes, haste and Enlighten additions. The first run finished with 199 passing scenarios and two failures out of 201, using one worker and no retries. This broader pass found a real presentation-performance regression that the recent focused scenarios had missed.

## Findings and repairs

**Unchanged shield labels mutated the DOM every frame.** The existing `health-bar-updates` scenario observed 120 attribute mutations over 20 identical renders instead of zero. Shield rendering assigned `hidden` and `title` unconditionally, even when their values had not changed. The world-label renderer now compares those attributes before writing. The extended regression checks zero mutations both with no shield and with a shield exceeding current health, and verifies that shield width/title/visibility still update immediately when the shield is added or removed. Existing shield absorption and expiry coverage also passes. This is measured removal of unnecessary DOM work, not a claim of a quantified frame-rate improvement.

**Sapphire Crystal's icon assertion ran before lazy loading.** The shop scenario read `naturalWidth` without scrolling to the item or waiting for decode. The longer catalog leaves this row below the visible list. The test now scrolls to the actual item and polls its decoded width before clicking it. It retains the price, mana, gold, ownership and sale assertions. The product's lazy-loading behavior was not removed to satisfy the test.

**The renderer requested an obsolete shadow mode.** The installed Three.js 0.186.0 implementation in `WebGLShadowMap.js` warns and changes `PCFSoftShadowMap` to `PCFShadowMap` before rendering. The application now requests `PCFShadowMap` explicitly, preserving that effective mode and removing the repeated startup warning. Recovery and source-scene checks remain part of the complete suite.

## Scope and evidence

The suite covers local asset boot, input and focus, aiming, camera/elevation/picking, source actors and structures, minions, spell effects and timing, vision/brush, audio and fallback handling, equipment, HUD/tooltips, economy, saved-state continuation, graphics loss/recovery and terminal states. Its development fixture and full-Rift scenarios serve different purposes. Many scenarios deliberately inject asset failures, visibility changes or graphics loss; those expected diagnostics must not be counted as normal-path runtime failures.

Fresh full-Rift base and laptop captures were visually inspected in addition to DOM assertions. They showed no new missing asset or layout obstruction. Source assets are recognizable, but the custom HUD, remaining temporary effects and incomplete gameplay do not satisfy the native visual-comparison contract. This suite does not test a finished ten-champion role match, cross-browser parity, offline delivery or sustained production frame budgets. Passing it cannot certify those requirements.

Raw local logs are `artifacts/browser-regression.log` (initial run), `artifacts/browser-regression-fixed.log` (verification run), and `artifacts/browser-regression-production.log` (nested-path production smoke). The compact reference report records hashes and final outcomes; it distinguishes the initial failure run from verification of the repairs.

Final verification: all 201 Chrome scenarios pass in one complete run with no retries. The 595 source/simulation checks, three focused repair/shield cases and nested-path production smoke also pass. The obsolete shadow warning is absent from the verification log. [The compact verification record](reference/browser-regression-verification.json) pins the baseline revision, changed source hashes and both run logs.
