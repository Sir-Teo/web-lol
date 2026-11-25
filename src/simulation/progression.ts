import { ASHE } from '../content/ashe-progression';
import { CHAMPION_PROFILES } from '../content/champion-profiles';
import { TOP_QUEST_MAX_LEVEL } from '../content/role-quests';
import type { ChampionIdentity } from './types';

export const MAX_LEVEL = 18;
export const ABSOLUTE_MAX_LEVEL = TOP_QUEST_MAX_LEVEL;
export const experienceToNextLevel = (level: number): number => 280 + (level - 1) * 100;
export const statPrecision = (value: number): number => Math.round(value * 1e6) / 1e6;
export function growthAtLevel(level: number): number {
  const baseFactors = ASHE.growthFactors;
  if (level <= baseFactors.length) {
    return statPrecision(
      baseFactors.slice(0, level).reduce<number>((sum, value) => sum + value, 0)
    );
  }
  const baseSum = baseFactors.reduce<number>((sum, value) => sum + value, 0);
  const extraLevels = Math.max(0, level - baseFactors.length);
  const lastFactor = baseFactors[baseFactors.length - 1] ?? 1.25;
  return statPrecision(baseSum + extraLevels * lastFactor);
}

/** Exact level-scaled base AD for any champion so bonus-AD ratios exclude level growth. */
export function championBaseAttackDamage(
  champion: ChampionIdentity | undefined,
  level: number
): number {
  const profile = champion ? CHAMPION_PROFILES[champion] : undefined;
  if (!profile) return 60;
  return statPrecision(profile.damage + profile.damageGrowth * growthAtLevel(level));
}
