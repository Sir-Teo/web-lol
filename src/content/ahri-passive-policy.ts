import { AHRI_PASSIVE } from './ahri-passive';

/** Local defaults: linear level 1–18 interpolation and AP for the omitted mStat.
 * Native kill/credit, arrival/heal, death and R extension ordering remain open. */
export const AHRI_PASSIVE_POLICY = {
  takedownWindowTicks: Math.round(AHRI_PASSIVE.takedownWindowSeconds * 60),
  maximumPursuitTicks: 8 * 60,
  historyTicks: 30,
  minimumLevel: 1,
  maximumLevel: 18,
} as const;
