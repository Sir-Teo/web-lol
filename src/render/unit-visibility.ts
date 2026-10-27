import { alphaVanished } from '../simulation/masteryi-alpha-strike';
import type { Unit } from '../simulation/types';
import type { World } from '../simulation/world';

/** Body, picking and rings share disappearance; damage protection is separate. */
export function unitVisible(world: World, unit: Unit): boolean {
  return (
    world.visible(unit) &&
    (unit.champion !== 'masteryi' || !alphaVanished(world.championState(unit.id)))
  );
}
