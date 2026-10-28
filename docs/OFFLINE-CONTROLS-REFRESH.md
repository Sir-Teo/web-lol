# Offline verification after the camera-control changes

The rebuilt game at `61d4dd7` passes fresh offline-pack and completed-match
checks under `/nested/rift/` in system Chromium 154.0.8037.57. Its pack is
`180aadb3005305d4982afdacd9328e58b8b98fc302203f3bffc703a49c8d710e`,
with **1,202 files / 538,110,595 bytes**. Schema stays 163 and the simulation
fingerprint stays
`abc8dc664ed97c0f0cfac64e4eb52b43dbbc593884a6896a47b1e8e0d34bd04f`.

The production-pack check independently hashes every built file before opening
the application. The actual UI then exercises corrupted-download rejection,
retry focus, cancellation with verified files retained, retry without redundant
download, focus preservation on completion, offline startup at the exact saved
paused tick, pack repair, a new offline Lux lane match, and removal that keeps
saved match bytes. It observes **978 service-worker responses** and no page
errors. A separate two-version fixture verifies refusal while another tab is
open, explicit atomic switching offline, revoking readiness for a missing entry,
and cleanup limited to its own cache scope.

The completed-match check uses the previously independently verified ordinary
seed-26018 game from the team-detour corpus. Its natural Blue victory is at
**tick 169,837 (47:10.616)**. The input report and save hashes are pinned. After
downloading the same production pack and disabling network access, the UI
previews that outcome, imports the actual file, displays Victory at 47:10,
and exports the exact state. Reloading offline preserves the exact stored
state and produces another byte-identical export. The source report, save and
pack manifest remain unchanged. This check observes **973 service-worker
responses**, with no page errors, failed requests or requests outside the
nested game prefix. The production development hook is absent.

The four retained captures were visually reviewed: ready-pack controls,
paused offline Lux match, completed-file preview and restored Victory dialog.
The [verification ledger](reference/offline-controls-refresh-verification.json)
pins reports, exports, captures, logs, tools, application sources, manifest and
the resumed quiet-check pause receipt. Both 100-seed audits continue from their
unchanged frozen source. This refresh checks offline delivery and completed
state handling; full browser match simulation, hundred-seed completion, native
fidelity and performance retain their separate gates. Earlier broad/Node QA
results retain their original scope. No application code, assets or saved
fields change in this evidence-only step.

Reproduce against this matching build with fresh outputs:

```sh
node --import /tmp/web-lol-chromium.mjs tools/qa/offline-pack.mjs unique-run-name
node tools/qa/offline-completed-match.mjs --system-chromium \
  --output-dir artifacts/unique-completed-offline-run \
  --report artifacts/team-detour/ordinary-two/seeds/26018/report.json
```

The retained `artifacts/offline-controls-abc8dc/system-chromium.mjs` is a copy
of the local launch override used for the first command. It selects the system
executable without changing the repository's browser configuration. The second
command supports that selection directly. Run these gates serially without
competing headless match workers. Historical offline verification ledgers and
their pinned scripts keep their original revisions and pack identities.
