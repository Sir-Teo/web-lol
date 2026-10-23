# Frozen normal-rules match cohorts

`tools/qa/match-cohort.mjs` runs independent seeds in separate Node processes.
The default plan is 100 distinct seeds: the four historical anchors (26018, 719,
1 and 927), seeds 2–94 and three uint32 boundary values. Four processes run at a
time. Every match keeps the normal 60-minute diagnostic horizon; the clock,
rewards, damage, AI tactics and victory conditions are unchanged. A horizon
stops the audit and retains an unfinished match. It never awards a winner.

The current roster remains six Ashe/four Lux with five roles on each team. The
human bottom-lane Ashe is automated only for QA, using existing bot decisions.
This tests the current interim match foundation; it cannot certify the target
six-champion roster, balance, natural human play or native audiovisual fidelity.
The full project's completion standard is unchanged.

## Reproduction

```sh
node tools/qa/match-cohort.mjs --output .cache/match-cohort/<unique-name>
node tools/qa/verify-match-cohort.mjs .cache/match-cohort/<unique-name>
```

Use `--jobs 1..8` to limit parallelism. Explicit seed arguments and `--minutes`
allow short harness diagnostics; fewer than 100 seeds or a non-60-minute horizon
cannot satisfy the hundred-seed invariant flag. Existing output directories are
rejected. Do not rerun into a frozen result directory.

The launcher builds an immutable SSR bundle with npm dependencies included and
without loading the application's production/offline-pack config. It copies the
three map inputs, pins all simulation/content dependencies, QA sources, runtime
and runner bytes, then starts the workers. Restored checkpoints use fresh terrain
objects and independent navigation buffers. Do not edit runtime, tests or assets
while the cohort is live. Even after a stop request, verify the actual process
handles have exited before changing source. Source hashes and the frozen input
copies allow later results to retain their original meaning.

## Checks and evidence

- Every tick: finite positions, bounded health/mana, ten unique champions and
  bounded champion gold/levels.
- Every structure damage application: an independent dependency predicate checks
  that protected buildings cannot lose health. It does not call the gameplay
  predicate it is checking. A fault-injection test deliberately breaks that
  predicate and verifies the audit catches the resulting protected damage.
- Every minute and at victory: strict snapshot decoding and exact round-trip
  equality. Every checkpoint is retained with both file and canonical-state hashes.
- After a minute checkpoint: original and restored matches run the same next
  60 ticks using their own terrain objects, then compare exact snapshots. A
  terminal result before that deadline also compares; the horizon itself is not
  advanced beyond the requested match clock.
- At victory: exactly the losing Nexus, both losing Nexus turrets and an open
  inhibitor must be destroyed. Extra step attempts must leave the terminal
  snapshot unchanged.

Reports retain per-minute champion/role/order samples, accepted building damage,
destruction events, final checkpoints and explicit failure details. An invalid
snapshot retains a raw diagnostic state. Parent status writes are atomic; live
progress files are transient until the owning process ends. Completed reports
and earlier runs are never reused or overwritten. `status.json` is a summary,
not proof that a process is alive or stopped—use the actual tool/process handle.

A failed seed stops further dispatch by default while already running workers
drain normally. The remaining seeds stay explicitly queued. `--keep-going`
retains all requested failures instead. Any infrastructure or invariant failure
prevents a green invariant flag. Unfinished horizons are counted separately and
are not silently removed from completion statistics. Duration percentiles apply
only to victories; unfinished matches are censored at the horizon.

`hundredSeedInvariantGate` certifies only execution and invariants for this frozen
interim roster. `roadmapMilestone4Complete` remains false: the complete roster,
quests/objectives, role quality, browser/offline full-length matches, performance
and native comparison requirements remain open. A completed 100-seed run must be
repeated after relevant match-rule or roster changes.
