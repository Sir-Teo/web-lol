import { newTeamPlans } from './bot-team';
import type { Battlefield } from './battlefield';
import { World } from './world';
import { equipSummoners, type SummonerLoadout } from './smite';
import { DEFAULT_SUMMONERS } from '../content/summoners';
import { assignRole } from './bot-jungle';

/** Five-position interim roster. Ashe jungle remains a local test composition
 * until the six complete champion roster and objective/team planning ship. */
export function createLaneMatch(
  battlefield: Battlefield,
  playerChampion: 'ashe' | 'lux' | 'leona' | 'garen' | 'masteryi' | 'ahri' = 'ashe',
  summoners: SummonerLoadout = DEFAULT_SUMMONERS
): World {
  if (battlefield.id !== 'rift') throw new Error('Lane matches require Summoner’s Rift.');
  if (battlefield.developmentAhriBots && !battlefield.developmentAhriRift)
    throw new Error('Ahri bot selection requires the trusted development Ahri Rift host.');
  if (battlefield.developmentMasterYiBots && !battlefield.developmentMasterYiRift)
    throw new Error('Master Yi bot selection requires the trusted development Yi Rift host.');
  const assignments = [
    { role: 'top', lane: 'top', champion: 'ashe' },
    {
      role: 'jungle',
      lane: null,
      champion: battlefield.developmentMasterYiBots ? 'masteryi' : 'ashe',
    },
    { role: 'mid', lane: 'mid', champion: battlefield.developmentAhriBots ? 'ahri' : 'lux' },
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
  const playerRole =
    playerChampion === 'masteryi'
      ? 'jungle'
      : playerChampion === 'garen'
        ? 'top'
        : playerChampion === 'leona'
          ? 'support'
          : playerChampion === 'lux' || playerChampion === 'ahri'
            ? 'mid'
            : 'carry';
  const playerSlot = assignments.findIndex(({ role }) => role === playerRole);
  assignRole(world.player, playerRole);
  for (const team of ['blue', 'red'] as const) {
    for (const [slot, assignment] of assignments.entries()) {
      // Human Yi takes jungle, Garen top, Leona support, Ahri/Lux mid and Ashe carry.
      // The human receives no lane order.
      if (team === 'blue' && slot === playerSlot) continue;
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
  world.teamPlans = newTeamPlans();
  return world;
}
