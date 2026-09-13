import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function lane(team: 'blue' | 'red' = 'blue', learned = true) {
  const spawns = { blue: { x: -4500, y: 0 }, red: { x: 4500, y: 0 } };
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    id: 'rift',
    initialUnits: [],
    spawns,
    lanes: [
      { name: 'mid', spawns, points: [-4000, -2000, 0, 2000, 4000].map((x) => ({ x, y: 0 })) },
    ],
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
    lineOfSight: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: team === 'blue' ? -2000 : 2000, y: 0 });
  bot.ai = true;
  if (learned) w.gainExperience(660, bot.id);
  return { w, bot, state: w.championState(bot.id)! };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} bot scouts forward fog, saves its cast and retains a charge`, () => {
    const { w, bot, state } = lane(team);
    const aim = { x: team === 'blue' ? 2000 : -2000, y: 0 };
    expect(w.pointVisible(aim, team)).toBe(false);
    w.step();
    expect(w.commands).toEqual([{ type: 'cast', unit: bot.id, ability: 'e', point: aim }]);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(2);
      expect(world.championState(bot.id)!.pendingCast?.ability).toBe('e');
      world.step(220);
      expect(world.pointVisible(aim, team)).toBe(true);
      expect(world.championState(bot.id)!.eCharges).toBe(1);
      expect(
        world.visionAreas.some(
          (a) => a.kind === 'scout' && a.sourceId === bot.id && a.team === team
        )
      ).toBe(true);
      expect(world.unit(bot.id)!.order.type).toBe('move');
    }
    expect(state.eRechargeTick).toBeGreaterThan(w.tick);
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}

test('scout destination does not follow hidden enemies', () => {
  const aims = [];
  for (const x of [-3500, 3500]) {
    const { w } = lane();
    const enemy = w.spawn('champion', 'red', { x, y: 0 });
    expect(w.visible(enemy, 'blue')).toBe(false);
    w.step();
    aims.push(w.commands);
  }
  expect(aims[0]).toEqual(aims[1]);
});

test('unlearned scouting and already visible route points do not spend Hawkshot', () => {
  for (const reason of ['unlearned', 'visible']) {
    const { w, bot } = lane('blue', reason !== 'unlearned');
    if (reason === 'visible') {
      w.spawn('champion', 'blue', { x: 0, y: 0 });
      w.spawn('champion', 'blue', { x: 2000, y: 0 });
    }
    w.step(2);
    expect(w.championState(bot.id)!.pendingCast).toBeNull();
    expect(w.projectiles.some((p) => p.source === bot.id && p.type === 'hawkshot')).toBe(false);
  }
});
