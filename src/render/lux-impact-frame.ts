import type { Vector3 } from 'three';
import profile from '../content/lux-impact-sparks.json';
function binding(seconds: number) {
  const [a, b] = profile.binding.times,
    [x, y] = profile.binding.values;
  return seconds <= a ? x : seconds >= b ? y : x + ((y - x) * (seconds - a)) / (b - a);
}
/** First-step birth, then accumulate 3D attachment displacement with emitter-
 * phase spark binding. Current weight times total displacement loses history.
 * All input/output positions share the caller's coordinate units.
 */
export function luxImpactSparkAnchor(
  startTick: number,
  tick: number,
  point: (tick: number) => Vector3
) {
  const birthTick = startTick + 1,
    position = point(birthTick).clone();
  for (let step = birthTick + 1; step <= Math.ceil(tick); step++) {
    const a = point(step - 1),
      b = point(step);
    const weight = binding((step - startTick) / 60) * Math.min(1, tick - step + 1);
    position.addScaledVector(b.clone().sub(a), weight);
  }
  return position;
}
