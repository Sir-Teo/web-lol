import { describe, expect, it } from 'vitest';
import { luxAttackHoopParticles } from '../src/render/lux-attack-hoops';
import { luxHoopParticles } from '../src/render/lux-hoop-particles';
import type { LuxAttackVisual } from '../src/simulation/types';

function effect(): LuxAttackVisual {
  return {
    id: 42,
    sourceId: 1,
    team: 'blue',
    origin: { x: 100, y: 200 },
    launchTick: 100,
    stopTick: null,
    frames: Array.from({ length: 31 }, (_, i) => ({
      tick: 100 + i,
      x: 100 + i * 20,
      y: 200,
      facing: Math.PI / 2,
      trailDistance: i * 20,
    })),
  };
}
describe('Lux hoop birth attachment', () => {
  it('rotates local offsets through each birth pose and preserves the birth trail', () => {
    const e = effect();
    const local = luxHoopParticles(e.id, 0.5);
    const world = luxAttackHoopParticles(e, 130);
    expect(world.length).toBeGreaterThan(10);
    world.forEach((p, i) => {
      expect(p.position[0]).toBeCloseTo(100 + p.birthTick * 20 + local[i].position[2]);
      expect(p.position[1]).toBe(local[i].position[1]);
      expect(p.position[2]).toBeCloseTo(200 - local[i].position[0]);
    });
    e.frames.push({ tick: 131, x: -900, y: -900, facing: 0, trailDistance: 2000 });
    expect(luxAttackHoopParticles(e, 130)).toEqual(world);
  });
  it('replays exactly after JSON restore and retains only pre-stop births', () => {
    const e = effect();
    e.stopTick = 130;
    const restored = JSON.parse(JSON.stringify(e));
    for (const tick of [130, 135.5, 140, 130, 166]) {
      const particles = luxAttackHoopParticles(e, tick);
      expect(luxAttackHoopParticles(restored, tick)).toEqual(particles);
      expect(particles.every((p) => p.birthTick <= 30)).toBe(true);
    }
    expect(luxAttackHoopParticles(e, 167)).toEqual([]);
  });
  it('does not invent positions outside the saved path', () => {
    const e = effect();
    e.frames = e.frames.slice(29);
    expect(luxAttackHoopParticles(e, 130).every((p) => p.birthTick >= 29)).toBe(true);
    expect(luxAttackHoopParticles(e, 100)).toEqual([]);
  });
});
