import { ABILITIES } from '../content/rules';
import type { Ability } from '../simulation/types';
import type { World } from '../simulation/world';

/** Input policy follows the current caster, including Lux's point-free E recast. */
export function instantSpell(world: World, ability: Ability): boolean {
  if (ability === 'f') return true;
  if (world.hero.champion !== 'lux') return ability === 'q';
  return (
    ability === 'e' &&
    (world.player.pendingCast?.ability === 'e' ||
      world.singularities.some(
        (zone) => zone.sourceId === world.hero.id && zone.detonatedTick === null
      ))
  );
}

export function minimapSpell(world: World, ability: Ability): boolean {
  // Lux's local aimed spells currently use the battlefield; do not inherit Hawkshot's policy.
  return world.hero.champion !== 'lux' && !!ABILITIES[ability].minimapTargeting;
}
