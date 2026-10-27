# Reuse Gromp source curve views

The Gromp death sampler now prepares its scale, color and rotation curve views
once when its static source module loads. Previously, each sampled channel
rebuilt a time array and a value array from the same keys. Those arrays were
recreated for each particle, corpse and seek. The views borrow the source value
tuples and are read-only to the sampling functions.

Sampling order and arithmetic are unchanged. Empty curves retain their unit
fallback; rotation accumulation uses the same keys and local reconstruction
grid. Every returned particle field remains exact against the frozen source
graph at `4ebf87e10cabf9f7eeafc94929b9486165cc5b79`. Its source-and-lockfile
archive SHA256 is
`46af3e7b372318b0a65cf692fd4a7b015a0c0b2697f8c9a3c2c7ce359b70b5c5`.
The retained comparison covers 6,507 calls and 314,704 particle states, including
255,500 non-Ray states and 59,204 Rays.

Forty controlled fixtures cover four IDs and ten burst/tail ages. Both Node and
browser measurements verify the complete fixture outputs, count `Array.map`
results separately, warm both samplers, alternate measurement order and compare
seven trial pairs of 2,000 calls. Timed output checksums remain exact.

| Measurement  | Before median | Prepared views median | Less sampler CPU time |
| ------------ | ------------: | --------------------: | --------------------: |
| Node 24.19   |     728.46 ms |             463.99 ms |                 36.3% |
| Chromium 154 |     742.20 ms |             484.50 ms |                 34.7% |

For the 224-particle birth fixture, counted map-result arrays fall from 5,788
to 2,540: 3,248 fewer per sample. These are counts of `Array.map` results,
not all allocations or bytes. Preparing the static views has a small one-time
module-load cost outside these steady-state measurements. The timings measure
sampler CPU work, not rendering, full-world throughput or game FPS.

The browser acceptance also checks all eight layers, exactly eight effect
draws, posed attachments, fog, exact Save/reload buffers and disposal. The two
Ray batch calibrations retain 168 nonempty pixel cases with zero differing
channel bytes. Asset/data files and source sampling values remain unchanged.

```sh
node tools/qa/benchmark-gromp-curves.mjs --output-dir .cache/gromp-curve-benchmark-new
node tools/qa/verify-gromp-ray-packets.mjs --output-dir .cache/gromp-curve-states-new
npx playwright test e2e/gromp-curve-views.spec.ts e2e/gromp-death.spec.ts e2e/gromp-ray-packets.spec.ts
```

The active packet verifier's limitation text now identifies unresolved live
texture binding, UV routing and sampling. The separately checked
[fallback DDS contents](LEGACY-PARTICLE-DEFAULT-TEXTURES.md) are already known.
Native curve arithmetic and draw-specific modifiers remain separate fidelity
work; this optimization changes neither.

Acceptance records 3,140 passing unit tests out of 3,142 across 395 files,
with the same two baseline failures. All 24 focused tests, TypeScript, six
Node QA checks and five browser cases pass. All 543 asset/data files preserve
their bytes and modification times. Production passes 32 recordings, eight
fresh screenshots and no unintended private-asset preloads. Save schema 163
and the ruleset fingerprint are unchanged. The
[verification ledger](reference/gromp-curve-views-verification.json) records
the final source identities, benchmark samples and acceptance evidence.
