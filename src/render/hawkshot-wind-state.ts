import { HAWKSHOT_WIND as W } from '../content/hawkshot-wind';
import type { ScoutFlight } from '../simulation/types';

const alphaValues = W.colors.map((color) => color[3]);

function random(flight: number, particle: number, component: number): number {
  let n =
    Math.imul(flight ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(particle + 1, 0xc2b2ae35) ^ component;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function curve(times: readonly number[], values: readonly number[], t: number): number {
  for (let i = 1; i < times.length; i++) {
    if (t <= times[i]) {
      const f = Math.max(0, (t - times[i - 1]) / (times[i] - times[i - 1]));
      return values[i - 1] + (values[i] - values[i - 1]) * f;
    }
  }
  return values[values.length - 1];
}

/** Stateless reconstruction; RNG and integration never advance with rendering frequency. */
export function windParticles(flight: ScoutFlight, seconds: number) {
  const start = (flight.launchTick - 1) / 60;
  const stop = flight.arrivalTick === undefined ? Infinity : flight.arrivalTick / 60;
  const first = start + W.delay;
  const maxLife = W.lifetime * Math.max(...W.lifeRange);
  const from = Math.max(0, Math.ceil((seconds - maxLife - first) * W.rate));
  const to = Math.floor((Math.min(seconds, stop) - first) * W.rate);
  const particles = [];
  for (let index = from; index <= to; index++) {
    const born = first + index / W.rate;
    if (born >= stop) continue;
    const sample = (range: readonly number[], channel: number) =>
      range[0] + (range[1] - range[0]) * random(flight.id, index, channel);
    const life = W.lifetime * sample(W.lifeRange, 0);
    const age = seconds - born;
    if (age < 0 || age >= life || seconds >= stop + W.linger) continue;
    const t = age / life;
    const traveled = Math.min(flight.distance ?? Infinity, flight.speed * (born - start));
    particles.push({
      index,
      age,
      life,
      x: flight.origin.x + flight.direction.x * traveled,
      y: flight.origin.y + flight.direction.y * traveled,
      // Analytic constant-drag motion is a local integration policy.
      lift: (W.velocity[1] / W.drag[1]) * (1 - Math.exp(-W.drag[1] * age)) * 0.01,
      rotation: [
        W.rotation[0],
        W.rotation[1] * sample(W.rotationRange, 1) + W.rotationalVelocity[1] * age,
        W.rotation[2],
      ],
      scale: W.scale.map((v, axis) => v * sample(W.scaleRanges[axis], 2 + axis)),
      alpha: curve(W.colorTimes, alphaValues, t),
      erosion: curve(W.erosionTimes, W.erosionValues, t),
    });
  }
  return particles;
}
