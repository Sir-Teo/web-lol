import { ABILITIES } from '../content/rules';
import type { Ability, Unit } from '../simulation/types';
import { GAREN_R } from '../content/garen-r';
import { GAREN_E_RECAST_TICKS } from '../simulation/garen-e';
import { distance } from '../simulation/math';
import type { World } from '../simulation/world';

/** Input policy follows the current caster, including Lux's point-free E recast. */
export function instantSpell(world: World, ability: Ability): boolean {
  if (ability === 'f') return true;
  if (world.hero.champion === 'garen') return ability === 'q' || ability === 'w' || ability === 'e';
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
  return world.hero.champion === 'ashe' && !!ABILITIES[ability].minimapTargeting;
}

export function targetedSpell(world: World, ability: Ability): boolean {
  return world.hero.champion === 'garen' && ability === 'r';
}

/** Input preview only. The queued command is revalidated by the simulation. */
export function garenRTarget(world: World, target: Unit | undefined): Unit | undefined {
  return target &&
    target.kind === 'champion' &&
    target.team !== world.hero.team &&
    world.alive(target) &&
    world.visible(target, world.hero.team) &&
    world.vulnerable(target) &&
    distance(world.hero, target) <= GAREN_R.castRange
    ? target
    : undefined;
}

export function garenRecastLockTicks(world: World): number {
  return world.hero.champion === 'garen' && world.player.garenE
    ? Math.max(0, world.player.garenE.startTick + GAREN_E_RECAST_TICKS - world.tick)
    : 0;
}
