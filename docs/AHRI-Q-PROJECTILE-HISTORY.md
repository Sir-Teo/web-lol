# Ahri Q projectile visual history

The implementation branch records the actual fixed-step orb path in optional,
nonempty saved field `ahriQProjectileVisuals` (schema 177). This presentation
observer uses the existing orb ID and changes no gameplay IDs, random draws,
movement, contacts, damage, or earlier presentation histories.

Records retain launch geometry and audience, consecutive flight endpoints, the
caster point used by each movement step, canonical facing, and per-step
visibility. The actual mixed outward/return tick supplies the turn point. Catch,
expiry, source loss, and match end stop the root. Ended histories remain for 360
ticks, covering the largest authored particle lifetime (six seconds across both
published systems). Match end freezes the World; a renderer must use its own
finite presentation drain without stepping the simulation.

Enemy projectiles can enter sight after a hidden launch. Birth audience is not a
permanent visibility veto. Saved endpoint visibility supports trail separators
without inventing geometry through unseen flight.

Restore validation replays every endpoint with the unchanged movement function,
checks turn and stop chronology, canonical audiences, facing and coverage, and
cross-checks active projectiles and retained audio dispatches. Stopped IDs remain
reserved against other saved entities. Historical fog and old caster positions
are saved inputs; they cannot be independently reconstructed from the present
World and do not establish native callback behavior.

The independent projectile reference retains every older presentation history:
14 genuine-cast cases and 634 complete projections match the archived Q cast
World. Earlier baseline test adapters omit only this newly added field. Frozen
helpers, producers and reference hashes remain unchanged.

Focused tests cover every-step round trips, future continuation, real return
Flash, caster death, terminal freezes, hidden entry, mixed turn motion, finite
cleanup, invalid histories, omitted stopped records, and signed-axis flights.
The particle sampler has a separate bounded motion cache and preserves
stateless results through backward seeks and disposal.

This stage has no projectile renderer. Published assets and native declaration
joins do not establish callback timing, native pixel equivalence, or device
performance. Full-suite, clean-CI and natural-match evidence will be recorded
separately when completed.
