import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import data from '../src/content/masteryi-q-contact-particles.json';
import { alphaContactParticles } from '../src/render/masteryi-q-contact-particles';
import { createAlphaContactMaterial } from '../src/render/masteryi-q-contacts';
import type { AlphaContactVisual } from '../src/simulation/masteryi-q-contact-visuals';

function record(critical = false): AlphaContactVisual {
  return {
    castTick: 44,
    rank: 1,
    markIndex: 3,
    markTick: 100,
    repeatIndex: 3,
    critical,
    tick: 100,
    targetId: 2,
    targetTeam: 'red',
    targetKind: 'champion',
    point: { x: 10, y: 20 },
    audience: ['blue', 'red'],
    radius: 65,
    facing: 0.7,
    detachedTick: null,
    frames: Array.from({ length: 22 }, (_, i) => ({
      tick: 100 + i,
      point: { x: 10 + i, y: 20 + 2 * i },
      audience: ['blue', 'red'],
    })),
  };
}
const sample = (r: AlphaContactVisual, tick: number) => alphaContactParticles(1, [r], tick, 'blue');

test('compiled profiles preserve all seven source emitters, omissions, lookup defaults and lossless transport identities', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/q-particles.json', 'utf8'));
  expect(data.profiles).toHaveLength(7);
  for (const p of data.profiles) {
    const native = source.resources[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.explicitFields).toEqual(Object.keys(native).sort());
    expect(p.rate).toBe(native.rate.constantValue);
    expect(p.life.value).toEqual([native.particleLifetime.constantValue]);
    expect(p.emitterLife).toBe(native.lifetime);
    expect(p.blend).toBe(native.blendMode ?? 0);
    expect(p.emitterLinger).toBe(native.emitterLinger ?? null);
    expect(p.particleLinger).toBe(native.particleLinger ?? null);
    expect(p.lookupTypes).toEqual([1, 0]);
    expect(p.lookupScales).toEqual([1, 1]);
    expect(p.lookupOffsets).toEqual([0, 0]);
  }
  expect(source.resources.MasterYi_Q_Hit.definition.complexEmitterDefinitionData).toBeUndefined();
  expect(data.textures).toHaveLength(7);
  expect(data.textures.reduce((n, a) => n + a.rectangles.length, 0)).toBe(59);
  for (const asset of [...data.textures, data.mesh]) {
    const raw = readFileSync('public/' + asset.url);
    expect(raw.length).toBe(asset.bytes);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(asset.sha256);
  }
});

test('ordinary contact emits four profiles on first update and only the trail has a second birth', () => {
  const r = record();
  expect(sample(r, 100.999)).toEqual([]);
  expect(sample(r, 101).map((p) => [p.profileIndex, p.ordinal, p.bornTick])).toEqual([
    [0, 1, 101],
    [1, 1, 101],
    [2, 1, 101],
    [3, 1, 101],
  ]);
  expect(sample(r, 108.99).filter((p) => p.profileIndex === 1)).toHaveLength(1);
  expect(
    sample(r, 109)
      .filter((p) => p.profileIndex === 1)
      .map((p) => [p.ordinal, p.bornTick])
  ).toEqual([
    [1, 101],
    [2, 109],
  ]);
  expect(sample(r, 120.399)).toHaveLength(1);
  expect(sample(r, 120.4)).toEqual([]);
  expect(sample(r, 700)).toEqual([]);
});

test('critical contact selects its own three profiles and retains exact source float lifetimes', () => {
  const r = record(true);
  expect(sample(r, 101).map((p) => p.profileIndex)).toEqual([4, 5, 6]);
  expect(sample(r, 110).map((p) => p.profileIndex)).toEqual([4, 5]);
  expect(sample(r, 113).map((p) => p.profileIndex)).toEqual([4]);
  expect(sample(r, 113.001)).toEqual([]);
});

test('bound roots interpolate current positions while unbound births stay at their known birth point', () => {
  const particles = sample(record(), 106.5);
  expect(particles.find((p) => p.profileIndex === 0)!.point).toEqual({ x: 16.5, y: 33 });
  expect(particles.find((p) => p.profileIndex === 1)!.point).toEqual({ x: 16.5, y: 33 });
  expect(particles.find((p) => p.profileIndex === 2)!.point).toEqual({ x: 11, y: 22 });
  expect(particles.find((p) => p.profileIndex === 3)!.point).toEqual({ x: 11, y: 22 });
});

