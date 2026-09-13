import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function lane() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', 'blue', { x: 0, y: 0 });
  bot.ai = true;
  const tower = w.spawn('turret', 'red', { x: 700, y: 0 });
  tower.range = 750;
  tower.nextAttackTick = 10000;
  return { w, bot, tower };
}

test('an unsupported healthy bot exits turret danger and does not repeatedly re-enter', () => {
  const { w, bot, tower } = lane();
  w.setOrder(bot, { type: 'attack', target: tower.id });
  w.step();
  expect(bot.order.type).toBe('move');
  expect(bot.x).toBeLessThan(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(360);
  restored.step(360);
  expect(Math.hypot(bot.x - tower.x, bot.y - tower.y)).toBeGreaterThan(
    tower.range + bot.radius + 100
  );
  expect(bot.order.type).toBe('idle');
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('minion cover permits tower attacks but loses protection when the wave dies', () => {
  const { w, bot, tower } = lane();
  const ally = w.spawn('melee', 'blue', { x: 650, y: 0 });
  ally.speed = 0;
  ally.nextAttackTick = 10000;
  w.step();
  expect(bot.order).toEqual({ type: 'attack', target: tower.id });
  ally.hp = 0;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.order.type).toBe('move');
  expect(bot.releaseTick).toBeNull();
});

test('tower focus overrides minion cover and interrupts an attack windup', () => {
  const { w, bot, tower } = lane();
  bot.x = 100;
  w.spawn('melee', 'blue', { x: 650, y: 0 });
  w.step();
  expect(bot.releaseTick).not.toBeNull();
  tower.order = { type: 'attack', target: bot.id };
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.order.type).toBe('move');
  expect(bot.releaseTick).toBeNull();
});

test('a newly visible tower interrupts a champion attack even with allied minion cover', () => {
  const { w, bot, tower } = lane();
  w.battlefield.lineOfSight = (_a, b) => b.x < 500;
  w.spawn('champion', 'red', { x: 200, y: 0 });
  w.spawn('melee', 'blue', { x: 650, y: 0 });
  w.step();
  expect(bot.releaseTick).not.toBeNull();
  w.battlefield.lineOfSight = () => true;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.order.type).toBe('move');
  expect(bot.releaseTick).toBeNull();
  expect(tower.hp).toBe(tower.maxHp);
});

test('hidden or destroyed towers do not drive decisions', () => {
  for (const hidden of [false, true]) {
    const { w, bot, tower } = lane();
    const enemy = w.spawn('champion', 'red', { x: 200, y: 0 });
    if (hidden) w.battlefield.lineOfSight = (_a, b) => b.x < 500;
    else tower.hp = 0;
    w.step();
    expect(bot.attackTarget).toBe(enemy.id);
  }
});

test('a bot outside tower range refuses a chase into its protection', () => {
  const { w, bot, tower } = lane();
  bot.x = -400;
  w.spawn('champion', 'red', { x: 650, y: 0 });
  w.step(180);
  expect(bot.order.type).toBe('idle');
  expect(bot.x).toBe(-400);
  expect(tower.hp).toBe(tower.maxHp);
});

test('a protected target does not prevent choosing a farther safe opponent', () => {
  const { w, bot, tower } = lane();
  tower.x = 1000;
  w.spawn('champion', 'red', { x: 1000, y: 0 });
  const safe = w.spawn('melee', 'red', { x: -1050, y: 0 });
  safe.speed = 0;
  w.step();
  expect(bot.order).toEqual({ type: 'attack', target: safe.id });
  expect(bot.x).toBeLessThan(0);
});

test('a hidden safe alternative cannot influence tower-safe target selection', () => {
  const { w, bot, tower } = lane();
  tower.x = 1000;
  w.spawn('champion', 'red', { x: 1000, y: 0 });
  w.spawn('melee', 'red', { x: -1050, y: 0 });
  w.battlefield.lineOfSight = (_a, b) => b.x >= 0;
  w.step();
  expect(bot.order.type).toBe('idle');
  expect(bot.x).toBe(0);
});

test('minion cover permits farming instead of idle champion aggression under a tower', () => {
  const { w, bot } = lane();
  w.spawn('melee', 'blue', { x: 650, y: 0 });
  w.spawn('champion', 'red', { x: 100, y: 0 });
  const farm = w.spawn('caster', 'red', { x: 250, y: 0 });
  farm.hp = 20;
  w.step();
  expect(bot.attackTarget).toBe(farm.id);
});
