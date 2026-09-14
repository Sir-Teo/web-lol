import type { LuxImpactVisual } from '../simulation/types';
import profile from '../content/lux-impact-sparks.json';

/** Saved target-centre interpolation; freezes at either retained endpoint. */
export function luxImpactFrame(effect: LuxImpactVisual, tick: number) {
  const frames = effect.frames;
  const first = frames[0],
    last = frames.at(-1)!;
  if (tick <= first.tick) return { x: first.x, y: first.y };
  if (tick >= last.tick) return { x: last.x, y: last.y };
  const index = Math.floor(tick) - first.tick,
    a = frames[index],
    b = frames[index + 1],
    t = tick - a.tick;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function binding(seconds: number) {
  const [a, b] = profile.binding.times,
    [x, y] = profile.binding.values;
  return seconds <= a ? x : seconds >= b ? y : x + ((y - x) * (seconds - a)) / (b - a);
}
/** First-step birth, then accumulate target displacement with emitter-phase
 * spark binding. Current weight times total displacement would lose history.
 */
export function luxImpactSparkAnchor(effect: LuxImpactVisual, tick: number) {
  const birthTick = effect.startTick + 1,
    position = luxImpactFrame(effect, birthTick);
  for (let step = birthTick + 1; step <= Math.ceil(tick); step++) {
    const a = luxImpactFrame(effect, step - 1),
      b = luxImpactFrame(effect, step);
    const weight = binding((step - effect.startTick) / 60) * Math.min(1, tick - step + 1);
    position.x += (b.x - a.x) * weight;
    position.y += (b.y - a.y) * weight;
  }
  return position;
}
