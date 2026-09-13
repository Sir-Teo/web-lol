import { ARRIVAL_GLOWS, ARRIVAL_GLOW_RAMP as R } from '../content/hawkshot-arrival-glows';
import type { ScoutFlight } from '../simulation/types';

/** Raw decoded color samples with the attributed preview adapter's endpoint interpolation. */
export function arrivalGlowRamp(t: number) {
  const x = Math.max(0, Math.min(1, t)) * (R.length - 1),
    a = Math.floor(x),
    b = Math.min(a + 1, R.length - 1);
  return R[a].map((v, i) => (v + (R[b][i] - v) * (x - a)) / 255);
}
export function arrivalGlows(flight: ScoutFlight, seconds: number) {
  if (flight.arrivalTick === undefined) return [];
  const result = [];
  for (let layer = 0; layer < ARRIVAL_GLOWS.length; layer++) {
    const e = ARRIVAL_GLOWS[layer];
    // Rate accumulation starts at zero: first birth occurs after one emission interval.
    for (let birth = 1; birth <= Math.floor(e.rate * e.duration); birth++) {
      const born = flight.arrivalTick / 60 + birth / e.rate;
      const age = seconds - born;
      if (age < 0 || age >= e.life) continue;
      let n = Math.imul(flight.id ^ Math.imul(layer + 1, 0x85ebca6b) ^ birth, 0x7feb352d);
      n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
      const random = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      const t = age / e.life,
        ramp = arrivalGlowRamp(t);
      result.push({
        layer,
        birth,
        age,
        size: e.scale * (e.scaleRange[0] + (e.scaleRange[1] - e.scaleRange[0]) * random) * 0.01,
        color: e.color.slice(0, 3).map((v, i) => v * ramp[i]),
        alpha: e.color[3] * (1 - t) * ramp[3],
      });
    }
  }
  return result;
}
