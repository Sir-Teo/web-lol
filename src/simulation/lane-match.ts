import {
  ORIGINAL_CHAMPIONS,
  ORIGINAL_LINEUP,
  isOriginalChampion,
} from '../content/original-lineup';
import { newTeamPlans } from './bot-team';
import type { Battlefield } from './battlefield';
import { World } from './world';
import { equipSummoners, type SummonerLoadout } from './smite';
import { DEFAULT_SUMMONERS } from '../content/summoners';
import { assignRole } from './bot-jungle';
import { PLAYER_CHAMPION_ROLES, ROLE_CHAMPION_POOLS } from '../content/champion-roles';
import { DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from '../content/bot-difficulty';
import type { ChampionIdentity, Team } from './types';
import type { RuneLoadout } from '../content/runes';
import { createRiftObjectivesState } from './epic-objectives';
import { initChampionRoleQuest } from './role-quests';
import {
  applyInitialRuneShards,
  createChampionRuneState,
  defaultRuneLoadoutForRole,
} from './runes';

/** Five-position roster with Milestone 6 10-champion zero-mirror public 5v5 and isolated trial overrides. */
export function createLaneMatch(
  battlefield: Battlefield,
  playerChampion: ChampionIdentity = 'ashe',
  summoners: SummonerLoadout = DEFAULT_SUMMONERS,
  botDifficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
  playerRunes?: RuneLoadout
): World {
  if (battlefield.id !== 'rift') throw new Error('Lane matches require Summoner’s Rift.');
  if (
    battlefield.developmentRosterBots &&
    !(
      battlefield.developmentGaren &&
      battlefield.developmentLeona &&
      battlefield.developmentAhriRift &&
      battlefield.developmentAhriBots &&
      battlefield.developmentMasterYiRift &&
      battlefield.developmentMasterYiBots
    )
  )
    throw new Error('Combined bot selection requires all trusted development Rift hosts.');
  if (battlefield.developmentAhriBots && !battlefield.developmentAhriRift)
    throw new Error('Ahri bot selection requires the trusted development Ahri Rift host.');
  if (battlefield.developmentMasterYiBots && !battlefield.developmentMasterYiRift)
    throw new Error('Master Yi bot selection requires the trusted development Yi Rift host.');
  const fullRoster = battlefield.publicRift === true || battlefield.developmentRosterBots === true;
  const baseRoles = [
    { role: 'top' as const, lane: 'top' as const },
    { role: 'jungle' as const, lane: null },
    { role: 'mid' as const, lane: 'mid' as const },
    { role: 'carry' as const, lane: 'bot' as const },
    { role: 'support' as const, lane: 'bot' as const },
  ];
  const lanes = baseRoles.map(({ lane }) => {
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
    playerChampion,
    botDifficulty
  );
  world.matchMode = 'lanes';
  if (battlefield.publicRift || battlefield.rosterPlaytestBaron)
    world.riftBaron = { unitId: null, lastClear: null, holders: [] };
  if (battlefield.publicRift) {
    world.riftObjectives = createRiftObjectivesState(world);
  }
  equipSummoners(world.player, summoners);
  const playerRole = PLAYER_CHAMPION_ROLES[playerChampion];
  const playerSlot = baseRoles.findIndex(({ role }) => role === playerRole);
  assignRole(world.player, playerRole);
  if (battlefield.publicRift) {
    initChampionRoleQuest(world, world.player);
    world.player.runeState = createChampionRuneState(
      playerRunes ?? defaultRuneLoadoutForRole(playerRole)
    );
    applyInitialRuneShards(world, world.hero, world.player);
  }

  const pickTeamChampion = (
    team: Team,
    role: (typeof baseRoles)[number]['role']
  ): ChampionIdentity => {
    if (battlefield.publicRift === true) {
      const pool = ROLE_CHAMPION_POOLS[role];
      if (isOriginalChampion(playerChampion)) {
        if (team === 'red') return pool[1];
        return ORIGINAL_CHAMPIONS.find((id) => ORIGINAL_LINEUP[id].role === role)!;
      }
      if (role === playerRole) {
        return team === 'blue'
          ? playerChampion
          : (pool.find((c) => c !== playerChampion) ?? pool[1]);
      }
      return team === 'blue' ? pool[0] : pool[1];
    }
    if (role === 'top') return fullRoster ? 'garen' : 'ashe';
    if (role === 'jungle')
      return fullRoster || battlefield.developmentMasterYiBots ? 'masteryi' : 'ashe';
    if (role === 'mid') return fullRoster || battlefield.developmentAhriBots ? 'ahri' : 'lux';
    if (role === 'carry') return 'ashe';
    return fullRoster ? 'leona' : 'lux';
  };

  for (const team of ['blue', 'red'] as const) {
    for (const [slot, assignment] of baseRoles.entries()) {
      if (team === 'blue' && slot === playerSlot) continue;
      const angle = (slot * Math.PI * 2) / 5;
      const home = battlefield.spawns[team];
      const point = battlefield.reachable(
        { x: home.x + Math.cos(angle) * 120, y: home.y + Math.sin(angle) * 120 },
        35,
        team
      );
      const botChampion = pickTeamChampion(team, assignment.role);
      const bot = world.spawn('champion', team, point, botChampion);
      bot.ai = true;
      bot.lane = lanes[slot];
      const state = world.championState(bot.id)!;
      assignRole(state, assignment.role);
      if (battlefield.publicRift) {
        initChampionRoleQuest(world, state);
        state.runeState = createChampionRuneState(defaultRuneLoadoutForRole(assignment.role));
        applyInitialRuneShards(world, bot, state);
      }
      if (assignment.role === 'jungle') {
        equipSummoners(state, { d: 'smite', f: 'flash' });
        const error = world.buy('mosstomper', bot.id);
        if (error) throw new Error(`Jungler companion purchase failed: ${error}`);
        if (state.itemState) state.itemState.undoHistory = [];
      }
      bot.nextThink = slot + 1;
    }
  }
  world.teamPlans = newTeamPlans();
  return world;
}
