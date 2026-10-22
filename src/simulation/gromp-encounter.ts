import { World } from './world';
import type { Battlefield } from './battlefield';

/** Controlled development encounter, not a standard-mode camp spawn schedule. */
export function createGrompEncounter(
  battlefield: Battlefield,
  champion: 'ashe' | 'lux' | 'garen' = 'ashe'
): World {
  if (battlefield.id !== 'practice-fixture')
    throw new Error('Gromp encounter requires the practice fixture.');
  const world = new World(false, battlefield, champion);
  world.encounter = 'gromp';
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  world.nextWaveTick = 1_000_000_000;
  world.spawnMonster({ x: 450, y: 0 });
  return world;
}
