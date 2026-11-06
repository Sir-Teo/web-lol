import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../src/content/ahri-q-projectile-particles.json';
import source from '../docs/reference/ahri/q-particles.json';
import transports from '../docs/reference/ahri/q-projectile-mesh-transports.json';
import cast from '../src/content/ahri-q-cast-particles.json';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
test('all 36 public profiles preserve every checked private field apart from explicit asset URL substitutions', () => {
  const raw = execFileSync(
    'python3',
    [
      '-c',
      "import runpy,sys; sys.stdout.buffer.write(runpy.run_path('tools/assets/prepare-ahri-q-projectile-profiles.py')['build']()[0])",
    ],
    { env: { ...process.env, PYTHONPATH: 'tools/assets' }, maxBuffer: 2 * 1024 * 1024 }
  );
  const privateData = JSON.parse(raw.toString()),
    paths = new Map(data.textures.map((t) => [t.path, t.url]));
  for (const m of transports.meshes)
    paths.set(
      m.glb.path,
      data.meshes.find((p) => p.source.wadPathHash === m.source.wadPathHash)!.url
    );
  function publicPaths(value: unknown): unknown {
    if (typeof value === 'string') return paths.get(value) ?? value;
    if (Array.isArray(value)) return value.map(publicPaths);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, publicPaths(v)]));
    return value;
  }
  expect(data.profiles).toEqual(publicPaths(privateData.profiles));
  expect(data.adapterDefaults).toEqual(privateData.adapterDefaults);
  expect(data.profiles).toHaveLength(36);
  for (const p of data.profiles) {
    const original =
      source.resources[p.system as 'Ahri_Q_mis' | 'Ahri_Q_mis_02'].definition
        .complexEmitterDefinitionData[p.index];
    expect(p.explicitFields).toEqual(Object.keys(original).sort());
  }
});
test('17 public textures retain all 151 authored mips while two reuse exact cast assets', () => {
  expect(data.textures).toHaveLength(17);
  expect(data.textures.reduce((n, t) => n + t.rectangles.length, 0)).toBe(151);
  expect(data.textures.filter((t) => t.textureOwner === 'ahri-q-cast')).toHaveLength(2);
  expect(data.textures.filter((t) => t.textureOwner === 'ahri-q-projectile')).toHaveLength(15);
  for (const t of data.textures) {
    const raw = readFileSync('public/' + t.url);
    expect(raw.length).toBe(t.bytes);
    expect(hash(raw)).toBe(t.sha256);
  }
  for (const t of data.textures.filter((t) => t.textureOwner === 'ahri-q-cast')) {
    const original = cast.textures.find((c) => c.url === t.url)!;
    expect(t.sha256).toBe(original.sha256);
    expect(t.rectangles).toEqual(original.rectangles);
  }
});
test('the indicator, seam-preserving sphere and borrowed swirls load in the actual engine without fabricated normals or colors', async () => {
  expect(data.meshes.map((m) => [m.vertices, m.triangles, m.hasVertexColors])).toEqual([
    [150, 192, true],
    [287, 480, false],
    [603, 792, true],
  ]);
  for (const m of data.meshes) {
    const raw = readFileSync('public/' + m.url);
    expect(raw.length).toBe(m.bytes);
    expect(hash(raw)).toBe(m.sha256);
    const gltf = await new GLTFLoader().parseAsync(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      ''
    );
    const found: THREE.Mesh[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((n) => {
      if (n instanceof THREE.Mesh) found.push(n);
    });
    expect(found).toHaveLength(1);
    const mesh = found[0],
      g = mesh.geometry;
    expect(mesh.matrixWorld.equals(new THREE.Matrix4())).toBe(true);
    expect(g.getAttribute('position').count).toBe(m.vertices);
    expect(g.getAttribute('uv').count).toBe(m.vertices);
    expect(g.index?.count).toBe(m.triangles * 3);
    expect(g.getAttribute('normal')).toBeUndefined();
    if (m.hasVertexColors) {
      expect(g.getAttribute('color').count).toBe(m.vertices);
      expect(g.getAttribute('color').normalized).toBe(true);
    } else expect(g.getAttribute('color')).toBeUndefined();
    g.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      material.dispose();
  }
  expect(data.meshes.filter((m) => m.geometryOwner === 'ahri-q-cast').map((m) => m.url)).toEqual([
    cast.meshes[0].url,
  ]);
  expect(data.meshes.find((m) => m.geometryOwner === 'ahri-q-cast')!.sha256).toBe(
    cast.meshes[0].sha256
  );
});
test('integrated UV curves, emitter scrolling, omitted trail fields and multi-particle singles remain explicit', () => {
  const indicator = data.profiles.find((p) => p.role === 'return' && p.name === 'Indicator')!;
  expect(indicator.uv.scroll.sourceType).toBe('IntegratedValueVector2');
  expect(indicator.uv.scroll.authoredKeyCount).toBe(2);
  expect(data.profiles.filter((p) => p.trail?.cameraFacing)).toHaveLength(6);
  expect(data.profiles.filter((p) => p.trail && p.trail.smoothing === null)).toHaveLength(3);
  expect(data.profiles.find((p) => p.name === 'sparkles_burst')).toMatchObject({
    single: true,
    rate: { values: [[75]] },
  });
  expect(
    data.profiles.find((p) => p.role === 'missile' && p.name === 'Trail3')!.uv.emitterScroll
  ).toEqual([0.5, 0]);
});
