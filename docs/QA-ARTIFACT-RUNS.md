# Preserved browser QA artifacts

Production subpath and Baron preview tools accept an optional unique run name;
omitting it uses a timestamp. Each preflights its screenshot/report paths and
reserves an exclusive `.claim` before browser work. Successful runs keep that
claim and write a fresh report. Failed runs keep their reservation too: retry
with a new name instead of replacing earlier evidence. Names permit lowercase
letters, numbers and hyphens only.

```sh
node tools/qa/production-subpath.mjs --system-chromium my-production-run
node tools/qa/baron-particle-preview.mjs my-baron-preview
```

Production writes `artifacts/production-subpath-<run>-*.png` and `<run>.json`
under its prefix; preview uses `artifacts/baron-preview-<run>-*.png` and report.
The production report also measures unwanted Baron effect-file requests, alongside
the earlier rig requests. The full named production run passes with both at zero;
the claimed preview draws all 21 emitters. Manual guard probes confirm claim
collision/path traversal rejection and unchanged bytes of an existing preview.
See reference/qa-artifact-run-verification.json.

Historical fixed-name receipts are not relabeled. Some older preview artifacts
were overwritten before the namespace fix and remain historical hashes.

## Current build integrity

`npm run offline:verify` (or `node tools/qa/verify-current-pack.mjs [dist-directory]`) audits the current
manifest, every file extent/hash, complete directory closure, policy hash,
pack identity and exact generated worker. It rejects symlinks, duplicate or
traversing paths and unlisted files. It writes only its JSON result to stdout;
it does not replace historical acceptance receipts or certify browser behavior.
Ten isolated tests cover valid output and nine rejection cases.
