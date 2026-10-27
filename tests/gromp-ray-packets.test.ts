import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import data from '../src/content/gromp-death.json';
import { createGrompDeathMaterial } from '../src/render/gromp-death';

test('Gromp byte streams stay bound to the two independently mapped legacy Rays', () => {
  const raw = readFileSync('docs/reference/native-legacy-primitive-types.json'),
    witness = JSON.parse(raw.toString()),
    source = JSON.parse(readFileSync('docs/reference/gromp-effects.json', 'utf8'));
  expect(createHash('sha256').update(raw).digest('hex')).toBe(
    '2e56236915d08ec883f89de2848a0571dc2085081b837d75e5a412ef8cdfda61'
  );
  expect(witness.ray.vertexBuilder).toBe('0x1018d9178');
  expect(witness.grompRays.map((p: any) => p.profileIndex)).toEqual([5, 7]);
  const white = new THREE.Texture();
  try {
    for (const [index, p] of data.profiles.entries()) {
      const material = createGrompDeathMaterial(index, white, white, true);
      expect(material.defines.VERTEX_BGRA).toBe(p.kind === 'ray' ? 1 : undefined);
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
