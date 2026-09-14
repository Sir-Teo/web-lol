import type { World } from '../simulation/world';
import { LUX_ATTACK_VISUAL_TAIL_TICKS } from '../content/lux-attack-presentation';

/** Freeze emission at victory while allowing retained particle tails to finish.
 * Some victory paths precede the projectile update, leaving a live saved emitter.
 * The terminal stop is presentation-only; the serialized match remains intact.
 */
export function luxAttackPresentation(world: World, alpha: number, terminalAge: number) {
  const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
  const effects = world.luxAttackVisuals
    .map((effect) =>
      world.winner && effect.stopTick === null ? { ...effect, stopTick: world.tick } : effect
    )
    .filter(
      (effect) => effect.stopTick === null || tick < effect.stopTick + LUX_ATTACK_VISUAL_TAIL_TICKS
    );
  return { tick, effects };
}
