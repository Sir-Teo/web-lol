import { expect, test } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Quaternion, Vector3 } from 'three';
import {
  zenithParticles,
  ZENITH_PROFILES,
  type ZenithRole,
} from '../src/render/leona-zenith-particles';
import {
  zenithBirthFrame,
  zenithDrawGroups,
  zenithPathDistance,
  zenithPoseAt,
} from '../src/render/leona-zenith-history';
import {
  zenithTrailPoints,
  zenithTrailRibbon,
  type ZenithTrailPoint,
} from '../src/render/leona-zenith-trails';
import data from '../src/content/leona-e-particles.json';
import ribbonSamples from '../docs/reference/leona-e-ribbon-samples.json';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { rulesetFiles } from '../tools/ruleset-fingerprint';

const roles: ZenithRole[] = ['weapon', 'dash', 'arrival', 'contact', 'sound'];
const profile = (p: ReturnType<typeof zenithParticles>[number]) => ZENITH_PROFILES[p.profileIndex];
const named = (name: string, time: number, seed = 17, stop = Infinity) => {
  const role = data.profiles.find((p) => p.name === name)!.role as ZenithRole;
  return zenithParticles(role, seed, time, stop).filter((p) => profile(p).name === name);
};
function fixture(age = 41) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
  const source = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
  target.hp = target.maxHp = 100000;
  for (const u of w.units) u.ai = false;
  w.learnSpell('e', source.id);
  w.enqueue({ type: 'cast', unit: source.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step(age + 1);
  const record = () => w.championState(source.id)!.leonaEVisuals[0];
  return { w, source, target, record, groups: () => zenithDrawGroups(source.id, record()) };
}

test('all 33 source declarations rebuild; every enabled field is routed and disabled records remain exact', () => {
  execFileSync('python3', ['tools/assets/export-leona-e-particles.py', '--check']);
  const source = JSON.parse(readFileSync('docs/reference/leona-e-particles.json', 'utf8')),
    audit = JSON.parse(readFileSync('docs/reference/leona-e-particle-profiles.json', 'utf8'));
  expect(data.profiles).toHaveLength(20);
  expect(data.disabled).toHaveLength(13);
  for (const p of data.profiles) {
    const raw = source.resources[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.sourceFields).toEqual(Object.keys(raw).sort());
    expect(p.sourceFields.every((k) => Object.hasOwn(audit.fieldRoutes, k))).toBe(true);
  }
  for (const p of data.disabled)
    expect(p.definition).toEqual(
      source.resources[p.system].definition.complexEmitterDefinitionData[p.index]
    );
  expect(data.pathResolutions[0]).toMatchObject({
    raw: '{97d68dc062eb5dfa}',
    resolvedAsset: 'assets/effects/leona_base_z_empty32.png',
  });
  expect(
    data.systems.find((s) => s.role === 'dash')!.declaration.materialOverrideDefinitions![0]
      .baseTexture
  ).toBe('{97d68dc062eb5dfa}');
});
test('ordinary compiler verification runs with shipped inputs and no private reader cache', () => {
  const root = mkdtempSync(join(tmpdir(), 'zenith-export-')),
    decoded = JSON.parse(readFileSync('docs/reference/leona-e-particles-decoded.json', 'utf8')),
    inputs = [
      'docs/reference/leona-e-particles.json',
      'docs/reference/leona-e-particles-decoded.json',
      'docs/reference/leona-w-emission-reader.json',
      'docs/reference/leona-e-kernel-readers.json',
      'docs/reference/leona-e-particle-profiles.json',
      'src/content/leona-e-particles.json',
      ...decoded.textures.map((t: any) => t.path),
      ...decoded.meshes.map((m: any) => 'public' + m.output.path),
    ];
  try {
    for (const file of new Set<string>(inputs)) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(file, target);
    }
    expect(existsSync(join(root, '.cache'))).toBe(false);
    execFileSync('python3', [resolve('tools/assets/export-leona-e-particles.py'), '--check'], {
      cwd: root,
    });
    expect(existsSync(join(root, '.cache'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('all twenty enabled families emit finite seekable samples without substituted disabled families', () => {
  const seen = new Set<number>();
  for (const role of roles)
    for (const time of [1 / 60, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.4])
      for (const p of zenithParticles(role, 17, time)) {
        seen.add(p.profileIndex);
        expect(
          [...p.offset, ...p.size, ...p.color, ...p.rotation, ...p.travel, ...p.uv.offset].every(
            Number.isFinite
          )
        ).toBe(true);
        expect(p.life).toBeGreaterThan(0);
        expect(p.phase).toBeGreaterThanOrEqual(0);
        expect(p.phase).toBeLessThanOrEqual(1);
      }
  expect([...seen].sort((a, b) => a - b)).toEqual(data.profiles.map((_p, i) => i));
});
test('source singles retain two hot cores, twenty delayed sparkles, one arrival and exact delayed weapon clocks', () => {
  expect(named('FlashCoreHot', 1 / 60)).toHaveLength(2);
  expect(named('Sparkles', 5 / 60)).toEqual([]);
  expect(named('Sparkles', 6 / 60)).toHaveLength(20);
  expect(named('Avatar_Burst', 1 / 60)).toHaveLength(1);
  for (const name of ['Bullets', 'Bullets1', 'groundswordGlow']) {
    expect(named(name, 2 / 60)).toEqual([]);
    expect(named(name, 3 / 60)).toHaveLength(1);
    expect(named(name, 5.05)).toEqual([]); // Period does not reactivate a finite single.
  }
});
test('authored early stops cap absolute lifetime and cannot create continuous births after the stop', () => {
  expect(named('sword2', 0.3)).toHaveLength(1);
  expect(named('sword2', 0.3, 17, 0.2)).toEqual([]);
  const live = zenithParticles('weapon', 17, 0.1, 0.1);
  expect(live.every((p) => p.bornTick < 6)).toBe(true);
  for (const role of roles) {
    expect(zenithParticles(role, 17, 0.1, 0)).toEqual([]);
    expect(zenithParticles(role, 17, 20, 0.45)).toEqual([]);
  }
});
test('E erosion mixer, address, palette, material override and orientation flags remain separate source bindings', () => {
  const glow = data.profiles.find((p) => p.name === 'up_glow')!,
    trail = data.profiles.find((p) => p.name === 'Kayn_Primay_Broken')!,
    dash = data.profiles.find((p) => p.name === 'Lightburst-horiz1')!;
  expect(glow.erosion).toMatchObject({ address: 0, mixer: { constant: [1, 0, 0, 0] } });
  expect(glow.uv.divisions).toEqual([0.5, 1]); // Retained even though the local reader rounds the grid.
  expect(trail.palette).toMatchObject({
    texture: 'assets/effects/leona_base_flame_trail_gradient.png',
    count: 16,
  });
  expect(dash.local).toBe(false);
  expect(dash.particleLocal).toBe(true);
  expect(named('Kayn_Primay_Broken', 0.1)[0].palette?.selector).toEqual([9, 0, 0]);
});
test('box and naive sphere spawns retain source extents and independent cosmetic choices', () => {
  const positions = new Set<string>();
  for (let seed = 1; seed <= 48; seed++) {
    const b = named('Bokeh', 1 / 60, seed)[0],
      s = named('Sparks', 1 / 60, seed)[0],
      origin = profile(b).position.values[0];
    expect(Math.hypot(...b.offset.map((v, i) => v - origin[i]))).toBeLessThanOrEqual(20 + 1e-8);
    const so = profile(s).position.values[0];
    expect(s.offset.every((v, i) => Math.abs(v - so[i]) <= 50)).toBe(true);
    positions.add(b.offset.join(','));
  }
  expect(positions.size).toBe(48);
});
test('birth acceleration changes Sparklies velocity while fixed birth choices survive later seeks', () => {
  const a = named('Sparklies', 1 / 60)[0],
    b = named('Sparklies', 2 / 60)[0];
  expect(a.ordinal).toBe(b.ordinal);
  expect(b.travel[1]).toBeLessThan(a.travel[1]);
  // Source Y acceleration ranges from -25 to -100; drag is applied after it.
  expect(b.travel[1]).toBeGreaterThanOrEqual((a.travel[1] - 100 / 60) * (1 - 1 / 60) - 1e-8);
  expect(b.travel[1]).toBeLessThanOrEqual((a.travel[1] - 25 / 60) * (1 - 1 / 60) + 1e-8);
  expect(b.spawnTurn).toEqual(a.spawnTurn);
});
test('random atlas and lookup coordinates keep the birth draw while age advances', () => {
  const cells = new Set<string>();
  for (let seed = 1; seed <= 48; seed++) {
    const p = named('Bokeh', 1 / 60, seed)[0];
    expect(p.uv.cellSize).toEqual([0.5, 0.5]);
    cells.add(p.uv.cell.join(','));
  }
  expect(cells.size).toBe(4);
  const a = named('Sparkles', 0.1)[0],
    b = named('Sparkles', 0.2)[0];
  expect(a.lookup[1]).toBe(b.lookup[1]);
  expect(a.lookup[0]).not.toBe(b.lookup[0]);
});
test('world acceleration contributes to source direction as well as displacement', () => {
  const p = named('Sparkles', 0.1)[0],
    direction = new Vector3(300, 1, 0).applyQuaternion(new Quaternion().fromArray(p.spawnTurn));
  direction.y += 200 * p.naturalLife;
  p.travel.forEach((v, i) => expect(v).toBeCloseTo(direction.toArray()[i], 10));
});
test('source trail modes, cutoff and birth tiling remain independent', () => {
  const trails = data.profiles.filter((p) => p.kind === 'trail');
  expect(
    trails.map((p) => [
      p.trail!.mode,
      p.trail!.smoothing,
      p.trail!.cutoff,
      p.trail!.tiling.constant,
    ])
  ).toEqual([
    [1, 1, 1200, [805, 0, 0]],
    [1, 1, 3000, [1100, 0, 0]],
  ]);
});
test('random seeks are stateless and arbitrarily late seeks remain bounded', () => {
  const before = zenithParticles('weapon', 17, 0.2);
  for (const role of roles) expect(zenithParticles(role, 17, 1e9, 0.45)).toEqual([]);
  zenithParticles('contact', 92, 0.7);
  expect(zenithParticles('weapon', 17, 0.2)).toEqual(before);
});
test.each([NaN, Infinity, -1])('invalid time %s produces no samples', (time) => {
  for (const role of roles) expect(zenithParticles(role, 17, time)).toEqual([]);
});
test('invalid stop and radius produce no samples', () => {
  expect(zenithParticles('weapon', 17, 0.2, NaN)).toEqual([]);
  expect(zenithParticles('weapon', 17, 0.2, -1)).toEqual([]);
  expect(zenithParticles('weapon', 17, 0.2, Infinity, 0)).toEqual([]);
});

test.each([
  ['windup', 7, []],
  ['flight', 20, ['weapon']],
  ['dash', 43, ['weapon', 'contact', 'sound', 'dash']],
  ['arrival', 75, ['weapon', 'contact', 'sound', 'dash', 'arrival']],
] as const)(
  '%s dispatch survives strict restoration and sampler evaluation does not mutate the world',
  (_phase, age, expected) => {
    const f = fixture(age),
      saved = f.w.snapshot(),
      copy = World.fromSnapshot(saved, f.w.battlefield),
      groups = f.groups(),
      restored = zenithDrawGroups(f.source.id, copy.championState(f.source.id)!.leonaEVisuals[0]);
    expect(groups.map((g) => g.role)).toEqual(expected);
    expect(restored).toEqual(groups);
    for (const g of groups) {
      expect(
        zenithParticles(
          g.role,
          g.seed,
          (f.w.tick - g.startTick) / 60,
          (g.stopTick - g.startTick) / 60,
          g.radius
        )
      ).toEqual(
        zenithParticles(
          g.role,
          g.seed,
          (copy.tick - g.startTick) / 60,
          (g.stopTick - g.startTick) / 60,
          g.radius
        )
      );
      zenithTrailPoints(g, f.w.tick);
    }
    expect(f.w.snapshot()).toBe(saved);
    expect(copy.snapshot()).toBe(saved);
  }
);
test('flight groups retain the actual origin and every moving frame, then freeze at the true endpoint', () => {
  const f = fixture(),
    g = f.groups().find((g) => g.role === 'weapon')!;
  expect(g.frames[0]).toMatchObject({ x: 0, tick: g.startTick - 1 });
  expect(g.frames[1].x).toBeCloseTo(2000 / 60);
  expect(zenithPoseAt(g.frames, g.startTick - 0.5)!.x).toBeCloseTo(2000 / 120);
  expect(zenithPathDistance(g, g.startTick)).toBeCloseTo(2000 / 60);
  expect(zenithPathDistance(g, 1e6)).toBeCloseTo(900);
  expect(zenithPoseAt(g.frames, 1e6)!.x).toBeCloseTo(900);
});
test('birth visibility is historical; finite event creation and moving flight have distinct audience gates', () => {
  const f = fixture(),
    g = structuredClone(f.groups().find((g) => g.role === 'weapon')!);
  g.frames[2].audience = ['red'];
  expect(zenithBirthFrame(g, 1, false)).toBeNull();
  expect(zenithBirthFrame(g, 2, false)).not.toBeNull();
  const contact = structuredClone(f.groups().find((g) => g.role === 'contact')!);
  contact.audience = ['red'];
  expect(zenithBirthFrame(contact, 1, false)).toBeNull();
  const last = g.frames.at(-1)!.tick;
  expect(zenithBirthFrame(g, last - g.startTick + 1, true)).toBeNull();
  const future = contact.frames.at(-1)!.tick - contact.startTick + 1;
  contact.audience = ['blue'];
  expect(zenithBirthFrame(contact, future, true)).not.toBeNull();
  expect(zenithBirthFrame(contact, future, false)).toBeNull();
});
test('posed interpolation takes the shortest facing turn and keeps detached animation clocks', () => {
  const f = fixture(75),
    frames = structuredClone(
      f
        .groups()
        .find((g) => g.role === 'arrival')!
        .frames.slice(0, 2)
    );
  frames[0].facing = 3.1;
  frames[1].facing = -3.1;
  expect(zenithPoseAt(frames, frames[0].tick + 0.5)!.facing).toBeCloseTo(Math.PI);
  expect(zenithPoseAt([], 10)).toBeNull();
  expect(zenithPoseAt(frames, NaN)).toBeNull();
});
test('a 1200-update pursuit keeps event clocks while expired particles need no discarded body frames', () => {
  const f = fixture();
  for (let i = 0; i < 1200; i++) {
    f.target.x = i % 2 ? -900 : 900;
    f.w.step();
  }
  const dash = f.groups().find((g) => g.role === 'dash')!;
  expect(dash.startTick).toBe(42);
  expect(dash.frames).toHaveLength(771);
  expect(zenithParticles(dash.role, dash.seed, (f.w.tick - dash.startTick) / 60)).toEqual([]);
});
test('real flight trails retain WAKE distance, both source widths and deterministic geometry after restore', () => {
  const f = fixture(24),
    g = f.groups().find((g) => g.role === 'weapon')!,
    saved = f.w.snapshot(),
    points = zenithTrailPoints(g, f.w.tick);
  expect(new Set(points.map((p) => p.profileIndex)).size).toBe(2);
  for (const index of new Set(points.map((p) => p.profileIndex))) {
    const family = points.filter((p) => p.profileIndex === index),
      profile = data.profiles[index];
    expect(family.length).toBeGreaterThan(2);
    expect(family.every((p) => p.visible)).toBe(true);
    for (const p of family)
      expect(p.wakeU).toBeCloseTo(
        zenithPathDistance(g, p.bornTick) / profile.trail!.tiling.constant[0]
      );
    const vertices = zenithTrailRibbon(family, profile.trail!.cutoff);
    expect(vertices.length).toBeGreaterThan(0);
    expect(
      vertices.flatMap((v) => [...v.position, ...v.uv, ...v.color]).every(Number.isFinite)
    ).toBe(true);
    const copy = World.fromSnapshot(saved, f.w.battlefield),
      cg = zenithDrawGroups(f.source.id, copy.championState(f.source.id)!.leonaEVisuals[0]).find(
        (g) => g.role === 'weapon'
      )!;
    expect(
      zenithTrailRibbon(
        zenithTrailPoints(cg, copy.tick).filter((p) => p.profileIndex === index),
        profile.trail!.cutoff
      )
    ).toEqual(vertices);
  }
  expect(f.w.snapshot()).toBe(saved);
});

const point = (x: number, z = 0, visible = true): ZenithTrailPoint => ({
  profileIndex: 11,
  ordinal: 10 - x,
  bornTick: 10 - x,
  position: [x, 0, z],
  halfWidth: 2,
  wakeU: x / 805,
  uvOffset: [0, 0],
  uvScale: [1, 1],
  side: [0, 0, 1],
  lookup: [1, 0],
  erosion: 0,
  color: [1, 1, 1, 1],
  visible,
});
test('hidden trail points split runs before smoothing and never become visible bridge triangles', () => {
  const points = [point(0), point(1), point(2, 100, false), point(3), point(4)],
    vertices = zenithTrailRibbon(points, 1000);
  expect(vertices).toHaveLength(12);
  expect(vertices.every((v) => v.position[2] >= -2 && v.position[2] <= 2)).toBe(true);
  expect(zenithTrailRibbon(points, 1000, (p) => p.position[0] !== 1)).toHaveLength(6);
});
test('mode-one filtering bisects particle sides and preserves source width and endpoints', () => {
  const v = zenithTrailRibbon([point(0), point(10, 20), point(20)], 1000);
  expect(v).toHaveLength(12);
  expect((v[0].position[2] + v[5].position[2]) / 2).toBeCloseTo(20 / 3);
  expect((v[1].position[0] + v[2].position[0]) / 2).toBe(0);
  expect(v.flatMap((v) => v.position).every(Number.isFinite)).toBe(true);
  expect(Math.hypot(v[0].position[0] - 10, v[0].position[2] - 20 / 3)).toBeCloseTo(2);
});
test('cutoff excludes its boundary and duplicate fixed-grid births cannot make undefined joints', () => {
  const p = [point(0), point(10), point(20)];
  expect(zenithTrailRibbon(p, 20)).toHaveLength(6);
  expect(zenithTrailRibbon(p, 20.1)).toHaveLength(12);
  expect(zenithTrailRibbon([point(0), point(0), point(10)], 100)).toHaveLength(12);
  expect(zenithTrailRibbon(p, NaN)).toEqual([]);
  expect(() => zenithTrailRibbon([point(0), { ...point(1), profileIndex: 14 }], 100)).toThrow();
});
test('saved interpretation fingerprints cover the E table, kernels and shared curve/motion dependencies', () => {
  for (const file of [
    'src/render/leona-zenith-particles.ts',
    'src/render/leona-zenith-history.ts',
    'src/render/leona-zenith-trails.ts',
    'src/content/leona-e-particles.json',
    'src/render/leona-eclipse-values.ts',
    'src/render/particle-motion.ts',
    'src/render/particle-color-lookup.ts',
  ])
    expect(rulesetFiles).toContain(file);
});
test.each(ribbonSamples.samples)(
  'ribbon construction matches independent pinned helper arrays: $name',
  ({ points, cutoff, expected }) => {
    const actual = zenithTrailRibbon(points as ZenithTrailPoint[], cutoff);
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < actual.length; i++) {
      for (const field of ['position', 'uv', 'color', 'lookup'] as const)
        actual[i][field].forEach((v, a) =>
          expect(Math.abs(v - expected[i][field][a])).toBeLessThan(1e-5)
        );
      expect(Math.abs(actual[i].erosion - expected[i].erosion)).toBeLessThan(1e-5);
    }
  }
);
