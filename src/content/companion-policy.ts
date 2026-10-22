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
/** Delivery bindings beyond the retained item scalars remain local policies. */
export const COMPANION_PASSIVE_POLICY = {
  emberIntervalTicks: 30,
  burnIntervalTicks: 60,
  aoeBurn: true,
} as const;
const normalized = (value: number) => Math.round(value * 1e6) / 1e6;
const g = source.finalPassives.gustwalker.values,
  s = source.finalPassives.scorchclaw.values,
  m = source.finalPassives.mosstomper.values;
export const COMPANION_PASSIVES = {
  gustwalker: {
    brushBonus: normalized(g.AvatarCampMoveSpeed),
    killBonus: normalized(g.AvatarEnhancedCampMS),
    decayTicks: Math.round(g.CampMSDuration * 60),
  },
  scorchclaw: {
    maxStacks: s.AvatarMaxStacks,
    stacksPerInterval: s.StacksPerHalfSec,
    radius: s.AvatarAoERadius,
    healthFraction: normalized(s.AvatarMaxHPBurnTotal),
    burnTicks: Math.round(s.AvatarBurnDuration * 60),
    slowFraction: normalized(s.AvatarSlowAmount),
    slowTicks: Math.round(s.AvatarSlowDuration * 60),
  },
  mosstomper: { rechargeTicks: Math.round(m.AvatarDamageCD * 60) },
} as const;
export function mosstomperShield(level: number): number {
  const part = source.finalPassives.mosstomper.calculations.MaxShield.mFormulaParts[0],
    breakpoint = part.mBreakpoints[0];
  return (
    part.mLevel1Value +
    Math.max(0, level - breakpoint.mLevel + 1) * breakpoint.mBonusPerLevelAtAndAfter
  );
}
