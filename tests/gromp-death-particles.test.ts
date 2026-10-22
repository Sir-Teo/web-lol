import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import profile from '../src/content/gromp-death.json';
import assets from '../docs/reference/gromp-effect-assets.json';
import { grompDeathParticles } from '../src/render/gromp-death-particles';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { NodeIO } from '@gltf-transform/core';
import { grompDeathTravel } from '../src/render/gromp-death-particles';
import { GROMP_POLICY } from '../src/content/gromp';
import { GROMP_DEATH_PARTICLE_RETENTION_TICKS } from '../src/content/gromp-death-timing';

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
  expect(assets.meshesDeferred).toEqual([]);
  expect(assets.meshes.map((m) => m.source.path)).toEqual(['data/particles/paper01.scb']);
  expect(assets.sourcePinSha256).toBe(hash('docs/reference/gromp-effects.json'));
  expect(profile.sourcePinSha256).toBe(assets.sourcePinSha256);
  for (const output of assets.outputs) {
    expect(hash(`public/${output.path}`)).toBe(output.sha256);
    expect(pin.extraction.files).toContainEqual(output.source);
  }
  const lookup = assets.outputs.find((o) => o.path.endsWith('/color-hold.png'))!;
  expect(lookup.extrema).toEqual(Array.from({ length: 4 }, () => [255, 255]));
});

test('all eight Gromp emitters retain original event attachment, lifetimes, scale, color and render modes', () => {
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
  expect(profile.profiles.map((p) => p.name)).toEqual([
    'flash',
    'lightring',
    'flashfrog',
    'chunks',
    'shadow',
    'pop',
    'skinshards',
    'popshards',
  ]);
  expect(new Set(profile.profiles.map((p) => p.sourceIndex)).size).toBe(8);
  for (const p of profile.profiles) {
    const e = source[p.sourceSection];
    expect(p.life).toBe(e['p-life']);
    expect(p.blend).toBe(e.rendermode);
    expect(p.priority).toBe(e.pass ?? 0);
    expect(p.count).toBe(e['e-rate']);
    expect(p.uniform).toBe(!!e.uniformscale);
    expect(p.depthTest).toBe(!e['flag-disable-z']);
    expect(p.size).toEqual(
      Array.isArray(e['p-scale']) ? e['p-scale'] : Array(3).fill(e['p-scale'])
    );
    expect(assets.outputs.find((o) => o.path === p.texture)?.source.path).toBe(
      (e['p-texture'] ?? e['p-meshtex']).toLowerCase()
    );
    for (const [prefix, keys] of [
      ['p-xscale', p.scaleCurve],
      ['p-xrgba', p.colorCurve],
    ] as const) {
      const entries = Object.entries(e)
        .filter(([key]) => new RegExp(`^${prefix}\\d+$`).test(key))
        .map(([, value]) => value as number[])
        .sort((a, b) => a[0] - b[0]);
      expect(keys.map((k) => k.time)).toEqual(entries.map((v) => v[0]));
      expect(keys.map((k) => k.value)).toEqual(
        entries.map((v) =>
          v.length === 2 ? Array(prefix === 'p-xscale' ? 3 : 4).fill(v[1]) : v.slice(1)
        )
      );
    }
  }
});

test('death burst honors its first-update boundary, authored curves, uniform flag and floating-point lifetime', () => {
  const quads = (tick: number) => grompDeathParticles(100, tick).filter((p) => p.profileIndex < 3);
  expect(grompDeathParticles(100, 100)).toEqual([]);
  expect(grompDeathParticles(100, NaN)).toEqual([]);
  expect(grompDeathParticles(NaN, 101)).toEqual([]);
  const born = quads(101);
  expect(born).toHaveLength(3);
  expect(born.map((p) => p.scale)).toEqual([
    [430, 430, 430],
    [150, 150, 150],
    [240, 240, 240],
  ]);
  expect(born[1].color).toEqual([1, 1, 1, 0]);
  expect(born.every((p) => p.offset.join() === '0,80,0')).toBe(true);
  const phaseHalf = quads(107);
  expect(phaseHalf[0].scale[0]).toBeCloseTo((430 * 2) / 3);
  expect(phaseHalf[1].scale[0]).toBeCloseTo(285);
  expect(phaseHalf[1].color[3]).toBeCloseTo(0.475);
  expect(phaseHalf[2].scale).toEqual([270, 270, 270]);
  expect(quads(113).map((p) => p.profileIndex)).toEqual([0]);
  expect(quads(119)).toHaveLength(1); // source life is slightly above 0.3
  expect(quads(119.001)).toEqual([]);
});

