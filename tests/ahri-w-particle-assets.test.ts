import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import data from '../src/content/ahri-w-particles.json';
import publication from '../docs/reference/ahri/w-publication.json';

const hash = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
test('W staging retains all authored profiles, mip atlases and exact transport bytes', () => {
  expect(hash(readFileSync('src/content/ahri-w-particles.json'))).toBe(
    publication.publicProfileSha256
  );
  expect(data.profiles).toHaveLength(30);
  expect(data.textures).toHaveLength(35);
  expect(data.textures.reduce((sum, t) => sum + t.rectangles.length, 0)).toBe(292);
  expect(data.meshes).toHaveLength(2);
  for (const asset of [...data.textures, ...data.meshes]) {
    const raw = readFileSync('public/' + asset.url);
    expect(raw.byteLength, asset.url).toBe(asset.bytes);
    expect(hash(raw), asset.url).toBe(asset.sha256);
  }
});

test('W ownership borrows six existing Q textures and preserves native mesh coordinates', () => {
  const owners = data.textures.map((t) => t.textureOwner);
  expect(owners.filter((o) => o === 'ahri-w')).toHaveLength(29);
  expect(owners.filter((o) => o === 'ahri-q-cast')).toHaveLength(3);
  expect(owners.filter((o) => o === 'ahri-q-projectile')).toHaveLength(3);
  expect(publication.sharedAssets).toHaveLength(6);
  expect(publication.newPublicAssetFiles).toBe(31);
  expect(publication.newPublicAssetBytes).toBe(1776675);
  for (const mesh of data.meshes) {
    expect(mesh.geometryOwner).toBe('ahri-w');
    expect(mesh.sourceCoordinateTransformApplied).toBe(false);
    expect(mesh.normalAttributeGenerated).toBe(false);
    expect(mesh.hasVertexColors).toBe(true);
  }
  expect(data.meshes.reduce((sum, m) => sum + m.vertices, 0)).toBe(812);
  expect(data.meshes.reduce((sum, m) => sum + m.triangles, 0)).toBe(1143);
});

test('W staging retains missing bindings, signed source atlas dimensions and integer flags', () => {
  expect(data.profiles.filter((p) => p.emitterLife === null)).toHaveLength(8);
  expect(data.profiles.filter((p) => p.palette && p.palette.texture === null)).toHaveLength(2);
  const ribbon = data.profiles.find((p) => p.uv.sourceDivisions[1] === -1)!;
  expect(ribbon.uv.sourceDivisions).toEqual([1, -1]);
  expect(ribbon.uv.divisions).toEqual([1, 1]);
  expect(data.profiles.find((p) => p.sharedRandomValue !== null)!.sharedRandomValue).toBe(1);
  for (const profile of data.profiles) {
    expect(profile.texture).toMatch(/^assets\/effects\//);
    if (profile.mesh) expect(profile.mesh).toMatch(/^assets\/effects\//);
    expect(profile.bindingRequirements).toBeInstanceOf(Array);
  }
});
