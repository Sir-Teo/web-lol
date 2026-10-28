import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid, fromRiot, toRiot, type NavGridMetadata } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { BOT_TEAM_POLICY } from '../src/content/bot-team-policy';
import { distance, segmentDistance, type Vec2 } from '../src/simulation/math';
import type { NavigationCircle } from '../src/simulation/battlefield';
import type { TeamGoal } from '../src/simulation/bot-team';
import type { Team } from '../src/simulation/types';

function gridFor(rows: number[][]) {
  const width = rows[0].length,
    height = rows.length,
    count = width * height;
  const buffer = new ArrayBuffer(count * 2 + (width + 1) * (height + 1) * 4);
  const view = new DataView(buffer);
  rows.flat().forEach((flags, i) => view.setUint16(i * 2, flags, true));
  const metadata: NavGridMetadata = {
    width,
    height,
    cellSize: 50,
    minimum: [0, 0, 0],
    heightWidth: width + 1,
    heightHeight: height + 1,
    heightSpacing: [50, 50],
    sections: { flags: [0], heights: [count * 2] },
  };
  return new NavGrid(metadata, buffer);
}
function clearRoute(
  grid: NavGrid,
  start: Vec2,
  path: Vec2[],
  circles: NavigationCircle[],
  radius = 20
) {
  expect(path.length).toBeGreaterThan(0);
  let previous = start;
  for (const point of path) {
    expect(grid.lineWalkable(previous, point, radius)).toBe(true);
    for (const circle of circles)
      expect(segmentDistance(circle, previous, point)).toBeGreaterThanOrEqual(circle.radius);
    expect(Object.keys(point).sort()).toEqual(['x', 'y']);
    previous = point;
  }
}
describe('navigation query exclusions', () => {
  for (const mirror of [false, true])
    test(`continuous edges and smoothing avoid a forbidden circle (${mirror ? 'reverse' : 'forward'})`, () => {
      const grid = gridFor(Array.from({ length: 32 }, () => Array(32).fill(0)));
      const start = fromRiot(mirror ? 1475 : 125, 800),
        end = fromRiot(mirror ? 125 : 1475, 800);
      const circles = [{ ...fromRiot(800, 800), radius: 250 }];
      const path = grid.findPath(start, end, 20, 'blue', circles);
      expect(path.length).toBeGreaterThan(1);
      expect(path.at(-1)).toEqual(end);
      clearRoute(grid, start, path, circles);
      expect(grid.findPath(start, end, 20, 'blue', circles)).toEqual(path);
    });
  test('overlapping exclusions cannot leak through the gap between cell centers', () => {
    const grid = gridFor(Array.from({ length: 32 }, () => Array(32).fill(0)));
    const start = fromRiot(125, 800),
      end = fromRiot(1475, 800);
    const circles = [600, 900].map((x) => ({ ...fromRiot(x, 800), radius: 210 }));
    const path = grid.findPath(start, end, 20, 'blue', circles);
    expect(path.at(-1)).toEqual(end);
    clearRoute(grid, start, path, circles);
  });
  test('a blocked opening selects the other terrain opening without cutting either obstacle', () => {
    const grid = gridFor(
      Array.from({ length: 32 }, (_, z) =>
        Array.from({ length: 32 }, (_, x) =>
          x === 16 && !((z >= 5 && z <= 10) || (z >= 22 && z <= 27)) ? 2 : 0
        )
      )
    );
    const start = fromRiot(300, 800),
      end = fromRiot(1300, 800),
      circles = [{ ...fromRiot(825, 400), radius: 220 }];
    const path = grid.findPath(start, end, 20, 'blue', circles);
    expect(path.at(-1)).toEqual(end);
    expect(path.some((p) => toRiot(p).y > 1100)).toBe(true);
    clearRoute(grid, start, path, circles);
  });
  test('an exclusion spanning the only corridor yields a safe partial path instead of crossing', () => {
    const grid = gridFor(
      Array.from({ length: 8 }, (_, z) => Array(32).fill(z === 3 || z === 4 ? 0 : 2))
    );
    const start = fromRiot(125, 200),
      end = fromRiot(1475, 200),
      circles = [{ ...fromRiot(800, 200), radius: 180 }];
    const path = grid.findPath(start, end, 20, 'blue', circles);
    expect(distance(path.at(-1)!, end)).toBeGreaterThan(500);
    clearRoute(grid, start, path, circles);
  });
  test('forbidden endpoints are rejected without relocating an actor or goal through danger', () => {
    const grid = gridFor(Array.from({ length: 32 }, () => Array(32).fill(0)));
    const start = fromRiot(125, 800),
      end = fromRiot(1475, 800);
    expect(grid.findPath(start, end, 20, 'blue', [{ ...start, radius: 100 }])).toEqual([]);
    expect(grid.findPath(start, end, 20, 'blue', [{ ...end, radius: 100 }])).toEqual([]);
  });
  test('per-query exclusions leave ordinary and later navigation caches unchanged', () => {
    const grid = gridFor(Array.from({ length: 32 }, () => Array(32).fill(0)));
    const start = { ...fromRiot(125, 800), hp: 500 },
      end = { ...fromRiot(1475, 800), id: 99 };
    const ordinary = grid.findPath(start, end, 20),
      circles = [{ ...fromRiot(800, 800), radius: 250 }];
    grid.findPath(start, end, 20, 'blue', circles);
    expect(grid.findPath(start, end, 20)).toEqual(ordinary);
    expect(grid.findPath(start, end, 20, 'blue', [])).toEqual(ordinary);
  });
  for (const circle of [
    { x: NaN, y: 0, radius: 10 },
    { x: 0, y: Infinity, radius: 10 },
    { x: 0, y: 0, radius: -1 },
    { x: 0, y: 0, radius: Infinity },
  ])
    test(`rejects malformed exclusion ${JSON.stringify(circle)}`, () => {
      const grid = gridFor(Array.from({ length: 8 }, () => Array(8).fill(0)));
      expect(() =>
        grid.findPath(fromRiot(75, 75), fromRiot(275, 275), 20, 'blue', [circle])
      ).toThrow('Invalid navigation exclusion');
    });
});
function fixture(team: Team = 'blue') {
  const grid = gridFor(Array.from({ length: 80 }, () => Array(80).fill(0)));
  const center = fromRiot(2000, 2000),
    start = { x: center.x + (team === 'blue' ? -1400 : 1400), y: center.y };
  const point = { x: center.x + (team === 'blue' ? 1400 : -1400), y: center.y };
  const battlefield = {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: center.x - 1400, y: center.y }, red: { x: center.x + 1400, y: center.y } },
    reachable: grid.reachable.bind(grid),
    findPath: grid.findPath.bind(grid),
    lineWalkable: grid.lineWalkable.bind(grid),
    lineOfSight: grid.lineOfSight.bind(grid),
    heightAt: grid.heightAt.bind(grid),
    inBrush: grid.inBrush.bind(grid),
  };
  const world = new World(false, battlefield);
  world.nextWaveTick = Infinity;
  const actor = team === 'blue' ? world.hero : world.spawn('champion', 'red', start);
  actor.ai = true;
  actor.nextThink = 10000;
  const tower = world.spawn('turret', team === 'blue' ? 'red' : 'blue', center);
  tower.range = 400;
  const goal: TeamGoal = {
    unitId: actor.id,
    kind: 'advance',
    targetId: tower.id,
    point,
    issuedTick: 0,
    observedTick: 0,
    expiresTick: 180,
    score: 90,
  };
  const follow = () => (world as any).followTeamGoal(actor, goal) as boolean;
  return { world, actor, tower, goal, point, follow, battlefield, grid };
}
function assertSafe(f: ReturnType<typeof fixture>, path = f.actor.path) {
  const route = [f.actor, ...path];
  for (let i = 1; i < route.length; i++) {
    expect(segmentDistance(f.tower, route[i - 1], route[i])).toBeGreaterThanOrEqual(
      f.tower.range + f.actor.radius + BOT_TEAM_POLICY.towerMargin
    );
    expect(f.grid.lineWalkable(route[i - 1], route[i], f.actor.radius, f.actor.team)).toBe(true);
  }
}
describe('strategic route detours', () => {
  for (const team of ['blue', 'red'] as const)
    test(`an unsafe ${team} crossing installs a safe route and moves along it through an exact saved future`, () => {
      const f = fixture(team),
        role = f.world.championState(f.actor.id)!.role;
      expect(f.world.visible(f.tower, team)).toBe(false);
      expect(f.follow()).toBe(true);
      expect(f.actor.order).toEqual({ type: 'move', point: f.point });
      expect(f.actor.path.length).toBeGreaterThan(1);
      assertSafe(f);
      expect(f.actor.pathTarget).toEqual(f.point);
      expect(f.actor.pathDestination).toEqual(f.point);
      const raw = f.world.snapshot(),
        copy = World.fromSnapshot(raw, f.battlefield);
      expect(copy.snapshot()).toBe(raw);
      for (let i = 0; i < 180; i++) {
        f.world.step();
        expect(distance(f.actor, f.tower)).toBeGreaterThanOrEqual(
          f.tower.range + f.actor.radius + BOT_TEAM_POLICY.towerMargin
        );
      }
      copy.step(180);
      expect(copy.snapshot()).toBe(f.world.snapshot());
      expect(f.world.championState(f.actor.id)!.role).toBe(role);
      expect(f.actor.lane).toBeNull();
    });
  for (const kind of ['defend', 'push', 'gank', 'river', 'advance'] as const)
    test(`${kind} jobs retain their captured point and goal identity while detouring`, () => {
      const f = fixture();
      f.goal.kind = kind;
      const goal = structuredClone(f.goal);
      expect(f.follow()).toBe(true);
      assertSafe(f);
      expect(f.goal).toEqual(goal);
      expect(f.actor.order).toEqual({ type: 'move', point: goal.point });
    });
  test('hidden actual tower health cannot remove a remembered path hazard', () => {
    const a = fixture(),
      b = fixture();
    b.tower.hp = 0;
    b.tower.deadAt = 0;
    expect(a.follow()).toBe(true);
    expect(b.follow()).toBe(true);
    expect(b.actor.path).toEqual(a.actor.path);
    expect(b.actor.order).toEqual(a.actor.order);
  });
  test('observed destruction releases the ordinary path', () => {
    const f = fixture();
    f.tower.hp = 0;
    f.tower.deadAt = 0;
    f.tower.structureKnowledge![f.actor.team] = 0;
    expect(f.follow()).toBe(true);
    expect(f.actor.path).toEqual([]);
    f.world.step();
    expect(f.actor.path).toEqual([f.point]);
  });
  for (const kind of ['advance', 'gank'] as const)
    test(`friendly minion cover keeps the existing ${kind} tower policy`, () => {
      const f = fixture();
      f.goal.kind = kind;
      const cover = f.world.spawn('melee', f.actor.team, { x: f.tower.x, y: f.tower.y + 100 });
      cover.ai = false;
      expect(f.follow()).toBe(true);
      if (kind === 'gank') {
        expect(f.actor.path.length).toBeGreaterThan(1);
        assertSafe(f);
      } else expect(f.actor.path).toEqual([]);
    });
  test('a stale cached crossing is replaced even when its ordinary destination is unchanged', () => {
    const f = fixture();
    f.world.setOrder(f.actor, { type: 'move', point: f.point });
    f.actor.path = [{ ...f.point }];
    f.actor.pathTarget = { ...f.point };
    f.actor.pathDestination = { ...f.point };
    expect(f.follow()).toBe(true);
    expect(f.actor.path.length).toBeGreaterThan(1);
    assertSafe(f);
  });
  test('a terrain implementation that ignores exclusions cannot authorize an unsafe route', () => {
    const f = fixture();
    f.battlefield.findPath = (_a, b) => [{ x: b.x, y: b.y }];
    expect(f.follow()).toBe(false);
    expect(f.actor.order).toEqual({ type: 'idle' });
    expect(f.actor.path).toEqual([]);
  });
  test('a partial alternative cannot authorize movement toward an unreachable goal', () => {
    const f = fixture(),
      ordinary = f.battlefield.findPath;
    f.battlefield.findPath = (a, b, r, t, avoid) =>
      avoid?.length ? [{ x: a.x, y: a.y + 300 }] : ordinary(a, b, r, t);
    expect(f.follow()).toBe(false);
    expect(f.actor.order).toEqual({ type: 'idle' });
  });
  test('a complete alternative still needs continuous terrain clearance', () => {
    const f = fixture(),
      ordinary = f.battlefield.findPath,
      clear = f.battlefield.lineWalkable;
    f.battlefield.findPath = (a, b, r, t, avoid) => {
      const route = ordinary(a, b, r, t, avoid);
      if (avoid?.length) f.battlefield.lineWalkable = () => false;
      return route;
    };
    expect(f.follow()).toBe(false);
    expect(f.actor.path).toEqual([]);
    f.battlefield.lineWalkable = clear;
  });
  test('a goal inside a remembered tower remains rejected', () => {
    const f = fixture();
    f.goal.point = { x: f.tower.x, y: f.tower.y };
    expect(f.follow()).toBe(false);
    expect(f.actor.order).toEqual({ type: 'idle' });
  });
  test('ordinary human movement keeps its chosen direct path', () => {
    const f = fixture();
    f.actor.ai = false;
    f.world.enqueue({ type: 'order', unit: f.actor.id, order: { type: 'move', point: f.point } });
    f.world.step();
    expect(f.actor.path).toEqual([f.point]);
    expect(f.actor.order).toEqual({ type: 'move', point: f.point });
  });
});

describe('retained Rift crossing geometry', () => {
  const rows = JSON.parse(readFileSync('docs/reference/team-detour-cases.json', 'utf8')).cases;
  for (const row of rows)
    test(`retained seed ${row.seed} tick ${row.tick} ${row.champion} crossing has a complete safe alternative`, () => {
      const bytes = readFileSync('public/assets/maps/rift-nav.bin');
      const grid = new NavGrid(
        JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      );
      const path = grid.findPath(row.start, row.goal, row.actorRadius, row.team, row.hazards);
      expect(path.at(-1)).toEqual(row.goal);
      clearRoute(grid, row.start, path, row.hazards, row.actorRadius);
    });
});
