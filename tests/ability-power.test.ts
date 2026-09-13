import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { ITEMS } from '../src/content/rules';

test('Amplifying Tome matches pinned source stats and prices', () => {
  const source = JSON.parse(readFileSync('docs/reference/amplifying-tome.json', 'utf8')).item;
  const item = ITEMS.find((item) => item.id === 'tome')!;
  expect(item.abilityPower).toBe(source.stats.FlatMagicDamageMod);
  expect(item.price).toBe(source.gold.total);
  expect(item.sell).toBe(source.gold.sell);
});
for (const team of ['blue', 'red'] as const)
  test(`${team} AP stacks independently and R keeps its cast snapshot after sale`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const owner = w.spawn('champion', team, w.battlefield.spawns[team]);
    w.championState(owner.id)!.gold = 800;
    expect(w.buy('tome', owner.id)).toBeNull();
    expect(w.buy('tome', owner.id)).toBeNull();
    expect(w.abilityPower(owner)).toBe(40);
    expect(w.abilityPower()).toBe(0);
    expect(w.volleyDamage(owner)).toBe(60);
    w.enqueue({
      type: 'cast',
      unit: owner.id,
      ability: 'r',
      point: { x: owner.x + 1000, y: owner.y },
    });
    w.step();
    expect(w.championState(owner.id)!.pendingCast!.damage).toBe(248);
    expect(w.sell(0, owner.id)).toBeNull();
    expect(w.crystalArrowDamage(owner)).toBe(224);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(15);
      expect(world.projectiles.find((p) => p.source === owner.id)!.damage).toBe(248);
      expect(world.sell(1, owner.id)).toBeNull();
      expect(world.abilityPower(world.unit(owner.id)!)).toBe(0);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
