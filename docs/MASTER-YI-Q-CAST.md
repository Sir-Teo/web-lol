# Alpha Strike cast particles

Accepted Q in the private Yi scene creates the complete two-emitter
`MasterYi_Q_Cas` system. The disappear billboard emits twice on the existing
60 Hz first-update grid; the bubble emits four particles on update one. The
source curves, spawn offsets, velocity, scale, rotation, spin, lookups and finite
lives are retained. Q combat timing and the public Ashe/Lux selector are unchanged.

Four exact texture transports contain 35 authored mip levels. Two lookup PNGs
reuse existing Q contact URLs; two base PNGs are new. No authored mip is resized,
generated, gamma-converted or premultiplied. Q cast, Q contact and Meditate
renderers borrow verified textures from one page-owned cache. Each effect still
requires its complete closure, preserves successes on failure and retries only
when explicitly requested. Ordinary startup does not load this private pack.

The [raw Q source](reference/masteryi/q-particles.json),
[texture transport](reference/masteryi/q-cast-texture-transport.json) and
[compiled reading](reference/masteryi/q-cast-particle-reading.json) remain separate.
The raw `{9b111ae4}` field exactly matches the FNV-1a `frameRate` name candidate.
Its value 10 is interpreted by a local seek adapter: random 2×2 atlas start plus
`floor(particleAge * 10)`, wrapping over four cells. The raw hash stays in the
frozen record and compiled explicit-field list. This identifies a matching name;
it does not certify native update cadence or random sequencing.

Schema 154 stores accepted rank, origin, creation audience and lossless root
pose/visibility runs for 15 ticks. Birth and current visibility use those saved
frames. Q's cast effect remains visible while Q hides its actor body; this is
separate from the existing body picking and targetability rules. Hidden creation
cannot become visible after vision returns. Death freezes the root. The terminal
presentation clock can finish the particles without advancing the world.
Decoding validates owner, accepted Q audio identity, rank, origin/audience,
canonical history coverage, live endpoints and frozen death frames.

The source's ten-second particle linger values remain recorded without extending
finite visible lives. Existing Q audio owns the declared on-create cue, so the
particle renderer adds no duplicate sound. Actor-root attachment, source-X
reflection, first-update emission, cosmetic draws, shader defaults and atlas seek
are explicit reconstruction choices. Native GPU/script/CPU and physical-device
parity remain unverified. Q_End, distortion and missile systems are separate work.

Reproduce with `python tools/assets/test-masteryi-q-cast.py`, its `python -O`
equivalent, and `python tools/assets/export-masteryi-q-cast-particles.py --check`.
Runtime checks live in the Q cast history/particle unit tests and
`e2e/masteryi-q-cast.spec.ts`; verification identities and retained evidence are
indexed in [the verification ledger](reference/masteryi/q-cast-verification.json).
