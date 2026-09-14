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
  expect(state.observedStats).toEqual({ blue: null, red: { level: 1, cs: 0 } });
  Object.assign(w.hero, { x: -800, y: -50 });
  w.step();
  expect(w.visible(enemy)).toBe(true);
  expect(state.observedStats.blue).toEqual({ level: 1, cs: 0 });
  Object.assign(w.hero, { x: -820, y: 450 });
  w.gainExperience(280, enemy.id);
  state.cs = 7;
  w.step();
  expect(state.level).toBe(2);
  expect(state.observedStats).toEqual({ blue: { level: 1, cs: 0 }, red: { level: 2, cs: 7 } });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const world of [w, restored]) {
    Object.assign(world.hero, { x: -800, y: -50 });
    world.step();
  }
  expect(state.observedStats.blue).toEqual({ level: 2, cs: 7 });
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('snapshots reject impossible observed levels', () => {
  const w = new World(false);
  for (const value of [0, 2, 19, 1.5]) {
    w.player.observedStats.blue = { level: value, cs: 0 };
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});

test('snapshots reject negative, fractional and unearned observed creep score', () => {
  const w = new World(false);
  for (const cs of [-1, 0.5, 1]) {
    w.player.observedStats.blue = { level: 1, cs };
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});
