# Current production offline checks

The `e20bdc…` / schema-163 production pack
`32a7a17b97102aeca703c6fb2e5f674d18633a1e56231c463b8c4dd5bc606843`
passes fresh offline checks under `/nested/rift/` in system Chromium
155.0.8059.79. It contains 1,204 files / 551,659,880 bytes.

The full-pack audit verifies every built file, then uses actual application
controls for corrupt-download rejection, retry focus, cancellation with verified
files retained, reuse without redundant downloads, preserved focus on completion,
network-off startup at the saved paused tick, pack repair and a new offline Lux
lane match. Removing the pack retains saved match bytes. An isolated two-version
deployment verifies refusal with another tab open, explicit offline activation,
old complete-pack retention, missing-entry readiness revocation and scope-only
removal. It sees 978 service-worker responses and no page errors.

The completed-match check takes ordinary seed 26018's natural Blue victory at
tick 169,837 (47:10). While offline, the production UI previews and imports the
snapshot, shows Victory at the exact clock, downloads exact match bytes, reloads
and downloads those exact bytes again. It sees 975 service-worker responses and
no page errors, failed requests or requests outside the host prefix. The source
report, source snapshot and manifest remain unchanged. The reviewed screenshot
shows the completed-game panel and accessible replay/export controls.

Reproduce against this matching build, with fresh output names, serially:

```sh
node tools/qa/offline-pack.mjs unique-run-name --system-chromium
node tools/qa/offline-completed-match.mjs --system-chromium \
  --output-dir artifacts/unique-completed-offline \
  --report .cache/current-e20bdc-ordinary/seeds/26018/report.json
```

The [verification ledger](reference/e20bdc-offline-verification.json) pins raw
reports, scripts, captures and exact exports. Prior offline/production records
retain their original packs and scopes. These checks cover offline delivery and
completed-state handling, not full browser-match simulation, native fidelity or
hardware performance. The current ordinary 100-seed simulation regression is
running separately; it is not yet accepted or complete.
