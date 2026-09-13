import { HAWKSHOT_DUST as D } from '../content/hawkshot-dust';
import type { ScoutFlight } from '../simulation/types';

function random(id: number, index: number, channel: number) {
  let n = Math.imul(id ^ 0x4cf5ad43, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35) ^ channel;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Fixed birth-relative 60 Hz reconstruction of the documented preview-adapter motion policy. */
export function dustParticles(flight: ScoutFlight, seconds: number) {
  const start = (flight.launchTick - 1) / 60;
  const stop = flight.arrivalTick === undefined ? Infinity : flight.arrivalTick / 60;
  const maxLife = D.lifetime * D.lifeRange[1];
  const from = Math.max(0, Math.ceil((seconds - maxLife - start) * D.rate));
  const to = Math.floor((Math.min(seconds, stop) - start) * D.rate);
  const traveled = (time: number) =>
    Math.min(flight.distance ?? Infinity, Math.max(0, time - start) * flight.speed);
  const particles = [];
  for (let index = from; index <= to; index++) {
    const born = start + index / D.rate,
      age = seconds - born;
    const sample = (range: readonly number[], channel: number) =>
      range[0] + (range[1] - range[0]) * random(flight.id, index, channel);
    const life = D.lifetime * sample(D.lifeRange, 0);
    if (born >= stop || age < 0 || age >= life || seconds >= stop + D.linger) continue;
    // Local +Z follows the scout. Box Size is provisionally treated as half-extents.
    let x = (random(flight.id, index, 1) * 2 - 1) * D.box[0];
    let y = (random(flight.id, index, 2) * 2 - 1) * D.box[1];
    let z = traveled(born) + (random(flight.id, index, 3) * 2 - 1) * D.box[2];
    let vy = D.velocity[1];
    const orbit = D.orbitalRanges.map((range, i) => sample(range, 4 + i));
    for (let time = 0; time < age;) {
      const dt = Math.min(1 / 60, age - time);
      time += dt;
      vy *= Math.exp(-D.drag[1] * dt);
      y += vy * dt;
      const center = traveled(born + time);
      z -= center;
      // Quaternion yaw/pitch/roll convention: rotate Z, then X, then Y.
      const rz = orbit[2] * dt,
        rx = orbit[0] * dt,
        ry = orbit[1] * dt;
      const ax = x * Math.cos(rz) - y * Math.sin(rz),
        ay = x * Math.sin(rz) + y * Math.cos(rz);
      const by = ay * Math.cos(rx) - z * Math.sin(rx),
        bz = ay * Math.sin(rx) + z * Math.cos(rx);
      x = ax * Math.cos(ry) + bz * Math.sin(ry);
      y = by;
      z = -ax * Math.sin(ry) + bz * Math.cos(ry) + center;
    }
    const t = age / life;
    particles.push({
      index,
      age,
      life,
      x: flight.origin.x + flight.direction.y * x + flight.direction.x * z,
      y: flight.origin.y - flight.direction.x * x + flight.direction.y * z,
      lift: y * 0.01,
      birthPoint: {
        x: flight.origin.x + flight.direction.x * traveled(born),
        y: flight.origin.y + flight.direction.y * traveled(born),
      },
      size:
        D.birthScale *
        sample(D.scaleRange, 7) *
        (D.scaleCurve[0] + (D.scaleCurve[1] - D.scaleCurve[0]) * t) *
        0.01,
      rotation: (sample(D.rotationRange, 8) * Math.PI) / 180,
      frame: Math.floor(random(flight.id, index, 9) * 4),
      alpha: D.color[3] * (1 - t),
    });
  }
  return particles;
}
