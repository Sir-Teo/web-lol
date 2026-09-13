import {
  CHAMPION_BASE_DEATH_SECONDS,
  CHAMPION_DEATH_SCALING,
} from '../content/champion-death-times';
import { TICK_RATE } from '../content/rules';

/** Source-backed bands; boundary rounding remains a documented simulation policy. */
export function championDeathTicks(level: number, deathTick: number): number {
  const { bands, intervalSeconds, maximumMultiplier } = CHAMPION_DEATH_SCALING;
  let multiplier = 1;
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const start = band.startSeconds * TICK_RATE;
    const end = i + 1 < bands.length ? bands[i + 1].startSeconds * TICK_RATE : deathTick;
    const elapsed = Math.max(0, Math.min(deathTick, end) - start);
    multiplier += Math.ceil(elapsed / (intervalSeconds * TICK_RATE)) * band.increase;
  }
  // Round only the final duration to a tick, never shorten the requested wait.
  const ticks =
    CHAMPION_BASE_DEATH_SECONDS[level - 1] * Math.min(maximumMultiplier, multiplier) * TICK_RATE;
  return Math.ceil(Math.round(ticks * 1e8) / 1e8);
}
