import { beforeAll, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BaronParticleBatch } from '../src/render/baron-particle-batch';
import { BaronAttackSystem } from '../src/render/baron-attack-system';
import type { BaronParticleResources } from '../src/render/baron-particle-resources';
let resources: BaronParticleResources;
beforeAll(async () => {
  const program = JSON.parse(
    readFileSync('public/assets/effects/baron-attack/program.json', 'utf8')
  );
  const bytes = Uint8Array.from(
    readFileSync('public/assets/effects/baron-attack/2a79d5c0e7f2dc6f.glb')
  );
  const loaded = await new GLTFLoader().parseAsync(bytes.buffer, '');
  let mesh: THREE.Mesh | undefined;
  loaded.scene.traverse((n) => {
    if (n instanceof THREE.Mesh) mesh = n;
  });
  if (!mesh) throw Error('Capsule mesh missing');
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  resources = {
    program,
    textures: new Map(
      program.textures.map((r: { source: { wadPathHash: string } }) => [
        r.source.wadPathHash,
        texture,
      ])
    ),
    meshes: new Map([['2a79d5c0e7f2dc6f', mesh.geometry]]),
    dispose: () => {},
  };
});
const camera = () => {
  const c = new THREE.PerspectiveCamera();
  c.position.set(5, 7, 9);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
};
function packets() {
  const s = new BaronAttackSystem(resources.program, 'missile', 12345, {
    capacity: 512,
    birthFactors: () => ({ birthScale: 1, emitOffset: 1 }),
  });
  s.step({
    dt: 1 / 60,
    origin: [100, 200, 300],
    moved: [0, 0, 0],
    orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    stopped: false,
  });
  return s.packets();
}
test('instanced geometry converts source centres once and preserves borrowed mesh BGRA', () => {
  const batch = new BaronParticleBatch(resources, 'missile'),
    p = packets();
  batch.update(p, camera());
  const mesh = batch.root.children.find((n) =>
    n.name.includes('missile 3 ')
  ) as THREE.InstancedMesh;
  expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
  expect(mesh.count).toBeGreaterThan(0);
  expect(mesh.geometry.getAttribute('_source_vertex_bgra').normalized).toBe(true);
  expect(mesh.geometry).not.toBe(resources.meshes.get('2a79d5c0e7f2dc6f'));
  const first = p
    .filter((p) => p.emitter === 3)
    .sort((a, b) => {
      const depth = (p: typeof a) =>
        (p.position[0] * 0.01 - 5) ** 2 +
        (p.position[1] * 0.01 - 7) ** 2 +
        (p.position[2] * 0.01 - 9) ** 2;
      return Math.fround(depth(b)) - Math.fround(depth(a));
    })[0];
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  for (let a = 0; a < 3; a++)
    expect(matrix.elements[12 + a]).toBe(Math.fround(first.position[a] * 0.01));
  batch.dispose();
});
test('hidden births split trail runs instead of bridging across them', () => {
  const batch = new BaronParticleBatch(resources, 'missile', 8),
    base = packets().find((p) => p.emitter === 2)!;
  expect(base).toBeDefined();
  const points = Array.from({ length: 5 }, (_, i) => ({
    ...structuredClone(base),
    serial: i + 1,
    position: new Float32Array([i * 10, 0, 0]),
    odometer: i * 10,
  }));
  batch.update(points, camera());
  const trail = batch.root.children.find((n) => n.name.includes('missile 2 ')) as THREE.Mesh;
  expect(trail.geometry.drawRange.count).toBe(24);
  batch.update(points, camera(), (p) => p.serial !== 3);
  expect(trail.geometry.drawRange.count).toBe(12);
  batch.update(points, camera(), () => false);
  expect(trail.visible).toBe(false);
  expect(trail.geometry.drawRange.count).toBe(0);
  batch.dispose();
});
test('batch retirement disposes owned buffers/materials once and leaves borrowed resources intact', () => {
  const batch = new BaronParticleBatch(resources, 'hit');
  let own = 0,
    borrowed = 0;
  for (const child of batch.root.children) {
    const mesh = child as THREE.Mesh;
    mesh.geometry.addEventListener('dispose', () => own++);
    (mesh.material as THREE.Material).addEventListener('dispose', () => own++);
  }
  const shared = resources.meshes.get('2a79d5c0e7f2dc6f')!,
    texture = resources.textures.values().next().value!;
  const dispose = () => borrowed++;
  shared.addEventListener('dispose', dispose);
  texture.addEventListener('dispose', dispose);
  batch.dispose();
  batch.dispose();
  expect(own).toBe(24);
  expect(borrowed).toBe(0);
  expect(batch.root.children).toHaveLength(0);
  expect(() => batch.update([], camera())).toThrow('disposed');
  shared.removeEventListener('dispose', dispose);
  texture.removeEventListener('dispose', dispose);
});
test('batch capacity rejects overflow rather than silently dropping authored particles', () => {
  expect(() => new BaronParticleBatch(resources, 'hit', 0)).toThrow();
  const batch = new BaronParticleBatch(resources, 'missile', 1),
    p = packets()[0];
  expect(() => batch.update([p, { ...p, serial: p.serial + 1 }], camera())).toThrow('capacity');
  batch.dispose();
});
