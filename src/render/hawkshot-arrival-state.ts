import { HAWKSHOT_ARRIVAL as A } from '../content/hawkshot-arrival';
import type { ScoutFlight } from '../simulation/types';

export function arrivalAurora(flight: ScoutFlight, seconds: number) {
  if (flight.arrivalTick === undefined) return null;
  let n = Math.imul(flight.id ^ 0x52dce729, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  const random = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  const life = A.lifetime * (A.lifeRange[0] + (A.lifeRange[1] - A.lifeRange[0]) * random);
  const age = seconds - flight.arrivalTick / 60;
  if (age < 0 || age >= life) return null;
  const t = age / life;
  const alpha =
    t <= A.alphaTimes[1]
      ? (A.alphaValues[1] * t) / A.alphaTimes[1]
      : (A.alphaValues[1] * (1 - t)) / (1 - A.alphaTimes[1]);
  return {
    age,
    life,
    alpha: alpha * A.birthColor[3],
    lift: (A.offset[1] + (A.velocity[1] / A.drag[1]) * (1 - Math.exp(-A.drag[1] * age))) * 0.01,
  };
}
