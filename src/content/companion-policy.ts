import source from './owned-companions.json';
/** Explicit controlled-encounter adapters; source inputs are retained separately. */
export const COMPANION_SOURCE = source;
export type CompanionKind = keyof typeof source.profiles;
export type CompanionAction = keyof typeof source.profiles.gustwalker.clips;
export const COMPANION_POLICY = {
  strikeTicks: 120,
  windupTicks: 28,
  activeTicks: 360,
  targetRange: 1000,
  cleaveRadius: 235,
  followSpeed: 650,
  followDistance: 100,
  snapDistance: 1000,
  navigationRadius: 20,
  pathTicks: 12,
  initialTreatTick: 5400,
  maxBonusTreats: 5,
} as const;
export const companionStage = (fed: number): 0 | 1 | 2 =>
  fed >= source.fullGrowthFeeds ? 2 : fed >= source.firstEvolutionFeeds ? 1 : 0;
export const companionSmiteDamage = (fed: number): number =>
  [600, source.upgradedSmiteDamage, source.finalSmiteDamage][companionStage(fed)];
