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
  expect(state.observedLevels).toEqual({ blue: null, red: 1 });
  Object.assign(w.hero, { x: -800, y: -50 });
  w.step();
  expect(w.visible(enemy)).toBe(true);
  expect(state.observedLevels.blue).toBe(1);
  Object.assign(w.hero, { x: -820, y: 450 });
  w.gainExperience(280, enemy.id);
  w.step();
  expect(state.level).toBe(2);
  expect(state.observedLevels).toEqual({ blue: 1, red: 2 });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const world of [w, restored]) {
    Object.assign(world.hero, { x: -800, y: -50 });
    world.step();
  }
  expect(state.observedLevels.blue).toBe(2);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('snapshots reject impossible observed levels', () => {
  const w = new World(false);
  for (const value of [0, 2, 19, 1.5]) {
    w.player.observedLevels.blue = value;
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).toThrow();
  }
});
