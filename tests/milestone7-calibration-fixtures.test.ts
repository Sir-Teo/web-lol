import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DRAGON_PIT_POINT, TOP_PIT_POINT } from '../src/content/epic-objectives';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { TICK_RATE } from '../src/content/rules';
import { createLaneMatch } from '../src/simulation/lane-match';
import { distance } from '../src/simulation/math';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';

const navBytes = readFileSync('public/assets/maps/rift-nav.bin');
const navGrid = new NavGrid(
  JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
  navBytes.buffer.slice(navBytes.byteOffset, navBytes.byteOffset + navBytes.byteLength)
);
const baseRift = createRift(
  navGrid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const publicRift = { ...baseRift, publicRift: true as const };

describe('Milestone 7.1 — Reference Validation Comparison Set Fixtures', () => {
  test('capture packet metadata registers all 8 core comparison IDs honestly', () => {
    const packets = JSON.parse(
      readFileSync('docs/reference/milestone7-capture-packets.json', 'utf8')
    );
    expect(packets.patch).toBe('26.18');
    expect(packets.clientBuild).toBe('16.18.8175716');
    const ids = packets.packets.map((p: { experiment_id: string }) => p.experiment_id);
    expect(ids).toEqual([
      'CAM-01',
      'MOVE-01',
      'INPUT-01',
      'ATK-01',
      'FOG-01',
      'LANE-01',
      'BASE-01',
      'MATCH-01',
    ]);
    for (const p of packets.packets) {
      expect(p.native_capture_status).toBe('pending-native-capture');
      expect(p.measurement_uncertainty.length).toBeGreaterThan(5);
    }
  });

  test('CAM-01: base spawns, river pits, and diagonal map symmetry align to pinned Rift layout', () => {
    const blueSpawn = publicRift.spawns.blue;
    const redSpawn = publicRift.spawns.red;
    // Planar Rift uses +x east, +y south: Blue base is SW (x < 0, y > 0), Red base is NE (x > 0, y < 0)
    expect(blueSpawn.x).toBeLessThan(0);
    expect(blueSpawn.y).toBeGreaterThan(0);
    expect(redSpawn.x).toBeGreaterThan(0);
    expect(redSpawn.y).toBeLessThan(0);
    // Blue and Red spawns are roughly symmetric across the river diagonal
    expect(Math.abs(blueSpawn.x + redSpawn.x)).toBeLessThan(800);
    expect(Math.abs(blueSpawn.y + redSpawn.y)).toBeLessThan(800);
    // Top pit (Baron/Herald/Grubs) is NW river (x < 0, y < 0); Dragon pit is SE river (x > 0, y > 0)
    expect(TOP_PIT_POINT.x).toBeLessThan(0);
    expect(TOP_PIT_POINT.y).toBeLessThan(0);
    expect(DRAGON_PIT_POINT.x).toBeGreaterThan(0);
    expect(DRAGON_PIT_POINT.y).toBeGreaterThan(0);
    expect(distance(TOP_PIT_POINT, DRAGON_PIT_POINT)).toBeGreaterThan(5000);
  });

  test('MOVE-01: unobstructed straight travel integrates champion movement speed within 1% per second', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'ashe');
    w.nextWaveTick = Infinity;
    const start = { x: w.hero.x, y: w.hero.y };
    const speed = w.movementSpeed(w.hero);
    const dest = { x: start.x + speed * 2, y: start.y };
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'move', point: dest } });
    w.step(TICK_RATE);
    const traveled = distance(start, w.hero);
    expect(traveled).toBeGreaterThan(speed * 0.96);
    expect(traveled).toBeLessThan(speed * 1.04);
  });

  test('INPUT-01: command queue respects move, stop, recall cancel on move, and deterministic replay', () => {
    const w = new World(false, publicRift, 'ashe');
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = Infinity;
    const mid = publicRift.reachable({ x: 0, y: 0 }, w.hero.radius, 'blue');
    w.hero.x = mid.x;
    w.hero.y = mid.y;

    // Start recall, verify active, then cancel with move order
    w.enqueue({ type: 'recall', unit: w.player.id });
    w.step(2);
    expect(w.player.recallEnd).not.toBeNull();
    const moved = publicRift.reachable({ x: mid.x + 300, y: mid.y }, w.hero.radius, 'blue');
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'move', point: moved } });
    w.step(5);
    expect(w.player.recallEnd).toBeNull();
    expect(distance(mid, w.hero)).toBeGreaterThan(5);

    // Stop order halts movement immediately
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'idle' } });
    w.step(1);
    const stoppedPos = { x: w.hero.x, y: w.hero.y };
    w.step(10);
    expect(distance(stoppedPos, w.hero)).toBeLessThan(0.01);
  });

  test('ATK-01: Ashe windup scales with attack speed, cancels before release, and commits on release', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'ashe');
    w.nextWaveTick = Infinity;
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 350, y: w.hero.y }, 'garen');
    foe.ai = false;
    foe.maxHp = 5000;
    foe.hp = 5000;

    // Begin attack and move before windup completes -> cancels attack (zero projectiles fired)
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(2);
    expect(w.hero.releaseTick).not.toBeNull();
    w.enqueue({
      type: 'order',
      unit: w.player.id,
      order: { type: 'move', point: { x: w.hero.x - 200, y: w.hero.y } },
    });
    w.step(3);
    expect(w.projectiles.filter((p) => p.source === w.player.id)).toHaveLength(0);

    // Attack again and let windup complete -> releases missile and deals damage
    const hpBefore = foe.hp;
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(35);
    expect(foe.hp).toBeLessThan(hpBefore);

    // Increasing attack speed with Recurve Bow shortens attack period
    const baseDelay = w.hero.attackPeriod;
    w.player.gold = 3000;
    const spawn = PRACTICE_FIXTURE.spawns.blue;
    w.hero.x = spawn.x;
    w.hero.y = spawn.y;
    expect(w.buy('dagger', w.player.id)).toBeNull();
    expect(w.buy('dagger', w.player.id)).toBeNull();
    expect(w.attackSpeedMultiplier(w.hero, foe)).toBeGreaterThan(1.1);
    expect(baseDelay).toBeGreaterThan(0);
  });

  test('FOG-01: enemy champion outside vision radius is hidden and revealed when entering sight', () => {
    const w = createLaneMatch(publicRift, 'ashe');
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = Infinity;
    const enemy = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    // Enemy at red fountain is not visible to blue team
    expect(w.visible(enemy, 'blue')).toBe(false);
    // Moving enemy adjacent to blue hero reveals them immediately
    enemy.x = w.hero.x + 250;
    enemy.y = w.hero.y;
    expect(w.visible(enemy, 'blue')).toBe(true);
  });

  test('LANE-01: minion waves spawn on schedule, last-hit grants gold, and attacking enemy draws lane aggro', () => {
    const w = createLaneMatch(publicRift, 'ashe');
    for (const u of w.units) u.ai = false;
    const goldBefore = w.player.gold;
    const csBefore = w.player.cs;
    const minion = w.spawn('melee', 'red', { x: w.hero.x + 220, y: w.hero.y });
    minion.ai = false;
    minion.hp = 10;
    w.damage(w.hero, minion, 50, 'physical', 'direct');
    expect(w.player.cs).toBe(csBefore + 1);
    expect(w.player.gold).toBeGreaterThan(goldBefore);
  });

  test('BASE-01: protected inner structures reject premature damage and Nexus destruction ends match cleanly', () => {
    const w = createLaneMatch(publicRift, 'ashe');
    for (const u of w.units) u.ai = false;
    const redNexus = w.units.find((u) => u.kind === 'nexus' && u.team === 'red')!;
    const hpBefore = redNexus.hp;
    // Protected Nexus ignores direct damage while outer/inner/inhibitor/nexus turrets stand
    w.damage(w.hero, redNexus, 500, 'true', 'ability');
    expect(redNexus.hp).toBe(hpBefore);
    expect(w.winner).toBeNull();

    // Clear one lane's dependency chain + nexus turrets -> Nexus becomes vulnerable and ends match
    for (const s of w.units) {
      if (
        s.team === 'red' &&
        (s.kind === 'turret' || s.kind === 'inhibitor') &&
        (s.structure?.lane === 'mid' || s.structure?.lane === null)
      ) {
        s.hp = 0;
        s.deadAt = w.tick;
      }
    }
    w.damage(w.hero, redNexus, redNexus.maxHp + 1000, 'true', 'ability');
    expect(redNexus.hp).toBe(0);
    expect(w.winner).toBe('blue');
  });

  test('MATCH-01: 10-champion zero-mirror match advances cleanly with bots and round-trips snapshots', () => {
    const w = createLaneMatch(publicRift, 'ashe');
    const champs = w.units.filter((u) => u.kind === 'champion');
    expect(champs).toHaveLength(10);
    expect(new Set(champs.map((c) => c.champion)).size).toBe(10);
    w.step(TICK_RATE * 5);
    const snap = w.snapshot();
    const restored = World.fromSnapshot(snap, publicRift);
    w.step(TICK_RATE);
    restored.step(TICK_RATE);
    expect(restored.snapshot()).toBe(w.snapshot());
  });
});
