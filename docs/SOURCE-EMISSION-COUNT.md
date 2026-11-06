# Source emission count kernel

`sourceEmissionCount` implements the pinned external count arithmetic after a
caller has resolved the rate. It retains 16-bit count wrapping, the 0.33-rate
burst cap, first-spawn minimum, single-particle burst, trail cap, 1,000-per-step
cap, segment remainder and current-cycle start. It does not mutate the inputs.
A caller updates lastSpawn only after a positive spawn, dropping that spawn's
fractional remainder rather than accumulating a fractional particle budget.

The caller must gate disabled/absent emitters, repeated single bursts, delay,
end time, active periods and stop ownership. Rate curves, probability, flex and
quality are resolved before this kernel. No existing Lux sampler changes.

The fixture generator verifies the pinned external emit.ts SHA-256
`2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58`
at LeagueToolkit revision `2adda384347dd43e76d6295d77fe1f13623b2808`.
It extracts the selected external functions using the TypeScript AST, without
rewriting their bodies or importing the application kernel. Only the rate
resolver is replaced with a supplied constant; scheduling and native execution
are not claimed. The camera-segment enum remains the pinned value 9.

All 86 cases pass: 72 independent count samples, three 60-step replays, exact
fixture regeneration and ten input guards. See
`artifacts/source-emission-count-tests.log`. Reproduce fixtures with
`node tools/assets/export-source-emission-count-samples.mjs --check`.
