import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function duel() {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    findPath: (_from, to) => [{ ...to }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
    lineOfSight: () => true,
  });
  world.nextWaveTick = Infinity;
  world.hero.x = world.hero.y = 0;
  world.hero.maxHp = world.hero.hp = 10000;
  const bot = world.spawn('champion', 'red', { x: 250, y: 0 });
  bot.ai = true;
  return { world, bot };
}

test('a close opponent does not prevent a ready bot attack', () => {
  const { world, bot } = duel();
  world.step();
  expect(bot.order).toEqual({ type: 'attack', target: world.hero.id });
  expect(bot.releaseTick).not.toBeNull();
});

test('a nearer opponent does not cancel a valid committed windup', () => {
  const { world, bot } = duel();
  world.step();
  const release = bot.releaseTick!;
  const original = bot.attackTarget;
  world.spawn('champion', 'blue', { x: bot.x - 100, y: bot.y });
  bot.nextThink = world.tick + 1;
  world.step();
  expect(bot.attackTarget).toBe(original);
  expect(bot.releaseTick).toBe(release);
  world.step(release - world.tick);
  expect(world.events.some((e) => e.type === 'attack' && e.unit === bot.id)).toBe(true);
});

test('a pursuing champion receives repeated attacks while the bot moves during recovery', () => {
  const { world, bot } = duel();
  world.hero.speed = 400;
  const attacks = new Set<number>();
  let recoveryMoves = 0;
  for (let i = 0; i < 600; i++) {
    if (i % 6 === 0)
      world.enqueue({
        type: 'order',
        unit: world.hero.id,
        order: { type: 'move', point: { x: bot.x, y: bot.y } },
      });
    world.step();
    for (const e of world.events) if (e.type === 'attack' && e.unit === bot.id) attacks.add(e.tick);
    if (bot.order.type === 'move' && bot.nextAttackTick > world.tick && bot.releaseTick === null)
      recoveryMoves++;
  }
  expect(attacks.size).toBeGreaterThanOrEqual(5);
  expect(recoveryMoves).toBeGreaterThan(30);
  expect(world.hero.hp).toBeLessThan(world.hero.maxHp);
});

test('committed bot attacks still cancel when the target becomes hidden', () => {
  const { world, bot } = duel();
  world.step();
  world.battlefield.lineOfSight = () => false;
  bot.nextThink = world.tick + 1;
  world.step();
  expect(bot.releaseTick).toBeNull();
  world.step(30);
  expect(world.events.filter((e) => e.type === 'attack' && e.unit === bot.id)).toHaveLength(0);
});

test('low-health retreat can interrupt a windup and its saved decision remains deterministic', () => {
  const { world, bot } = duel();
  world.step();
  bot.hp = bot.maxHp * 0.2;
  bot.nextThink = world.tick + 1;
  world.step();
  expect(bot.aiRetreating).toBe(true);
  expect(bot.order.type).toBe('move');
  expect(bot.releaseTick).toBeNull();
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  for (let i = 0; i < 120; i++) {
    world.step();
    restored.step();
  }
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('overlapping opponents do not leave a recovering bot with a zero-length escape order', () => {
  const { world, bot } = duel();
  world.hero.x = bot.x;
  world.hero.y = bot.y;
  bot.nextAttackTick = 100;
  const before = { x: bot.x, y: bot.y };
  world.step();
  expect(bot.order.type).toBe('move');
  expect(Math.hypot(bot.x - before.x, bot.y - before.y)).toBeGreaterThan(0);
});
