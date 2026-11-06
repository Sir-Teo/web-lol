/** Exercise the application loader against the staged source GLB. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const metadata = JSON.parse(await readFile('.cache/ahri-q-cast-mesh-v1/mesh.json', 'utf8'));
const raw = await readFile(metadata.glb.path);
assert.equal(createHash('sha256').update(raw).digest('hex'), metadata.glb.sha256);
const gltf = await new GLTFLoader().parseAsync(
  raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  ''
);
const meshes = [];
gltf.scene.traverse((o) => {
  if (o.isMesh) meshes.push(o);
});
assert.equal(meshes.length, 1);
const mesh = meshes[0],
  g = mesh.geometry;
assert.equal(g.getAttribute('position').count, 603);
assert.equal(g.index.count, 2376);
assert.equal(g.getAttribute('uv').count, 603);
assert.equal(g.getAttribute('color').count, 603);
assert.equal(g.getAttribute('color').normalized, true);
assert.equal(g.getAttribute('normal'), undefined);
assert.equal(mesh.material.isMeshBasicMaterial, true);
assert.equal(mesh.material.transparent, true);
assert.equal(mesh.material.side, 2);
assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
assert.deepEqual(mesh.quaternion.toArray(), [0, 0, 0, 1]);
mesh.geometry.dispose();
mesh.material.dispose();
process.stdout.write(
  JSON.stringify({
    result: 'passed',
    loader: 'Three.js GLTFLoader',
    vertices: 603,
    triangles: 792,
    normalizedVertexColors: true,
    authoredUvs: true,
    normalAttribute: false,
    identityTransform: true,
  }) + '\n'
);
