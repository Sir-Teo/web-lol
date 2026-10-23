import { luxAttackAnimation } from './lux-attack-animation';
export type GarenAttackKind = 'attack1' | 'attack2' | 'crit';
/** Pinned ordinary attack slots are weighted 0.5/0.5. Reuse the existing
 * stateless visual sampler with a Garen salt, independent of gameplay RNG.
 * The critical roll is already captured by combat. Native RNG remains open. */
export function garenAttackAnimation(
  id: number,
  startTick: number,
  critical = false
): GarenAttackKind {
  return critical ? 'crit' : luxAttackAnimation(id ^ 0x47a2, startTick);
}
