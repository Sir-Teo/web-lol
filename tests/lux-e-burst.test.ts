import { expect, test, vi } from 'vitest';
import profiles from '../src/content/lux-e-burst.json';
import pin from '../docs/reference/lux-e-vfx.json';
import { luxEBurstParticles, luxEBurstTravel } from '../src/render/lux-e-burst-particles';
import { particleTravel } from '../src/render/particle-motion';
import { LUX_E_BURST_TICKS } from '../src/content/lux-e-particle-timing';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('all three detonation motion records retain their independent source budgets and authored atlas', () => {
  expect(profiles.map((p) => p.index)).toEqual([5, 7, 8]);
  for (const p of profiles) {
    const e = pin.definitions.Lux_E_tar_nova.complexEmitterDefinitionData[p.index];
    expect(p.name).toBe(e.emitterName);
    expect(p.rate).toBe(e.rate.constantValue);
    expect(p.emitterLife).toBe(e.lifetime);
  }
  expect(profiles.map((p) => p.rate)).toEqual([140, 200, 40]);
  expect(profiles[2].atlas).toEqual({ grid: [2, 2], frames: 4, random: true });
  expect(profiles[2].cylinderRadius).toBe(150);
  expect(profiles[2].cylinderFlags).toBe(1);
});
test('continuous motes obey the shared emission grid while the forty-particle burst begins immediately', () => {
  expect(luxEBurstParticles(12, -0.01)).toEqual([]);
  const count = (time: number) =>
    profiles.map((_, i) => luxEBurstParticles(12, time).filter((p) => p.profileIndex === i).length);
  expect(count(0)).toEqual([0, 0, 40]);
  expect(count(1 / 60)).toEqual([2, 3, 40]);
  const late = luxEBurstParticles(12, 0.175);
  expect(late.filter((p) => p.profileIndex === 0)).toHaveLength(23);
  expect(Math.max(...late.filter((p) => p.profileIndex === 1).map((p) => p.ordinal))).toBe(20);
  expect(luxEBurstParticles(12, LUX_E_BURST_TICKS / 60)).toEqual([]);
});
test('motion, birth colors and random atlas choices seek exactly without consuming global randomness', () => {
  const random = vi.spyOn(Math, 'random');
  try {
    const a = luxEBurstParticles(91, 0.3);
    luxEBurstParticles(99, 1.1);
    expect(luxEBurstParticles(91, 0.3)).toEqual(a);
    expect(luxEBurstParticles(92, 0.3)).not.toEqual(a);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});
test('closed-form constant motion matches independent fixed steps, including fractional seeks and zero drag', () => {
  for (const drag of [
    [5, 5, 5],
    [4, 4, 4],
    [0, 0, 0],
    [60, 80, 1],
  ])
    for (const age of [0, 1 / 120, 1 / 60, 0.075, 0.2, 0.7, 1.6001]) {
      const actual = luxEBurstTravel([1700, 100, -350], [0, 40, 0], drag, age),
        expected = particleTravel([1700, 100, -350], [0, 40, 0], drag, age);
      actual.position.forEach((v, i) => expect(v).toBeCloseTo(expected.position[i], 8));
      actual.travel.forEach((v, i) => expect(v).toBeCloseTo(expected.travel[i], 8));
    }
});
test('cylinder points stay inside the source disk and all atlas cells retain per-particle lookup and tint', () => {
  const born = luxEBurstParticles(12, 0).filter((p) => p.profileIndex === 2);
  expect(born).toHaveLength(40);
  expect(new Set(born.map((p) => p.frame)).size).toBe(4);
  for (const p of born) {
    expect(Math.hypot(p.position[0], p.position[2])).toBeLessThanOrEqual(150);
    expect(p.position[1]).toBe(-50);
    expect(p.lookup[1]).toBe(p.chance);
    expect(p.scale).toEqual([0, 0, 0]);
  }
  const alive = luxEBurstParticles(12, 0.18).filter((p) => p.profileIndex === 2);
  expect(new Set(alive.map((p) => p.color[3])).size).toBeGreaterThan(1);
  expect(alive.every((p) => p.scale[0] === p.scale[1] && p.scale[1] === p.scale[2])).toBe(true);
});
test('sampled lives fit the saved tail while meaningful particles remain after the old forty-three-tick bound', () => {
  expect(LUX_E_BURST_TICKS).toBe(108);
  const late = luxEBurstParticles(91, 0.9);
  expect(late.length).toBeGreaterThan(0);
  for (const p of late) expect(p.birthSeconds + p.life).toBeLessThan(LUX_E_BURST_TICKS / 60);
  expect(
    late.every((p) => [...p.position, ...p.scale, ...p.color, p.stretch].every(Number.isFinite))
  ).toBe(true);
});
test('a restored late E explosion neither damages again nor extends slow or vision', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
    dummy = w.spawn('dummy', 'red', { x: 600, y: 0 });
  dummy.hp = dummy.maxHp = 5000;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: dummy });
  w.step(45);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: dummy });
  w.step();
  expect(w.singularities[0].detonatedTick).toBe(w.tick);
  const point = { x: w.singularities[0].x, y: w.singularities[0].y },
    hp = dummy.hp;
  for (const u of w.units.filter((u) => u.team === 'blue')) {
    u.x = u.y = -5000;
    u.previous = { x: u.x, y: u.y };
    w.setOrder(u, { type: 'idle' });
  }
  w.step(70);
  expect(w.singularities).toHaveLength(1);
  expect(dummy.hp).toBe(hp);
  expect(w.slowFactor(dummy)).toBe(1);
  expect(w.pointVisible(point)).toBe(false);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(LUX_E_BURST_TICKS);
  copy.step(LUX_E_BURST_TICKS);
  expect(w.singularities).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(dummy.hp).toBe(hp);
});
