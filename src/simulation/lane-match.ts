import type { Battlefield } from './battlefield';
import { World } from './world';
import { equipSummoners, type SummonerLoadout } from './smite';
import { DEFAULT_SUMMONERS } from '../content/summoners';
import { assignRole } from './bot-jungle';

/** Five-position interim roster. Ashe jungle remains a local test composition
 * until the six complete champion roster and objective/team planning ship. */
export function createLaneMatch(
  battlefield: Battlefield,
  playerChampion: 'ashe' | 'lux' = 'ashe',
  summoners: SummonerLoadout = DEFAULT_SUMMONERS
): World {
  if (battlefield.id !== 'rift') throw new Error('Lane matches require Summoner’s Rift.');
  const assignments = [
    { role: 'top', lane: 'top', champion: 'ashe' },
    { role: 'jungle', lane: null, champion: 'ashe' },
    { role: 'mid', lane: 'mid', champion: 'lux' },
    { role: 'carry', lane: 'bot', champion: 'ashe' },
    { role: 'support', lane: 'bot', champion: 'lux' },
  ] as const;
  const lanes = assignments.map(({ lane }) => {
    if (lane === null) return null;
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
  equipSummoners(world.player, summoners);
  assignRole(world.player, playerChampion === 'lux' ? 'mid' : 'carry');
  for (const team of ['blue', 'red'] as const) {
    for (const [slot, assignment] of assignments.entries()) {
      // Human Lux takes mid; Ashe takes bottom. Neither receives an automatic lane order.
      if (team === 'blue' && slot === (playerChampion === 'lux' ? 2 : 3)) continue;
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
      const state = world.championState(bot.id)!;
      assignRole(state, assignment.role);
      if (assignment.role === 'jungle') {
        equipSummoners(state, { d: 'smite', f: 'flash' });
        const error = world.buy('mosstomper', bot.id);
        if (error) throw new Error(`Jungler companion purchase failed: ${error}`);
      }
      bot.nextThink = slot + 1;
    }
  }
  return world;
}
