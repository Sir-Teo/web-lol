# Ordinary source values and birth draws

`SourceValue` owns a prepared copy of a format-2 value. It samples authored keys
with flat ends, honors the last duplicate key at a boundary and retains constants
where no keys were authored. Shared probability draws return double values;
per-channel births first write the sample to float32, then round each probability
multiplication back into float32. Every present table consumes its own draw,
even under an explicit pin; empty tables retain their single multiplier. Outputs
own their storage. Invalid dimensions, order, clocks and chances reject.
Integrated values explicitly require a separate integral adapter.

All 235 tests pass. The 231 independent samples execute the pinned external
`sampleCurve.ts` without importing this helper, retaining float64 sample/shared
bytes and float32 per-channel bytes plus exact draw counts. Cases include eight
Baron values, duplicate keys, flat endpoints, rounding-sensitive values and pins
at the unit endpoint. Fixtures use the format-2 program's authored-key metadata.
See `artifacts/source-value-tests.log`; regenerate with
`node tools/assets/export-source-value-samples.mjs --check`.

The pinned [value-reader sources](reference/baron-value-readers.json) include
verified Git blobs and SHA-256 identities. The parser confirms that source keys
remain raw (constant does not multiply keyed values), while probability tables
retain channel slots. The current strict program permits only complete struct
tables; sparse/null source tables remain outside its accepted closure.

This verifies the selected external JavaScript arithmetic, not native CPU,
PRNG, update cadence or visual fidelity. The external Rng reader explicitly uses
xorshift32 in place of the native xorshift64 stream; its outputs must not be
presented as native random parity. No active renderer changes here. TypeScript
passes; production rendering and integrated curves remain subsequent work.
