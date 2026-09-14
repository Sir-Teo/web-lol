import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { Random } from '../src/simulation/math';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ITEMS, ITEM_RECIPES } from '../src/content/rules';
import pin from '../docs/reference/infinity-edge.json';

function setup(champion: 'lux' | 'ashe' = 'lux') {
  const w = new World(false, PRACTICE_FIXTURE, champion);
  w.nextWaveTick = Infinity;
  w.player.gold = 20000;
  return w;
}

test('Infinity Edge and B. F. Sword match both source catalogs and source recipe', () => {
  for (const [id, code] of [
    ['bf-sword', '1038'],
    ['infinity-edge', '3031'],
  ] as const) {
    const item = ITEMS.find((i) => i.id === id)!;
    const source = pin.items[code];
    const raw = pin.communityDragon.records[`Items/${code}`];
    expect(item.damage).toBe(raw.mFlatPhysicalDamageMod);
    expect([item.price, item.sell]).toEqual([source.gold.total, source.gold.sell]);
  }
  expect(ITEM_RECIPES['infinity-edge'].map((id) => ITEMS.find((i) => i.id === id)!.icon)).toEqual(
    pin.items['3031'].from
  );
  const edge = ITEMS.find((i) => i.id === 'infinity-edge')!;
  expect(edge.bonusCriticalDamage).toBeCloseTo(
    pin.communityDragon.records['Items/3031'].mFlatCritDamageMod
  );
});

test('full-inventory recipe consumes each selected component once and sale removes its modifiers', () => {
  const w = setup();
  const base = w.hero.damage;
  for (const id of ['bf-sword', 'pickaxe', 'agility', 'agility', 'boots', 'sword'])
    expect(w.buy(id)).toBeNull();
  const gold = w.player.gold;
  expect(w.purchasePlan('infinity-edge')!.cost).toBe(725);
  expect(w.buy('infinity-edge')).toBeNull();
  expect(w.player.gold).toBe(gold - 725);
  expect(w.hero.damage).toBe(base + 85);
  expect(w.player.inventory.filter((i) => i === 'agility')).toHaveLength(1);
  expect(w.criticalChance()).toBe(0.4);
  expect(w.basicAttackDamageMultiplier(w.hero, true)).toBe(2.3);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  expect(w.buy('infinity-edge')).toBe('You already own Infinity Edge');
  const slot = w.player.inventory.indexOf('infinity-edge');
  expect(w.sell(slot)).toBeNull();
  expect(w.hero.damage).toBe(base + 10);
  expect(w.criticalChance()).toBe(0.15);
  expect(w.basicAttackDamageMultiplier(w.hero, true)).toBe(2);
});

for (const champion of ['lux', 'ashe'] as const)
  test(`${champion} applies additive crit damage and preserves launched payload after sale`, () => {
    const w = setup(champion);
    expect(w.buy('infinity-edge')).toBeNull();
    expect(w.basicAttackDamageMultiplier(w.hero, false)).toBe(champion === 'ashe' ? 1.325 : 1);
    expect(w.basicAttackDamageMultiplier(w.hero, true)).toBe(champion === 'ashe' ? 1.325 : 2.3);
    let seed = 0;
    while (new Random(seed).next() >= 0.25) seed++;
    w.random.state = seed;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
    target.hp = target.maxHp = 5000;
    target.armor = 100;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    w.step(w.hero.releaseTick! - w.tick);
    const payload = w.projectiles[0].damage;
    expect(w.projectiles[0].critical).toBe(true);
    expect(payload).toBeCloseTo(w.hero.damage * (champion === 'ashe' ? 1.325 : 2.3));
    w.setOrder(w.hero, { type: 'idle' });
    expect(w.sell(0)).toBeNull();
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(30);
    restored.step(30);
    expect(w.snapshot()).toBe(restored.snapshot());
    expect(target.hp).toBeCloseTo(5000 - payload / 2);
  });

test('crit chance caps at 100% and duplicate unique items are rejected on import', () => {
  const w = setup('ashe');
  expect(w.buy('infinity-edge')).toBeNull();
  for (let i = 0; i < 5; i++) expect(w.buy('agility')).toBeNull();
  expect(w.criticalChance()).toBe(1);
  expect(w.basicAttackDamageMultiplier()).toBe(2.3);
  const saved = JSON.parse(w.snapshot());
  saved.player.inventory[1] = 'infinity-edge';
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
