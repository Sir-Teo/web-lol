import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { BRUSH } from '../src/content/map';

test('levels are observed independently by team and hidden gains survive exact restoration', () => {
  const w = new World(false);
  w.units = [w.hero];
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -820, y: 450 });
  const enemy = w.spawn('champion', 'red', BRUSH[0], 'lux');
  enemy.ai = false;
  const state = w.championState(enemy.id)!;
  w.step();
  expect(w.visible(enemy)).toBe(false);
  expect(state.observedStats).toEqual({ blue: null, red: { level: 1, cs: 0, inventory: [] } });
  Object.assign(w.hero, { x: -800, y: -50 });
  w.step();
  expect(w.visible(enemy)).toBe(true);
  expect(state.observedStats.blue).toEqual({ level: 1, cs: 0, inventory: [] });
  Object.assign(w.hero, { x: -820, y: 450 });
  w.gainExperience(280, enemy.id);
  state.cs = 7.4;
  w.step();
  expect(state.level).toBe(2);
  expect(state.observedStats).toEqual({
    blue: { level: 1, cs: 0, inventory: [] },
    red: { level: 2, cs: 7.4, inventory: [] },
  });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const world of [w, restored]) {
    Object.assign(world.hero, { x: -800, y: -50 });
    world.step();
  }
  expect(state.observedStats.blue).toEqual({ level: 2, cs: 7.4, inventory: [] });
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('snapshots reject impossible observed levels', () => {
  const w = new World(false);
  for (const value of [0, 2, 19, 1.5]) {
    w.player.observedStats.blue = { level: value, cs: 0, inventory: [] };
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});

test('snapshots reject negative, noncanonical and unearned observed creep score', () => {
  const w = new World(false);
  for (const cs of [-1, 0.4000000059604645, 1]) {
    w.player.observedStats.blue = { level: 1, cs, inventory: [] };
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});

test('observed inventories keep slot order and do not alias hidden inventory changes', () => {
  const w = new World(false);
  w.units = [w.hero];
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -800, y: -50 });
  const enemy = w.spawn('champion', 'red', BRUSH[0], 'lux');
  enemy.ai = false;
  const state = w.championState(enemy.id)!;
  state.inventory = ['tome', null, 'boots'];
  w.step();
  expect(state.observedStats.blue!.inventory).toEqual(['tome', null, 'boots']);
  expect(state.observedStats.blue!.inventory).not.toBe(state.inventory);
  Object.assign(w.hero, { x: -820, y: 450 });
  state.inventory[0] = 'wand';
  state.inventory[2] = null;
  w.step();
  expect(state.observedStats.blue!.inventory).toEqual(['tome', null, 'boots']);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const world of [w, restored]) {
    Object.assign(world.hero, { x: -800, y: -50 });
    world.step();
  }
  expect(state.observedStats.blue!.inventory).toEqual(['wand', null, null]);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('observed inventories reject unknown items, oversized packs and unique-item duplicates', () => {
  const w = new World(false);
  for (const inventory of [
    ['missing'],
    Array(7).fill(null),
    ['chapter', 'chapter'],
    ['deathcap', 'deathcap'],
  ]) {
    w.player.observedStats.blue = { level: 1, cs: 0, inventory };
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});
