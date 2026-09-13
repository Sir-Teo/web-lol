import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ABILITIES, RECALL_DURATION_TICKS } from '../src/content/rules';

function setup() {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
  bot.ai = false;
  return { w, bot, state: w.championState(bot.id)! };
}

for (const ability of ['w', 'e', 'r'] as const)
  test(`enemy ${ability} owns its windup, resource spending and projectiles across reload`, () => {
    const { w, bot, state } = setup();
    w.enqueue({ type: 'cast', unit: bot.id, ability, point: { x: 2000, y: 0 } });
    w.step();
    expect(state.pendingCast?.ability).toBe(ability);
    expect(state.castAnimation?.ability).toBe(ability);
    expect(bot.mana).toBeLessThanOrEqual(bot.maxMana - ABILITIES[ability].cost + 1);
    expect(w.player.pendingCast).toBeNull();
    expect(w.player.cooldowns[ability]).toBe(0);
    expect(w.player.eCharges).toBe(2);
    if (ability === 'e') expect(state.eCharges).toBe(1);
    const release = state.pendingCast!.releaseTick;
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(release - w.tick);
    restored.step(release - restored.tick);
    expect(restored.snapshot()).toBe(w.snapshot());
    expect(state.pendingCast).toBeNull();
    expect(w.projectiles.length).toBeGreaterThan(0);
    expect(w.projectiles.every((p) => p.source === bot.id && p.team === 'red')).toBe(true);
    expect(w.events.find((e) => e.type === 'cast')?.unit).toBe(bot.id);
  });

test('enemy cast rejection uses its cooldown and keeps feedback off the human team', () => {
  const { w, bot, state } = setup();
  state.cooldowns.w = 600;
  expect(w.abilityCooldownTicks('w', bot.id)).toBe(600);
  expect(w.abilityCooldownTicks('w')).toBe(0);
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'w', point: { x: 2000, y: 0 } });
  w.step();
  expect(state.pendingCast).toBeNull();
  expect(bot.mana).toBe(bot.maxMana);
  const feedback = w.events.find((e) => e.type === 'message')!;
  expect(feedback.audience).toEqual(['red']);
  expect(feedback.unit).toBe(bot.id);
});

test('enemy Q consumes its own Focus and resets its attack', () => {
  const { w, bot, state } = setup();
  state.qStacks = 4;
  state.qStackExpiry = 240;
  bot.nextAttackTick = 200;
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'q', point: bot });
  w.step();
  expect(state.qStacks).toBe(0);
  expect(state.qUntil).toBe(361);
  expect(bot.nextAttackTick).toBe(1);
  expect(w.player.qUntil).toBe(0);
});

test('red recall returns to red fountain and leaves the human in place', () => {
  const { w, bot, state } = setup();
  const humanPoint = { x: w.hero.x, y: w.hero.y };
  w.enqueue({ type: 'recall', unit: bot.id });
  w.step();
  expect(state.recallEnd).toBe(w.tick + RECALL_DURATION_TICKS);
  expect(w.player.recallEnd).toBeNull();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(RECALL_DURATION_TICKS);
  restored.step(RECALL_DURATION_TICKS);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect({ x: bot.x, y: bot.y }).toEqual(w.battlefield.spawns.red);
  expect({ x: w.hero.x, y: w.hero.y }).toEqual(humanPoint);
  expect(state.recallEnd).toBeNull();
});

test('enemy Heal preserves its pending cast, heals its team and spends its own summoner cooldown', () => {
  const { w, bot, state } = setup();
  const ally = w.spawn('champion', 'red', { x: 350, y: 0 });
  ally.ai = false;
  bot.hp = 100;
  ally.hp = 100;
  w.hero.hp = 100;
  state.level = 18;
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'w', point: { x: 2000, y: 0 } });
  w.step();
  const pending = state.pendingCast;
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'f', point: ally });
  w.step();
  expect(state.pendingCast).toBe(pending);
  expect(bot.hp).toBeGreaterThanOrEqual(418);
  expect(ally.hp).toBeGreaterThanOrEqual(418);
  expect(w.hero.hp).toBeLessThan(110);
  expect(state.cooldowns.f).toBeGreaterThan(w.tick);
  expect(w.player.cooldowns.f).toBe(0);
});
