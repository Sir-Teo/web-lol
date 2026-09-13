import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function setup() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, hp: 10 });
  return w;
}
function cast(w: World, point = { x: -10000, y: -10000 }) {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point });
  w.step();
}

test('cursor selection heals one ally even when another has a lower health percentage', () => {
  const w = setup();
  const selected = w.spawn('champion', 'blue', { x: 500, y: 0 });
  const wounded = w.spawn('champion', 'blue', { x: 0, y: 600 });
  selected.hp = 200;
  wounded.hp = 1;
  cast(w, selected);
  expect(selected.hp).toBe(280);
  expect(wounded.hp).toBe(1);
  expect(w.hero.hp).toBeGreaterThanOrEqual(90);
  expect(w.movementSpeed(selected)).toBeCloseTo(selected.speed * 1.3);
  expect(w.movementSpeed(wounded)).toBe(wounded.speed);
  expect(selected.summonerHealReductionUntil).toBe(1801);
});

test('fallback chooses lowest percentage rather than lowest absolute health', () => {
  const w = setup();
  const first = w.spawn('champion', 'blue', { x: 500, y: 0 });
  const second = w.spawn('champion', 'blue', { x: 0, y: 100 });
  first.maxHp = 1000;
  first.hp = 100;
  second.hp = 70;
  cast(w, w.hero);
  expect(first.hp).toBe(180);
  expect(second.hp).toBe(70);
});

test('cursor tolerance includes 200 units and falls back beyond that boundary', () => {
  for (const [offset, expected] of [[200, 280], [200.001, 200]]) {
    const w = setup();
    const selected = w.spawn('champion', 'blue', { x: 500, y: 0 });
    const wounded = w.spawn('champion', 'blue', { x: 0, y: 600 });
    selected.hp = 200;
    wounded.hp = 1;
    cast(w, { x: selected.x + offset, y: selected.y });
    expect(selected.hp).toBe(expected);
    expect(wounded.hp).toBe(offset === 200 ? 1 : 81);
  }
});

test('range boundary includes 900 but excludes dead allies, enemies and non-champions', () => {
  const w = setup();
  const edge = w.spawn('champion', 'blue', { x: 900, y: 0 });
  const outside = w.spawn('champion', 'blue', { x: 900.001, y: 0 });
  const dead = w.spawn('champion', 'blue', { x: 100, y: 0 });
  const enemy = w.spawn('champion', 'red', { x: 100, y: 0 });
  const minion = w.spawn('melee', 'blue', { x: 100, y: 0 });
  edge.hp = outside.hp = enemy.hp = minion.hp = 1;
  dead.hp = 0;
  dead.deadAt = w.tick;
  cast(w);
  expect(edge.hp).toBe(81);
  for (const unit of [outside, dead, enemy, minion]) expect(unit.summonerHealSpeedUntil).toBe(0);
});

test('recipient reduction is independent and both haste timers survive restoration', () => {
  const w = setup();
  w.player.level = 18;
  w.hero.maxHp = 2327;
  w.hero.summonerHealReductionUntil = 1000;
  const ally = w.spawn('champion', 'blue', { x: 500, y: 0 });
  ally.hp = 10;
  cast(w, ally);
  expect(w.events.filter((event) => event.type === 'heal').map((event) => event.value)).toEqual([
    159, 318,
  ]);
  expect(ally.hp).toBe(328);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(59);
  restored.step(59);
  expect(w.movementSpeed(ally)).toBeCloseTo(ally.speed * 1.3);
  w.step();
  restored.step();
  expect(w.movementSpeed(ally)).toBe(ally.speed);
  expect(restored.snapshot()).toBe(w.snapshot());
});
