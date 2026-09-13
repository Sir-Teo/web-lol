import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { FIRST_BLOOD_BONUS } from '../src/content/champion-kill-gold';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';

test('first blood bonus matches the pinned standard-mode record', () => {
  const pin = JSON.parse(readFileSync('docs/reference/assist-window.json', 'utf8'));
  expect(FIRST_BLOOD_BONUS).toBe(pin.record.FirstBloodBonus);
  expect(FIRST_BLOOD_BONUS).toBe(100);
});

for (const team of ['blue', 'red'] as const)
  test(`${team} first blood pays only the killer and only once in a same-tick trade`, () => {
    const w = new World(false, PRACTICE_FIXTURE);
    const a = w.spawn('champion', team, { x: 0, y: 0 });
    const b = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 0, y: 0 });
    const ally = w.spawn('champion', team, { x: 0, y: 0 });
    w.damage(ally, b, 1, 'true');
    w.damage(a, b, 10000, 'true');
    w.damage(b, a, 10000, 'true');
    expect(w.firstBloodClaimed).toBe(true);
    expect(w.championState(a.id)!.gold).toBe(900);
    expect(w.championState(b.id)!.gold).toBe(800);
    expect(w.championState(ally.id)!.gold).toBe(500);
    expect(w.championState(ally.id)!.assists).toBe(1);
    expect(w.events.filter((event) => event.type === 'gold').map((event) => event.value)).toEqual([
      400, 300,
    ]);
  });

test('uncredited deaths and nonchampion targets do not consume first blood', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  const minion = w.spawn('melee', 'red', { x: 0, y: 0 });
  w.damage(minion, w.hero, 10000, 'true');
  w.damage(w.hero, minion, 10000, 'true');
  const friend = w.spawn('champion', 'blue', { x: 0, y: 0 });
  w.damage(w.hero, friend, 10000, 'true');
  expect(w.firstBloodClaimed).toBe(false);
  const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
  const before = w.player.gold;
  w.damage(w.hero, victim, 10000, 'true');
  expect(w.player.gold - before).toBe(400);
});

test('checkpoint continuation preserves first blood before and after its award', () => {
  let w = new World(false, PRACTICE_FIXTURE);
  w = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(w.firstBloodClaimed).toBe(false);
  w.damage(w.hero, w.spawn('champion', 'red', { x: 0, y: 0 }), 10000, 'true');
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.firstBloodClaimed).toBe(true);
  expect(restored.events).toEqual([]);
  for (const world of [w, restored]) {
    world.damage(world.hero, world.spawn('champion', 'red', { x: 0, y: 0 }), 10000, 'true');
    expect(world.player.gold).toBe(1200);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
  const invalid = JSON.parse(w.snapshot());
  invalid.firstBloodClaimed = 1;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  delete invalid.firstBloodClaimed;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
});
