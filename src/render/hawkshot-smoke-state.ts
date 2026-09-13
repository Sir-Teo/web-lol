import { HAWKSHOT_SMOKE as S } from '../content/hawkshot-smoke';
import type { ScoutFlight } from '../simulation/types';
function random(id: number, index: number, channel: number) {
  let n = Math.imul(id ^ 0x6d2b79f5, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35) ^ channel;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function smokeParticles(flight: ScoutFlight, seconds: number) {
  const start = (flight.launchTick - 1) / 60,
    stop = flight.arrivalTick === undefined ? Infinity : flight.arrivalTick / 60;
  const from = Math.max(0, Math.ceil((seconds - S.lifetime - start) * S.rate));
  const to = Math.floor((Math.min(seconds, stop) - start) * S.rate),
    particles = [];
  for (let index = from; index <= to; index++) {
    const born = start + index / S.rate,
      age = seconds - born;
    const life =
      S.lifetime *
      (S.lifeRange[0] + (S.lifeRange[1] - S.lifeRange[0]) * random(flight.id, index, 0));
    if (born >= stop || age < 0 || age >= life || seconds >= stop + S.linger) continue;
    const t = age / life,
      growth = S.scaleCurve[0] + (S.scaleCurve[1] - S.scaleCurve[0]) * t;
    const distance = Math.min(flight.distance ?? Infinity, (born - start) * flight.speed);
    const alpha =
      t <= S.colorTimes[1]
        ? (S.alphaValues[1] * t) / S.colorTimes[1]
        : (S.alphaValues[1] * (1 - t)) / (1 - S.colorTimes[1]);
    particles.push({
      index,
      age,
      life,
      x: flight.origin.x + flight.direction.x * distance,
      y: flight.origin.y + flight.direction.y * distance,
      width:
        S.birthScale[0] *
        (S.scaleRange[0] + (S.scaleRange[1] - S.scaleRange[0]) * random(flight.id, index, 1)) *
        growth *
        0.01,
      height: S.birthScale[1] * growth * 0.01,
      rotation:
        ((S.rotationRange[0] +
          random(flight.id, index, 2) * (S.rotationRange[1] - S.rotationRange[0])) *
          Math.PI) /
        180,
      frame: Math.floor(random(flight.id, index, 3) * 4),
      alpha,
      erosion: t,
    });
  }
  return particles;
}
