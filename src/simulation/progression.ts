import { ASHE } from '../content/ashe-progression';
import { TOP_QUEST_MAX_LEVEL } from '../content/role-quests';

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
