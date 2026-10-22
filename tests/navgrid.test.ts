import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid, fromRiot, toRiot, type NavGridMetadata } from '../src/simulation/navgrid';
import { distance } from '../src/simulation/math';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function fixture(rows: number[][]) {
  const height = rows.length,
    width = rows[0].length,
    count = height * width;
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

describe('continuous navigation clearance', () => {
  it('exposes center-point brush flags without treating walls or off-grid cells as brush', () => {
    const grid = fixture([[0, 1, 2]]);
    expect(grid.inBrush(fromRiot(25, 25))).toBe(false);
    expect(grid.inBrush(fromRiot(75, 25))).toBe(true);
    expect(grid.inBrush(fromRiot(125, 25))).toBe(false);
    expect(grid.inBrush(fromRiot(-25, 25))).toBe(false);
  });
  it('returns position-only waypoints when pathfinding receives entity records', () => {
    const grid = fixture(Array.from({ length: 8 }, () => Array(8).fill(0)));
    const start = { ...fromRiot(75, 75), id: 1, hp: 610 };
    const target = { ...fromRiot(275, 275), id: 2, hp: 400 };
    const endpoint = { x: target.x, y: target.y };
    expect(grid.reachable(target, 35)).toEqual(endpoint);
    expect(grid.findPath(start, target, 35)).toEqual([endpoint]);
  });

  it('saves and resumes a live champion chase on the navigation grid', () => {
    const grid = fixture(Array.from({ length: 24 }, () => Array(24).fill(0)));
    const battlefield = {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      spawns: { blue: fromRiot(100, 100), red: fromRiot(1000, 1000) },
      reachable: grid.reachable.bind(grid),
      findPath: grid.findPath.bind(grid),
      lineWalkable: grid.lineWalkable.bind(grid),
      lineOfSight: grid.lineOfSight.bind(grid),
    };
    const world = new World(false, battlefield);
    world.nextWaveTick = Infinity;
    const enemy = world.spawn('champion', 'red', fromRiot(1000, 100));
    world.setOrder(world.hero, { type: 'attack', target: enemy.id });
    world.step();
    expect(world.hero.x).toBeGreaterThan(battlefield.spawns.blue.x);
    expect(world.hero.pathDestination).not.toBeNull();
    const restored = World.fromSnapshot(world.snapshot(), battlefield);
    world.step(180);
    restored.step(180);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(restored.snapshot()).toBe(world.snapshot());
  });

  it('routes a capsule around a barrier through its opening without cutting corners', () => {
    const grid = fixture(
      Array.from({ length: 9 }, (_, z) =>
        Array.from({ length: 9 }, (_, x) => (x === 4 && z < 6 ? 2 : 0))
      )
    );
    const start = fromRiot(100, 100),
      end = fromRiot(350, 100);
    const path = grid.findPath(start, end, 27);
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => toRiot(p).y > 300)).toBe(true);
    let previous = start;
    for (const point of path) {
      expect(grid.lineWalkable(previous, point, 27)).toBe(true);
      previous = point;
    }
    expect(distance(path.at(-1)!, end)).toBeLessThan(0.01);
    expect(grid.lineWalkable(start, end, 27)).toBe(false);
  });
  it('checks the swept radius against diagonal cell corners and rejects non-finite inputs', () => {
    const grid = fixture([
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(grid.lineWalkable(fromRiot(110, 40), fromRiot(160, 90), 20)).toBe(false);
    expect(grid.lineWalkable(fromRiot(125, 25), fromRiot(175, 75), 20)).toBe(true);
    expect(grid.lineWalkable(fromRiot(NaN, 0), fromRiot(100, 100), 20)).toBe(false);
  });
  it('stops in the reachable component instead of teleporting through a sealed wall', () => {
    const grid = fixture(Array.from({ length: 8 }, () => [0, 0, 0, 2, 0, 0, 0, 0]));
    const start = fromRiot(75, 175),
      end = fromRiot(275, 175);
    const path = grid.findPath(start, end, 20);
    expect(path.length).toBeGreaterThan(0);
    expect(toRiot(path.at(-1)!).x).toBeLessThan(150);
    expect(grid.findPath(start, end, 20)).toEqual(path);
  });
});

describe('source terrain semantics', () => {
  it('permits sight through transparent walls while blocking movement', () => {
    const grid = fixture(Array.from({ length: 6 }, () => [0, 0, 66, 0, 0, 0]));
    const start = fromRiot(75, 125),
      end = fromRiot(225, 125);
    expect(grid.lineOfSight(start, end)).toBe(true);
    expect(grid.lineWalkable(start, end, 10)).toBe(false);
  });
  it('shares a connected brush, sees out, and blocks sight entering another brush', () => {
    const grid = fixture([
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 1, 0],
      [0, 1, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
    expect(grid.lineOfSight(fromRiot(25, 75), fromRiot(75, 75))).toBe(false);
    expect(grid.lineOfSight(fromRiot(75, 75), fromRiot(125, 125))).toBe(true);
    expect(grid.lineOfSight(fromRiot(75, 75), fromRiot(25, 75))).toBe(true);
    expect(grid.lineOfSight(fromRiot(125, 75), fromRiot(225, 75))).toBe(false);
  });
  it('uses team-specific gates and their into-but-not-through vision rule', () => {
    const grid = fixture(Array.from({ length: 6 }, () => [0, 0, 1024 | 64 | 4096, 0, 0, 0]));
    const start = fromRiot(75, 125),
      end = fromRiot(225, 125),
      inside = fromRiot(125, 125);
    expect(grid.lineWalkable(start, end, 10, 'blue')).toBe(true);
    expect(grid.lineWalkable(start, end, 10, 'red')).toBe(false);
    expect(grid.lineOfSight(start, end)).toBe(false);
    expect(grid.lineOfSight(start, inside)).toBe(true);
    expect(grid.lineOfSight(inside, end)).toBe(true);
  });
});

describe('pinned full Rift grid', () => {
  const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
  const file = readFileSync('public/assets/maps/rift-nav.bin');
  const grid = new NavGrid(
    metadata,
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
  );
  it('preserves fountain and river elevations and the map coordinate transform', () => {
    expect(grid.heightAt(fromRiot(394, 461))).toBeGreaterThan(150);
    expect(grid.heightAt(fromRiot(10000, 5000))).toBeLessThan(0);
    expect(toRiot(fromRiot(394, 461))).toEqual({ x: 394, y: 461 });
  });
  it('routes across the full map with continuous champion clearance', () => {
    const start = grid.reachable(fromRiot(394, 461), 35),
      end = grid.reachable(fromRiot(14340, 14391), 35);
    const path = grid.findPath(start, end, 35);
    expect(path.length).toBeGreaterThan(1);
    expect(distance(path.at(-1)!, end)).toBeLessThan(0.01);
    let previous = start;
    for (const p of path) {
      expect(grid.lineWalkable(previous, p, 35)).toBe(true);
      previous = p;
    }
    expect(grid.findPath(start, end, 35)).toEqual(path);
  });
});
