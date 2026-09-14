import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function lane(team: 'blue' | 'red' = 'red') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 }, 'garen');
  const enemy = team === 'red' ? 'blue' : 'red';
  const healthy = w.spawn('melee', enemy, { x: 90, y: 0 });
  const weak = w.spawn('siege', enemy, { x: 160, y: 0 });
  for (const minion of [healthy, weak]) {
    minion.speed = 0;
    minion.nextAttackTick = 10000;
    minion.armor = 0;
  }
  weak.hp = 100; // Above an ordinary 69-damage attack, below Q's 133.5.
  expect(w.learnSpell('q', bot.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: bot.id, ability: 'q', point: { x: 0, y: 0 } });
  w.step();
  const state = w.championState(bot.id)!;
  const think = () => {
    bot.ai = true;
    bot.nextThink = w.tick + 1;
    w.step();
  };
  return { w, bot, healthy, weak, state, think };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} Garen prioritizes a Q-only last hit and completes it across a saved windup`, () => {
    const { w, bot, healthy, weak, state, think } = lane(team);
    think();
    expect(bot.attackTarget).toBe(weak.id);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    const remaining = bot.releaseTick! - w.tick;
    for (const world of [w, restored]) {
      world.step(remaining);
      expect(world.unit(weak.id)!.hp).toBe(0);
      expect(world.unit(healthy.id)!.hp).toBe(healthy.maxHp);
      expect(world.championState(bot.id)!.cs).toBe(1);
    }
    expect(state.garenQ?.consumed).toBe(true);
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('consumed and exactly expired empowerment cannot create a false Q last hit', () => {
  for (const condition of ['consumed', 'expired']) {
    const { w, bot, healthy, state, think } = lane();
    if (condition === 'consumed') state.garenQ!.consumed = true;
    else w.step(state.garenQ!.attackUntil - w.tick - 1);
    think();
    expect(bot.attackTarget, condition).toBe(healthy.id);
    expect(bot.attackCycle?.garenQRank, condition).toBeUndefined();
  }
});

test('Q farming still respects armor, visibility and melee range', () => {
  for (const condition of ['armor', 'hidden', 'range']) {
    const { w, bot, healthy, weak, think } = lane();
    if (condition === 'armor') weak.armor = 1000;
    if (condition === 'hidden') w.battlefield.lineOfSight = (_a, b) => b.x < 150;
    if (condition === 'range') weak.x = 400;
    think();
    expect(bot.attackTarget, condition).toBe(healthy.id);
  }
});

test('a last hit committed just before Q expires still lands its captured empowerment', () => {
  const { w, bot, weak, state, think } = lane();
  w.step(state.garenQ!.attackUntil - w.tick - 2);
  think();
  expect(bot.attackTarget).toBe(weak.id);
  expect(bot.attackCycle?.garenQRank).toBe(1);
  w.step(bot.releaseTick! - w.tick);
  expect(weak.hp).toBe(0);
  expect(state.cs).toBe(1);
  expect(state.garenQ).toBeNull();
});
