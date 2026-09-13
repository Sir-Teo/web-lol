import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const target = w.spawn('champion', 'red', { x: 0, y: 0 });
  const guardian = w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux');
  return { w, target, guardian };
}

for (const kind of ['physical', 'magic', 'true'] as const)
  test(`${kind} damage consumes shields after resistance and passes only overflow to health`, () => {
    const { w, target, guardian } = setup();
    target.armor = target.magicResist = 100;
    w.applyShield(guardian, target, 70, 150);
    w.damage(w.hero, target, 100, kind);
    expect(target.hp).toBe(target.maxHp - (kind === 'true' ? 30 : 0));
    expect(w.shieldAmount(target)).toBe(kind === 'true' ? 0 : 20);
    if (kind !== 'true') {
      w.damage(w.hero, target, 100, kind);
      expect(target.hp).toBe(target.maxHp - 30);
      expect(target.shields).toEqual([]);
    }
  });

test('earlier expiry absorbs first and saved partial shields continue identically', () => {
  const { w, target, guardian } = setup();
  w.applyShield(guardian, target, 50, 150);
  w.applyShield(target, target, 20, 60);
  w.damage(w.hero, target, 30, 'true');
  expect(target.shields).toEqual([{ sourceId: guardian.id, amount: 40, endTick: 150 }]);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(149);
    const victim = world.unit(target.id)!;
    expect(world.shieldAmount(victim)).toBe(40);
    world.step();
    expect(victim.shields).toEqual([]);
    world.damage(world.hero, victim, 50, 'true');
    expect(victim.hp).toBe(victim.maxHp - 50);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('absorbed damage preserves recall, credits combat and contributes to omnivamp', () => {
  const { w, target, guardian } = setup();
  w.player.inventory.push('blade');
  w.hero.hp = 100;
  const state = w.championState(target.id)!;
  state.recallEnd = 480;
  w.applyShield(guardian, target, 100, 150);
  w.damage(w.hero, target, 80, 'true');
  expect(state.recallEnd).toBe(480);
  expect(w.hero.hp).toBe(102);
  expect(state.damageContributors).toEqual([{ sourceId: w.hero.id, lastDamageTick: 0 }]);
  w.damage(w.hero, target, 30, 'true');
  expect(state.recallEnd).toBeNull();
  expect(target.hp).toBe(target.maxHp - 10);
  expect(w.hero.hp).toBe(102.75);
});

test('caster death preserves a shield; victim death and respawn clear it', () => {
  const { w, target, guardian } = setup();
  w.applyShield(guardian, target, 100, 150);
  w.damage(w.hero, guardian, 10000, 'true');
  expect(w.shieldAmount(target)).toBe(100);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.damage(w.hero, target, 10000, 'true');
  expect(target.shields).toEqual([]);
  w.step(target.respawnTick! - w.tick);
  expect(target.deadAt).toBeNull();
  expect(target.shields).toEqual([]);
});

test('invalid shield grants and malformed saved ownership/resources are rejected', () => {
  const { w, target, guardian } = setup();
  for (const amount of [-1, 0, NaN, Infinity]) w.applyShield(guardian, target, amount, 150);
  for (const duration of [-1, 0, 0.5, Infinity]) w.applyShield(guardian, target, 100, duration);
  w.applyShield(w.hero, target, 100, 150);
  expect(target.shields).toEqual([]);
  for (const shields of [
    undefined,
    [{ sourceId: w.hero.id, amount: 100, endTick: 150 }],
    [{ sourceId: guardian.id, amount: 0, endTick: 150 }],
    [{ sourceId: guardian.id, amount: 100, endTick: 0 }],
  ]) {
    const saved = JSON.parse(w.snapshot());
    saved.units.find((u: { id: number }) => u.id === target.id).shields = shields;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
