import { readFileSync } from 'node:fs';
import { BufferGeometry, BufferAttribute } from 'three';
/** Read this converter's expanded GLB attributes without a DOM/FileReader shim. */
export function luxESlashTemplates() {
  const bytes = readFileSync('public/assets/models/lux-e-slash.glb');
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const bin = bytes.subarray(28 + jsonLength);
  const geometry = new BufferGeometry();
  for (const [semantic, index] of Object.entries(gltf.meshes[0].primitives[0].attributes)) {
    const a = gltf.accessors[index as number],
      view = gltf.bufferViews[a.bufferView];
    const size = a.type === 'VEC3' ? 3 : 2;
    const values = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++)
      for (let axis = 0; axis < size; axis++)
        values[i * size + axis] = bin.readFloatLE(
          (view.byteOffset ?? 0) +
            (a.byteOffset ?? 0) +
            i * (view.byteStride ?? size * 4) +
            axis * 4
        );
    geometry.setAttribute(
      semantic === 'POSITION' ? 'position' : 'uv',
      new BufferAttribute(values, size)
    );
  }
  return new Map([['assets/models/lux-e-slash.glb', geometry]]);
}