test('burst seeks and saved neutral deaths reconstruct exactly without changing simulation state or RNG', () => {
  const w = createGrompEncounter(PRACTICE_FIXTURE);
  w.step(480);
  const target = w.units.find((u) => u.kind === 'monster')!;
  w.damage(w.hero, target, 99999, 'true');
  w.step(7);
  const saved = w.snapshot(),
    restored = World.fromSnapshot(saved, w.battlefield);
  const sample = (world: World) =>
    world.unit(target.id)
      ? grompDeathParticles(world.unit(target.id)!.deadAt!, world.tick, target.id)
      : [];
  const first = sample(w);
  expect(sample(restored)).toEqual(first);
  grompDeathParticles(target.deadAt!, w.tick + 500);
  expect(sample(w)).toEqual(first);
  expect(w.snapshot()).toBe(saved);
  w.step(310);
  restored.step(310);
  expect(sample(w)).toEqual([]);
  expect(sample(restored)).toEqual([]);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('the original paper SCB retains 42 expanded triangles, UV seams, raw colors and exact scaled attributes', async () => {
  const manifest = assets.meshes[0],
    path = `public${manifest.output.path}`;
  expect(hash(path)).toBe(manifest.output.sha256);
  expect(manifest.sourceVersion).toEqual([3, 2]);
  expect(manifest.sourceVertices).toBe(44);
  expect(manifest.triangles).toBe(42);
  expect(manifest.exportedCorners).toBe(126);
  const primitive = (await new NodeIO().read(path)).getRoot().listMeshes()[0].listPrimitives()[0];
  expect(primitive.getIndices()).toBeNull();
  for (const [name, digest] of [
    ['POSITION', manifest.positionFloat32Sha256],
    ['TEXCOORD_0', manifest.uvFloat32Sha256],
    ['_SOURCE_FACE_RGB', manifest.faceRgbSha256],
  ]) {
    const a = primitive.getAttribute(name)!;
    expect(a.getCount()).toBe(126);
    expect(createHash('sha256').update(new Uint8Array(a.getArray()!.buffer)).digest('hex')).toBe(
      digest
    );
  }
  expect([...primitive.getAttribute('_SOURCE_FACE_RGB')!.getArray()!].every((v) => v === 0)).toBe(
    true
  );
  expect(manifest.sourceIndices).toHaveLength(126);
  expect(new Set(manifest.sourceIndices).size).toBe(44);
  expect(manifest.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
});

test('rate-sized bursts preserve correlated source birth tables, indexed atlas frames and survivor identities', () => {
  expect(profile.profiles[3].probabilities.size[0]).toEqual({
    times: [0, 0.8, 1],
    values: [0.1, 0.5, 1],
  });
  expect(profile.profiles[5].probabilities.life).toEqual({ times: [0, 1], values: [0.3, 1] });
  expect(profile.profiles[6].probabilities.life).toEqual({ times: [0, 1], values: [0.5, 1] });
  expect(profile.profiles[7].probabilities.life).toEqual({ times: [0, 1], values: [0.4, 0.75] });
  const born = grompDeathParticles(100, 101, 7);
  expect(profile.profiles.map((_, i) => born.filter((p) => p.profileIndex === i).length)).toEqual([
    1, 1, 1, 150, 1, 15, 20, 35,
  ]);
  expect(born).toHaveLength(224);
  for (const i of [3, 5, 7])
    expect(new Set(born.filter((p) => p.profileIndex === i).map((p) => p.frame)).size).toBe(4);
  for (const p of born.filter((p) => p.profileIndex === 6)) {
    const chance = (p.life / 4 - 0.5) * 2;
    expect(p.offset[0]).toBeCloseTo(100 * (-1 + 2 * chance));
    expect(p.offset[1]).toBe(200);
    expect(p.offset[2]).toBeCloseTo(p.offset[0]);
    expect(p.scroll[1]).toBeCloseTo(-0.6 * chance);
  }
  const later = grompDeathParticles(100, 119, 7);
  expect(later.filter((p) => p.profileIndex === 3).length).toBeLessThan(150);
  for (const p of later) {
    const original = born.find(
      (b) => b.profileIndex === p.profileIndex && b.ordinal === p.ordinal
    )!;
    expect(p.life).toBe(original.life);
    expect(p.frame).toBe(original.frame);
    if (p.profileIndex === 6) expect(p.scroll[1] - original.scroll[1]).toBeCloseTo(0.2 * p.age);
  }
  expect(grompDeathParticles(100, 119, 8)).not.toEqual(later);
  expect(grompDeathParticles(100, 119, 7)).toEqual(later);
});

test('mesh shard integrated rotation uses the source curve on each right-endpoint fixed update', () => {
  const born = grompDeathParticles(100, 101, 7).find((p) => p.profileIndex === 6)!;
  const later = grompDeathParticles(100, 161, 7).find(
    (p) => p.profileIndex === 6 && p.ordinal === born.ordinal
  )!;
  let angle = born.rotation[0];
  for (let tick = 1; tick <= 60; tick++) {
    const phase = tick / 60 / born.life;
    angle += phase <= 0.4 ? -10 + (16 * phase) / 0.4 : 6 * (1 - (phase - 0.4) / 0.6);
  }
  expect(later.rotation[0]).toBeCloseTo(angle, 10);
  expect(later.rotation.slice(1)).toEqual(born.rotation.slice(1));
});

test('ballistic debris uses stepped acceleration and drag with exact fractional display interpolation', () => {
  const age = 1.005,
    velocity = [180, 75, -90],
    acceleration = [0, -70, 0],
    drag = [1, 1, 1],
    position = [0, 0, 0],
    speed = [...velocity];
  for (let step = 0; step < 61; step++)
    for (let axis = 0; axis < 3; axis++) {
      speed[axis] = ((speed[axis] + acceleration[axis] / 60) * 59) / 60;
      position[axis] += (speed[axis] / 60) * (step === 60 ? 0.3 : 1);
    }
  const result = grompDeathTravel(velocity, acceleration, drag, age);
  for (let axis = 0; axis < 3; axis++) {
    expect(result.position[axis]).toBeCloseTo(position[axis], 10);
    expect(result.travel[axis]).toBeCloseTo(speed[axis], 10);
  }
  expect(grompDeathTravel([0, 0, 0], [0, -800, 0], [0, 0, 0], 1).position[1]).toBeCloseTo(
    (-800 * 61) / 120
  );
});

test('corpse retention covers the five-second shadow plus birth and interpolation, including saved final intervals', () => {
  expect(GROMP_DEATH_PARTICLE_RETENTION_TICKS).toBe(302);
  expect(GROMP_POLICY.corpseLifetimeTicks).toBe(302);
  const world = createGrompEncounter(PRACTICE_FIXTURE),
    target = world.units.find((u) => u.kind === 'monster')!;
  world.damage(world.hero, target, 99999, 'true');
  const death = target.deadAt!;
  world.step(301);
  expect(world.unit(target.id)).toBeDefined();
  expect(
    grompDeathParticles(death, world.tick - 0.5, target.id).map((p) => p.profileIndex)
  ).toEqual([4]);
  const restored = World.fromSnapshot(world.snapshot(), world.battlefield);
  expect(restored.snapshot()).toBe(world.snapshot());
  world.step(1);
  restored.step(1);
  expect(world.unit(target.id)).toBeUndefined();
  expect(restored.snapshot()).toBe(world.snapshot());
  expect(grompDeathParticles(death, death + 301, target.id)).toEqual([]);
});
