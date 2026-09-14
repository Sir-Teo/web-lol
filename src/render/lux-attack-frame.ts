import type { LuxAttackVisual } from '../simulation/types';

/** Saved frame convention matches world.tick-1+alpha presentation interpolation.
 * No invented earlier trajectory; a stopped effect stays at its last known frame.
 */
export function luxAttackFrame(effect: LuxAttackVisual, tick: number) {
  const frames = effect.frames;
  if (!Number.isFinite(tick) || !frames.length || tick < frames[0].tick) return null;
  for (let i = 1; i < frames.length; i++) {
    const b = frames[i],
      a = frames[i - 1];
    if (tick > b.tick) continue;
    const fraction = (tick - a.tick) / (b.tick - a.tick);
    const turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
    return {
      x: a.x + (b.x - a.x) * fraction,
      y: a.y + (b.y - a.y) * fraction,
      facing: a.facing + turn * fraction,
    };
  }
  const last = frames.at(-1)!;
  return { x: last.x, y: last.y, facing: last.facing };
}
