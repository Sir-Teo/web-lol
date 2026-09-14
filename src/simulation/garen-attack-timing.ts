import { GAREN } from '../content/garen-progression';
import { TICK_RATE } from '../content/rules';

/** Basic attacks only; Decisive Strike has a separate authored timing override.
 * The source offset and scaling coefficient are pinned. Interpolating between
 * base and fully speed-scaled windup is our adapter interpretation, pending
 * native-client frame calibration. Round only the final duration to local ticks.
 */
export function garenAttackWindupTicks(attackSpeed: number): number {
  if (!Number.isFinite(attackSpeed) || attackSpeed <= 0)
    throw new RangeError('Garen attack speed must be finite and positive');
  const fraction = 0.3 + GAREN.attackDelayCastOffsetPercent;
  const baseSeconds = fraction / GAREN.attackSpeed;
  const scaledSeconds = fraction / attackSpeed;
  const seconds =
    baseSeconds +
    GAREN.attackDelayCastOffsetPercentAttackSpeedRatio * (scaledSeconds - baseSeconds);
  return Math.max(1, Math.round(seconds * TICK_RATE));
}
