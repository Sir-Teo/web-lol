import oracle from './oracle-lens.json';
import { WARD_SOURCE, wardScaling } from './warding-totem';
import { TICK_RATE } from './rules';
export type TrinketKind = 'ward' | 'oracle';
export const TRINKETS = {
  ward: { name: 'Stealth Ward', icon: '3340' },
  oracle: { name: 'Oracle Lens', icon: '3364' },
} as const;
export const ORACLE_SOURCE = oracle;
// Local adapters until native dispatch is recovered: capture all-champion
// average level on cast/recharge; interpolate endpoints; continuous unobstructed
// ward detection. Hidden champions leave a sampled, non-targetable silhouette.
// A second accepted activation replaces the first; committed scans survive
// swaps, death and practice refill, following their owner's current position.
export const ORACLE_POLICY = {
  durationTicks: Math.round(oracle.durationSeconds * TICK_RATE),
  cooldownTicks: Math.round(oracle.cooldownSeconds * TICK_RATE),
  echoTicks: TICK_RATE / 2,
};
export function trinketScaling(kind: TrinketKind, level: number) {
  if (kind === 'ward')
    return { rechargeTicks: wardScaling(level).rechargeTicks, radius: WARD_SOURCE.sightRadius };
  const t = (Math.max(1, Math.min(18, level)) - 1) / 17;
  return {
    rechargeTicks: Math.round(
      (oracle.earlyRechargeSeconds +
        t * (oracle.lateRechargeSeconds - oracle.earlyRechargeSeconds)) *
        TICK_RATE
    ),
    radius: oracle.startingRadius + t * (oracle.endingRadius - oracle.startingRadius),
  };
}
