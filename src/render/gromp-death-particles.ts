import source from '../content/gromp-death.json';
import { TICK_RATE } from '../content/rules';
import { Vector3 } from 'three';
import { sampleParticleCurve, accumulateParticleCurve } from './particle-curves';
import { luxHoopChance } from './lux-hoop-particles';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';

function sample(keys: { time: number; value: number[] }[], phase: number, axis: number) {
  return keys.length
    ? sampleParticleCurve(
        { times: keys.map((k) => k.time), values: keys.map((k) => k.value) },
        phase,
        axis
      )
    : 1;
}

/** Fixed-grid semi-implicit acceleration/drag, interpolating the final display
 * interval. Reconstructing from age makes random seeks independent of history.
 * This is the stepped reconstruction policy, not a native cadence claim. */
export function grompDeathTravel(
  velocity: number[],
  acceleration: number[],
  drag: number[],
  age: number
) {
  const ticks = age * TICK_RATE,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  const position = [0, 0, 0],
    travel = [...velocity];
  for (let step = 1; step <= whole + (fraction > 0 ? 1 : 0); step++)
    for (let axis = 0; axis < 3; axis++) {
      travel[axis] =
        (travel[axis] + acceleration[axis] / TICK_RATE) * Math.max(0, 1 - drag[axis] / TICK_RATE);
      position[axis] += (travel[axis] / TICK_RATE) * (step <= whole ? 1 : fraction);
    }
  return { position, travel };
}

/** All single emitters burst on death+1. Indexed chance/roll reproduce every
 * source multiplier and atlas choice without consuming the simulation RNG. */
export function grompDeathParticles(deathTick: number, tick: number, id = 0) {
  if (!Number.isFinite(deathTick) || !Number.isFinite(tick)) return [];
  const age = (tick - deathTick - 1) / TICK_RATE;
  if (age < 0) return [];
  return source.profiles.flatMap((p, profileIndex) => {
    const seed = id ^ Math.imul(deathTick, 0x9e3779b9) ^ Math.imul(p.sourceIndex + 1, 0x85ebca6b);
    return Array.from({ length: p.count }, (_, index) => {
      const ordinal = index + 1,
        chance = luxHoopChance(seed, ordinal),
        roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
      const birth = (
        value: number[],
        probabilities: Parameters<typeof luxBeamBirthOffset>[0]['probabilities']
      ) => luxBeamBirthOffset({ value, probabilities }, chance);
      const life = birth([p.life], [p.probabilities.life])[0];
      if (age >= life) return [];
      const phase = age / life,
        velocity = new Vector3(...birth(p.velocity, p.probabilities.velocity)),
        origin = new Vector3(...birth(p.offset, p.probabilities.offset));
      for (const shape of p.shape) {
        const angle = (birth([shape.value], [shape.probability])[0] * Math.PI) / 180,
          axis = new Vector3(...shape.axis).normalize();
        velocity.applyAxisAngle(axis, angle);
        origin.applyAxisAngle(axis, angle);
      }
      const motion = grompDeathTravel(velocity.toArray(), p.acceleration, p.drag, age),
        scale = birth(p.size, p.probabilities.size).map(
          (v, axis) => v * sample(p.scaleCurve, phase, axis)
        ),
        rotation = birth(p.rotation, p.probabilities.rotation);
      if (p.uniform) scale.fill(scale[0]);
      if (p.rotationCurve.length)
        for (let axis = 0; axis < 3; axis++)
          rotation[axis] +=
            p.rotationRate[axis] *
            TICK_RATE *
            accumulateParticleCurve(
              {
                times: p.rotationCurve.map((k) => k.time),
                values: p.rotationCurve.map((k) => k.value),
              },
              age,
              life,
              axis
            );
      const frame =
        (p.atlas.start +
          (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0) +
          Math.floor(p.atlas.fps * age)) %
        (p.atlas.grid[0] * p.atlas.grid[1]);
      return [
        {
          profileIndex,
          ordinal,
          age,
          life,
          phase,
          scale,
          rotation,
          frame,
          color: p.color.map((v, axis) => v * sample(p.colorCurve, phase, axis)),
          offset: origin.toArray().map((v, axis) => v + p.postOffset[axis] + motion.position[axis]),
          scroll: birth(p.uvOffset, p.probabilities.uvOffset).map(
            (v, axis) => v + p.scroll[axis] * age
          ),
        },
      ];
    }).flat();
  });
}
