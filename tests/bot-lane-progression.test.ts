import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function route(team: 'blue' | 'red', assigned: number | null = null) {
  const lanes = ['top', 'mid', 'bot'].map((name, i) => ({
    name,
    points: [-2000, -1000, 0, 1000, 2000].map((x) => ({ x, y: (i - 1) * 1000 })),
    spawns: { blue: { x: -2200, y: (i - 1) * 1000 }, red: { x: 2200, y: (i - 1) * 1000 } },
  }));
  const battlefield = {
    ...PRACTICE_FIXTURE,
    id: 'rift' as const,
    initialUnits: [],
    lanes,
    spawns: { blue: { x: -2400, y: 0 }, red: { x: 2400, y: 0 } },
    findPath: (_a: any, b: any) => [{ ...b }],
    reachable: (p: any) => ({ ...p }),
    lineWalkable: () => true,
    lineOfSight: () => true,
  };
  const w = new World(false, battlefield);
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, battlefield.spawns[team]);
  bot.ai = true;
  bot.lane = assigned;
  return { w, bot };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} bot follows the entire lane instead of stopping at its midpoint`, () => {
    const { w, bot } = route(team);
    const visited = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      w.step();
      visited.add(bot.laneWaypoint);
    }
    expect(bot.lane).toBe(1);
    expect(visited.size).toBe(5);
    expect(Math.abs(bot.x - (team === 'blue' ? 2000 : -2000))).toBeLessThanOrEqual(3);
    expect(bot.order.type).toBe('idle');
  });
}

test('assigned lane persists through combat interruption and a saved continuation', () => {
  const { w, bot } = route('blue', 0);
  w.step(300);
  expect(bot.lane).toBe(0);
  const enemy = w.spawn('champion', 'red', { x: bot.x + 100, y: bot.y });
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.order.type).toBe('attack');
  w.damage(bot, enemy, 10000, 'true');
  // Isolate route resumption from a second fight after the opponent respawns.
  enemy.respawnTick = w.tick + 100000;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(900);
    const unit = world.unit(bot.id)!;
    expect(unit.lane).toBe(0);
    expect(unit.y).toBeCloseTo(-1000, 0);
    expect(Math.abs(unit.x - 2000)).toBeLessThanOrEqual(3);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('returning from base rejoins the assigned lane instead of walking straight to its old front', () => {
  const { w, bot } = route('red', 2);
  w.step(650);
  bot.x = w.battlefield.spawns.red.x;
  bot.y = w.battlefield.spawns.red.y;
  w.setOrder(bot, { type: 'idle' });
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.lane).toBe(2);
  expect(bot.laneWaypoint).toBe(4);
  expect(bot.order).toEqual({ type: 'move', point: { x: 2000, y: 1000 } });
});
