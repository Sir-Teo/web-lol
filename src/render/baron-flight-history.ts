import type { BaronAttackVisual, BaronFlightFrame } from '../simulation/baron-attack-visuals';
import type { Team } from '../simulation/types';

export type BaronFlightSample = Omit<BaronFlightFrame, 'tick' | 'audience'>;
/** Samples only retained evidence. Fractional ticks use the earlier endpoint's
 * visibility, so a later reveal never grants visibility to an earlier birth.
 * Stopped roots are represented by actual retained frames, not extrapolation. */
export function sampleBaronFlight(
  effect: Pick<BaronAttackVisual, 'frames'>,
  tick: number,
  team: Exclude<Team, 'neutral'>
): BaronFlightSample | null {
  const first = effect.frames[0],
    last = effect.frames.at(-1);
  if (!Number.isFinite(tick) || !first || !last || tick < first.tick || tick > last.tick)
    return null;
  const index = Math.floor(tick) - first.tick;
  const a = effect.frames[index],
    b = effect.frames[index + 1];
  if (!a || !a.audience.includes(team)) return null;
  if (!b || tick === a.tick) return { x: a.x, y: a.y, facing: a.facing, distance: a.distance };
  const fraction = tick - a.tick;
  const turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    facing: a.facing + turn * fraction,
    distance: a.distance + (b.distance - a.distance) * fraction,
  };
}
