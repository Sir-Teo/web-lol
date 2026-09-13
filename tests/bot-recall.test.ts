import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { RECALL_DURATION_TICKS } from '../src/content/rules';

function retreat(team: 'blue' | 'red' = 'red') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -6000, y: 0 }, red: { x: 6000, y: 0 } },
    findPath: (_from, to) => [{ ...to }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
    lineOfSight: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 });
  bot.ai = true;
  bot.hp = 100;
  const state = w.championState(bot.id)!;
  state.cooldowns.f = 100000;
  return { w, bot, state };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} retreating bot completes one recall and resumes after a saved channel`, () => {
    const { w, bot, state } = retreat(team);
    w.step(2);
    const deadline = state.recallEnd;
    expect(deadline).toBe(w.tick + RECALL_DURATION_TICKS);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(RECALL_DURATION_TICKS - 1);
      expect(world.championState(bot.id)!.recallEnd).toBe(deadline);
      world.step();
      expect(world.unit(bot.id)!.x).toBe(world.battlefield.spawns[team].x);
      expect(world.unit(bot.id)!.hp).toBe(world.unit(bot.id)!.maxHp);
      expect(world.championState(bot.id)!.recallEnd).toBeNull();
      world.step(18);
      expect(world.unit(bot.id)!.aiRetreating).toBe(false);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}

test('visible approaching enemy cancels recall and hidden enemy does not change the decision', () => {
  for (const hidden of [false, true]) {
    const { w, bot, state } = retreat();
    w.step(2);
    w.spawn('champion', 'blue', { x: 500, y: 0 });
    if (hidden) w.battlefield.lineOfSight = () => false;
    bot.nextThink = w.tick + 1;
    w.step();
    expect(state.recallEnd !== null).toBe(hidden);
    expect(bot.order.type).toBe(hidden ? 'idle' : 'move');
  }
});

test('recent damage, nearby minions and shorter walks prevent unsafe or wasteful recall', () => {
  for (const reason of ['damage', 'minion', 'near-home']) {
    const { w, bot, state } = retreat();
    if (reason === 'damage') w.damage(w.hero, bot, 1, 'true');
    if (reason === 'minion') w.spawn('caster', 'blue', { x: 500, y: 0 });
    if (reason === 'near-home') bot.x = 5000;
    w.step(2);
    expect(state.recallEnd, reason).toBeNull();
    expect(bot.order.type, reason).toBe('move');
  }
});

test('damage interrupts a channel and the bot retreats before attempting another recall', () => {
  const { w, bot, state } = retreat();
  w.step(2);
  w.damage(w.hero, bot, 1, 'true');
  bot.nextThink = w.tick + 1;
  w.step();
  expect(state.recallEnd).toBeNull();
  expect(bot.order.type).toBe('move');
  // The two-second quiet window expires between the bot's 18-tick decisions.
  w.step(138);
  expect(state.recallEnd).not.toBeNull();
});

test('a visible incoming targeted missile prevents recall even after its source leaves sight', () => {
  const { w, bot, state } = retreat();
  bot.ai = false;
  w.hero.x = -500;
  w.hero.y = 0;
  w.setOrder(w.hero, { type: 'attack', target: bot.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  expect(w.projectiles).toHaveLength(1);
  w.setOrder(w.hero, { type: 'idle' });
  w.hero.x = -10000;
  bot.ai = true;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(state.recallEnd).toBeNull();
  expect(w.commands.some((c) => c.type === 'recall')).toBe(false);
  expect(bot.order.type).toBe('move');
});
