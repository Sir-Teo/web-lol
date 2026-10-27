import { expect, test } from 'vitest';
import fixtures from '../docs/reference/gromp-attack-color-fixtures.json';
import source from '../src/content/gromp-attack.json';
import {
  prepareLegacyParticleColor,
  sampleLegacyParticleColor,
} from '../src/render/legacy-particle-color';
import { writeGrompAttackColor } from '../src/render/gromp-attack-color';
import { createGrompAttackMaterial } from '../src/render/gromp-attack';
import * as THREE from 'three';
const curves = source.profiles.map((p) =>
  p.colorCurve.length ? prepareLegacyParticleColor(p.color, p.colorCurve) : null
);
for (const row of fixtures.rows)
  test(`missile ${row.profileIndex} at ${row.phase} matches host-C RGBA and BGRA`, () => {
    const curve = curves[row.profileIndex],
      color = curve
        ? sampleLegacyParticleColor(curve, row.phase)
        : source.profiles[row.profileIndex].color;
    expect(color).toEqual(row.rgba);
    const bytes = new Uint8Array(20).fill(91),
      before = [...color];
    writeGrompAttackColor(bytes, 1, 3, color, source.profiles[row.profileIndex].blend);
    expect([...bytes]).toEqual([
      91,
      91,
      91,
      91,
      ...row.bgra,
      ...row.bgra,
      ...row.bgra,
      91,
      91,
      91,
      91,
    ]);
    expect(color).toEqual(before);
  });
for (const blend of [0, 2])
  test(`mode ${blend} premultiplies before truncating rather than rounding`, () => {
    const bytes = new Uint8Array(4),
      color = [1, 0.5, 0.25, 0.5];
    writeGrompAttackColor(bytes, 0, 1, color, blend);
    expect([...bytes]).toEqual([31, 63, 127, 255]);
    expect(color).toEqual([1, 0.5, 0.25, 0.5]);
  });
test('mode4 retains alpha and rejects unsupported source modes', () => {
  const bytes = new Uint8Array(4);
  writeGrompAttackColor(bytes, 0, 1, [1, 0.5, 0.25, 0.5], 4);
  expect([...bytes]).toEqual([63, 127, 255, 127]);
  for (const mode of [1, 3, -1, NaN])
    expect(() => writeGrompAttackColor(bytes, 0, 1, [1, 1, 1, 1], mode)).toThrow(RangeError);
});
for (let i = 0; i < 4; i++)
  test(`missile material ${i} decodes its normalized BGRA stream`, () => {
    const texture = new THREE.Texture(),
      material = createGrompAttackMaterial(i, texture, true);
    expect(material.defines).toMatchObject({ VERTEX_TINT: 1, VERTEX_BGRA: 1, VERTEX_LOOKUP: 1 });
    material.dispose();
    texture.dispose();
  });
