# Frozen normal-rules match cohorts

`tools/qa/match-cohort.mjs` runs independent seeds in separate Node processes.
The default plan is 100 distinct seeds: the four historical anchors (26018, 719,
1 and 927), seeds 2–94 and three uint32 boundary values. Four processes run at a
time. Every match keeps the normal 60-minute diagnostic horizon; the clock,
rewards, damage, AI tactics and victory conditions are unchanged. A horizon
stops the audit and retains an unfinished match. It never awards a winner.

The default roster remains six Ashe/four Lux with five roles on each team. The
human bottom-lane Ashe is automated only for QA, using existing bot decisions.
This tests the current interim match foundation; it cannot certify the target
six-champion roster, balance, natural human play or native audiovisual fidelity.
The full project's completion standard is unchanged.

The private combined profile is available with `--development-roster`. It uses
Garen top, Master Yi jungle, Ashe carry and Leona support on both teams, with
a QA-automated human Lux mid against Ahri mid. It enables only the existing
private roster gates; ordinary simulation rules and victory checks remain in
force. `--development-leona` retains its separate support profile. The two
flags are mutually exclusive. See [combined cohort validation](COMBINED-ROSTER-COHORT.md).

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
three map inputs and archives every pinned source under `frozen-source/`,
then pins all simulation/content dependencies, QA sources, runtime
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

## First run and corrections

The first frozen plan stopped after eight seeds: six passed and two exposed
save-state failures. Its 92 queued seeds were not counted as executed. See
[the findings and controlled replays](MATCH-COHORT-FINDINGS.md). A corrected
cohort must restart with the complete seed population under the new fingerprint;
old and new runs are not combined into a passing 100-seed result.

## Completed corrected baseline

The corrected `6466566…` baseline completed all 100 seeds: 70 victories,
30 unfinished horizons and zero invariant failures. Its independent verifier
passed before later source edits, and its exact source inputs are archived.
See [the complete results and bot approach correction](NORMAL-COHORT-RESULTS.md)
for duration/censoring details, retained evidence and the distinction between
that completed baseline and the subsequent runtime fingerprint.

## Optional lossless snapshot compression

Pass `--snapshot-compression gzip` to store checkpoints and final snapshots as
`.match.json.gz`. Plain JSON remains the default, with its existing descriptor
shape. The frozen plan records the codec and zlib version. Each compressed
artifact records both its stored-byte hash and decoded-state hash, plus both
byte lengths. Verification checks those pins and the exact decoded JSON before
restoring the world; restore and future checks use bytes read from disk.
Unknown codecs, mislabeled filenames and corrupt artifacts are rejected.

The full seed-1 development-roster validation at source `52d959b9` finished with
a blue victory at tick 157,116: 44 restores and 43 future checks (2,580 ticks).
All 45 decoded artifacts, including the final state, are byte-identical to the
accepted uncompressed noise run. Storage fell from 16,680,648 to 1,592,845 bytes.
This is a single-seed storage validation; the current hundred-seed gate remains
false until a separate complete audit passes.

`inspect-cohort-horizon.mjs` accepts either plain or gzip snapshots through the
same verified codec. It requires a frozen seed ledger and verifies each pinned
unfinished report before sampling counters and nexus HP. Compressed final-state
descriptors, stored hashes, decoded extents and state hashes remain mandatory.
The diagnostic output pins the stored artifact bytes. It reads archived states
without replaying them or changing any outcome; minute samples do not establish
causal AI behavior. Fourteen reader tests pass, and the two actual two-minute
plain/gzip smoke archives produce identical observations.

Independent final verification also requires every summary report to equal its
worker report, every minute/terminal checkpoint to be present in order, and the
last checkpoint to equal the final saved state. Future-check counts and tick
coverage must match the available post-checkpoint intervals, including a victory
less than 60 ticks after a minute boundary. Victory/unfinished totals and the
reported completion rate are checked against the individual outcomes. Fifteen
verification tests include resealed omissions, reordering, duplicates, invented
futures and summary disagreements. The unchanged historical 100-seed schema-167
archive passes these stronger checks, including four partial final probes.

## Verification ledgers

Add `--output` to final verification to produce a ledger after all checks pass:

```sh
node tools/qa/verify-match-cohort.mjs /path/to/completed-cohort --output artifacts/cohort-ledger.json
node tools/qa/inspect-cohort-horizon.mjs /path/to/completed-cohort artifacts/cohort-ledger.json artifacts/horizon-diagnostics.json
```

Use `--historical` explicitly for an older source revision. The ledger records
plan, summary and per-seed report hashes, exact outcomes and coverage, the
verification tool/runtime identities, and the unfinished seed list consumed by
the diagnostic reader. Plan, summary, reports and verifier bytes are rechecked
before writing. Without `--output`, verification keeps its concise JSON stdout.
The output must be fresh and outside the immutable cohort, including through
parent-directory symlinks; its parent directory must already exist. Unknown
flags and additional cohort arguments are rejected. A failed verification
creates no ledger, and an existing output is never overwritten.

## Live process observations

```sh
node tools/qa/inspect-cohort-progress.mjs /path/to/cohort
```

This read-only command checks the frozen runner pin, reads recorded completion
counts, and observes matching supervisor/worker processes through Linux `/proc`.
A stale `running` status with no observed owner reports `processStatus: stopped`.
The command also sees newly dispatched workers before the next parent status
write. A worker must execute the frozen runner as its actual Node entrypoint;
shell command text and a runner path supplied as ordinary data do not qualify.
Minute progress is sampled separately, with its age; truncated or inconsistent
samples are labeled invalid rather than treated as a verified tick. Recorded
status, observed process state and summary presence remain separate. This tool
never restores worlds, changes evidence or performs final invariant verification.
