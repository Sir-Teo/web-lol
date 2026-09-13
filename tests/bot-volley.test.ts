import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function duel() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    findPath: (_from, to) => [{ x: to.x, y: to.y }],
    reachable: (p) => ({ x: p.x, y: p.y }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  const bot = w.spawn('champion', 'red', { x: 900, y: 0 });
  bot.ai = true;
  return { w, bot, state: w.championState(bot.id)! };
}

test('bot Volley queues an observed aim point and releases its own arrows after windup', () => {
  const { w, bot, state } = duel();
  w.step();
  expect(w.commands).toEqual([{ type: 'cast', unit: bot.id, ability: 'w', point: { x: 0, y: 0 } }]);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(16);
  restored.step(16);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.w).toBe(1082);
  expect(w.player.cooldowns.w).toBe(0);
  expect(w.projectiles).toHaveLength(7);
  expect(w.projectiles.every((p) => p.source === bot.id && p.type === 'volley')).toBe(true);
  for (let i = 0; i < 60 && !w.hero.criticalSlow; i++) w.step();
  expect(w.hero.hp).toBeLessThan(w.hero.maxHp);
  expect(w.hero.criticalSlow).not.toBeNull();
});

test('Volley decision does not use hidden targets or bypass mana, cooldown, attack range or retreat', () => {
  for (const condition of ['hidden', 'mana', 'cooldown', 'close', 'retreat']) {
    const { w, bot, state } = duel();
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'mana') bot.mana = 0;
    if (condition === 'cooldown') state.cooldowns.w = 1000;
    if (condition === 'close') bot.x = 300;
    if (condition === 'retreat') bot.hp = 100;
    w.step();
    expect(
      w.commands.filter((c) => c.type === 'cast' && c.ability === 'w'),
      condition
    ).toHaveLength(0);
  }
});

test('queued Volley preserves the last observed aim when a target disappears and moves', () => {
  const { w, state } = duel();
  w.step();
  w.battlefield.lineOfSight = () => false;
  w.hero.y = 600;
  w.step();
  expect(state.pendingCast?.point).toEqual({ x: 0, y: 0 });
  expect(state.pendingCast?.point).not.toEqual({ x: w.hero.x, y: w.hero.y });
});

test('queued Volley is rejected if the bot is stunned before execution', () => {
  const { w, bot, state } = duel();
  w.step();
  bot.stunUntil = 100;
  w.step();
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.w).toBe(0);
  expect(bot.mana).toBe(bot.maxMana);
});
