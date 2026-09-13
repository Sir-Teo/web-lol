import { HAWKSHOT_SNOW } from '../content/hawkshot-snow';
import type { ScoutVisual } from '../simulation/types';

export function snowParticles(effect: ScoutVisual, seconds: number, layer: number) {
  const S = HAWKSHOT_SNOW[layer],
    start = effect.flight.arrivalTick / 60;
  const duration = Math.min(S.duration, effect.stopTick / 60 - start);
  const from = Math.max(1, Math.ceil((seconds - start - S.life) * S.rate));
  const to = Math.min(Math.floor(duration * S.rate), Math.floor((seconds - start) * S.rate));
  const particles = [];
  for (let birth = from; birth <= to; birth++) {
    const age = seconds - (start + birth / S.rate);
    const random = (component: number) => {
      let n = Math.imul(
        effect.flight.id ^
          Math.imul(birth, 0x85ebca6b) ^
          Math.imul(component + 1 + layer * 17, 0x52dce729),
        0x7feb352d
      );
      n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const range = (values: readonly number[], c: number) =>
      values[0] + (values[1] - values[0]) * random(c);
    const life = S.life * range(S.lifeRange, 0);
    if (age < 0 || age >= life) continue;
    const angle = random(1) * Math.PI * 2,
      sx = S.shape[0] * random(2),
      sz = S.shape[2] * random(3);
    let x = sx * Math.cos(angle) + sz * Math.sin(angle),
      z = -sx * Math.sin(angle) + sz * Math.cos(angle),
      y = S.shape[1] * random(4);
    let vy = S.velocity[1] * range(S.velocityRange, 5);
    const oy = S.orbit[1] * range(S.orbitYRange, 6),
      oz = S.orbit[2];
    for (let time = 0; time < age;) {
      const dt = Math.min(1 / 60, age - time);
      time += dt;
      vy = (vy + S.acceleration[1] * dt) * Math.exp(-S.drag[1] * dt);
      y += vy * dt;
      const ax = x * Math.cos(oz * dt) - y * Math.sin(oz * dt),
        ay = x * Math.sin(oz * dt) + y * Math.cos(oz * dt);
      x = ax * Math.cos(oy * dt) + z * Math.sin(oy * dt);
      z = -ax * Math.sin(oy * dt) + z * Math.cos(oy * dt);
      y = ay;
    }
    const t = age / life,
      growth = S.growth[0] + (S.growth[1] - S.growth[0]) * t;
    const width = S.scale[0] * range(S.scaleRange, 7) * growth * 0.01;
    particles.push({
      birth,
      age,
      life,
      x: effect.x + S.offset[0] + x,
      y: effect.y + S.offset[2] + z,
      height: (S.offset[1] + y) * 0.01,
      vy,
      width,
      heightSize: S.uniform ? width : S.scale[1] * growth * 0.01,
      rotation: (S.spin * range(S.spinRange, 8) * age * Math.PI) / 180,
      frame: Math.floor(random(9) * 4),
      alpha: S.color[3] * (1 - t),
    });
  }
  return particles;
}
