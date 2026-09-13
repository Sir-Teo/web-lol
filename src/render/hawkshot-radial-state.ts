import { HAWKSHOT_RADIAL as R } from '../content/hawkshot-radial';
import type { ScoutFlight } from '../simulation/types';

/** Inverse integral of the linear normalized-emitter-age rate curve. */
export function radialBirth(index: number) {
  const slope = (R.rate[1] - R.rate[0]) / R.duration;
  return (2 * index) / (R.rate[0] + Math.sqrt(R.rate[0] ** 2 + 2 * slope * index));
}
export function radialParticles(flight: ScoutFlight, seconds: number) {
  if (flight.arrivalTick === undefined) return [];
  const result = [];
  const count = Math.floor((R.rate[0] + R.rate[1]) * 0.5 * R.duration);
  for (let index = 1; index <= count; index++) {
    const born = radialBirth(index),
      age = seconds - (flight.arrivalTick / 60 + born);
    if (age < 0 || age >= R.life * Math.max(...R.lifeRange)) continue;
    const random = (component: number) => {
      let n = Math.imul(
        flight.id ^ Math.imul(index, 0x85ebca6b) ^ Math.imul(component + 1, 0x52dce729),
        0x7feb352d
      );
      n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const life = R.life * (R.lifeRange[0] + (R.lifeRange[1] - R.lifeRange[0]) * random(0));
    if (age >= life) continue;
    const t = age / life,
      angle = random(1) * 2 * Math.PI;
    const velocity =
      R.velocity[0] * (R.velocityRange[0] + (R.velocityRange[1] - R.velocityRange[0]) * random(2));
    const radius = R.radius[0] + ((R.radius[1] - R.radius[0]) * born) / R.duration;
    const distance = radius + (velocity / R.drag[0]) * (1 - Math.exp(-R.drag[0] * age));
    const speed = velocity * Math.exp(-R.drag[0] * age);
    result.push({
      index,
      age,
      life,
      frame: Math.floor(random(3) * 4),
      offset: [
        Math.cos(angle) * distance,
        R.offset[1] + R.velocity[1] * age,
        -Math.sin(angle) * distance,
      ],
      velocity: [Math.cos(angle) * speed, R.velocity[1], -Math.sin(angle) * speed],
      size: R.scale.map(
        (s, i) => s * (R.growth[0][i] + (R.growth[1][i] - R.growth[0][i]) * t) * 0.01
      ),
      alpha: R.color[3] * (1 - t),
    });
  }
  return result;
}
