import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { ITEMS, ITEM_RECIPES } from '../src/content/rules';
import { DEATHCAP_AP_AMPLIFICATION } from '../src/content/mage-items';

test('mage item values, duplicate-component recipe and amplification agree with both pinned sources', () => {
  const pin = JSON.parse(readFileSync('docs/reference/mage-items.json', 'utf8'));
  for (const id of ['wand', 'rod', 'deathcap']) {
    const item = ITEMS.find((item) => item.id === id)!;
    const dd = pin.items[item.icon],
      raw = pin.communityDragon.records[`Items/${item.icon}`];
    expect([item.price, item.sell, item.abilityPower]).toEqual([
      dd.gold.total,
      dd.gold.sell,
      raw.mFlatMagicDamageMod,
    ]);
    expect(
      (ITEM_RECIPES[id] ?? []).map((id) => ITEMS.find((item) => item.id === id)!.icon)
    ).toEqual(dd.from ?? []);
  }
  expect(DEATHCAP_AP_AMPLIFICATION).toBeCloseTo(
    pin.communityDragon.records['Items/3089'].mDataValues[0].mValue
  );
});

test('Deathcap consumes two distinct rods in a full inventory, retains a third and amplifies all remaining AP', () => {
  const w = new World(false);
  w.player.gold = 10000;
  for (const id of ['rod', 'tome', 'rod', 'boots', 'wand', 'rod']) expect(w.buy(id)).toBeNull();
  expect(w.abilityPower()).toBe(260);
  w.player.gold = 1099;
  const before = w.snapshot();
  expect(w.buy('deathcap')).toBe('Not enough gold');
  expect(w.snapshot()).toBe(before);
  w.player.gold = 1100;
  expect(w.purchasePlan('deathcap')).toEqual({ cost: 1100, consumed: [0, 2] });
  expect(w.buy('deathcap')).toBeNull();
  expect(w.player.inventory).toEqual(['deathcap', 'tome', null, 'boots', 'wand', 'rod']);
  expect(w.abilityPower()).toBe(338);
  expect(w.player.gold).toBe(0);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(saved.abilityPower()).toBe(338);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(w.sell(0)).toBeNull();
  expect(w.abilityPower()).toBe(130);
  expect(w.player.gold).toBe(2450);
});

test('direct and one-component purchases charge only the missing total and enforce unique ownership', () => {
  for (const rods of [0, 1]) {
    const w = new World(false);
    w.player.gold = 10000;
    if (rods) w.buy('rod');
    expect(w.purchasePlan('deathcap')!.cost).toBe(3500 - rods * 1200);
    expect(w.buy('deathcap')).toBeNull();
    expect(w.player.gold).toBe(6500);
    expect(w.abilityPower()).toBe(169);
    const before = w.snapshot();
    expect(w.buy('deathcap')).toContain('already own');
    expect(w.snapshot()).toBe(before);
    w.player.inventory.push('deathcap');
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});

test('amplified AP affects Lux damage and shields, and is captured before a later sale', () => {
  for (const ability of ['q', 'w', 'e', 'r'] as const) {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'red', w.battlefield.spawns.red, 'lux');
    const owner = w.championState(lux.id)!;
    owner.gold = 5000;
    w.buy('tome', lux.id);
    w.buy('deathcap', lux.id);
    expect(w.abilityPower(lux)).toBe(195);
    expect(w.abilityPower(w.hero)).toBe(0);
    w.enqueue({ type: 'cast', unit: lux.id, ability, point: { x: lux.x - 500, y: lux.y } });
    w.step();
    const expected = { q: 226.25, w: 118, e: 221, r: 534 }[ability];
    expect(ability === 'w' ? owner.pendingCast!.shield : owner.pendingCast!.damage).toBe(expected);
    w.sell(owner.inventory.indexOf('deathcap'), lux.id);
    expect(w.abilityPower(lux)).toBe(20);
    expect(ability === 'w' ? owner.pendingCast!.shield : owner.pendingCast!.damage).toBe(expected);
  }
});

test('Lux bot completes the two-rod recipe at its actual completion cost and does not rebuild it', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', w.battlefield.spawns.blue, 'lux');
  const state = w.championState(lux.id)!;
  state.gold = 5000;
  for (const id of ['chapter', 'boots', 'rod', 'rod']) w.buy(id, lux.id);
  state.gold = 1100;
  lux.ai = true;
  lux.nextThink = 0;
  w.step();
  expect(state.inventory).toContain('deathcap');
  expect(state.inventory).not.toContain('rod');
  expect(w.abilityPower(lux)).toBe(221);
  state.gold = 850;
  lux.nextThink = 0;
  w.step();
  expect(state.inventory).toContain('wand');
  expect(w.abilityPower(lux)).toBe(279.5);
});

test('Lux recalls for an affordable completion even when components fill all six slots', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', w.battlefield.spawns.blue, 'lux');
  const state = w.championState(lux.id)!;
  state.gold = 10000;
  for (const id of ['chapter', 'boots', 'rod', 'rod', 'cloth', 'ruby'])
    expect(w.buy(id, lux.id)).toBeNull();
  state.gold = 1100;
  lux.x += 3000;
  lux.ai = true;
  lux.nextThink = 0;
  w.step();
  expect(w.commands).toContainEqual({ type: 'recall', unit: lux.id });
});
