import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const state = w.championState(lux.id)!;
  return { w, lux, state };
}

test('Lux owns distinct base stats, nonlinear growth, attack ratio and regeneration', () => {
  const { w, lux } = setup();
  expect([lux.maxHp, lux.maxMana, lux.damage, lux.armor, lux.magicResist]).toEqual([
    580, 440, 54, 21, 30,
  ]);
  expect([lux.speed, lux.range, lux.windupTicks, lux.missileSpeed]).toEqual([330, 550, 14, 1600]);
  lux.hp -= 100;
  lux.mana -= 100;
  w.step(60);
  expect(lux.hp).toBeCloseTo(481.1);
  expect(lux.mana).toBeCloseTo(341.8);
  w.gainExperience(280, lux.id);
  expect(lux.maxHp).toBeCloseTo(651.28);
  expect(lux.maxMana).toBeCloseTo(456.92);
  w.gainExperience(1e6, lux.id);
  expect([lux.maxHp, lux.maxMana, lux.damage, lux.armor, lux.magicResist]).toEqual([
    2263, 839.5, 110.1, 109.4, 52.1,
  ]);
  expect(lux.attackPeriod).toBe(Math.round(60 / (0.669 + 0.625 * 0.03 * 17)));
  expect(lux.windupTicks).toBe(9);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('ordinary Q captures AP damage, spends own mana/cooldown and resumes saved windup', () => {
  const { w, lux, state } = setup();
  state.inventory.push('tome');
  const enemies = [300, 600, 900].map((x) => w.spawn('champion', 'red', { x, y: 0 }));
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
  w.step();
  expect(lux.mana).toBeCloseTo(390.03);
  expect(state.cooldowns.q).toBe(601);
  expect(state.pendingCast).toMatchObject({
    ability: 'q',
    damage: 95,
    startTick: 1,
    releaseTick: 16,
  });
  expect(w.player.cooldowns.q).toBe(0);
  state.inventory.length = 0;
  w.step(14);
  expect(w.projectiles).toHaveLength(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.projectiles[0]).toMatchObject({ type: 'binding', source: lux.id, damage: 95 });
    world.step(40);
    expect(enemies.map((u) => world.unit(u.id)!.rootUntil > world.tick)).toEqual([
      true,
      true,
      false,
    ]);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('Lux basic attacks do not build Focus or apply Frost Shot', () => {
  const { w, lux, state } = setup();
  const enemy = w.spawn('champion', 'red', { x: 300, y: 0 });
  w.setOrder(lux, { type: 'attack', target: enemy.id });
  w.step(180);
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
  expect(enemy.slowUntil).toBe(0);
  expect(state.qStacks).toBe(0);
  expect(state.qUntil).toBe(0);
});

test('Lux saves reject crossed champion state', () => {
  const { w, lux, state } = setup();
  const saved = JSON.parse(w.snapshot());
  const record = saved.units.find((u: { id: number }) => u.id === lux.id);
  delete record.champion;
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  record.champion = 'lux';
  state.qUntil = 100;
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
});
