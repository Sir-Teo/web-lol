import { World } from './world';
import type { Battlefield } from './battlefield';
import type { ChampionIdentity } from './types';
import { equipSummoners } from './smite';

/** Private basic-combat fixture; no live objective calendar, boss kit or epic rewards. */
export function createBaronEncounter(
  battlefield: Battlefield,
  champion: ChampionIdentity = 'ashe'
): World {
  if (battlefield.id !== 'practice-fixture' || !battlefield.developmentBaron)
    throw new Error('Baron encounter requires its trusted development fixture.');
  const world = new World(false, battlefield, champion);
  world.encounter = 'baron';
  equipSummoners(world.player, { d: 'flash', f: 'smite' });
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  world.nextWaveTick = 1_000_000_000;
  world.spawnMonster({ x: 450, y: 0 }, null, 'baron');
  return world;
}
