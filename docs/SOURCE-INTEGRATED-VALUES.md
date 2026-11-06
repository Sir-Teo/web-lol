# Source integrated values

`SourceIntegratedValue` bakes authored curves into 64 float32 entries over the
unit interval, then interpolates the table. The first integral uses linear-curve
areas; the second sums the first integral with eight Simpson cuts per interval.
Unkeyed constants remain fixed amounts, while authored single-key curves are
integrated. The adapter retains this distinction from program format 2.

The caller owns particle lifetime scaling (once for velocity/scroll, twice for
world acceleration), probability/flicker and final coordinate placement. This
helper does not apply them implicitly. It owns copied inputs and per-order
cached tables; returned arrays own their storage. Invalid structure, clocks or
integration order reject. Sampling order and seeks do not change the result.

All 148 adapter cases pass alongside all 235 ordinary-value cases (383 total).
The 144 independent samples execute the pinned external integral baker directly
without importing this helper. Inputs retain raw float64 bytes, including signed
zeros, and outputs retain exact float32 bytes. Cases cover constants versus
single keys, ramps, flat ends, negative starts, duplicate keys, clamped phases,
both orders and the actual zero-valued Baron Embers_Add acceleration.
Reproduce with `node tools/assets/export-source-integrated-value-samples.mjs --check`.
Logs: `artifacts/source-integrated-value-tests.log`; TypeScript passes.

This checks selected external arithmetic, not native CPU/PRNG/update parity or
visual fidelity. No active renderer or public assets change in this step.
