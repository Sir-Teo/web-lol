import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import type { Ability } from '../src/simulation/types';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0 });
  return w;
}
function cast(w: World, ability: Ability = 'f') {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: { x: w.hero.x + 100, y: w.hero.y } });
  w.step();
}

test('Heal scales from 80 to 318 and respects missing health', () => {
  for (const [level, amount] of [
    [1, 80],
    [2, 94],
    [10, 206],
    [18, 318],
  ]) {
    const w = setup();
    w.player.level = level;
    w.hero.hp = 10;
    cast(w);
    expect(w.events.find((e) => e.type === 'heal')?.value).toBe(amount);
    expect(w.player.cooldowns.f).toBe(1 + 240 * 60);
    expect(w.healSpeedEnd).toBe(61);
  }
  const w = setup();
  w.hero.hp = w.hero.maxHp - 7;
  cast(w);
  expect(w.events.find((e) => e.type === 'heal')?.value).toBe(7);
  expect(w.hero.hp).toBe(w.hero.maxHp);
});

test('Heal works during stun without enabling movement or other spells', () => {
  const w = setup();
  w.hero.hp = 10;
  w.hero.stunUntil = 120;
  const point = { x: w.hero.x, y: w.hero.y };
  for (const ability of ['q', 'w', 'e', 'r', 'd'] as const) cast(w, ability);
  cast(w);
  expect(w.events.filter((e) => e.type === 'cast').map((e) => e.text)).toEqual(['f']);
  expect(w.events.find((e) => e.type === 'heal')?.value).toBe(80);
  expect(w.hero.x).toBe(point.x);
  expect(w.hero.y).toBe(point.y);
  expect(w.hero.stunUntil).toBe(120);
});

test('Heal preserves recall and its cooldown prevents a repeated cast', () => {
  const w = setup();
  w.hero.hp = 10;
  w.player.recallEnd = 480;
  cast(w);
  cast(w);
  expect(w.player.recallEnd).toBe(480);
  expect(w.events.filter((e) => e.type === 'heal')).toHaveLength(1);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(480);
  restored.step(480);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(w.player.recallEnd).toBeNull();
  expect(w.hero.hp).toBe(w.hero.maxHp);
});

test('Heal cannot revive a dead player or change a completed match', () => {
  const w = setup();
  w.hero.hp = 0;
  w.hero.deadAt = 0;
  cast(w);
  expect(w.hero.hp).toBe(0);
  expect(w.player.cooldowns.f).toBe(0);
  w.winner = 'red';
  const before = w.snapshot();
  cast(w);
  expect(w.snapshot()).toBe(before);
});
