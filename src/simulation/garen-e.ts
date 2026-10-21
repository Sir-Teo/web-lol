import { GAREN_E } from '../content/garen-e';
import { GAREN_E_AUDIO } from '../content/garen-e-audio';
import { GAREN } from '../content/garen-progression';
import { TICK_RATE } from '../content/rules';
import { growthAtLevel } from './progression';

export const GAREN_E_DURATION_TICKS = Math.round(GAREN_E.durationSeconds * TICK_RATE);
// Local recast lock; native script timing still requires a capture.
export const GAREN_E_RECAST_TICKS = TICK_RATE;
// Shared presentation history covers particle stop caps, active-sound fade and
// cast/ending recordings, including an R interruption immediately after E starts.
export const GAREN_E_PRESENTATION_TAIL_TICKS = Math.ceil(
  Math.max(
    1,
    GAREN_E_AUDIO.cast.maxDurationSeconds,
    GAREN_E_AUDIO.end.maxDurationSeconds,
    GAREN_E_AUDIO.active.stop.fadeSeconds
  ) * TICK_RATE
);

/** The current item catalog supplies no attack speed. Temporary attack-speed
 * multipliers do not count as item or level growth for Judgment. */
export function garenEStrikes(level: number): number {
  return (
    GAREN_E.baseStrikes +
    Math.floor((GAREN.attackSpeedGrowth * growthAtLevel(level)) / GAREN_E.bonusAttackSpeedPerStrike)
  );
}

/** Complete each equal-length spin on the first simulation step at/after its
 * endpoint; the final strike is at exactly three seconds, never beyond it. */
export function garenEStrikeTick(startTick: number, strikes: number, index: number): number {
  return startTick + Math.ceil((index * GAREN_E_DURATION_TICKS) / strikes);
}
