import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import data from '../src/content/gromp-death.json';
import { createGrompDeathMaterial } from '../src/render/gromp-death';

test('Gromp byte streams stay bound to independently mapped Rays, complex CameraQuads and the plane', () => {
  const raw = readFileSync('docs/reference/native-legacy-primitive-types.json'),
    witness = JSON.parse(raw.toString()),
    source = JSON.parse(readFileSync('docs/reference/gromp-effects.json', 'utf8'));
  expect(createHash('sha256').update(raw).digest('hex')).toBe(
    '2e56236915d08ec883f89de2848a0571dc2085081b837d75e5a412ef8cdfda61'
  );
  expect(witness.ray.vertexBuilder).toBe('0x1018d9178');
  expect(witness.grompRays.map((p: any) => p.profileIndex)).toEqual([5, 7]);
  const billboardRaw = readFileSync('docs/reference/native-gromp-emitter-routes.json'),
    billboardWitness = JSON.parse(billboardRaw.toString());
  expect(createHash('sha256').update(billboardRaw).digest('hex')).toBe(
    '8e268d02303addefa4c70b311215329d4ef1782eac4ae12378a54039dd6eff3c'
  );
  expect(billboardWitness.source.complexCameraQuadProfiles).toEqual([1, 2, 3]);
  expect(billboardWitness.source.simpleProfiles).toEqual([0]);
  const planeRaw = readFileSync('docs/reference/native-plane-color-packets.json'),
    planeWitness = JSON.parse(planeRaw.toString());
  expect(createHash('sha256').update(planeRaw).digest('hex')).toBe(
    'bb9528c072b7223dd85c9a2ab678b1cb1564ea28885a97ec438d626b2d3bb2ea'
  );
  expect(planeWitness.source.profileIndex).toBe(4);
  expect(planeWitness.primitive.legacyPType).toBe(1);
  const packed = new Set([
    ...witness.grompRays.map((p: any) => p.profileIndex),
    ...billboardWitness.source.complexCameraQuadProfiles,
    planeWitness.source.profileIndex,
  ]);
  expect([...packed].sort()).toEqual([1, 2, 3, 4, 5, 7]);
  const white = new THREE.Texture();
  try {
    for (const [index, p] of data.profiles.entries()) {
      const material = createGrompDeathMaterial(index, white, white, true);
      expect(material.defines.VERTEX_BGRA).toBe(packed.has(index) ? 1 : undefined);
      expect(material.defines.VERTEX_TINT).toBe(1);
      material.dispose();
      if (p.kind !== 'ray') continue;
      const e = source.records[p.sourceRecord].decoded.values[p.sourceSection];
      expect(e['p-type']).toBe(2);
      expect(e['e-color-modulate']).toBeUndefined();
      expect(p.blend).toBe(index === 5 ? 1 : 0);
      expect(p.atlas.grid).toEqual([4, 1]);
      expect(p.scroll).toEqual([0, 0]);
      expect(p.uvOffset).toEqual([0, 0]);
      expect(p.lookup).toBeNull();
    }
  } finally {
    white.dispose();
  }
});
