# Lux E sampler portability audit

The existing first-fifteen-stream golden remains unchanged and unresolved. This
audit identifies a measured runtime math difference without replacing the golden,
rounding game values or changing the renderer.

For the same 24 role/seed/age snapshots, Node 24.19 / V8 13.6 produces SHA-256
`4258cc67eef3b42afb26960a816f30a9237f2c203a3040e0acf3afb364580f9a`.
Chromium 154.0.8037.57 produces
`dab2134a44fc98d065ec0a1e993c68fd844f3d4948b33a51c914fd3546d5abe0`.
Neither reproduces the retained
`09b53b57121711b36aef97f538295b21e5f04e53bcbfb34cde19450118d628df`.

The pre-missile sampler and profiles from `c08b46b` produce exactly the current
sample bytes within each runtime. Their original authored profile fields match;
the missile addition supplied only zero/default attachment fields for these
fifteen profiles. This comparison uses the current shared dependencies. It is
not a reproduction of the complete original host environment.

The runtimes differ on 19 sine/cosine results for identical float64 inputs:
11 cosine and eight sine outputs. Those changes propagate to 35 scalar values:
16 position, 16 travel and three stretch components. The largest absolute delta
is `2.2737367544323206e-13` source units. Every differing scalar casts to the same
Float32 value in these samples. That observation does not establish cross-engine
GPU-frame equality or native-client parity.

Causality was checked in both directions. Replaying only Chromium's captured
sine/cosine results in Node reproduces Chromium's complete sampler bytes;
replaying Node's results in Chromium reproduces Node's complete bytes. Each
replay substitutes 17,888 calls. Math tracing independently preserves the
uninstrumented sample bytes. Replay uses captured float64 bit patterns because
decimal JSON loses signed zero; native functions are restored even after errors.
Interception occurs only in the audit process and its blank browser page.

Run the [standalone tool](../tools/qa/lux-e-sampler-portability.mjs) from the
project. It creates a new output directory, records source hashes, the existing
golden, runtime versions, exact traces, numeric differences and bidirectional
replay results. It does not rewrite source profiles or tests:

```sh
node tools/qa/lux-e-sampler-portability.mjs
```

The managed cloud environment uses an explicit browser override:

```sh
node tools/qa/lux-e-sampler-portability.mjs \
  --output-dir .cache/lux-e-portability-review \
  --chromium-executable /usr/bin/chromium --no-sandbox
```

See the [measured reading](reference/lux-e-sampler-portability.json) and
[verification ledger](reference/lux-e-sampler-portability-verification.json).
The original golden's producing environment remains unreproduced. Its exact
assertion still fails here; this audit is not a clean full-suite certificate.
The other two known missing-evidence failures remain separate.

The later [FMA reference investigation](LUX-E-FMA-REFERENCE.md) reproduces the
original golden exactly using contracted V8 trig arithmetic. It identifies one
changed cosine input while retaining the original production math and assertion.
The original producing machine remains unidentified.
