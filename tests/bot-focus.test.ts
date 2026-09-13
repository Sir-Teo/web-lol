import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function ready() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
  bot.ai = true;
  bot.nextAttackTick = 100;
  const state = w.championState(bot.id)!;
  state.qStacks = 4;
  state.qStackExpiry = 240;
  return { w, bot, state };
}

test('bot queues Q during recovery and starts its own empowered attack through the normal command path', () => {
  const { w, bot, state } = ready();
  w.step();
  expect(state.qUntil).toBe(0);
  expect(w.commands).toEqual([
    { type: 'cast', unit: bot.id, ability: 'q', point: { x: 300, y: 0 } },
  ]);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  restored.step();
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.qUntil).toBe(362);
  expect(state.qStacks).toBe(0);
  expect(bot.attackCycle?.empowered).toBe(true);
  expect(w.player.qUntil).toBe(0);
  expect(w.events.some((e) => e.type === 'cast' && e.unit === bot.id && e.text === 'q')).toBe(true);
});

test('bot Focus decision respects sight, range, mana, cooldown, stacks and retreat', () => {
  for (const condition of ['hidden', 'range', 'mana', 'cooldown', 'stacks', 'retreat']) {
    const { w, bot, state } = ready();
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'range') bot.x = 1000;
    if (condition === 'mana') bot.mana = 0;
    if (condition === 'cooldown') state.cooldowns.q = 500;
    if (condition === 'stacks') state.qStacks = 3;
    if (condition === 'retreat') bot.hp = 100;
    w.step();
    expect(
      w.commands.filter((c) => c.type === 'cast' && c.ability === 'q'),
      condition
    ).toHaveLength(0);
    expect(state.qUntil, condition).toBe(0);
  }
});

test('bot does not cancel a committed windup to activate Q', () => {
  const { w, bot, state } = ready();
  bot.nextAttackTick = 0;
  w.step();
  const release = bot.releaseTick;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(w.commands).toHaveLength(0);
  expect(bot.releaseTick).toBe(release);
  expect(state.qUntil).toBe(0);
});

test('stun arriving after the decision rejects queued Q without spending resources', () => {
  const { w, bot, state } = ready();
  w.step();
  bot.stunUntil = 100;
  w.step();
  expect(state.qUntil).toBe(0);
  expect(state.qStacks).toBe(4);
  expect(state.cooldowns.q).toBe(0);
});
