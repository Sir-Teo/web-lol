import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { LOST_CHAPTER, MAGE_ITEMS } from '../src/content/mage-items';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'red', w.battlefield.spawns.red, 'lux');
  const state = w.championState(lux.id)!;
  state.gold = 5000;
  w.buy('chapter', lux.id);
  lux.x -= 1500;
  lux.mana = 0;
  return { w, lux, state };
}

test('Lost Chapter source stats, Enlighten values and ownership group are pinned', () => {
  const pin = JSON.parse(readFileSync('docs/reference/mage-items.json', 'utf8'));
  const item = MAGE_ITEMS.find((item) => item.id === 'chapter')!;
  const raw = pin.communityDragon.records['Items/3802'];
  expect([item.abilityPower, item.mana, item.abilityHaste]).toEqual([
    raw.mFlatMagicDamageMod,
    raw.flatMPPoolMod,
    raw.mAbilityHasteMod,
  ]);
  expect([item.price, item.sell]).toEqual([
    pin.items['3802'].gold.total,
    pin.items['3802'].gold.sell,
  ]);
  expect(LOST_CHAPTER.manaFraction).toBeCloseTo(
    raw.mDataValues.find((v: any) => v.mName === 'ManaRestorePercent').mValue
  );
  expect(LOST_CHAPTER.durationSeconds).toBe(
    raw.mDataValues.find((v: any) => v.mName === 'RestorationDuration').mValue
  );
  expect(pin.communityDragon.records['Items/ItemGroups/MythicItems'].mMaxGroupOwnable).toBe(1);
});

test('full-inventory completion preserves component mana and replaces AP and haste exactly once', () => {
  const w = new World(false);
  w.player.gold = 5000;
  for (const id of ['tome', 'boots', 'sapphire', 'mote', 'rod', 'cloth']) w.buy(id);
  w.hero.mana = 80;
  const max = w.hero.maxMana;
  w.player.gold = 249;
  let before = w.snapshot();
  expect(w.buy('chapter')).toBe('Not enough gold');
  expect(w.snapshot()).toBe(before);
  w.player.gold = 250;
  expect(w.purchasePlan('chapter')).toEqual({ cost: 250, consumed: [0, 2, 3] });
  expect(w.buy('chapter')).toBeNull();
  expect([w.hero.mana, w.hero.maxMana, w.abilityPower(), w.abilityHaste()]).toEqual([
    80,
    max,
    105,
    10,
  ]);
  expect(w.player.inventory).toEqual(['chapter', 'boots', null, null, 'rod', 'cloth']);
  w.player.gold = 1200;
  before = w.snapshot();
  expect(w.buy('chapter')).toContain('already own');
  expect(w.snapshot()).toBe(before);
  w.player.inventory[2] = 'chapter';
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
});

test('Enlighten restores exactly the captured fraction over 180 subsequent ticks and resumes mid-effect', () => {
  const { w, lux, state } = setup();
  w.gainExperience(280, lux.id);
  const total = lux.maxMana * 0.2;
  expect(state.enlighten).toEqual({ startTick: 0, endTick: 180, totalMana: total });
  const baseline = World.fromSnapshot(w.snapshot(), w.battlefield);
  baseline.championState(lux.id)!.enlighten = null;
  for (let i = 0; i < 60; i++) {
    w.step();
    baseline.step();
  }
  expect(lux.mana - baseline.unit(lux.id)!.mana).toBeCloseTo(total / 3, 8);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (let i = 60; i < 180; i++) {
    w.step();
    baseline.step();
    restored.step();
  }
  expect(lux.mana - baseline.unit(lux.id)!.mana).toBeCloseTo(total, 8);
  expect(state.enlighten).toBeNull();
  expect(restored.snapshot()).toBe(w.snapshot());
  w.step();
  baseline.step();
  expect(lux.mana - baseline.unit(lux.id)!.mana).toBeCloseTo(total, 8);
});

test('later levels refresh the effect; full mana clamps and death cancels restoration', () => {
  const { w, lux, state } = setup();
  w.gainExperience(280, lux.id);
  for (let i = 0; i < 60; i++) w.step();
  w.gainExperience(380, lux.id);
  expect(state.enlighten).toEqual({ startTick: 60, endTick: 240, totalMana: lux.maxMana * 0.2 });
  lux.mana = lux.maxMana;
  w.step();
  expect(lux.mana).toBe(lux.maxMana);
  w.damage(w.hero, lux, 10000, 'true');
  expect(state.enlighten).toBeNull();
  w.gainExperience(1000, lux.id);
  expect(state.enlighten).toBeNull();
});

test('a committed restoration survives sale, while invalid saved timing is rejected', () => {
  const { w, lux, state } = setup();
  w.gainExperience(280, lux.id);
  const total = state.enlighten!.totalMana;
  lux.x = w.battlefield.spawns.red.x;
  expect(w.sell(0, lux.id)).toBeNull();
  expect(state.enlighten!.totalMana).toBe(total);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const change of [{ startTick: 1 }, { endTick: 181 }, { endTick: 0 }, { totalMana: 0 }]) {
    const invalid = World.fromSnapshot(w.snapshot(), w.battlefield);
    Object.assign(invalid.championState(lux.id)!.enlighten!, change);
    expect(() => World.fromSnapshot(invalid.snapshot(), w.battlefield)).toThrow();
  }
});

test('Lux buys Chapter components, completes it, and progresses without rebuying the consumed Tome', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', w.battlefield.spawns.blue, 'lux');
  const state = w.championState(lux.id)!;
  lux.ai = true;
  for (const [gold, item] of [
    [400, 'tome'],
    [300, 'boots'],
    [300, 'sapphire'],
    [250, 'mote'],
    [250, 'chapter'],
    [1200, 'rod'],
  ] as const) {
    state.gold = gold;
    lux.nextThink = 0;
    w.step();
    expect(state.inventory).toContain(item);
  }
  expect(state.inventory).not.toContain('tome');
  expect(state.inventory).not.toContain('sapphire');
  expect(state.inventory).not.toContain('mote');
  expect(w.abilityHaste(lux.id)).toBe(10);
  expect(lux.maxMana).toBe(740);
});
