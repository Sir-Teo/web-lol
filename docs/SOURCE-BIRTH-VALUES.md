# Source complex birth values

`SourceBirthValues` prepares the current Baron closure's untransformed lifetime,
velocity, rotation, angular velocity, scale, drag and birth color. It preserves
the selected external field order and per-channel draw consumption. Lifetime
uses its own draw when table-driven, writes float32, and retains the negative
sentinel as unbounded. Pins still consume the original draws. Prepared input
and returned vectors own their storage; malformed widths/clocks/chances reject.

All 202 cases pass. The 198 independent samples execute selected external
lifetime and channel-write functions for all 21 Baron profiles plus an unbounded
lifetime case, across three phases and three pin policies. Every float32 field
and total draw count matches exactly. The fixture generator never imports the
application helper. See `artifacts/source-birth-values-tests.log`; reproduce with
`node tools/assets/export-source-birth-value-samples.mjs --check`.
TypeScript passes.

This is a birth-value stage, not complete native emission. The caller owns the
particle/emitter shared chance, RNG stream, shape/surface sampling, flex scales,
attachment placement, UV state and live motion. Current strict Baron inputs
write no birth-acceleration, rotational-acceleration, orbital or offset-lifetime
fields; their absent defaults consume no draws. The lifetime write assumes this
zero offset-lifetime closure. Native CPU/PRNG/update and visual fidelity remain
unverified. No gameplay, public assets or active renderer change here.
