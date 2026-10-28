import source from './baron.json';
import { growthAtLevel } from '../simulation/progression';
import { TICK_RATE } from './rules';

/** Published standard-Rift minimum level; this fixture does not select a live camp level. */
export function baronStatsAtLevel(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 18)
    throw new Error('Baron preview level must be an integer from 1 to 18.');
  const growth = growthAtLevel(Math.max(source.minimumLevel, level));
  return {
    ...source.baseStats,
    maxHp: source.baseStats.maxHp + source.growth.maxHp * growth,
    damage: source.baseStats.damage + source.growth.damage * growth,
    armor: source.baseStats.armor + source.growth.armor * growth,
    magicResist: source.baseStats.magicResist + source.growth.magicResist * growth,
    // Stationary sparring policy; the authored movement scalar remains in source.baseStats.
    speed: 0,
  };
}
export const BARON = {
  ...source,
  stats: baronStatsAtLevel(source.minimumLevel),
  gold: 0,
  experience: 0,
  minionScore: 0,
  missileSpeed: 0,
  castFrame: source.castSeconds * 30,
  pathfindingRadius: 0,
  policy: {
    ...source.policy,
    windupTicks: Math.round(source.castSeconds * TICK_RATE),
    attackPeriodTicks: Math.round(TICK_RATE / source.baseStats.attackSpeed),
    corpseLifetimeTicks: Math.ceil(source.clips.death.durationSeconds * TICK_RATE),
  },
  spawnLeadupTicks: 0,
  spawnClipTicks: Math.ceil(source.clips.spawn.durationSeconds * TICK_RATE),
  spawnSubmesh: null,
} as const;
