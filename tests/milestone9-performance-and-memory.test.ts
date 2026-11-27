import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createRift } from '../src/content/rift';
import { MapTextureResidency } from '../src/render/map-texture-residency';
import { createLaneMatch } from '../src/simulation/lane-match';
import { fromRiot, NavGrid, type NavGridMetadata } from '../src/simulation/navgrid';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { World } from '../src/simulation/world';

const MILESTONE8_FINAL_RULESET =
  'bf0a46cff65fb8997c4f7ad5846dffd9c308118612f39111125d1929a30ca869';
const MILESTONE8_INITIAL_RULESET =
  '3e7c02a0e1111c87e1000524899247258d8f916efb0b00944a4eb4754c23df2a';

function loadRiftNav() {
  const meta = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')) as NavGridMetadata;
  const raw = readFileSync('public/assets/maps/rift-nav.bin');
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return { meta, grid: new NavGrid(meta, buf) };
}

function loadPublicRift() {
  const { grid } = loadRiftNav();
  return {
    ...createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
    publicRift: true as const,
  };
}

/** Reference O(W*H) linear scan mirroring pre-Milestone-9 NavGrid.reachable(). */
function bruteForceReachable(
  grid: NavGrid,
  passable: Uint8Array,
  point: { x: number; y: number },
  radius: number,
  team: 'blue' | 'red' = 'blue'
): { x: number; y: number } {
  if (grid.walkable(point, radius, team)) return { x: point.x, y: point.y };
  let best = -1,
    score = Infinity;
  for (let i = 0; i < passable.length; i++) {
    if (!passable[i]) continue;
    const p = grid.center(i);
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d < score) {
      score = d;
      best = i;
    }
  }
  return grid.center(best);
}

