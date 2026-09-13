import { ASHE_R } from '../content/ashe-r';
import { TICK_RATE } from '../content/rules';

/** Existing simulation collision radius, shared with tactical prediction. */
export const CRYSTAL_ARROW_RADIUS = 65;

export function crystalArrowStunTicks(distanceTravelled: number): number {
  const seconds = Math.min(
    ASHE_R.maximumStunSeconds,
    Math.max(ASHE_R.minimumStunSeconds, distanceTravelled * ASHE_R.stunSecondsPerUnit)
  );
  // Preserve exact tick boundaries despite accumulated floating-point travel.
  return Math.ceil(Math.round(seconds * TICK_RATE * 1e8) / 1e8);
}
