import { luxBasicParticleLife } from '../content/lux-basic-linger';
import { LUX_BASIC_TRAIL as trail } from '../content/lux-basic-trail';
import type { LuxAttackVisual } from '../simulation/types';
import { luxAttackFrame } from './lux-attack-frame';

interface ScalarCurve {
  readonly times: readonly number[];
  readonly values: readonly number[];
}
function sample(curve: ScalarCurve, time: number): number {
  if (time <= curve.times[0]) return curve.values[0];
  for (let i = 1; i < curve.times.length; i++) {
    if (time > curve.times[i]) continue;
    const f = (time - curve.times[i - 1]) / (curve.times[i] - curve.times[i - 1]);
    return curve.values[i - 1] + f * (curve.values[i] - curve.values[i - 1]);
  }
  return curve.values.at(-1)!;
}
function color(
  curve: { readonly times: readonly number[]; readonly values: readonly (readonly number[])[] },
  time: number
) {
  return [0, 1, 2, 3].map((axis) =>
    sample({ times: curve.times, values: curve.values.map((v) => v[axis]) }, time)
  );
}
export interface LuxTrailPoint {
  ordinal: number;
  birthTick: number;
  age: number;
  position: readonly [number, number, number];
  facing: number;
  halfWidth: number;
  color: readonly number[];
  distance: number;
  wakeU: number;
  multScroll: readonly [number, number];
}
/** Live trail points in native default walk order (newest first). Uses the same
 * explicit 60 Hz birth policy as the hoop. Geometry/cutoff and material sampling
 * are separate; these values remain in source units and unwrapped UV space.
 */
export function luxTrailParticles(effect: LuxAttackVisual, tick: number): LuxTrailPoint[] {
  if (!Number.isFinite(tick) || tick < effect.launchTick) return [];
  const life = luxBasicParticleLife(
    'trail',
    trail.particleLife,
    effect.stopTick !== null && tick >= effect.stopTick
  );
  const nowTick = tick - effect.launchTick;
  const seconds = nowTick / 60;
  const stopTick = effect.stopTick === null ? Infinity : effect.stopTick - effect.launchTick;
  const lastTick = Math.floor(Math.min(nowTick, stopTick, trail.emitterLife * 60));
  const last = Math.floor((lastTick * trail.rate) / 60);
  const first = Math.max(1, Math.floor((seconds - trail.particleLife - 1 / 60) * trail.rate));
  const points: LuxTrailPoint[] = [];
  for (let ordinal = last; ordinal >= first; ordinal--) {
    const birthTick = Math.ceil((ordinal * 60) / trail.rate);
    const age = (nowTick - birthTick) / 60;
    if (age < 0 || age >= life) continue;
    const frame = luxAttackFrame(effect, effect.launchTick + birthTick);
    if (!frame) continue;
    const birthPhase = birthTick / 60 / trail.emitterLife;
    const phase = age / life;
    const birthColor = color(trail.birthColor, birthPhase);
    const lifeColor = color(trail.color, phase);
    points.push({
      ordinal,
      birthTick,
      age,
      position: [frame.x, trail.offset[1], frame.y],
      facing: frame.facing + (sample(trail.birthRotationDegrees, birthPhase) * Math.PI) / 180,
      halfWidth: sample(trail.birthWidth, birthPhase) * sample(trail.relativeWidth, phase),
      color: lifeColor.map((v, i) => v * birthColor[i]),
      distance: frame.distance,
      wakeU: frame.distance / trail.tiling[0],
      multScroll: [age * trail.multScroll[0], age * trail.multScroll[1]],
    });
  }
  return points;
}
