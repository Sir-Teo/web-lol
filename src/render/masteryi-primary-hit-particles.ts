import { Quaternion, Vector3 } from 'three';
import data from '../content/masteryi-primary-hit-particles.json';
import type { MasterYiAttackKind } from '../simulation/masteryi-attack-kind';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipseValue, eclipseUv, type EclipseValue } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { spatialDragTravel } from './particle-spatial-drag';

/** All eleven source emitters on the local indexed first-update/force grid.
 * No world RNG, IDs or mutable particle clocks are consumed. */
export function primaryHitParticles(
  seed: number,
  time: number,
  kind: MasterYiAttackKind,
  radius: number
) {
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(radius) || radius < 0) return [];
  return data.profiles.flatMap((p, profileIndex) => {
    if (p.role !== kind) return [];
    const emitterSeed = seed ^ Math.imul(profileIndex + 1, 0x85ebca6b),
      rate = eclipseValue(p.rate, 0, luxHoopChance(emitterSeed, 0))[0],
      count = p.single
        ? time * 60 >= 1
          ? Math.max(1, Math.trunc(rate))
          : 0
        : luxEmissionCount(rate, time * 60, p.emitterLife),
      particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const bornTick = p.single ? 1 : luxEmissionBirthTick(rate, ordinal),
        age = time - bornTick / 60,
        birthPhase = Math.min(1, bornTick / 60 / p.emitterLife),
        chance = luxHoopChance(emitterSeed, ordinal),
        roll = luxHoopChance(emitterSeed ^ 0x27d4eb2d, ordinal),
        sample = (v: EclipseValue) => eclipseValue(v, birthPhase, chance),
        life = sample(p.life)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        turn = new Quaternion(),
        spawn = new Vector3(...sample(p.shape.offset));
      if (p.boundOffset !== null) spawn.multiplyScalar(radius * 2 * p.boundOffset);
      p.shape.angles.forEach((angle, index) => {
        const axis = new Vector3(...p.shape.axes[index]);
        if (axis.lengthSq())
          turn.multiply(
            new Quaternion().setFromAxisAngle(axis.normalize(), (sample(angle)[0] * Math.PI) / 180)
          );
      });
      spawn.applyQuaternion(turn);
      const origin = sample(p.position).map((x, axis) => x + spawn.getComponent(axis)),
        velocity = new Vector3(...sample(p.velocity)).applyQuaternion(turn).toArray(),
        fieldAcceleration = sample(p.fields.acceleration),
        acceleration = sample(p.worldAcceleration).map((x, axis) => x + fieldAcceleration[axis]),
        field = p.fields.drag,
        motion = spatialDragTravel(
          velocity,
          acceleration,
          sample(p.birthDrag),
          origin,
          age,
          field
            ? {
                position: sample(field.position),
                radius: sample(field.radius)[0],
                strength: sample(field.strength)[0],
              }
            : null
        ),
        scale = eclipseValue(p.scale, phase),
        size = sample(p.size).map((x, axis) => x * scale[axis]),
        color = eclipseValue(p.color, phase),
        uv = eclipseUv(p.uv, age, life, birthPhase, phase, chance, roll),
        columns = p.uv.divisions[0],
        rows = p.uv.divisions[1],
        frame =
          (p.uv.startFrame +
            (p.uv.randomStart ? Math.floor(roll * p.uv.frames) : 0) +
            Math.floor(age * p.uv.frameRate)) %
          (columns * rows);
      if (p.uniform) size.fill(size[0]);
      uv.cell = [(frame % columns) / columns, Math.floor(frame / columns) / rows];
      particles.push({
        profileIndex,
        ordinal,
        bornTick,
        age,
        life,
        naturalLife: life,
        phase,
        offset: origin.map((x, axis) => x + motion.position[axis]),
        size,
        color: sample(p.birthColor).map((x, axis) => x * color[axis]),
        rotation: sample(p.rotation),
        spawnTurn: turn.toArray(),
        travel: motion.travel,
        stretch: 1,
        bind: eclipseValue(p.bind, Math.min(1, time / p.emitterLife))[0],
        lookup: particleColorLookup(p, phase, roll, motion.travel),
        uv,
        multUv: null,
        erosion: 0,
      });
    }
    return particles;
  });
}
