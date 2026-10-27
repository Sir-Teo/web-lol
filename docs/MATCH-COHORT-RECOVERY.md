# Recovering an interrupted immutable match cohort

`resume-match-cohort.mjs` continues an interrupted format-1 cohort without
changing its simulation, frozen worker, map inputs or final verifier. It retains
accepted terminal results, archives interrupted output and starts only the
remaining seeds. Interrupted workers restart from zero because the frozen
worker has no resume mode; their earlier checkpoints and logs remain available.

Run the tool from the current repository, pointing `--project` at the original
checkout whose source files still match the cohort's pins:

```sh
node tools/qa/resume-match-cohort.mjs --output /path/to/cohort --project /path/to/frozen-checkout --check
node tools/qa/resume-match-cohort.mjs --output /path/to/cohort --project /path/to/frozen-checkout
```

The check is read-only and does not reserve the cohort. A live supervisor or
worker causes refusal, including a paused process. Normal launch repeats
preflight under an exclusive OS lock, writes recovery evidence, starts a
detached supervisor and returns after its startup receipt. Linux `/proc` and
util-linux `flock` are required. The recorded Node, V8, platform, architecture
and CPU identity must match. The plan, source pins, worker, maps and accepted
reports must also match.

The supported canonical controller is pinned by SHA-256
`23d32770882f4c6958326b7bf9e44931a45cfd3ed867276ba06ab25185ea7c45`.
The tool rejects an unknown controller rather than wrapping unverified code.
Its generated supervisor keeps the canonical dispatch/invariant tail byte-for-byte.
The recovery preamble supports completions arriving out of order: accepted
seeds precede pending seeds in its local dispatch list, while the original plan
and pending order remain unchanged.

Recovery never retries a recorded failure. An unaccepted worker report that
records failure also causes refusal. A terminal result absent from the saved
supervisor state has no accepted worker-exit record; it is retained as an
unconfirmed attempt and rerun from zero. Negative/incomplete tick coverage,
incompatible runtime metadata and invalid terminal winners are rejected.

Recovery receipts and archived attempts live below the cohort's `recovery/`
directory. Accepted report bytes are copied and left intact. The tool verifies
archived bytes after each move. A partial move failure rolls performed renames
back and retains a failure receipt. Symbolic-link directory redirection is
rejected. OS locking prevents duplicate preparation, and `/proc` ownership
checks also protect older supervisors that do not use the new lock.

A cohort whose results all completed but whose final summary is missing can
recover the canonical summary without rerunning any seed. The final invariant
gate still uses the unchanged `verify-match-cohort.mjs`; recovery is explicitly
recorded and does not imply uninterrupted execution or a completed 100-seed gate.

Thirteen new control-plane tests pass. They cover refusal and preservation,
out-of-order completion, exclusive locking, detached startup, unknown controller
formats, invalid terminal metadata, missing-summary recovery, symbolic links
and rollback after an injected I/O failure. These use synthetic worker fixtures;
they do not certify game outcomes. All 29 Node QA checks pass. A read-only check
against the live original cohort correctly refuses duplicate ownership and
leaves its plan and 65 accepted reports unchanged.

The first end-to-end fixture exposed a generated preamble name collision with
the canonical `launch` function. The corrected preamble has a distinct name,
and generated code now receives a syntax check before evidence moves. Failed
fixtures are retained for diagnosis; the retained reproduction and passing
artifacts accompany the verification record.

This is a QA-only change. The accepted Ahri application identity is inherited:
schema 163, rules fingerprint
`c722d7ca3bb84c44a976e8c72eb57887b4d6a9ba529844a795ac080766139b62`,
pack `5aff35be26d9be78e6f660f7eb1b6af5112024b90622034aa3b0f2ab933eced2`
(1,202 files / 538,093,442 bytes). No new application, browser, native visual or
device performance acceptance is claimed. The original live cohort continues
under its earlier checked recovery supervisor; the new tool was not used to
restart it again. Evidence is retained in the
[verification ledger](reference/match-cohort-recovery-verification.json).
