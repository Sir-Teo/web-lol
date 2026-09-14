import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MAGE_ITEMS } from '../src/content/mage-items';
import { World } from '../src/simulation/world';
import { ITEMS, ITEM_RECIPES, TICK_RATE } from '../src/content/rules';
import { hastedCooldownTicks } from '../src/simulation/ability-haste';

test('haste item stats and recipe match raw fields and current tooltips', () => {
  const pin = JSON.parse(readFileSync('docs/reference/mage-items.json', 'utf8'));
  for (const id of ['mote', 'codex'] as const) {
    const item = MAGE_ITEMS.find((item) => item.id === id)!;
    const dd = pin.items[item.icon],
      raw = pin.communityDragon.records[`Items/${item.icon}`];
    expect(item.abilityHaste).toBe(raw.mAbilityHasteMod);
    expect(dd.description).toContain(`<attention>${item.abilityHaste}</attention> Ability Haste`);
    expect([item.price, item.sell]).toEqual([dd.gold.total, dd.gold.sell]);
    expect(
      (ITEM_RECIPES[id] ?? []).map((id) => ITEMS.find((item) => item.id === id)!.icon)
    ).toEqual(dd.from ?? []);
  }
  expect(hastedCooldownTicks(100, 100)).toBe(50 * TICK_RATE);
  expect(hastedCooldownTicks(100, 200)).toBe(2000);
});

test('Codex replaces consumed haste and AP in a full inventory, and sale removes one copy', () => {
  const w = new World(false);
  w.player.gold = 10000;
  for (const id of ['codex', 'mote', 'tome', 'mote', 'sapphire', 'boots'])
    expect(w.buy(id)).toBeNull();
  expect(w.abilityHaste()).toBe(20);
  w.player.gold = 200;
  expect(w.purchasePlan('codex')).toEqual({ cost: 200, consumed: [2, 1] });
  expect(w.buy('codex')).toBeNull();
  expect(w.abilityHaste()).toBe(25);
  expect(w.abilityPower()).toBe(50);
  expect(w.sell(0)).toBeNull();
  expect(w.abilityHaste()).toBe(15);
  expect(w.abilityPower()).toBe(25);
});

test('all champion spells use additive haste but summoners and cast windups do not', () => {
  for (const champion of ['ashe', 'lux'] as const) {
    const w = new World(false);
    const unit = w.spawn('champion', 'red', w.battlefield.spawns.red, champion);
    const state = w.championState(unit.id)!;
    const base = Object.fromEntries(
      ['q', 'w', 'e', 'r', 'd', 'f'].map((a) => [a, w.abilityResources(a as 'q', unit.id)])
    );
    state.gold = 3000;
    w.buy('codex', unit.id);
    w.buy('codex', unit.id);
    expect(w.abilityHaste(unit.id)).toBe(20);
    expect(w.abilityHaste()).toBe(0);
    for (const a of ['q', 'w', 'e', 'r', 'd', 'f'] as const) {
      const resources = w.abilityResources(a, unit.id);
      expect(resources.mana).toBe(base[a].mana);
      expect(resources.cooldownSeconds).toBeCloseTo(
        base[a].cooldownSeconds / (a === 'd' || a === 'f' ? 1 : 1.2)
      );
    }
    w.enqueue({ type: 'cast', unit: unit.id, ability: 'w', point: { x: unit.x - 500, y: unit.y } });
    w.step();
    expect(state.cooldowns.w).toBe(w.tick + Math.ceil((base.w.cooldownSeconds * 60) / 1.2));
    expect(state.pendingCast!.releaseTick - state.pendingCast!.startTick).toBe(15);
  }
});

test('running cooldowns retain their captured deadline across purchase, sale and checkpoint', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.gold = 3000;
  w.buy('codex');
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: 'w',
    point: { x: w.hero.x + 500, y: w.hero.y },
  });
  w.step();
  const deadline = w.player.cooldowns.w;
  expect(deadline).toBe(1 + Math.ceil(1080 / 1.1));
  w.sell(0);
  w.buy('mote');
  expect(w.player.cooldowns.w).toBe(deadline);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  while (restored.tick < deadline - 1) restored.step();
  expect(restored.abilityCooldownTicks('w')).toBe(1);
  restored.step();
  expect(restored.abilityCooldownTicks('w')).toBe(0);
});

test('Hawkshot captures current haste for each new sequential recharge cycle', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  w.player.gold = 2000;
  w.buy('codex');
  const cast = () =>
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 500, y: w.hero.y },
    });
  cast();
  w.step();
  const first = w.player.eRechargeTick!;
  expect(w.player.eRechargeDurationTicks).toBe(Math.ceil(5400 / 1.1));
  w.sell(0);
  while (w.abilityCooldownTicks('e') > 0) w.step();
  cast();
  w.step();
  expect(w.player.eCharges).toBe(0);
  expect(w.player.eRechargeTick).toBe(first);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  while (restored.tick < first) restored.step();
  expect(restored.player.eCharges).toBe(1);
  expect(restored.player.eRechargeTick).toBe(first + 5400);
  expect(restored.player.eRechargeDurationTicks).toBe(5400);
  restored.player.eRechargeDurationTicks = 1;
  expect(() => World.fromSnapshot(restored.snapshot(), restored.battlefield)).toThrow();
});
