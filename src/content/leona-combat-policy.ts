import { LEONA } from './leona-progression';
import { LEONA_SPELLS } from './leona-spells';

/** Development simulation adapter. Native input/timing calibration remains open.
 * The six-second window, +50 range and 53-tick automatic recovery are explicit
 * provisional policies, not values extracted from the character BIN. */
export const LEONA_COMBAT_POLICY = {
  // Provisional geometry/scheduling; display radius differs from raw cast radius.
  eclipseRadius: LEONA_SPELLS.w.displayRange,
  eclipseDurationTicks: Math.round(LEONA_SPELLS.w.resistanceSeconds * 60),
  zenithWindupTicks: Math.round(LEONA_SPELLS.e.authoredCastSeconds * 60),
  // Width-as-radius, dash speed and near-edge landing require native calibration.
  zenithRadius: LEONA_SPELLS.e.missile.authoredWidth,
  zenithDashSpeed: 2000,
  // Legacy cast timing is not an explicit mCastTime declaration. Both clocks
  // are provisional; the 0.625s impact is rounded up to a fixed simulation tick.
  solarWindupTicks: Math.round(LEONA_SPELLS.r.legacyCastSeconds * 60),
  solarImpactTicks: Math.ceil(0.625 * 60),
  attackWindowTicks: 6 * 60,
  empoweredRangeBonus: 50,
  ordinaryWindupTicks: Math.round(
    ((0.3 + LEONA.attackDelayCastOffsetPercent) * 60) / LEONA.attackSpeed
  ),
  daybreakWindupTicks: Math.round(LEONA_SPELLS.q.authoredAttackCastSeconds * 60),
  daybreakCycleTicks: 53,
} as const;
