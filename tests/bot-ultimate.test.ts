import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function duel() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = 0;
  w.hero.y = 0;
  w.hero.hp = 100;
  const bot = w.spawn('champion', 'red', { x: 900, y: 0 });
  bot.ai = true;
  return { w, bot, state: w.championState(bot.id)! };
}

test('bot finishes a visible champion through a normally validated, saved ultimate cast', () => {
  const { w, bot, state } = duel();
  w.step();
  expect(w.commands).toEqual([{ type: 'cast', unit: bot.id, ability: 'r', point: { x: 0, y: 0 } }]);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(2);
    expect(world.championState(bot.id)!.pendingCast?.ability).toBe('r');
    world.step(90);
    expect(world.hero.hp).toBe(0);
    expect(world.championState(bot.id)!.kills).toBe(1);
  }
  expect(state.cooldowns.r).toBeGreaterThan(w.tick);
  expect(w.player.cooldowns.r).toBe(0);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('blue champion bots own their ultimate resources and kill attribution independently', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', 'blue', { x: 900, y: 0 });
  const target = w.spawn('champion', 'red', { x: 0, y: 0 });
  target.hp = 100;
  bot.ai = true;
  w.step(95);
  expect(target.hp).toBe(0);
  expect(w.championState(bot.id)!.kills).toBe(1);
  expect(w.championState(bot.id)!.cooldowns.r).toBeGreaterThan(w.tick);
  expect(w.player.kills).toBe(0);
  expect(w.player.cooldowns.r).toBe(0);
});

test('ultimate decisions respect visibility, magic resistance, resources, rank and retreat', () => {
  for (const reason of [
    'hidden',
    'resist',
    'health',
    'mana',
    'cooldown',
    'unlearned',
    'retreat',
    'far',
  ]) {
    const { w, bot, state } = duel();
    if (reason === 'hidden') w.battlefield.lineOfSight = () => false;
    if (reason === 'resist') w.hero.magicResist = 1000;
    if (reason === 'health') w.hero.hp = w.hero.maxHp;
    if (reason === 'mana') bot.mana = 0;
    if (reason === 'cooldown') state.cooldowns.r = 10000;
    if (reason === 'unlearned') state.spellRanks.r = 0;
    if (reason === 'retreat') bot.hp = 100;
    if (reason === 'far') bot.x = 1200;
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.ability === 'r'),
      reason
    ).toBe(false);
  }
});

test('visible champions block a finishing arrow, minions and hidden blockers do not affect the decision', () => {
  for (const kind of ['champion', 'melee', 'hidden'] as const) {
    const { w } = duel();
    w.spawn(kind === 'melee' ? 'melee' : 'champion', 'blue', { x: 450, y: 0 });
    if (kind === 'hidden') w.battlefield.lineOfSight = (_a, b) => b.x !== 450;
    w.step();
    expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'r')).toBe(
      kind !== 'champion'
    );
  }
});

test('queued ultimate aim is fixed to observation and can still be rejected by stun', () => {
  for (const stunned of [false, true]) {
    const { w, bot, state } = duel();
    w.step();
    w.battlefield.lineOfSight = () => false;
    w.hero.y = 600;
    if (stunned) bot.stunUntil = 100;
    w.step();
    if (stunned) expect(state.pendingCast).toBeNull();
    else expect(state.pendingCast?.point).toEqual({ x: 0, y: 0 });
  }
});
