import source from './warding-totem.json';
import { TICK_RATE } from './rules';
export const WARD_SOURCE = source;
// Local adapters pending native traces: one starting charge; average champion
// level interpolation; captured recharge spans; two-second initial/hit reveal.
export const WARD_POLICY = {
  initialCharges: 1,
  // Provisional trinket override; Root has zero. The legacy 11.17 clone fix
  // supplies a 10-gold candidate, not recovered current callback dispatch.
  killGold: 10,
  revealTicks: 2 * TICK_RATE,
  placementTicks: Math.ceil(source.placementTravelSeconds * TICK_RATE),
  cooldownTicks: Math.ceil(source.cooldownSeconds * TICK_RATE),
  corpseTicks: Math.ceil(source.clips.death.durationSeconds * TICK_RATE),
};
export function wardScaling(averageLevel: number) {
  const t = (Math.max(1, Math.min(18, averageLevel)) - 1) / 17;
  return {
    lifeTicks: Math.round(
      (source.minLifeSeconds + t * (source.maxLifeSeconds - source.minLifeSeconds)) * TICK_RATE
    ),
    rechargeTicks: Math.round(
      (source.earlyRechargeSeconds +
        t * (source.lateRechargeSeconds - source.earlyRechargeSeconds)) *
        TICK_RATE
    ),
  };
}
