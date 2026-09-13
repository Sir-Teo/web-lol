import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import type { Team, StructureState } from '../src/simulation/types';
const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const battlefield = createRift(
  new NavGrid(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function setup() {
  const w = new World(true, battlefield);
  w.nextWaveTick = Infinity;
  w.units = w.units.filter((u) => u.id === w.hero.id || u.structure);
  return w;
}
function find(
  w: World,
  team: Team,
  role: StructureState['role'],
  lane: StructureState['lane'] = null
) {
  return w.units.find(
    (u) => u.team === team && u.structure?.role === role && u.structure.lane === lane
  )!;
}
function openBase(w: World, team: Team) {
  for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor'] as const)
    w.damage(w.hero, find(w, team, role, 'mid'), 1e6, 'true');
}
function breakNexusTowers(w: World, team: Team) {
  for (const u of w.units.filter((u) => u.team === team && u.structure?.role === 'nexus-turret'))
    w.damage(w.hero, u, 1e6, 'true');
}
describe('structure dependency and terminal match state', () => {
  it('loads all base structures and source health values; only outer towers begin vulnerable', () => {
    const w = setup();
    expect(w.units.filter((u) => u.kind === 'nexus')).toHaveLength(2);
    expect(w.units.filter((u) => u.kind === 'inhibitor')).toHaveLength(6);
    const structures = w.units.filter((u) => u.structure);
    expect(structures.filter((u) => w.vulnerable(u))).toHaveLength(6);
    expect(find(w, 'red', 'outer-turret', 'mid').hp).toBe(9000);
    expect(find(w, 'red', 'inner-turret', 'mid').hp).toBe(5000);
    expect(find(w, 'red', 'inhibitor-turret', 'mid').hp).toBe(4750);
    expect(find(w, 'red', 'nexus-turret').hp).toBe(3500);
    expect(find(w, 'red', 'inhibitor', 'mid').hp).toBe(4000);
    expect(find(w, 'red', 'nexus').hp).toBe(5500);
  });
  it('rejects protected damage and acquisition, then unlocks each defender in lane order', () => {
    const w = setup(),
      nexus = find(w, 'red', 'nexus');
    Object.assign(w.hero, battlefield.reachable({ x: nexus.x + 450, y: nexus.y }, 35, 'blue'));
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(nexus.hp).toBe(5500);
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: nexus.id } });
    w.step();
    expect(w.hero.releaseTick).toBeNull();
    for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor'] as const) {
      const u = find(w, 'red', role, 'mid');
      expect(w.vulnerable(u)).toBe(true);
      w.damage(w.hero, u, 1e6, 'true');
      expect(u.hp).toBe(0);
    }
    expect(w.vulnerable(find(w, 'red', 'inner-turret', 'top'))).toBe(false);
    expect(w.vulnerable(find(w, 'red', 'nexus-turret'))).toBe(true);
    expect(w.vulnerable(nexus)).toBe(false);
    breakNexusTowers(w, 'red');
    expect(w.vulnerable(nexus)).toBe(true);
  });
  it('respawns an inhibitor in place at its deadline and protects the base again', () => {
    const w = setup();
    openBase(w, 'red');
    breakNexusTowers(w, 'red');
    const inhibitor = find(w, 'red', 'inhibitor', 'mid'),
      point = { x: inhibitor.x, y: inhibitor.y };
    expect(inhibitor.respawnTick).toBe(inhibitor.deadAt! + 300 * 60);
    w.tick = inhibitor.respawnTick! - 1;
    // Keep the towers down to isolate protection caused by the inhibitor itself.
    for (const u of w.units.filter((u) => u.structure?.role === 'nexus-turret'))
      u.respawnTick = null;
    expect(w.vulnerable(find(w, 'red', 'nexus'))).toBe(true);
    w.step();
    expect(inhibitor.hp).toBe(inhibitor.maxHp);
    expect({ x: inhibitor.x, y: inhibitor.y }).toEqual(point);
    expect(w.vulnerable(find(w, 'red', 'nexus'))).toBe(false);
    expect(w.vulnerable(find(w, 'red', 'nexus-turret'))).toBe(false);
  });
  it('restores a Nexus turret at 40% health after three minutes without moving it', () => {
    const w = setup();
    openBase(w, 'red');
    breakNexusTowers(w, 'red');
    const tower = find(w, 'red', 'nexus-turret'),
      point = { x: tower.x, y: tower.y };
    expect(tower.respawnTick).toBe(tower.deadAt! + 180 * 60);
    w.tick = tower.respawnTick! - 1;
    w.step();
    expect(tower.hp).toBe(tower.maxHp * 0.4);
    expect({ x: tower.x, y: tower.y }).toEqual(point);
    expect(w.vulnerable(find(w, 'red', 'nexus'))).toBe(false);
  });
  it('stops the rest of a live tick when a melee attack destroys the Nexus', () => {
    const w = setup();
    openBase(w, 'blue');
    breakNexusTowers(w, 'blue');
    const nexus = find(w, 'blue', 'nexus');
    nexus.hp = 1;
    const attacker = w.spawn('melee', 'red', { x: nexus.x + 350, y: nexus.y });
    attacker.order = { type: 'attack', target: nexus.id };
    w.step(60);
    expect(w.winner).toBe('red');
    expect(w.tick).toBeLessThan(60);
    expect(w.projectiles).toHaveLength(0);
    expect(w.units.every((u) => u.order.type === 'idle' && u.releaseTick === null)).toBe(true);
    const state = w.snapshot();
    w.step();
    expect(w.snapshot()).toBe(state);
  });

  for (const team of ['blue', 'red'] as const)
    it(`ends on the ${team} Nexus and rejects subsequent gameplay mutations`, () => {
      const w = setup();
      openBase(w, team);
      breakNexusTowers(w, team);
      w.damage(w.hero, find(w, team, 'nexus'), 1e6, 'true');
      expect(w.winner).toBe(team === 'blue' ? 'red' : 'blue');
      const snapshot = w.snapshot();
      w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'move', point: { x: 0, y: 0 } } });
      w.step(100);
      w.damage(
        w.hero,
        find(w, team === 'blue' ? 'red' : 'blue', 'outer-turret', 'mid'),
        1e6,
        'true'
      );
      expect(w.buy('blade')).toBe('The game has ended');
      expect(w.snapshot()).toBe(snapshot);
      expect(w.commands).toHaveLength(0);
    });
});
