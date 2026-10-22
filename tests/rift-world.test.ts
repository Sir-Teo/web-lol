import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid, fromRiot } from '../src/simulation/navgrid';
import { createRift, type RiftLayout } from '../src/content/rift';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';
import { GROMP } from '../src/content/gromp';

const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const file = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  metadata,
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
);
const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = createRift(grid, layout);

it('moves neutral Gromp from both raw source object positions with its distinct pathfinding radius', () => {
  const pin = JSON.parse(readFileSync('docs/reference/jungle-map-source.json', 'utf8'));
  const sources = pin.records.neutralCharacterEntities.filter(
    (v: any) => v.record.Character.CharacterRecord === 'Characters/SRU_Gromp/CharacterRecords/Root'
  );
  expect(sources).toHaveLength(2);
  for (const source of sources) {
    const p = source.record.transform[3],
      home = fromRiot(p[0], p[2]);
    const world = new World(false, battlefield);
    world.nextWaveTick = 1_000_000_000;
    expect(grid.lineWalkable(home, home, GROMP.pathfindingRadius)).toBe(true);
    const candidates = Array.from({ length: 16 }, (_, i) => {
      const angle = (i * Math.PI) / 8;
      return battlefield.reachable(
        { x: home.x + Math.cos(angle) * 400, y: home.y + Math.sin(angle) * 400 },
        world.hero.radius,
        'blue'
      );
    });
    const point = candidates.find(
      (point) =>
        distance(home, point) > 250 &&
        distance(home, point) < 650 &&
        battlefield.lineOfSight(home, point) &&
        grid.lineWalkable(home, point, GROMP.pathfindingRadius)
    );
    expect(point).toBeDefined();
    Object.assign(world.hero, point, { previous: { ...point! }, hp: 10000, maxHp: 10000 });
    const target = world.spawnMonster(home);
    world.damage(world.hero, target, 20, 'true');
    for (let i = 0; i < 120; i++) {
      world.step();
      expect(grid.lineWalkable(target.previous, target, GROMP.pathfindingRadius)).toBe(true);
    }
    expect(target.monster.phase).toBe('engaged');
    expect(distance(target, home)).toBeGreaterThan(50);
    expect(World.fromSnapshot(world.snapshot(), battlefield).snapshot()).toBe(world.snapshot());
    world.hero.x = home.x + 1200;
    for (let i = 0; i < 200; i++) {
      world.step();
      expect(grid.lineWalkable(target.previous, target, GROMP.pathfindingRadius)).toBe(true);
    }
    expect(target.monster.phase).toBe('idle');
    expect(distance(target, home)).toBeLessThan(3);
  }
});

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
    const tower = world.units.find((u) => u.structure?.role === 'outer-turret')!;
    world.units = [world.hero, tower];
    world.damage(world.hero, tower, 10000, 'true');
    world.step(301);
    expect(world.unit(tower.id)).toBe(tower);
    expect(world.alive(tower)).toBe(false);
    expect(world.visionSources(tower.team).some((s) => s.x === tower.x && s.y === tower.y)).toBe(
      false
    );
    expect(tower.structureTransform).toEqual(
      layout.turrets.find((t) => t.point.x === tower.x && t.point.y === tower.y)!.transform
    );
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
          expect(
            grid.lineWalkable(u.previous, u, u.radius, u.team === 'neutral' ? undefined : u.team)
          ).toBe(true);
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

it('full Rift starts unlearned, conserves points and restores learned spells', () => {
  const world = new World(true, battlefield);
  expect(world.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(world.player.skillPoints).toBe(1);
  expect(world.player.eCharges).toBe(0);
  expect(world.learnSpell('r')).toBe('Requires champion level 6');
  expect(world.learnSpell('e')).toBeNull();
  expect(world.player.eCharges).toBe(2);
  expect(world.player.skillPoints).toBe(0);
  const restored = World.fromSnapshot(world.snapshot(), battlefield);
  expect(restored.snapshot()).toBe(world.snapshot());
  for (const mutate of [
    (state: any) => {
      state.player.skillPoints++;
    },
    (state: any) => {
      state.player.spellRanks = { q: 0, w: 0, e: 0, r: 1 };
      state.player.eCharges = 0;
    },
    (state: any) => {
      state.player.spellRanks.e = 0;
      state.player.skillPoints = 1;
    },
  ]) {
    const state = JSON.parse(world.snapshot());
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), battlefield)).toThrow();
  }
});
