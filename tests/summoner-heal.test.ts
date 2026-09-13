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
    expect(w.hero.summonerHealSpeedUntil).toBe(61);
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

test('repeated Heal halves the amount without compounding, and refreshes the window', () => {
  const w = setup();
  for (const [index, expected] of [80, 40, 40].entries()) {
    w.hero.hp = 10;
    w.player.cooldowns.f = 0; // Practice reset stands in for another available Heal.
    cast(w);
    expect(w.events.filter((e) => e.type === 'heal').at(-1)?.value).toBe(expected);
    expect(w.hero.summonerHealReductionUntil).toBe(index + 1 + 30 * 60);
  }
  expect(w.hero.summonerHealSpeedUntil).toBe(w.tick + 60);
  expect(w.movementSpeed(w.hero)).toBeCloseTo(w.hero.speed * 1.3);
});

test('reduction expires at its exact deadline and clamps after reduction', () => {
  for (const [offset, expected] of [
    [-1, 40],
    [0, 80],
    [1, 80],
  ]) {
    const w = setup();
    cast(w);
    w.tick = w.hero.summonerHealReductionUntil + offset - 1;
    w.hero.hp = 10;
    w.player.cooldowns.f = 0;
    cast(w);
    expect(w.events.filter((e) => e.type === 'heal').at(-1)?.value).toBe(expected);
  }
  const w = setup();
  cast(w); // A cast at full health still establishes the reduction window.
  w.player.cooldowns.f = 0;
  w.hero.hp = w.hero.maxHp - 30;
  cast(w);
  expect(w.hero.hp).toBe(w.hero.maxHp);
  expect(w.events.filter((e) => e.type === 'heal').at(-1)?.value).toBe(30);
});

test('the recipient reduction survives saves and does not change ordinary regeneration', () => {
  const w = setup();
  w.hero.hp = 10;
  cast(w);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  const before = w.hero.hp;
  w.step(60);
  restored.step(60);
  expect(w.hero.hp - before).toBeCloseTo(0.7);
  w.player.cooldowns.f = restored.player.cooldowns.f = 0;
  cast(w);
  cast(restored);
  expect(w.events.filter((e) => e.type === 'heal').at(-1)?.value).toBe(40);
  expect(restored.snapshot()).toBe(w.snapshot());
  for (const invalid of [-1, 0.5, null]) {
    const saved = JSON.parse(w.snapshot());
    saved.units.find((unit: { id: number }) => unit.id === w.hero.id).summonerHealReductionUntil =
      invalid;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
