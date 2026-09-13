import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function danger() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
  bot.ai = true;
  bot.hp = 100;
  return { w, bot, state: w.championState(bot.id)! };
}

test('threatened low-health bot heals through normal commands while retaining retreat', () => {
  const { w, bot, state } = danger();
  w.step();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'f')).toBe(true);
  expect(bot.order).toEqual({ type: 'move', point: w.battlefield.spawns.red });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  restored.step();
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(bot.hp).toBeGreaterThan(180);
  expect(bot.summonerHealSpeedUntil).toBe(w.tick + 60);
  expect(state.cooldowns.f).toBe(14402);
  expect(w.player.cooldowns.f).toBe(0);
  expect(bot.aiRetreating).toBe(true);
});

test('bot can decide to Heal while stunned without issuing movement or attacking', () => {
  const { w, bot, state } = danger();
  bot.stunUntil = 100;
  w.step(2);
  expect(bot.hp).toBeGreaterThan(180);
  expect(state.cooldowns.f).toBeGreaterThan(w.tick);
  expect(bot.order.type).toBe('idle');
  expect(bot.releaseTick).toBeNull();
  expect(bot.nextThink).toBe(19);
});

test('defensive Heal can be chosen during Volley windup without replacing the pending cast', () => {
  const { w, bot, state } = danger();
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'w', point: w.hero });
  w.step();
  const cast = state.pendingCast;
  expect(cast?.ability).toBe('w');
  w.step();
  expect(state.pendingCast).toBe(cast);
  expect(state.castAnimation?.ability).toBe('w');
  expect(bot.hp).toBeGreaterThan(180);
});

test('Heal is not spent at home, without a visible threat, when healthy or on cooldown', () => {
  for (const condition of ['home', 'hidden', 'far', 'healthy', 'cooldown']) {
    const { w, bot, state } = danger();
    if (condition === 'home') Object.assign(bot, w.battlefield.spawns.red);
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'far') w.hero.x = 2000;
    if (condition === 'healthy') bot.hp = bot.maxHp;
    if (condition === 'cooldown') state.cooldowns.f = 1000;
    w.step();
    expect(
      w.commands.filter((c) => c.type === 'cast' && c.ability === 'f'),
      condition
    ).toHaveLength(0);
  }
});
