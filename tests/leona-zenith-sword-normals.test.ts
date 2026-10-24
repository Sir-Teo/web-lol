import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import {
  attachZenithSwordNormals,
  ZENITH_SWORD_NORMALS,
} from '../src/render/leona-zenith-sword-normals';

async function fixture() {
  const doc = await new NodeIO().read('public/' + ZENITH_SWORD_NORMALS.sourceModel.path),
    primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0],
    geometry = new THREE.BufferGeometry();
  const position = primitive.getAttribute('POSITION')!.getArray()!,
    source = primitive.getAttribute('_SOURCE_POSITION')!.getArray()!,
    values = new Float32Array(position.length * 2);
  for (let i = 0; i < position.length; i += 3) {
    values.set(position.slice(i, i + 3), i * 2);
    values.set(source.slice(i, i + 3), i * 2 + 3);
  }
  const interleaved = new THREE.InterleavedBuffer(values, 6);
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
  geometry.setAttribute(
    '_source_position',
    new THREE.InterleavedBufferAttribute(interleaved, 3, 3)
  );
  const bytes = new Uint8Array(readFileSync('public/' + ZENITH_SWORD_NORMALS.stream.path)).buffer;
  return { geometry, bytes };
}

test('separate normal bytes bind to exact source corner order without changing source positions', async () => {
  const { geometry, bytes } = await fixture(),
    original = geometry.getAttribute('_source_position').array.slice(),
    position = geometry.getAttribute('position').array.slice();
  expect(geometry.hasAttribute('normal')).toBe(false);
  await attachZenithSwordNormals(geometry, bytes);
  expect(geometry.getAttribute('normal').count).toBe(1944);
  expect(geometry.getAttribute('_source_position').array).toEqual(original);
  expect(geometry.getAttribute('position').array).toEqual(position);
  expect(geometry.userData.derivedNormalSha256).toBe(ZENITH_SWORD_NORMALS.stream.sha256);
  expect(Array.from(geometry.getAttribute('normal').array)).toEqual(
    Array.from(new Float32Array(bytes))
  );
});

test('corrupt, truncated, reordered or already-normalized source inputs fail before mutation', async () => {
  for (const change of ['normal', 'length', 'source', 'position', 'existing']) {
    const f = await fixture();
    if (change === 'normal') new Uint8Array(f.bytes)[0] ^= 1;
    if (change === 'length') f.bytes = f.bytes.slice(0, -4);
    if (change === 'source') f.geometry.getAttribute('_source_position').setX(0, 123);
    if (change === 'position') f.geometry.getAttribute('position').setX(0, 123);
    if (change === 'existing')
      f.geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1], 3));
    const before = f.geometry.getAttribute('normal');
    await expect(attachZenithSwordNormals(f.geometry, f.bytes)).rejects.toThrow(/Zenith sword/);
    expect(f.geometry.getAttribute('normal')).toBe(before);
  }
});
