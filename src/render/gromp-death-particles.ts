import source from '../content/gromp-death.json';
import { TICK_RATE } from '../content/rules';
import { sampleParticleCurve } from './particle-curves';

function sample(keys: { time: number; value: number[] }[], phase: number, axis: number) {
  return keys.length
    ? sampleParticleCurve(
        { times: keys.map((k) => k.time), values: keys.map((k) => k.value) },
        phase,
        axis
      )
    : 1;
}

/** One burst on the first fixed update after death, reconstructed from the
 * retained corpse clock. Dispatch/defaults and uniform-X scale follow the local
 * particle adapter; this does not certify the legacy native update convention. */
export function grompDeathParticles(deathTick: number, tick: number) {
  if (!Number.isFinite(deathTick) || !Number.isFinite(tick)) return [];
  const age = (tick - deathTick - 1) / TICK_RATE;
  if (age < 0) return [];
  return source.profiles.flatMap((p, profileIndex) => {
    if (age >= p.life) return [];
    const phase = age / p.life,
      scale = p.size.map((v, axis) => v * sample(p.scaleCurve, phase, axis));
    if (p.uniform) scale.fill(scale[0]);
    return [
      {
        profileIndex,
        age,
        phase,
        scale,
        color: p.color.map((v, axis) => v * sample(p.colorCurve, phase, axis)),
        offset: p.offset.map((v, axis) => v + p.postOffset[axis]),
      },
    ];
  });
}
