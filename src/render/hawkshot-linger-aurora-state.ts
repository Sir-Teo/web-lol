import { HAWKSHOT_LINGER_AURORA as A } from '../content/hawkshot-linger-aurora';
import type { ScoutVisual } from '../simulation/types';
export function lingerAurora(effect: ScoutVisual, seconds: number) {
  const age = seconds - effect.flight.arrivalTick / 60;
  const random = (channel: number) => {
    let n = Math.imul(effect.flight.id ^ Math.imul(channel + 1, 0x52dce729), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const life = A.life * (A.lifeRange[0] + (A.lifeRange[1] - A.lifeRange[0]) * random(0));
  if (age < 0 || age >= life) return null;
  const t = age / life,
    i = t <= A.alphaTimes[1] ? 0 : 1;
  const radius = A.radius * Math.sqrt(random(1)),
    angle = random(2) * Math.PI * 2;
  return {
    age,
    life,
    frame: Math.floor(random(3) * 4),
    x: effect.x + A.offset[0] + radius * Math.cos(angle) + A.velocity[0] * age,
    y: effect.y + A.offset[2] + radius * Math.sin(angle) + A.velocity[2] * age,
    height: (A.offset[1] + A.velocity[1] * age) * 0.01,
    alpha:
      A.alpha[i] +
      ((A.alpha[i + 1] - A.alpha[i]) * (t - A.alphaTimes[i])) /
        (A.alphaTimes[i + 1] - A.alphaTimes[i]),
    erosion: A.erosion[0] + (A.erosion[1] - A.erosion[0]) * t,
  };
}
