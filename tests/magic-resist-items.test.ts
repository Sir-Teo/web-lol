import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ITEMS, ITEM_RECIPES } from '../src/content/rules';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('magic resistance item stats and recipe match the pinned data', () => {
  const pin = JSON.parse(readFileSync('docs/reference/magic-resist-items.json', 'utf8'));
  for (const id of ['mantle', 'cloak']) {
    const item = ITEMS.find((entry) => entry.id === id)!;
    const source = pin.items[item.icon];
    expect(item.magicResist).toBe(source.stats.FlatSpellBlockMod);
    expect(item.price).toBe(source.gold.total);
    expect(item.sell).toBe(source.gold.sell);
    expect(
      (ITEM_RECIPES[id] ?? []).map((id) => ITEMS.find((entry) => entry.id === id)!.icon)
    ).toEqual(source.from ?? []);
  }
});

for (const team of ['blue', 'red'] as const)
  test(`${team} magic resistance upgrade changes magic mitigation and sale preserves level growth`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const owner = w.spawn('champion', team, w.battlefield.spawns[team]);
    const enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 0, y: 0 });
    w.championState(owner.id)!.gold = 850;
    expect(w.buy('mantle', owner.id)).toBeNull();
    expect(owner.magicResist).toBe(53);
    expect(w.buy('cloak', owner.id)).toBeNull();
    expect(owner.magicResist).toBe(78);
    expect(w.championState(owner.id)!.gold).toBe(0);
    let hp = owner.hp;
    w.damage(enemy, owner, 100, 'magic');
    expect(hp - owner.hp).toBeCloseTo(100 / 1.78);
    hp = owner.hp;
    w.damage(enemy, owner, 100, 'true');
    expect(hp - owner.hp).toBeCloseTo(100);
    w.gainExperience(280, owner.id);
    const grownResistance = owner.magicResist;
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      expect(world.sell(0, owner.id)).toBeNull();
      expect(world.unit(owner.id)!.magicResist).toBeCloseTo(grownResistance - 45);
      expect(world.championState(owner.id)!.gold).toBe(595);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
