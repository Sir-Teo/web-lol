import { LEONA } from './leona-progression';
import { LEONA_SPELLS } from './leona-spells';

/** Development simulation adapter. Native input/timing calibration remains open.
 * The six-second window, +50 range and 53-tick automatic recovery are explicit
 * provisional policies, not values extracted from the character BIN. */
export const LEONA_COMBAT_POLICY = {
  attackWindowTicks: 6 * 60,
  empoweredRangeBonus: 50,
  ordinaryWindupTicks: Math.round(
    ((0.3 + LEONA.attackDelayCastOffsetPercent) * 60) / LEONA.attackSpeed
  ),
  daybreakWindupTicks: Math.round(LEONA_SPELLS.q.authoredAttackCastSeconds * 60),
  daybreakCycleTicks: 53,
} as const;
