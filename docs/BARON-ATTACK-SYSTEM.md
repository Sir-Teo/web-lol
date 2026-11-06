# Composed Baron particle preview system

`BaronAttackSystem` prepares all nine missile or twelve hit profiles from the
private format-2 program, then runs explicit positive steps through schedules,
birth values/shapes/surfaces, lifetime settlement, field-free motion, spin,
frames/binding and draw packets. It owns an independent preview RNG and bounded
particle pool. Swap retirement retains source pool ordering. Failed allocation
still consumes the nonshared candidate's draw, as the external emit loop draws
before asking for a pool slot. The schedule plan exposes planned versus accepted
counts without changing its existing step API.

Internal checkpoints own typed arrays, RNG state, emitter clocks/chances/travel
and particle fields. Restoring reproduces exact packets and futures. They are
not gameplay save fields or JSON snapshots. Game saves retain presentation facts
for later effect reconstruction. Input metadata is copied/frozen and draw packets
own their buffers. Invalid steps and checkpoint extents/fields reject.

The compositor requires an explicit factor provider for the bound-size source
fields. It does not infer a native size from a gameplay radius. Current tests use
neutral factors, matching the external reader's omission of those fields. Root
orientation, actor/scene conversion and missile height are caller inputs. There
is no build-up, child system, force field, legacy-simple or analytic-drag path in
the current strict Baron closure. Emitter rate scale is explicitly one.

Ten composition cases pass, alongside 70 scheduler cases (80 total). Real source
program bytes are pinned by SHA-256. Both roles emit all profiles and retire in
natural/stopped runs; checkpoints match exact futures, pool pressure stays bounded,
and ownership/corruption guards pass. TypeScript passes. See
`artifacts/baron-system-composition-tests.log`.

The independent full external loop now agrees on all 480 steps across six traces:
missile/hit natural completion, explicit stopping, and capacity-one pressure. The
reference executes pinned external emit/integrate/read functions and never imports
application kernels. Every scalar and typed-array byte, packet and eight-draw RNG
lookahead participates in each digest. All 87 focused tests and TypeScript pass.
See `baron-system-external-verification.json` for evidence.

The comparison exposed the emitter override matrix's signed-zero arithmetic.
The harness also corrected a vector default and normalizes transported input
zeros before both loops, since JSON cannot preserve negative zero. Initial failing
artifacts are retained. GPU/material dispatch, asset delivery and native
CPU/PRNG/cadence/visual fidelity remain unverified. No active renderer, gameplay
or public assets change in this step.
