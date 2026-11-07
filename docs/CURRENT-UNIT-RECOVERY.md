# Full unit results and reference restoration

The latest primary run uses application `cabb9791`, schema 181 and ruleset
`e02f3e73`. Its resolved result is **10,152/10,154 tests across 611 files**;
the full unit gate remains open for the same historical Leona-input and
Lux-digest failures described below. One additional five-second wave-clock
deadline failure passed the unchanged nine-test focused retry after a recorded
9.74-second pause of the three audit workers. The original failure, retry and
pause/resume evidence are all retained in the
[current unit verification](reference/current-production-unit-verification.json).
No expected digest or test deadline changed.

## Earlier source-cache restoration checkpoint

The following records the earlier schema-163 run and its exact input recovery;
its test counts and production scope describe that historical checkpoint.

The current full run passes **3,761 of 3,763 tests across 427 files**. Two tests
still fail, so the full unit gate remains open. All new source/camera-trail and
static-emission tests pass. Commands use Node 24.22.1 and two Vitest workers,
while the separately frozen ordinary match cohort runs with two workers.

The first run passed 3,756 tests with seven failures. Restoring the exact pinned
Wwise checkout, Garen source banks/WEMs/passive BINs and distortion evidence
closes five missing-input failures. The four Garen/Leona audio-source files pass
all 23 focused tests; the unchanged distortion suite passes all three cases.
The subsequent full run confirms only the two existing gaps remain.

Recovery uses the existing `restore-reference-cache.py --garen` and
`particle_distortion_recovery.py` commands. Wwise is checked out cleanly at
`71654ed1a2c4642894bd7e7ed79eba66986fb770`. All three LLVM packages match the
previously pinned package bytes and hashes; local extraction restores exact
Clang 21.1.8/library identities without system package installation or maintainer
scripts. This run checks their existing identities, not a fresh package-signature
audit. Fifteen compiler runs reproduce every historical distortion disassembly
hash; all 53 canonical shader payloads verify. Complete-cache replay verifies
without a compiler or network. Neither Metal code nor a game client executes.

The remaining Leona test requires an absent historical checker and other
original retained native inputs, starting at
`.cache/leona-attached-skin-reflection-reading-v1-20261024/check.py`.
Reconstructing differently named or approximated evidence would not satisfy its
exact identity gate. The Lux test expects 24 sampler snapshots to hash to
`09b53b57121711b36aef97f538295b21e5f04e53bcbfb34cde19450118d628df`;
the current runtime produces
`4258cc67eef3b42afb26960a816f30a9237f2c203a3040e0acf3afb364580f9a`.
Its expected value is retained. Earlier Node-version probes also failed to
reproduce the expected digest; no runtime switch is claimed to fix it.

The [verification record](reference/current-unit-recovery.json) pins both full
logs, focused logs, recovery/replay receipts and toolchain identities. Assertions,
expected hashes, deadlines, application sources and public assets are unchanged
by this recovery. Schema 163 / `e20bdc…` remain current. Production/offline
results retain their earlier exact pack identities; the running 100-seed cohort
is a separate invariant gate and is not yet complete.
