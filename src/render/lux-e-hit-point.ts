import type { SingularityHit } from '../simulation/types';
/** Saved target-root translation, clamped for terminal playback and reverse
 * seeks. No dependency on the current unit or a mutable renderer cache. */
export function luxEHitPoint(hit: SingularityHit, tick: number) {
  const first = hit.frames[0],
    last = hit.frames.at(-1)!;
  if (tick <= first.tick) return { x: first.x, y: first.y };
  if (tick >= last.tick) return { x: last.x, y: last.y };
  const a = hit.frames[Math.floor(tick) - first.tick],
    b = hit.frames[Math.floor(tick) - first.tick + 1];
  const f = tick - a.tick;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
