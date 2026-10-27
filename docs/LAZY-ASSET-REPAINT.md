# Repaint after lazy effect preparation

When a private effect pack finished loading while the match was paused, its
renderer could remain absent until the next interaction. The paused application
paints once and sleeps; completing an asynchronous loader previously installed
the renderer without requesting another frame.

All 29 lazy effect loaders now expose an optional completion callback. They
notify after successful renderer installation. A disposed loader does not
install or notify. Concurrent callers still share one preparation promise;
repeated calls after completion do not notify again. Failed preparation keeps
its existing retry policy and does not issue a completion notification.

`GameView` connects these callbacks to its optional `onAssetsReady` handler.
The application forwards it to the existing frame request function. A running
loop coalesces requests. While paused, the frame paints without advancing the
simulation and sleeps again. Hidden documents and graphics interruptions retain
the existing frame-request guards. This adds no polling timer or permanent loop.

The real Garen R regression blocks its four mesh requests while all other Garen
loaders finish. After their paints drain, it releases the R assets without user
interaction or the development repaint hook. The effect must appear after
exactly one new frame, the world tick must remain frozen, and two subsequent
animation callbacks must observe the same frame counter. Strict request counts
remain one module, four distinct meshes and two distinct kill textures. Ordinary
Ashe startup still requests none of those resources.

Unit coverage checks shared promises, deferred completion and notification order
for every lazy loader; it also checks all six disposable loaders and explicit
retry after failure. These checks exercise the actual loader classes with
controlled preparation promises. No saved fields or source particle values are
changed.

Acceptance records 3,140 passing tests out of 3,142 across 395 files, with the
same two baseline failures. All 49 focused tests, TypeScript, six Node QA checks
and ten browser regressions pass. The gated R case advances the render counter
from 20 to 21, then stays at 21, while the world remains at tick 91. Those
fixture values document this run rather than native timing. All 543 asset/data
files retain their bytes and modification times. Production passes 32 recordings,
eight fresh screenshots and no unintended private-asset preloads.

The [verification ledger](reference/lazy-asset-repaint-verification.json) retains
the final sources, controlled browser evidence and production acceptance. Save
schema 163 and its ruleset fingerprint are unchanged.
