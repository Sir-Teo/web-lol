import { ASHE } from '../content/ashe-progression';

export const MAX_LEVEL = 18;
export const experienceToNextLevel = (level: number): number => 280 + (level - 1) * 100;
export const statPrecision = (value: number): number => Math.round(value * 1e6) / 1e6;
export function growthAtLevel(level: number): number {
  return statPrecision(
    ASHE.growthFactors.slice(0, level).reduce<number>((sum, value) => sum + value, 0)
  );
}
