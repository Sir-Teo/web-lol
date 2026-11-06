# Source emitter timing window

`sourceEmissionWindow` preserves the selected external reader's emitter timing:
absolute delay/end, unwrapped and unclamped phase, active-period comparisons,
single-particle lifetime rewrite and capped emitter linger measured from system
start. A zero-length period with an active window stays inactive. The caller
supplies the already resolved maximum particle lifetime and gates disabled,
absent and already-emitted single emitters separately. Native scheduling and
stop ownership are not certified by this helper.

The fixture generator runs selected external functions unchanged from pinned
`systemModel.ts` SHA-256
`20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad`,
LeagueToolkit revision `2adda384347dd43e76d6295d77fe1f13623b2808`.
Its 168 cases cover boundaries, negative ends, zero spans, delayed singles,
material overrides, never-expiring lifetime, periodic windows and stop caps.
Every phase is also retained as raw float64 bytes, including negative zero.
An initial JSON-only fixture lost that sign; the initial record/log remain in
cache/artifacts and the corrected checks compare the original phase bytes.

All 179 clock tests and 86 count tests pass (265 total); TypeScript passes.
See `artifacts/source-emission-window-verified-tests.log` and reproduce with
`node tools/assets/export-source-emission-window-samples.mjs --check`.
These independent fixtures never import the application kernel. No active
renderer or existing champion emitter changes in this step.