describe('Milestone 9 — Runtime Performance, Memory Budget, and Scale Hardening', () => {
  test('NavGrid.reachable expanding-ring search is bit-exact against brute-force across walls, corners, gates, and radii', () => {
    const { meta, grid } = loadRiftNav();
    const total = meta.width * meta.height;
    const probes = [
      // Out-of-bounds corners & map borders
      { x: -12000, y: -12000 },
      { x: 12000, y: 12000 },
      { x: -12000, y: 12000 },
      { x: 12000, y: -12000 },
      // Dense jungle walls, Baron pit, Dragon pit, base walls, and river terrain
      { x: -3200, y: 2400 },
      { x: 3200, y: -2400 },
      { x: -2400, y: 3100 },
      { x: 2400, y: -3100 },
      { x: -4800, y: -4800 },
      { x: 4800, y: 4800 },
      { x: -5500, y: -1200 },
      { x: 5500, y: 1200 },
      { x: 0, y: 0 },
      { x: -1400, y: 1400 },
      { x: 1400, y: -1400 },
      { x: -6200, y: -5800 },
      { x: 6200, y: 5800 },
    ];
    let rng = 0x9e3779b9;
    const next = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 0xffffffff;
    };
    const min = fromRiot(meta.minimum[0], meta.minimum[2] + meta.height * meta.cellSize);
    const max = fromRiot(meta.minimum[0] + meta.width * meta.cellSize, meta.minimum[2]);
    for (let i = 0; i < 40; i++) {
      probes.push({
        x: min.x + next() * (max.x - min.x),
        y: min.y + next() * (max.y - min.y),
      });
    }

    for (const radius of [0, 35, 65, 110]) {
      for (const team of ['blue', 'red'] as const) {
        const passable = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          passable[i] = grid.walkable(grid.center(i), radius, team) ? 1 : 0;
        }
        for (const p of probes) {
          const fast = grid.reachable(p, radius, team);
          const exact = bruteForceReachable(grid, passable, p, radius, team);
          expect(fast).toEqual(exact);
        }
      }
    }
  });

  test('Schema 188 upgrades Milestone 7/8 checkpoints and rejects tampered rulesets', () => {
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(188);
    expect(SNAPSHOT_RULESET).toMatch(/^[0-9a-f]{64}$/);
    const battlefield = loadPublicRift();
    const publicMatch = createLaneMatch(battlefield).snapshot();
    const originalMatch = createLaneMatch(battlefield, 'vess').snapshot();
    for (const [expected, version, ruleset] of [
      [publicMatch, 187, MILESTONE8_FINAL_RULESET],
      [originalMatch, 187, MILESTONE8_FINAL_RULESET],
      [publicMatch, 187, MILESTONE8_INITIAL_RULESET],
      [originalMatch, 187, MILESTONE8_INITIAL_RULESET],
    ] as const) {
      const legacy = { ...JSON.parse(expected), version, ruleset };
      expect(World.fromSnapshot(JSON.stringify(legacy), battlefield).snapshot()).toBe(expected);
      legacy.ruleset = 'f'.repeat(64);
      expect(() => World.fromSnapshot(JSON.stringify(legacy), battlefield)).toThrow(
        /game version/
      );
    }
  });

  test('MapTextureResidency tracks isResident and honors prefetch prepare gating', () => {
    const residency = new MapTextureResidency(2048);
    const uploaded: THREE.Texture[] = [];
    const upload = (texture: THREE.Texture) => {
      uploaded.push(texture);
    };
    const t1 = new THREE.Texture();
    const t2 = new THREE.Texture();
    const t3 = new THREE.Texture();

    expect(residency.isResident(t1)).toBe(false);

    // Prepare returning false must not upload or mark resident
    expect(residency.prefetch(new Map([[t1, 1024]]), upload, () => 0, 2, 10, () => false)).toBe(0);
    expect(uploaded).toHaveLength(0);
    expect(residency.isResident(t1)).toBe(false);
    expect(residency.residentCount).toBe(0);

    // Prepare returning true uploads and marks resident
    expect(residency.prefetch(new Map([[t1, 1024]]), upload, () => 0, 2, 10, () => true)).toBe(1);
    expect(uploaded).toEqual([t1]);
    expect(residency.isResident(t1)).toBe(true);
    expect(residency.residentCount).toBe(1);

    // Second prefetch of already-resident texture is a no-op
    expect(residency.prefetch(new Map([[t1, 1024]]), upload, () => 0, 2, 10, () => true)).toBe(0);
    expect(uploaded).toHaveLength(1);

    // Evicting t1 via budget pressure clears isResident(t1)
    residency.beginFrame();
    residency.touch(t2, 1024);
    residency.touch(t3, 1024);
    residency.endFrame();
    expect(residency.isResident(t1)).toBe(false);
    expect(residency.isResident(t2)).toBe(true);
    expect(residency.isResident(t3)).toBe(true);
    expect(residency.evictions).toBe(1);
  });

  test('Step-scoped unitLookup clears cleanly and preserves bit-exact determinism with external mutations', () => {
    const battlefield = loadPublicRift();
    const a = createLaneMatch(battlefield);
    const b = createLaneMatch(battlefield);
    a.step(300);
    b.step(300);
    expect(a.snapshot()).toBe(b.snapshot());

    // External test mutation outside step() must remain visible to unit/nearest/championState
    const extra = a.spawn('melee', 'red', { x: a.hero.x + 120, y: a.hero.y });
    expect(a.unit(extra.id)).toBe(extra);
    a.units = a.units.filter((u) => u.id !== extra.id);
    expect(a.unit(extra.id)).toBeUndefined();
  });

  test('Leona Zenith Blade dash cleanly cancels an in-progress ordinary attack on the same target', () => {
    const battlefield = loadPublicRift();
    const world = createLaneMatch(battlefield);
    const leona = world.units.find((u) => u.champion === 'leona' && u.team === 'blue')!;
    const target = world.units.find((u) => u.champion === 'lux' && u.team === 'red')!;
    const state = world.championState(leona.id)!;
    state.spellRanks = { q: 0, w: 0, e: 1, r: 0 };
    state.skillPoints = 0;
    state.cooldowns.e = 0;
    leona.mana = leona.maxMana;
    leona.x = 0;
    leona.y = 0;
    target.x = 120;
    target.y = 0;
    world.enqueue({ type: 'cast', unit: leona.id, ability: 'e', point: { x: target.x, y: target.y } });

    // Step until Zenith Blade projectile has hit target and is within a few ticks of max range
    let blade = world.projectiles.find((p) => p.type === 'zenith' && p.source === leona.id);
    for (let i = 0; i < 60; i++) {
      world.step(1);
      blade = world.projectiles.find((p) => p.type === 'zenith' && p.source === leona.id);
      if (blade && blade.zenith?.lastChampionId === target.id && blade.remaining <= 200) break;
    }
    expect(blade?.zenith?.lastChampionId).toBe(target.id);

    // Start an ordinary AA on the same target right before Zenith Blade reaches max range
    leona.x = target.x - 100;
    leona.y = target.y;
    leona.nextAttackTick = world.tick;
    world.enqueue({ type: 'order', unit: leona.id, order: { type: 'attack', target: target.id } });
    world.step(1);
    expect(state.leonaAAVisuals.length).toBeGreaterThan(0);
    const attackBeforeDash = state.leonaAAVisuals.at(-1)!;
    expect(attackBeforeDash.targetId).toBe(target.id);
    expect(attackBeforeDash.impact).toBeNull();
    expect(attackBeforeDash.cancelTick).toBeNull();

    // Advance until Zenith Blade finishes travel and begins Leona's dash mid-windup
    for (let i = 0; i < 20 && !state.leonaDash; i++) {
      world.step(1);
    }
    expect(state.leonaDash).not.toBeNull();
    expect(attackBeforeDash.impact).toBeNull();
    expect(attackBeforeDash.cancelTick).not.toBeNull();
    expect(attackBeforeDash.stopTick).toBe(attackBeforeDash.cancelTick);
    expect(attackBeforeDash.endReason).toBe('action');

    // Snapshot round-trip must pass validateLeonaAttacks
    const raw = world.snapshot();
    expect(() => World.fromSnapshot(raw, battlefield)).not.toThrow();
  });
});
