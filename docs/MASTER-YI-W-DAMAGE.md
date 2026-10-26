# Meditate damage reaction

The private Master Yi fixture renders both `MasterYi_W_Dmg` emitters when positive
physical or magic damage is actually reduced by Meditate, including the existing
post-interruption reduction linger. Fully shielded and lethal reduced hits also
admit a reaction. True damage, zero damage and hits outside the reduction window
create none. Reactions coalesce once per owner/tick, following an explicit local
presentation policy; native script triggering and coalescing remain unverified.

The Hit billboard retains its rotation probability, scale curve, pass 30,
`miscRenderFlags=1` and root bind. The flash keeps its authored uniform scale,
lookup and omitted bind field, with an explicit local zero-bind default. Both use
the existing first-update emission grid and finite source lives, with a 15-tick
history bound. Source linger does not extend visible particles.

All four texture transports already belong to Alpha Strike contacts. Their 32
authored mip levels remain exact, without generated/resized mips, normalization,
gamma conversion or premultiplication. The programs borrow shared verified
textures while keeping independent readiness and selective explicit retry. This
integration adds no public PNG, mesh or audio recording. The source system omits
sound declarations.

Schema 158 records W cast identity/rank, reaction tick, admission audience and
lossless actor-root pose/visibility runs. Decoding checks matching accepted W,
its reduction/stop window, unique ordered ticks, finite retention, root endpoints
and death freeze. A save does not retain a complete damage ledger, so these
structural and lifecycle checks cannot independently prove a historical damage
amount or detect every deleted reaction.

Admission and subsequent birth visibility remain separate. Bound Hit particles
follow known roots; the flash keeps its known birth root. Q can hide bound
particles while an already-born unbound flash finishes. Death freezes the root
after Q cancellation; victory drains finite tails through presentation time
without stepping the match. Sampling consumes no gameplay RNG or entity IDs.

Source axis reflection, omitted defaults, fixed cosmetic probability draws,
first-update scheduling and render flag/shader mappings are reconstruction
choices. Exact source transports and GPU upload do not certify native frame or
physical-device parity. The public production roster remains Ashe/Lux.

See [runtime reading](reference/masteryi/w-damage-runtime-reading.json),
[complete W source](MASTER-YI-W-PARTICLES.md) and
[verification](reference/masteryi/w-damage-verification.json).
Reproduce with `python tools/assets/export-masteryi-w-damage-particles.py --check`
and `python tools/assets/test-masteryi-w-damage.py`, including optimized Python,
plus the corresponding history/sampler and browser tests.
