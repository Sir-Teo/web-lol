import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import type { Team } from '../src/simulation/types';
const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const grid = new NavGrid(
  metadata,
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const battlefield = createRift(
  grid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function setup() {
  const w = new World(true, battlefield);
  w.units = w.units.filter((u) => u.structure || u.id === w.hero.id);
  w.nextWaveTick = Infinity;
  return w;
}
function clearLane(w: World, team: Team, lane: string) {
  for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor']) {
    const target = w.units.find(
      (u) => u.team === team && u.structure?.role === role && u.structure.lane === lane
    )!;
    w.damage(w.hero, target, 1e6, 'true');
  }
}
function nextWave(w: World) {
  w.nextWaveTick = w.tick + 1;
  w.step();
  w.nextWaveTick = Infinity;
}
function composition(w: World, team: Team, lane: string) {
  const index = battlefield.lanes.findIndex((l) => l.name === lane);
  return [
    ...w.units.filter((u) => u.team === team && u.lane === index).map((u) => u.kind),
    ...w.pendingSpawns.filter((u) => u.team === team && u.lane === index).map((u) => u.kind),
  ];
}

describe('inhibitor-driven lane waves', () => {
  for (const team of ['blue', 'red'] as const)
    it(`scales ${team} super health at source boundaries and caps the bonus`, () => {
      expect(battlefield.unitHealthGrowth?.super?.[team]).toEqual({
        intervalSeconds: 90,
        increment: 100,
        maxBonus: 6000,
      });
      const w = new World(false, battlefield);
      for (const [tick, health] of [
        [0, 1500],
        [90 * 60 - 1, 1500],
        [90 * 60, 1600],
        [180 * 60 - 1, 1600],
        [180 * 60, 1700],
        [30 * 60 * 60, 3500],
        [90 * 60 * 60 - 1, 7400],
        [90 * 60 * 60, 7500],
        [120 * 60 * 60, 7500],
      ]) {
        w.tick = tick;
        const unit = w.spawn('super', team, w.hero);
        expect(unit.maxHp).toBe(health);
        expect(unit.hp).toBe(health);
      }
      expect(battlefield.unitStats?.super?.[team]?.maxHp).toBe(1500);
    });
  it('preserves wounded super health across an upgrade boundary and checkpoint', () => {
    const w = new World(false, battlefield);
    w.nextWaveTick = Infinity;
    w.units = [w.hero];
    w.tick = 180 * 60 - 1;
    const older = w.spawn('super', 'blue', w.hero);
    older.hp -= 250;
    w.step();
    expect(older.maxHp).toBe(1600);
    expect(older.hp).toBe(1350);
    const restored = World.fromSnapshot(w.snapshot(), battlefield);
    const saved = restored.units.find((unit) => unit.id === older.id)!;
    expect(saved.maxHp).toBe(1600);
    expect(saved.hp).toBe(1350);
    expect(restored.spawn('super', 'blue', saved).maxHp).toBe(1700);
  });
  it('turret health-percentage hits use the scaled maximum health', () => {
    const w = new World(true, { ...battlefield, lineOfSight: () => true });
    w.tick = 30 * 60 * 60;
    w.nextWaveTick = Infinity;
    const turret = w.units.find(
      (unit) => unit.team === 'blue' && unit.structure?.role === 'outer-turret'
    )!;
    w.units = [w.hero, turret];
    turret.ai = false;
    const target = w.spawn('super', 'red', { x: turret.x + 200, y: turret.y });
    target.stunUntil = Infinity;
    const before = target.hp;
    w.setOrder(turret, { type: 'attack', target: target.id });
    w.step();
    expect(turret.releaseTick).not.toBeNull();
    w.step(turret.releaseTick! - w.tick);
    turret.nextAttackTick = Infinity;
    w.step(60);
    expect(before).toBe(3500);
    expect(target.hp).toBeCloseTo(3500 - (3500 * 0.07) / 2);
  });
  for (const team of ['blue', 'red'] as const)
    it(`changes only the opposing ${team} inhibitor lane and replaces its cannon`, () => {
      const w = setup();
      clearLane(w, team, 'mid');
      w.wave = 2; // A normal cannon wave.
      nextWave(w);
      const attacker = team === 'blue' ? 'red' : 'blue';
      expect(composition(w, attacker, 'mid').filter((k) => k === 'super')).toHaveLength(1);
      expect(composition(w, attacker, 'mid')).not.toContain('siege');
      expect(composition(w, attacker, 'top')).toContain('siege');
      expect(composition(w, attacker, 'top')).not.toContain('super');
      expect(composition(w, team, 'mid')).toContain('siege');
      expect(composition(w, team, 'mid')).not.toContain('super');
      w.step(143);
      expect(w.units.filter((u) => u.kind === 'super')).toHaveLength(0);
      w.step();
      const superUnit = w.units.find((u) => u.kind === 'super')!;
      expect(superUnit.team).toBe(attacker);
      expect(superUnit.lane).toBe(1);
      expect(superUnit.radius).toBe(65);
      expect(superUnit.missileSpeed).toBe(0);
    });
  it('spawns two supers per lane when all three enemy inhibitors are down, with valid wide-unit navigation', () => {
    const w = setup();
    for (const lane of battlefield.lanes) clearLane(w, 'red', lane.name);
    nextWave(w);
    for (const lane of battlefield.lanes) {
      expect(composition(w, 'blue', lane.name).filter((k) => k === 'super')).toHaveLength(2);
      expect(composition(w, 'red', lane.name)).not.toContain('super');
    }
    for (let tick = 0; tick < 700; tick++) {
      w.step();
      for (const u of w.units.filter((u) => u.kind === 'super'))
        expect(grid.lineWalkable(u.previous, u, u.radius, u.team)).toBe(true);
    }
    expect(w.units.filter((u) => u.kind === 'super')).toHaveLength(6);
    expect(w.units.filter((u) => u.kind === 'super').every((u) => u.laneWaypoint > 0)).toBe(true);
  });
  it('keeps an already queued wave stable when an inhibitor falls during release', () => {
    const w = setup();
    nextWave(w);
    clearLane(w, 'red', 'mid');
    expect(w.pendingSpawns.some((u) => u.kind === 'super')).toBe(false);
    w.step(300);
    nextWave(w);
    expect(w.pendingSpawns.filter((u) => u.kind === 'super')).toHaveLength(1);
  });
  it('uses the respawn deadline when a new wave and inhibitor regrowth share a tick', () => {
    const w = setup();
    clearLane(w, 'red', 'mid');
    const inhibitor = w.units.find(
      (u) => u.team === 'red' && u.structure?.role === 'inhibitor' && u.structure.lane === 'mid'
    )!;
    w.tick = inhibitor.respawnTick! - 1;
    w.wave = 2;
    nextWave(w);
    expect(w.alive(inhibitor)).toBe(true);
    expect(composition(w, 'blue', 'mid')).not.toContain('super');
    expect(composition(w, 'blue', 'mid')).toContain('siege');
  });
  it('applies the source melee windup, negative MR, and separate super-minion rewards', () => {
    const w = new World(false, battlefield);
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const u = w.spawn('super', 'red', { x: w.hero.x + 100, y: w.hero.y });
    const victim = w.spawn('champion', 'blue', { x: 0, y: 0 });
    const hp = victim.hp;
    w.setOrder(u, { type: 'attack', target: victim.id });
    w.step(30);
    expect(victim.hp).toBe(hp);
    w.step();
    expect(victim.hp).toBeCloseTo(hp - 180 / 1.26);
    expect(w.projectiles).toHaveLength(0);
    w.damage(w.hero, u, 130, 'magic');
    expect(u.hp).toBeCloseTo(1500 - 160);
    const gold = w.player.gold,
      xp = w.player.xp;
    w.damage(w.hero, u, 1e6, 'true');
    expect(w.player.gold - gold).toBe(50);
    expect(w.player.xp - xp).toBe(75);
    expect(w.player.cs).toBe(1);
  });
  it('keeps damage finite at very negative resistance and leaves true damage unmodified', () => {
    const w = new World(false, battlefield);
    const u = w.spawn('super', 'red', w.hero);
    u.magicResist = -100;
    w.damage(w.hero, u, 100, 'magic');
    expect(u.hp).toBe(1350);
    u.armor = -1000;
    w.damage(w.hero, u, 100, 'true');
    expect(u.hp).toBe(1250);
  });
});
