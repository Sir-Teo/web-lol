import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ASHE_Q } from '../src/content/ashe-q';
import { championDeathTicks } from '../src/simulation/champion-death';

function duel() {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  w.hero.x = 0;
  w.hero.y = 0;
  const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
  bot.ai = false;
  const state = w.championState(bot.id)!;
  return { w, bot, state };
}

test('enemy attack releases build only their own Focus and survive checkpoint continuation', () => {
  const { w, bot, state } = duel();
  w.player.qStacks = 2;
  w.player.qStackExpiry = 1000;
  w.setOrder(bot, { type: 'attack', target: w.hero.id });
  w.step();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (let i = 0; i < 100; i++) {
    w.step();
    restored.step();
    expect(restored.snapshot()).toBe(w.snapshot());
  }
  expect(state.qStacks).toBeGreaterThan(0);
  expect(state.qStackExpiry).toBeGreaterThan(w.tick);
  expect(w.player.qStacks).toBe(2);
  expect(w.hero.hp).toBeLessThan(w.hero.maxHp);
});

test('enemy Q owns attack timing, empowerment and release damage independently of human Q', () => {
  const { w, bot, state } = duel();
  state.qUntil = 1000;
  expect(w.attackSpeedMultiplier(bot, w.hero)).toBeGreaterThan(1);
  expect(w.attackSpeedMultiplier(w.hero, bot)).toBe(1);
  w.setOrder(bot, { type: 'attack', target: w.hero.id });
  w.step();
  expect(bot.attackCycle?.empowered).toBe(true);
  expect(bot.nextAttackTick - w.tick).toBeLessThan(bot.attackPeriod);
  while (!w.projectiles.length) w.step();
  const arrow = w.projectiles[0];
  expect(arrow.source).toBe(bot.id);
  expect(arrow.damage).toBeCloseTo(bot.damage * ASHE_Q.damageMultiplierByRank[0]);
  expect(state.qStacks).toBe(0);
  state.qUntil = w.tick;
  expect(w.attackSpeedMultiplier(bot, w.hero)).toBe(1);
  expect(arrow.damage).toBeCloseTo(bot.damage * ASHE_Q.damageMultiplierByRank[0]);
});

test('Frost Shot strength uses the enemy attacker level', () => {
  const { w, bot, state } = duel();
  state.level = 18;
  w.setOrder(bot, { type: 'attack', target: w.hero.id });
  for (let i = 0; i < 100 && !w.hero.slowUntil; i++) w.step();
  expect(w.hero.slowMultiplier).toBeCloseTo(0.7);
  expect(w.hero.slowUntil).toBe(w.tick + 120);
  expect(w.player.level).toBe(1);
});

test('enemy death resets its combat state and uses its level without consuming cooldowns or charges', () => {
  const { w, bot, state } = duel();
  state.level = 18;
  state.qStacks = 4;
  state.qStackExpiry = 240;
  state.qUntil = 360;
  state.recallEnd = 480;
  state.castAnimation = { ability: 'w', startTick: 0 };
  state.pendingCast = {
    ability: 'w',
    startTick: 0,
    releaseTick: 15,
    point: { x: 0, y: 0 },
    damage: 50,
  };
  state.cooldowns.w = 600;
  state.eCharges = 1;
  state.eRechargeTick = 120;
  w.player.qStacks = 3;
  w.player.qStackExpiry = 240;
  w.damage(w.hero, bot, 10000, 'true');
  expect(state.deaths).toBe(1);
  expect(bot.respawnTick).toBe(championDeathTicks(18, w.tick));
  expect(state.pendingCast).toBeNull();
  expect(state.castAnimation).toBeNull();
  expect(state.recallEnd).toBeNull();
  expect([state.qStacks, state.qStackExpiry, state.qUntil]).toEqual([0, 0, 0]);
  expect(state.cooldowns.w).toBe(600);
  expect(state.eCharges).toBe(1);
  expect(w.player.qStacks).toBe(3);
  expect(w.player.deaths).toBe(0);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  restored.step(180);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.eCharges).toBe(2);
});