test('source flash and bubble curve maxima are applied without arbitrary fades or linger extensions', () => {
  const r = record();
  const flash = sample(r, 101 + data.profiles[2].life.value[0] * 30).find(
    (p) => p.profileIndex === 2
  )!;
  expect(flash.scale).toEqual([440, 440, 440]);
  expect(flash.offset).toEqual([0, 100, 0]);
  expect(flash.color).toEqual([1, 1, 1, 1]);
  expect(flash.lookup[0]).toBeCloseTo(0.5, 12);
  expect(flash.lookup[1]).toBe(1);
  const bubble = sample(r, 101 + data.profiles[3].life.value[0] * 30).find(
    (p) => p.profileIndex === 3
  )!;
  expect(bubble.scale).toEqual([70, 70, 70]);
  expect(sample(r, 130)).toEqual([]); // Native particleLinger=10 is not ten extra visible seconds.
});

test('trail preserves correlated source birth probabilities, local bound size, angular velocity and scroll', () => {
  const r = record(),
    first = sample(r, 101).find((p) => p.profileIndex === 1)!;
  const chance = 1 - first.rotation[0] / 10;
  expect(first.rotation[1] / -180).toBeCloseTo(1 - chance, 12);
  const nativeSize = data.profiles[1].size.value[0],
    bound = 130 * data.profiles[1].boundSize!;
  expect(first.scale[0]).toBeCloseTo(
    nativeSize * (0.800000011920929 + chance * (2 - 0.800000011920929)) * bound,
    12
  );
  expect(first.scale[1]).toBeCloseTo(nativeSize * bound, 12);
  const later = sample(r, 105).find((p) => p.profileIndex === 1 && p.ordinal === 1)!;
  expect(later.rotation[0] - first.rotation[0]).toBeCloseTo((100 * 4) / 60, 12);
  expect(later.scroll).toEqual([(2 * 4) / 60, 0]);
  expect(later.offset).toEqual([0, 120, 0]);
});

test('birth visibility gates every layer; later fog hides bound layers and retains only known unbound positions', () => {
  const r = record();
  r.frames[1].audience = ['red'];
  expect(sample(r, 104)).toEqual([]);
  r.frames[1].audience = ['blue', 'red'];
  r.frames[5].audience = ['red'];
  expect(sample(r, 105).map((p) => p.profileIndex)).toEqual([2, 3]);
  expect(sample(r, 104.5).map((p) => p.profileIndex)).toEqual([2, 3]);
  expect(sample(r, 106).map((p) => p.profileIndex)).toEqual([0, 1, 2, 3]);
  r.audience = ['red'];
  expect(sample(r, 106)).toEqual([]);
});

test('a hidden second trail birth never appears retroactively on vision return', () => {
  const r = record();
  r.frames[9].audience = ['red'];
  expect(
    sample(r, 110)
      .filter((p) => p.profileIndex === 1)
      .map((p) => p.ordinal)
  ).toEqual([1]);
});

test('cosmetic sampling is immutable, seekable and distinguishes mark/profile/ordinal seeds', () => {
  const r = record(),
    before = JSON.stringify(r),
    a = sample(r, 109);
  sample(r, 500);
  sample(r, 102);
  expect(sample(r, 109)).toEqual(a);
  expect(JSON.stringify(r)).toBe(before);
  const other = structuredClone(r);
  other.markIndex--;
  expect(sample(other, 109).find((p) => p.profileIndex === 1)!.rotation).not.toEqual(
    a.find((p) => p.profileIndex === 1)!.rotation
  );
  expect(alphaContactParticles(1, [r], NaN)).toEqual([]);
});

test('materials preserve source blend/pass/depth/cull selection without face-RGB material tint', () => {
  const base = new THREE.Texture(),
    lookup = new THREE.Texture();
  for (let index = 0; index < 7; index++) {
    const p = data.profiles[index],
      m = createAlphaContactMaterial(index, base, lookup);
    expect(m.uniforms.sourceTexture.value).toBe(base);
    expect(m.uniforms.particleColorTexture.value).toBe(lookup);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe((p.miscRenderFlags & 1) === 0);
    expect(m.blendSrc).toBe(p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor);
    expect(m.blendDst).toBe(THREE.OneFactor);
    expect(m.defines.VERTEX_TINT).toBeUndefined();
    expect(m.side).toBe(THREE.DoubleSide);
    m.dispose();
  }
  base.dispose();
  lookup.dispose();
});
