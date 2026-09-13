import { HAWKSHOT_SPARKLE as S } from '../content/hawkshot-sparkle';
import type { ScoutVisual } from '../simulation/types';

export function sparkleParticles(effect: ScoutVisual, seconds: number) {
  const particles = [];
  const duration = Math.min(S.duration, (effect.stopTick - effect.flight.arrivalTick) / 60);
  for (let birth = 1; birth <= Math.floor(duration * S.rate); birth++) {
    const age = seconds - (effect.flight.arrivalTick / 60 + birth / S.rate);
    if (age < 0 || age >= S.life * Math.max(...S.lifeRange)) continue;
    const random = (component: number) => {
      let n = Math.imul(
        effect.flight.id ^ Math.imul(birth, 0x85ebca6b) ^ Math.imul(component + 1, 0x52dce729),
        0x7feb352d
      );
      n = Math.imul(n ^ (n >>> 16), 0x846ca68b);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const life = S.life * (S.lifeRange[0] + (S.lifeRange[1] - S.lifeRange[0]) * random(0));
    if (age >= life) continue;
    const t = age / life,
      k = t <= S.growthTimes[1] ? 0 : 1;
    const growth =
      S.growth[k] +
      ((S.growth[k + 1] - S.growth[k]) * (t - S.growthTimes[k])) /
        (S.growthTimes[k + 1] - S.growthTimes[k]);
    const angle = random(1) * Math.PI * 2,
      x = S.shape[0] * random(2),
      z = S.shape[2] * random(3);
    particles.push({
      birth,
      age,
      life,
      x: effect.x + S.offset[0] + x * Math.cos(angle) + z * Math.sin(angle),
      y: effect.y + S.offset[2] - x * Math.sin(angle) + z * Math.cos(angle),
      height:
        (S.offset[1] +
          S.shape[1] * random(4) +
          S.velocity[1] *
            (S.velocityRange[0] + (S.velocityRange[1] - S.velocityRange[0]) * random(5)) *
            age) *
        0.01,
      size:
        S.scale *
        (S.scaleRange[0] + (S.scaleRange[1] - S.scaleRange[0]) * random(6)) *
        growth *
        0.01,
      alpha: S.color[3] * (1 - t),
    });
  }
  return particles;
}
