import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ITEMS, ITEM_RECIPES } from '../src/content/rules';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('health item stats, gold and recipe match the pinned source', () => {
  const pin = JSON.parse(readFileSync('docs/reference/health-item-recipes.json', 'utf8'));
  for (const id of ['ruby', 'belt']) {
    const item = ITEMS.find((item) => item.id === id)!;
    const source = pin.items[item.icon];
    expect(item.hp).toBe(source.stats.FlatHPPoolMod);
    expect(item.price).toBe(source.gold.total);
    expect(item.sell).toBe(source.gold.sell);
    expect(
      (ITEM_RECIPES[id] ?? []).map((id) => ITEMS.find((item) => item.id === id)!.icon)
    ).toEqual(source.from ?? []);
  }
});

for (const team of ['blue', 'red'] as const)
  test(`${team} upgrades a component in a full inventory without double-counting health`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const champion = w.spawn('champion', team, w.battlefield.spawns[team]);
    const owner = w.championState(champion.id)!;
    owner.gold = 5000;
    for (const id of ['sword', 'ruby', 'boots', 'sword', 'ruby', 'sword']) w.buy(id, champion.id);
    owner.gold = 499;
    const before = w.snapshot();
    expect(w.buy('belt', champion.id)).toBe('Not enough gold');
    expect(w.snapshot()).toBe(before);
    owner.gold = 500;
    expect(w.purchasePlan('belt', champion.id)).toEqual({ cost: 500, consumed: [1] });
    expect(w.buy('belt', champion.id)).toBeNull();
    expect(owner.gold).toBe(0);
    expect(owner.inventory).toEqual(['sword', 'belt', 'boots', 'sword', 'ruby', 'sword']);
    expect(champion.maxHp).toBe(1110);
    expect(champion.hp).toBe(1110);
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  });

test('direct purchase costs full price; upgrading while dead preserves death', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.player.gold = 2000;
  expect(w.purchasePlan('belt')).toEqual({ cost: 900, consumed: [] });
  expect(w.buy('ruby')).toBeNull();
  const enemy = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(enemy, w.hero, 10000, 'true');
  const deadline = w.hero.respawnTick;
  expect(w.buy('belt')).toBeNull();
  expect(w.player.gold).toBe(1100);
  expect(w.hero.maxHp).toBe(960);
  expect(w.hero.hp).toBe(0);
  expect(w.hero.respawnTick).toBe(deadline);
});
