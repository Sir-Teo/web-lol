import type { Battlefield } from './battlefield';
import { World } from './world';
import { newRiverScuttlers } from './scuttler';
import { RIFT_CAMPS, type RiftCampId } from '../content/rift-camps';

/** Interim lane-only roster: mirrors are deliberate until more complete kits ship. */
export function createLaneMatch(
  battlefield: Battlefield,
  playerChampion: 'ashe' | 'lux' = 'ashe'
): World {
  if (battlefield.id !== 'rift') throw new Error('Lane matches require Summoner’s Rift.');
  const assignments = [
    { lane: 'top', champion: 'ashe' },
    { lane: 'top', champion: 'ashe' },
    { lane: 'mid', champion: 'lux' },
    { lane: 'bot', champion: 'ashe' },
    { lane: 'bot', champion: 'ashe' },
  ] as const;
  const lanes = assignments.map(({ lane }) => {
    const index = battlefield.lanes.findIndex((route) => route.name === lane);
    if (index < 0 || battlefield.lanes[index].points.length < 2)
      throw new Error(`The ${lane} lane is unavailable.`);
    return index;
  });
  const world = new World(
    true,
    {
      ...battlefield,
      initialUnits: battlefield.initialUnits.filter(
        (unit) => unit.kind !== 'champion' && unit.kind !== 'dummy'
      ),
    },
    playerChampion
  );
  world.matchMode = 'lanes';
  world.scuttlers = newRiverScuttlers();
  world.jungleCamps = RIFT_CAMPS.map((camp) => ({
    id: camp.id as RiftCampId,
    unitIds: camp.members.map(() => null),
    cleanupTicks: camp.members.map(() => null),
    nextSpawnTick: camp.firstReadyTick,
    splitWaves: [],
  }));
  for (const team of ['blue', 'red'] as const) {
    for (const [slot, assignment] of assignments.entries()) {
      // Human Lux takes mid; Ashe takes bottom. Neither receives an automatic lane order.
      if (team === 'blue' && slot === (playerChampion === 'lux' ? 2 : 4)) continue;
      const angle = (slot * Math.PI * 2) / 5;
      const home = battlefield.spawns[team];
      const point = battlefield.reachable(
        { x: home.x + Math.cos(angle) * 120, y: home.y + Math.sin(angle) * 120 },
        35,
        team
      );
      const bot = world.spawn('champion', team, point, assignment.champion);
      bot.ai = true;
      bot.lane = lanes[slot];
      bot.nextThink = slot + 1;
    }
  }
  return world;
}
