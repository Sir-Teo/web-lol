# Offline download keyboard focus

Starting a game-pack download now focuses Cancel download when the original
Download button becomes disabled. Completion, cancellation or verification failure
returns focus to the enabled download/retry control if Cancel still owns focus.
If the player moves to another control, completion preserves that focus. Leaving
the dialog continues to dispose the panel without moving focus back into it.

The original compiled UI reproduced the missing handoff: the newly visible Cancel
button was not focused. The repair changes only focus management, preserving
pack verification, cache state, progress, cancellation and all game rules.

The production offline audit now checks verification-failure focus, keyboard
cancellation with Enter, restored retry focus and preservation of Back-button
focus across a full download. Its original integrity, cached-file reuse, saved
pause/offline restore, new Lux lane match, scoped removal and two-version atomic
activation checks remain intact.

```sh
npm run build
node tools/qa/offline-pack.mjs offline-keyboard-new
```

The [verification record](reference/offline-keyboard-focus-verification.json)
retains the original failing assertion, source freezes, compiled pack identity,
full offline reading and inherited broader application checks. Software-browser
acceptance does not certify physical GPU performance or native game appearance.

The fresh full production offline audit passes all four focus checks and every
original pack/cache assertion, with 978 service-worker responses and zero page
errors. TypeScript, all 14 Node QA checks and the build pass. The exact pack is
`9c1d6b224cb5d205b36e71557ad0dd06ca092b81cd2472ae256df3219aaf1f9f`
(1,202 files / 538,092,294 bytes). All 1,125 public asset/data sizes and modification
times and all 539 cohort source pins remain unchanged. The broader unit and
32-scenario production results are inherited at their earlier recorded identities.
