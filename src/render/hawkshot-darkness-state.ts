import { HAWKSHOT_DARKNESS as D } from '../content/hawkshot-darkness';
import type { ScoutFlight } from '../simulation/types';

export function darknessLife(random: number) {
  const p = D.lifeProbability;
  const i = random <= p.keyTimes[1] ? 0 : 1;
  return (
    D.life *
    (p.keyValues[i] +
      ((p.keyValues[i + 1] - p.keyValues[i]) * (random - p.keyTimes[i])) /
        (p.keyTimes[i + 1] - p.keyTimes[i]))
  );
}

export function arrivalDarkness(flight: ScoutFlight, seconds: number) {
  if (flight.arrivalTick === undefined) return null;
  const age = seconds - (flight.arrivalTick / 60 + D.delay);
  const random = (component: number) => {
    let n = Math.imul(flight.id ^ Math.imul(component + 1, 0x85ebca6b), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const range = (values: readonly number[], component: number) =>
    values[0] + (values[1] - values[0]) * random(component);
  const life = darknessLife(random(0));
  if (age < 0 || age >= life) return null;
  const t = age / life;
  return {
    age,
    life,
    offset: [
      D.offset[0] +
        D.spawnX * range(D.spawnRange, 1) +
        D.velocity[0] * range(D.velocityRanges[0], 2) * age,
      D.offset[1] + D.velocity[1] * age,
      D.offset[2] + D.velocity[2] * range(D.velocityRanges[1], 3) * age,
    ],
    size: D.scale * range(D.scaleRange, 4) * 0.01,
    rotation: (range(D.rotationRange, 5) * Math.PI) / 180,
    frame: Math.floor(random(6) * D.frames),
    alpha: D.color[3] * range(D.alphaRange, 7) * (1 - t),
    erosion: D.erosion[0] + (D.erosion[1] - D.erosion[0]) * t,
  };
}
