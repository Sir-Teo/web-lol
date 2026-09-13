import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function chase() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
  bot.hp = 100;
  bot.ai = true;
  const state = w.championState(bot.id)!;
  state.cooldowns.f = 10000;
  w.setOrder(w.hero, { type: 'attack', target: bot.id });
  return { w, bot, state };
}

test('retreating bot stuns a visible attacker and resumes escape through saved continuation', () => {
  const { w, bot, state } = chase();
  w.step();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'r')).toBe(true);
  expect(bot.aiRetreating).toBe(true);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(40);
    const own = world.unit(bot.id)!;
    expect(world.hero.stunUntil).toBeGreaterThan(world.tick);
    expect(world.hero.hp).toBeGreaterThan(0);
    expect(own.hp).toBeGreaterThan(0);
    expect(own.aiRetreating).toBe(true);
    expect(own.order).toEqual({ type: 'move', point: world.battlefield.spawns.red });
    expect(own.x).toBeGreaterThan(300);
  }
  expect(state.cooldowns.r).toBeGreaterThan(w.tick);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('defensive ultimate excludes idle, distant, hidden, already stunned and unavailable threats', () => {
  for (const reason of ['idle', 'far', 'hidden', 'stunned', 'cooldown', 'unlearned', 'mana']) {
    const { w, bot, state } = chase();
    if (reason === 'idle') w.setOrder(w.hero, { type: 'idle' });
    if (reason === 'far') w.hero.x = -1000;
    if (reason === 'hidden') w.battlefield.lineOfSight = () => false;
    if (reason === 'stunned') w.hero.stunUntil = 1000;
    if (reason === 'cooldown') state.cooldowns.r = 1000;
    if (reason === 'unlearned') state.spellRanks.r = 0;
    if (reason === 'mana') bot.mana = 0;
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.ability === 'r'),
      reason
    ).toBe(false);
    if (reason === 'hidden' || reason === 'far') {
      expect(w.commands.some((c) => c.type === 'recall')).toBe(true);
    } else expect(bot.order.type).toBe('move');
  }
});

test('a visible incoming attack remains a defensive cue after the attacker finishes its windup', () => {
  const { w, bot } = chase();
  bot.ai = false;
  while (!w.projectiles.length) w.step();
  w.setOrder(w.hero, { type: 'idle' });
  expect(w.hero.releaseTick).toBeNull();
  bot.ai = true;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(w.commands.some((c) => c.type === 'cast' && c.ability === 'r')).toBe(true);
});
