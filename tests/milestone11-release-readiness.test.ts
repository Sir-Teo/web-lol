import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  MOBILE_CLIP_DURATIONS,
  mobileClipDurations,
  mobileRig,
} from '../src/content/mobile-clip-durations';
import { MONSTERS } from '../src/content/monsters';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid, type NavGridMetadata } from '../src/simulation/navgrid';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { World } from '../src/simulation/world';

const MILESTONE10_RULESET =
  'c1e9395085d05e5450340fac5433787d3bac9b05b8d675e6b43efa8a8b334341';
const MILESTONE9_RULESET =
  '878d8aaf2b241c5b515b21c68ee3efb33e35ceeae4b5e442240e2deb1c6e76a2';
const MILESTONE8_FINAL_RULESET =
  'bf0a46cff65fb8997c4f7ad5846dffd9c308118612f39111125d1929a30ca869';

function loadPublicRift() {
  const meta = JSON.parse(
    readFileSync('public/assets/maps/rift-nav.json', 'utf8')
  ) as NavGridMetadata;
  const raw = readFileSync('public/assets/maps/rift-nav.bin');
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const grid = new NavGrid(meta, buf);
  return {
    ...createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
    publicRift: true as const,
  };
}

describe('Milestone 11 — Full-Scale Certification, Engine Optimization & Cross-Browser Release Readiness', () => {
  test('Schema 190 upgrades Milestone 8, 9, and 10 checkpoints and rejects tampered rulesets', () => {
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(190);
    expect(SNAPSHOT_RULESET).toMatch(/^[0-9a-f]{64}$/);
    const battlefield = loadPublicRift();
    const publicMatch = createLaneMatch(battlefield).snapshot();
    const originalMatch = createLaneMatch(battlefield, 'vess').snapshot();

    for (const [expected, version, ruleset] of [
      [publicMatch, 189, MILESTONE10_RULESET],
      [originalMatch, 189, MILESTONE10_RULESET],
      [publicMatch, 188, MILESTONE9_RULESET],
      [originalMatch, 188, MILESTONE9_RULESET],
      [publicMatch, 187, MILESTONE8_FINAL_RULESET],
      [originalMatch, 187, MILESTONE8_FINAL_RULESET],
    ] as const) {
      const legacy = { ...JSON.parse(expected), version, ruleset };
      expect(World.fromSnapshot(JSON.stringify(legacy), battlefield).snapshot()).toBe(expected);
      legacy.ruleset = 'a'.repeat(64);
      expect(() => World.fromSnapshot(JSON.stringify(legacy), battlefield)).toThrow(
        /game version/
      );
    }
  });

  test('Batched world.step(N) and single-tick world.step(1) are bit-exact with spatial indexing', () => {
    const battlefield = loadPublicRift();
    const batched = createLaneMatch(battlefield);
    const single = createLaneMatch(battlefield);

    // Step across minion wave spawns, lane clashes, jungle spawns, and ward vision
    batched.step(1800);
    for (let i = 0; i < 1800; i++) single.step(1);

    expect(batched.snapshot()).toBe(single.snapshot());
    expect(batched.tick).toBe(1800);
  });

  test('Spatial grid preserves exact dummy vision, nearest targeting, and unit-order independence', () => {
    const battlefield = loadPublicRift();
    const world = createLaneMatch(battlefield);
    const blueDummy = world.spawn('dummy', 'blue', { x: 200, y: 200 });
    const redEnemy = world.spawn('champion', 'red', { x: 500, y: 200 }, 'lux');
    const redMinion = world.spawn('melee', 'red', { x: 350, y: 200 });

    const nearestOf = (
      w: World,
      u: (typeof world.units)[number],
      range: number,
      championsOnly = false
    ) =>
      (
        w as unknown as {
          nearest(
            unit: (typeof world.units)[number],
            r: number,
            champs?: boolean
          ): (typeof world.units)[number] | undefined;
        }
      ).nearest(u, range, championsOnly);

    world.step(1);
    // Dummy must provide vision to its team and never be targeted by nearest()
    expect(world.pointVisible({ x: 500, y: 200 }, 'blue')).toBe(true);
    expect(world.visible(redEnemy, 'blue')).toBe(true);
    expect(nearestOf(world, redEnemy, 400, false)?.id).not.toBe(blueDummy.id);

    // Moving a non-champion outside step() must not see stale spatial cells
    redMinion.x = -5000;
    redMinion.y = -5000;
    world.step(1);
    expect(nearestOf(world, blueDummy, 300, false)?.id).not.toBe(redMinion.id);

    // In-place array reordering between steps must never read stale unitLookup
    world.units.reverse();
    world.step(1);
    expect(world.unit(blueDummy.id)).toBe(blueDummy);
    expect(world.unit(redEnemy.id)).toBe(redEnemy);
  });

  test('Map-backed mobileRig and mobileClipDurations match MOBILE_CLIP_DURATIONS exactly', () => {
    const monsterSpeciesByRig = new Map<string, keyof typeof MONSTERS>();
    for (const [species, spec] of Object.entries(MONSTERS)) {
      if (!monsterSpeciesByRig.has(spec.rig)) {
        monsterSpeciesByRig.set(spec.rig, species as keyof typeof MONSTERS);
      }
    }

    for (const [key, expected] of Object.entries(MOBILE_CLIP_DURATIONS)) {
      if (key.startsWith('blue-') || key.startsWith('red-')) {
        const [team, kind] = key.split('-') as [
          'blue' | 'red',
          'melee' | 'caster' | 'siege' | 'super',
        ];
        expect(mobileRig({ kind, team })).toBe(key);
        expect(mobileClipDurations({ kind, team })).toEqual(expected);
      } else if (monsterSpeciesByRig.has(key)) {
        const species = monsterSpeciesByRig.get(key)!;
        const monster = { species } as NonNullable<Parameters<typeof mobileRig>[0]['monster']>;
        expect(mobileRig({ kind: 'monster', team: 'neutral', monster })).toBe(key);
        expect(mobileClipDurations({ kind: 'monster', team: 'neutral', monster })).toEqual(
          expected
        );
      } else if (key.endsWith('-base')) {
        const champion = key.slice(0, -'-base'.length) as Parameters<
          typeof mobileRig
        >[0]['champion'];
        expect(mobileRig({ kind: 'champion', team: 'blue', champion })).toBe(key);
        expect(mobileClipDurations({ kind: 'champion', team: 'blue', champion })).toEqual(
          expected
        );
      }
    }

    // Non-mobile unit kinds return null / undefined cleanly
    for (const kind of ['turret', 'inhibitor', 'nexus', 'ward', 'dummy'] as const) {
      expect(mobileRig({ kind, team: 'blue' })).toBeNull();
      expect(mobileClipDurations({ kind, team: 'blue' })).toBeUndefined();
    }
  });
});
