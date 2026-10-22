import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import profile from '../src/content/gromp-death.json';
import assets from '../docs/reference/gromp-effect-assets.json';
import { grompDeathParticles } from '../src/render/gromp-death-particles';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';

const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const pin = JSON.parse(readFileSync('docs/reference/gromp-effects.json', 'utf8'));
test('legacy Gromp pins retain original typed fields, verified labels and complete asset dependencies', () => {
  expect(pin.extraction.archive).toBe('DATA/FINAL/DATA.wad.client');
  expect(pin.extraction.referenceVersion).toBe('16.18.8175716');
  expect(Object.keys(pin.records)).toHaveLength(16);
  const dependencies = new Set<string>();
  for (const record of Object.values(pin.records) as any[]) {
    expect(new Set(record.typed.rows.map((r: any) => r.hash)).size).toBe(record.typed.rows.length);
    for (const row of record.typed.rows) {
      const label = record.labels[row.hash];
      if (label) {
        let value = 0;
        for (const char of label.join('*').toLowerCase())
          value = (char.charCodeAt(0) + Math.imul(65599, value)) >>> 0;
        expect(value.toString(16).padStart(8, '0')).toBe(row.hash);
        expect(record.decoded.values[label[0]][label[1]]).toEqual(row.value);
      } else expect(record.decoded.unknown[row.hash]).toEqual(row.value);
      if (typeof row.raw === 'string' && /^data\/.*\.(dds|scb)$/i.test(row.raw))
        dependencies.add(row.raw.toLowerCase());
    }
  }
  expect([...dependencies].sort()).toEqual(
    pin.extraction.files
      .filter((f: any) => !f.path.endsWith('.troybin'))
      .map((f: any) => f.path)
      .sort()
  );
  expect(dependencies.size).toBe(20);
  expect(assets.outputs).toHaveLength(19);
  expect(assets.meshesDeferred.map((f) => f.path)).toEqual(['data/particles/paper01.scb']);
  expect(assets.sourcePinSha256).toBe(hash('docs/reference/gromp-effects.json'));
  expect(profile.sourcePinSha256).toBe(assets.sourcePinSha256);
  for (const output of assets.outputs) {
    expect(hash(`public/${output.path}`)).toBe(output.sha256);
    expect(pin.extraction.files).toContainEqual(output.source);
  }
  const lookup = assets.outputs.find((o) => o.path.endsWith('/color-hold.png'))!;
  expect(lookup.extrema).toEqual(Array.from({ length: 4 }, () => [255, 255]));
});

test('three live Gromp quads retain original event attachment, lifetimes, scale, color and render modes', () => {
  const characters = JSON.parse(
    readFileSync('docs/reference/jungle-character-source.json', 'utf8')
  );
  expect(profile.characterPinSha256).toBe(hash('docs/reference/jungle-character-source.json'));
  const graph = characters.records['data/characters/sru_gromp/animations/skin0.bin']['{bc5b28a0}'];
  expect(profile.event).toEqual(graph.mClipDataMap['{bd28bd4d}'].mEventDataMap['{fd3600a1}']);
  let boneHash = 0x811c9dc5;
  for (const c of profile.bone.toLowerCase())
    boneHash = Math.imul(boneHash ^ c.charCodeAt(0), 16777619) >>> 0;
  expect(profile.event.mParticleEventDataPairList[0].mBoneName).toBe(`{${boneHash.toString(16)}}`);
  const source = pin.records['data/particles/sru_gromp_death_pop.troybin'].decoded.values;
  expect(Array.from({ length: 8 }, (_, i) => source.System[`GroupPart${i + 1}`])).toEqual([
    'flash',
    'lightring',
    'chunks',
    'shadow',
    'flashfrog',
    'pop',
    'skinshards',
    'popshards',
  ]);
  expect(profile.profiles.map((p) => p.name)).toEqual(['flash', 'lightring', 'flashfrog']);
  for (const p of profile.profiles) {
    const e = source[p.sourceSection];
    expect(p.life).toBe(e['p-life']);
    expect(p.blend).toBe(e.rendermode);
    expect(p.priority).toBe(e.pass);
    expect(p.uniform).toBe(!!e.uniformscale);
    expect(p.depthTest).toBe(!e['flag-disable-z']);
    expect(p.size).toEqual(
      Array.isArray(e['p-scale']) ? e['p-scale'] : Array(3).fill(e['p-scale'])
    );
    expect(assets.outputs.find((o) => o.path === p.texture)?.source.path).toBe(
      e['p-texture'].toLowerCase()
    );
    for (const [prefix, keys] of [
      ['p-xscale', p.scaleCurve],
      ['p-xrgba', p.colorCurve],
    ] as const)
      expect(keys.map((k) => k.time)).toEqual(
        Object.entries(e)
          .filter(([key]) => new RegExp(`^${prefix}\\d+$`).test(key))
          .map(([, value]) => (value as number[])[0])
          .sort((a, b) => a - b)
      );
  }
});

test('death burst honors its first-update boundary, authored curves, uniform flag and floating-point lifetime', () => {
  expect(grompDeathParticles(100, 100)).toEqual([]);
  expect(grompDeathParticles(100, NaN)).toEqual([]);
  expect(grompDeathParticles(NaN, 101)).toEqual([]);
  const born = grompDeathParticles(100, 101);
  expect(born).toHaveLength(3);
  expect(born.map((p) => p.scale)).toEqual([
    [430, 430, 430],
    [150, 150, 150],
    [240, 240, 240],
  ]);
  expect(born[1].color).toEqual([1, 1, 1, 0]);
  expect(born.every((p) => p.offset.join() === '0,80,0')).toBe(true);
  const phaseHalf = grompDeathParticles(100, 107);
  expect(phaseHalf[0].scale[0]).toBeCloseTo((430 * 2) / 3);
  expect(phaseHalf[1].scale[0]).toBeCloseTo(285);
  expect(phaseHalf[1].color[3]).toBeCloseTo(0.475);
  expect(phaseHalf[2].scale).toEqual([270, 270, 270]);
  expect(grompDeathParticles(100, 113).map((p) => p.profileIndex)).toEqual([0]);
  expect(grompDeathParticles(100, 119)).toHaveLength(1); // source life is slightly above 0.3
  expect(grompDeathParticles(100, 119.001)).toEqual([]);
});

test('burst seeks and saved neutral deaths reconstruct exactly without changing simulation state or RNG', () => {
  const w = createGrompEncounter(PRACTICE_FIXTURE);
  w.step(480);
  const target = w.units.find((u) => u.kind === 'monster')!;
  w.damage(w.hero, target, 99999, 'true');
  w.step(7);
  const saved = w.snapshot(),
    restored = World.fromSnapshot(saved, w.battlefield);
  const sample = (world: World) => grompDeathParticles(world.unit(target.id)!.deadAt!, world.tick);
  const first = sample(w);
  expect(sample(restored)).toEqual(first);
  grompDeathParticles(target.deadAt!, w.tick + 500);
  expect(sample(w)).toEqual(first);
  expect(w.snapshot()).toBe(saved);
  w.step(15);
  restored.step(15);
  expect(sample(w)).toEqual([]);
  expect(sample(restored)).toEqual([]);
  expect(restored.snapshot()).toBe(w.snapshot());
});
