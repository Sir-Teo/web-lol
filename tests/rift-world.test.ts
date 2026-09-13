import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid, fromRiot } from '../src/simulation/navgrid';
import { createRift, type RiftLayout } from '../src/content/rift';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';

const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const file = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  metadata,
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
);
const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = createRift(grid, layout);

describe('authored full Rift simulation', () => {
  it('uses the source fountains, all three lanes, and all 22 tower placements', () => {
    const world = new World(true, battlefield);
    expect(world.hero.x).toBe(394 - 7425);
    expect(world.hero.y).toBe(7425 - 461);
    expect(world.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
    expect(battlefield.lanes.map((lane) => lane.name)).toEqual(['top', 'mid', 'bot']);
    expect(world.nextWaveTick).toBe(30 * 60);
    expect(JSON.parse(world.snapshot()).battlefield).toBe('rift');
  });

  it('retains destroyed structures without targeting or living sight', () => {
    const world = new World(true, battlefield);
    world.nextWaveTick = Infinity;
    const tower = world.units.find((u) => u.kind === 'turret')!;
    world.units = [world.hero, tower];
    world.damage(world.hero, tower, 10000, 'true');
    world.step(301);
    expect(world.unit(tower.id)).toBe(tower);
    expect(world.alive(tower)).toBe(false);
    expect(world.visionSources(tower.team).some((s) => s.x === tower.x && s.y === tower.y)).toBe(
      false
    );
    expect(tower.structureTransform).toEqual(layout.turrets[0].transform);
  });

  it('spawns both teams on three authored lanes with the source 0.8-second cadence', () => {
    const world = new World(false, battlefield);
    world.step(1799);
    expect(world.units).toHaveLength(1);
    world.step();
    expect(world.units.filter((u) => u.kind === 'melee')).toHaveLength(6);
    expect(
      new Set(world.units.filter((u) => u.kind === 'melee').map((u) => `${u.team}:${u.lane}`)).size
    ).toBe(6);
    world.step(47);
    expect(world.units.filter((u) => u.kind === 'melee')).toHaveLength(6);
    world.step();
    expect(world.units.filter((u) => u.kind === 'melee')).toHaveLength(12);
    world.step(192);
    expect(world.units.filter((u) => u.kind === 'caster')).toHaveLength(18);
    expect(world.pendingSpawns).toHaveLength(0);
  });

  it('keeps every moving unit outside terrain throughout lane progression', () => {
    const world = new World(false, battlefield);
    world.step(1799);
    for (let tick = 0; tick < 1100; tick++) {
      world.step();
      for (const u of world.units)
        if (u.hp > 0 && u.speed > 0) {
          expect(grid.lineWalkable(u.previous, u, u.radius, u.team)).toBe(true);
        }
    }
    for (let lane = 0; lane < 3; lane++) {
      const minion = world.units.find(
        (u) => u.kind === 'melee' && u.team === 'blue' && u.lane === lane
      )!;
      expect(minion.laneWaypoint).toBeGreaterThan(1);
      expect(distance(minion, battlefield.lanes[lane].spawns.blue)).toBeGreaterThan(2500);
    }
  });

  it('uses source brush for gameplay visibility and recalls to the authored fountain', () => {
    const world = new World(false, battlefield);
    world.nextWaveTick = Infinity;
    let inside = -1,
      outside = -1;
    for (let i = 0; i < grid.flags.length; i++) {
      if (!(grid.flags[i] & 1) || !grid.walkable(grid.center(i), 35)) continue;
      const j = i + 1;
      if (j % metadata.width === 0 || grid.flags[j] & 1 || !grid.walkable(grid.center(j), 35))
        continue;
      inside = i;
      outside = j;
      break;
    }
    expect(inside).toBeGreaterThan(-1);
    Object.assign(world.hero, grid.center(outside));
    const target = world.spawn('champion', 'red', grid.center(inside));
    expect(world.visible(target)).toBe(false);
    Object.assign(world.hero, grid.center(inside));
    expect(world.visible(target)).toBe(true);
    world.enqueue({ type: 'recall', unit: world.hero.id });
    world.step(481);
    expect(distance(world.hero, fromRiot(394, 461))).toBeLessThan(0.01);
    expect(world.buy('blade')).toBeNull();
  });
});
