# Source lifetime settlement

`sourceLifetimeSettlement` handles one emitter's particles under the four
external linger modes. The default caps total lifetime rather than granting
extra remaining time; fixed modes can assign a remaining lifetime once.
Existing linger stamps remain unchanged. Simple emitters force the cap mode,
singles can finish after their burst, and material overrides retain the normal
end/stop test. Emission stops at age >= end; settlement finishes at age > end.
Stop waiting uses the emitter's absolute age, and the linger duration has its
own cap from the maximum particle lifetime plus ten seconds.

All 340 cases pass. The 336 independent fixtures execute selected external
settle/finished/clock/linger functions on a local float32 pool. They cover 28
policies, stop and natural-end boundaries, prior settlement, singles, overrides,
simple emitters, negative ends and unbounded lifetime. Every lifetime/linger
float32 byte and finished timestamp matches. TypeScript passes.
See `artifacts/source-lifetime-settlement-tests.log`; reproduce with
`node tools/assets/export-source-lifetime-samples.mjs --check`.

The helper copies state and particle fields. It settles only particles already
selected for one emitter; the caller owns selection, expiry retirement, linger
replacement curves and full system scheduling. The fixtures execute no native
client and certify neither native ownership/cadence nor visual fidelity.
No active renderer or gameplay changes in this step.
