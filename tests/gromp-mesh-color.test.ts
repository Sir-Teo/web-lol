import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import source from '../src/content/gromp-death.json';
import fixtures from '../docs/reference/gromp-mesh-color-fixtures.json';
import mesh from '../docs/reference/native-mesh-color-route.json';
import { createGrompDeathMaterial } from '../src/render/gromp-death';
import {
  prepareLegacyParticleColor,
  sampleLegacyParticleColor,
} from '../src/render/legacy-particle-color';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const curve = prepareLegacyParticleColor(source.profiles[6].color, source.profiles[6].colorCurve);

test('mesh fixtures bind original source and independent float32 compiler provenance', () => {
  expect(fixtures.compiler.flags).toEqual([
    '-std=c11',
    '-O2',
    '-ffp-contract=off',
    '-fno-fast-math',
  ]);
  expect(fixtures.compiler.nativeExecuted).toBe(false);
  expect(sha('tools/qa/lib/legacy-mesh-color-reference.py')).toBe(fixtures.referenceToolSha256);
  for (const [path, digest] of Object.entries(fixtures.compiler.sourcePins))
    expect(sha(path)).toBe(digest);
  expect(mesh.source.profileIndex).toBe(6);
  expect(mesh.source.quadBytePolicyApplicable).toBe(false);
  expect(mesh.primitive.quadSlotBehavior).toBe('RET only');
  expect(mesh.floatTransfer.bytes).toBe(16);
  expect(source.profiles[6].blend).toBe(1);
});
for (const row of fixtures.rows)
  test(`Gromp mesh float color matches C at phase ${row.phase}`, () => {
    const color = sampleLegacyParticleColor(curve, row.phase);
    expect(color).toEqual(row.rgba);
    expect(
      color.map((value) => {
        const bytes = Buffer.alloc(4);
        bytes.writeFloatLE(value);
        return bytes.readUInt32LE().toString(16).padStart(8, '0');
      })
    ).toEqual(row.words);
  });
test('mesh retains the float tint shader rather than a quad byte stream', () => {
  const white = new THREE.Texture();
  const material = createGrompDeathMaterial(6, white, white, true);
  try {
    expect(material.defines.VERTEX_TINT).toBe(1);
    expect(material.defines.VERTEX_BGRA).toBeUndefined();
  } finally {
    material.dispose();
    white.dispose();
  }
});
