import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function shopTrip(team: 'blue' | 'red' = 'red') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -6000, y: 0 }, red: { x: 6000, y: 0 } },
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
    lineOfSight: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 });
  bot.ai = true;
  const state = w.championState(bot.id)!;
  state.gold = 1000;
  return { w, bot, state };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} healthy bot recalls for shopping, purchases and resumes without another recall`, () => {
    const { w, bot, state } = shopTrip(team);
    w.step(2);
    expect(state.recallEnd).not.toBeNull();
    expect(bot.aiRetreating).toBe(false);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(520);
      const own = world.championState(bot.id)!;
      expect(own.inventory).toEqual(['blade', 'boots']);
      expect(own.gold).toBe(250);
      expect(own.recallEnd).toBeNull();
      expect(world.unit(bot.id)!.order.type).toBe('move');
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}

test('shopping recalls require an upgrade, sufficient gold, space, distance and safety', () => {
  for (const reason of ['gold', 'full', 'complete', 'near', 'enemy', 'damage']) {
    const { w, bot, state } = shopTrip();
    if (reason === 'gold') state.gold = 899;
    if (reason === 'full') state.inventory = Array(6).fill('sword');
    if (reason === 'complete') state.inventory = ['blade', 'boots', 'infinity-edge'];
    if (reason === 'near') bot.x = 5000;
    if (reason === 'enemy') w.spawn('champion', 'blue', { x: 500, y: 0 });
    if (reason === 'damage') w.damage(w.hero, bot, 1, 'true');
    w.step(2);
    expect(state.recallEnd, reason).toBeNull();
  }
});

test('new visible danger cancels a shopping channel while hidden opponents do not', () => {
  for (const hidden of [false, true]) {
    const { w, bot, state } = shopTrip();
    w.step(2);
    w.spawn('champion', 'blue', { x: 500, y: 0 });
    if (hidden) w.battlefield.lineOfSight = () => false;
    bot.nextThink = w.tick + 1;
    w.step();
    expect(state.recallEnd !== null).toBe(hidden);
  }
});

test('shopping never cancels an otherwise safe committed attack', () => {
  const { w, bot, state } = shopTrip();
  bot.ai = false;
  const dummy = w.spawn('dummy', 'blue', { x: 200, y: 0 });
  w.setOrder(bot, { type: 'attack', target: dummy.id });
  w.step();
  const release = bot.releaseTick;
  expect(release).not.toBeNull();
  bot.ai = true;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.releaseTick).toBe(release);
  expect(state.recallEnd).toBeNull();
  expect(w.commands.some((c) => c.type === 'recall')).toBe(false);
});
