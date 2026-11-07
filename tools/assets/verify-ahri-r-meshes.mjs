/** Load the private exact source transports with the application's actual engine. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const manifest = JSON.parse(await readFile('docs/reference/ahri/r-mesh-transports.json', 'utf8'));
assert.equal(manifest.meshes.length, 4);
for (const row of manifest.meshes) {
  const raw = await readFile(row.glb.path);
  assert.equal(raw.length, row.glb.bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.glb.sha256);
  const gltf = await new GLTFLoader().parseAsync(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    ''
  );
  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((n) => {
    if (n instanceof THREE.Mesh) meshes.push(n);
  });
  assert.equal(meshes.length, 1);
  const mesh = meshes[0],
    g = mesh.geometry;
  assert(mesh.matrixWorld.equals(new THREE.Matrix4()));
  assert.equal(g.getAttribute('position').count, row.transportVertices);
  assert.equal(g.getAttribute('uv').count, row.transportVertices);
  assert.equal(g.index.count, row.sourceTriangles * 3);
  assert.equal(g.getAttribute('normal'), undefined);
  if (row.hasVertexColors) {
    assert.equal(g.getAttribute('color').count, row.transportVertices);
    assert.equal(g.getAttribute('color').normalized, true);
  } else assert.equal(g.getAttribute('color'), undefined);
  g.dispose();
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  console.log(
    JSON.stringify({
      result: 'passed',
      path: row.glb.path,
      vertices: row.transportVertices,
      triangles: row.sourceTriangles,
      sourceColors: row.hasVertexColors,
      sourceCoordinatesPreserved: true,
      engine: THREE.REVISION,
      gpuPixelEquivalence: false,
    })
  );
}
