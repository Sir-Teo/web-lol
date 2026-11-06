import type { BaronAttackVisual, BaronFlightFrame } from '../simulation/baron-attack-visuals';
import type { Team } from '../simulation/types';

export type BaronFlightSample = Omit<BaronFlightFrame, 'tick' | 'audience'>;
/** Raw root for private reconstruction, including hidden emission steps.
 * Stopped roots are actual retained frames, never extrapolation. Drawing must
 * use the visibility-gated wrapper below or separately preserve birth visibility. */
export function sampleBaronFlightRoot(
  effect: Pick<BaronAttackVisual, 'frames'>,
  tick: number
): BaronFlightSample | null {
  const first = effect.frames[0],
    last = effect.frames.at(-1);
  if (!Number.isFinite(tick) || !first || !last || tick < first.tick || tick > last.tick)
    return null;
  const index = Math.floor(tick) - first.tick;
  const a = effect.frames[index],
    b = effect.frames[index + 1];
  if (!a) return null;
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

/** Visibility-gated sampling for drawing. Private reconstruction uses the raw
 * root sampler above so hidden births still consume the source emitter stream. */
export function sampleBaronFlight(
  effect: Pick<BaronAttackVisual, 'frames'>,
  tick: number,
  team: Exclude<Team, 'neutral'>
): BaronFlightSample | null {
  const sample = sampleBaronFlightRoot(effect, tick);
  if (!sample) return null;
  const frame = effect.frames[Math.floor(tick) - effect.frames[0].tick];
  return frame.audience.includes(team) ? sample : null;
}
