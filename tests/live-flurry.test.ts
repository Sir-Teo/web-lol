import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function launch(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const source = w.spawn('champion', team, { x: 0, y: 0 });
  const target = w.spawn('dummy', team === 'blue' ? 'red' : 'blue', { x: 550, y: 0 });
  target.armor = 100;
  w.championState(source.id)!.qUntil = 360;
  w.setOrder(source, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  w.setOrder(source, { type: 'idle' });
  return { w, source, target };
}
for (const team of ['blue', 'red'] as const) {
  test(`${team} Q emits five separately mitigated impacts and saves between launches`, () => {
    const { w, source, target } = launch(team);
    const firstTick = w.projectiles[0].launchTick!;
    expect(w.pendingAttackProjectiles.map((p) => p.launchTick)).toEqual(
      [4, 8, 12, 16].map((n) => n + firstTick)
    );
    expect(w.projectiles[0].flurryShot).toBe(0);
    w.step(5);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.championState(source.id)!.qUntil = world.tick;
      world.unit(source.id)!.damage = 500;
      world.step(40);
      expect(world.unit(target.id)!.maxHp - world.unit(target.id)!.hp).toBeCloseTo(32.45);
      const hits = world.events.filter((e) => e.type === 'damage' && e.unit === target.id);
      expect(hits).toHaveLength(5);
      expect(hits.slice(1).map((hit, i) => hit.tick - hits[i].tick)).toEqual([4, 4, 4, 4]);
      expect(world.pendingAttackProjectiles).toHaveLength(0);
      expect(world.projectiles).toHaveLength(0);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}

test('a committed flurry survives source death but stops when the target dies', () => {
  const { w, source, target } = launch();
  w.damage(target, source, 10000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(40);
    expect(world.events.filter((e) => e.type === 'damage' && e.unit === target.id)).toHaveLength(5);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  const other = launch();
  other.target.hp = 1;
  other.w.step(40);
  expect(
    other.w.events.filter((e) => e.type === 'damage' && e.unit === other.target.id)
  ).toHaveLength(1);
  expect(other.w.projectiles).toHaveLength(0);
  expect(other.w.pendingAttackProjectiles).toHaveLength(0);
});

test('resistance is sampled at each arrow impact, not once for the burst', () => {
  const { w, target } = launch();
  while (target.hp === target.maxHp) w.step();
  const frostDeadline = target.slowUntil;
  target.armor = 0;
  w.step(30);
  expect(target.maxHp - target.hp).toBeCloseTo(6.49 + 4 * 12.98);
  expect(target.slowUntil).toBe(frostDeadline);
});

test('pending flurry validation rejects past launch ticks and duplicate identities', () => {
  const { w } = launch();
  for (const mutate of [
    (s: any) => {
      s.pendingAttackProjectiles[0].launchTick = s.tick;
    },
    (s: any) => {
      s.pendingAttackProjectiles[0].flurryShot = 0;
    },
    (s: any) => {
      s.pendingAttackProjectiles[0].id = s.projectiles[0].id;
    },
  ]) {
    const saved = JSON.parse(w.snapshot());
    mutate(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
