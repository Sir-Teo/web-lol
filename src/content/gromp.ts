import profile from './gromp.json';
import { TICK_RATE } from './rules';
export const GROMP = profile;
/** Local encounter policies. Full camp activation, level scaling and native
 * leash/reset/attack timing remain separate work. */
export const GROMP_POLICY = {
  leashRadius: 700,
  sightRadius: 1000,
  resetHealthFractionPerSecond: 0.2,
  windupTicks: Math.round((profile.castFrame / 30) * TICK_RATE),
  attackPeriodTicks: Math.round(TICK_RATE / profile.stats.attackSpeed),
} as const;
