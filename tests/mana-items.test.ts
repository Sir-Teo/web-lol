import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ITEMS } from '../src/content/rules';
import { World } from '../src/simulation/world';

test('Sapphire Crystal matches both pinned standard-map item records', () => {
  const pin = JSON.parse(readFileSync('docs/reference/mage-items.json', 'utf8'));
  const item = ITEMS.find((item) => item.id === 'sapphire')!;
  const dd = pin.items['1027'],
    raw = pin.communityDragon.records['Items/1027'];
  expect(item.mana).toBe(dd.stats.FlatMPPoolMod);
  expect(item.mana).toBe(raw.flatMPPoolMod);
  expect([item.price, item.sell, item.icon]).toEqual([dd.gold.total, dd.gold.sell, '1027']);
  expect(raw.price).toBe(item.price);
  expect(dd.maps['11']).toBe(true);
});

test('repeated crystals preserve missing mana, sell one copy and clamp exhausted resources', () => {
  const w = new World(false);
  w.player.gold = 1000;
  const base = w.hero.maxMana;
  w.hero.mana = 40;
  expect(w.buy('sapphire')).toBeNull();
  expect(w.buy('sapphire')).toBeNull();
  expect([w.hero.mana, w.hero.maxMana, w.player.gold]).toEqual([640, base + 600, 400]);
  expect(w.sell(0)).toBeNull();
  expect([w.hero.mana, w.hero.maxMana, w.player.gold]).toEqual([340, base + 300, 610]);
  expect(w.player.inventory).toEqual([null, 'sapphire']);
  w.hero.mana = 25;
  expect(w.sell(1)).toBeNull();
  expect([w.hero.mana, w.hero.maxMana]).toEqual([0, base]);
});

test('mana equipment and champion growth commute and survive an exact checkpoint', () => {
  for (const champion of ['ashe', 'lux'] as const) {
    const w = new World(false),
      baseline = new World(false);
    const unit = w.spawn('champion', 'red', w.battlefield.spawns.red, champion);
    const control = baseline.spawn('champion', 'red', baseline.battlefield.spawns.red, champion);
    unit.mana = control.mana = 50;
    expect(w.buy('sapphire', unit.id)).toBeNull();
    w.gainExperience(2400, unit.id);
    baseline.gainExperience(2400, control.id);
    expect(unit.maxMana).toBeCloseTo(control.maxMana + 300);
    expect(unit.mana).toBeCloseTo(control.mana + 300);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    expect(restored.snapshot()).toBe(w.snapshot());
    expect(restored.sell(0, unit.id)).toBeNull();
    expect(restored.unit(unit.id)!.maxMana).toBeCloseTo(control.maxMana);
    expect(restored.unit(unit.id)!.mana).toBeCloseTo(control.mana);
    expect(restored.hero.maxMana).toBe(baseline.hero.maxMana);
  }
});

test('dead purchases do not refill mana; respawn and recall restore the equipped maximum', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const unit = w.spawn('champion', 'red', w.battlefield.spawns.red, 'lux');
  const state = w.championState(unit.id)!;
  state.gold = 1000;
  unit.mana = 25;
  w.damage(w.hero, unit, 10000, 'true');
  const deadline = unit.respawnTick!;
  expect(w.buy('sapphire', unit.id)).toBeNull();
  expect([unit.hp, unit.mana, unit.maxMana, unit.respawnTick]).toEqual([0, 25, 740, deadline]);
  expect(w.sell(0, unit.id)).toBeNull();
  expect([unit.mana, unit.maxMana]).toEqual([25, 440]);
  w.buy('sapphire', unit.id);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  while (restored.tick < deadline) restored.step();
  const revived = restored.unit(unit.id)!;
  expect([revived.mana, revived.maxMana]).toEqual([740, 740]);
  revived.x -= 1500;
  revived.mana = 0;
  restored.enqueue({ type: 'recall', unit: unit.id });
  restored.step();
  const recallEnd = restored.championState(unit.id)!.recallEnd!;
  expect(recallEnd).toBeGreaterThan(restored.tick);
  while (restored.tick < recallEnd) restored.step();
  expect(revived.mana).toBe(740);
  expect(revived.x).toBe(restored.battlefield.spawns.red.x);
});

test('failed mana purchases leave resources and inventory untouched', () => {
  const w = new World(false);
  w.player.gold = 299;
  let before = w.snapshot();
  expect(w.buy('sapphire')).toBe('Not enough gold');
  expect(w.snapshot()).toBe(before);
  w.player.gold = 10000;
  for (let i = 0; i < 6; i++) w.buy('sapphire');
  before = w.snapshot();
  expect(w.buy('sapphire')).not.toBeNull();
  expect(w.snapshot()).toBe(before);
});
