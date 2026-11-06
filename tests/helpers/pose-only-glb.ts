import { Buffer } from 'node:buffer';
/** Keep the original binary, geometry, skins, nodes and animation channels;
 * remove image/material bindings so Node can sample poses without a DOM. */
export function poseOnlyGlb(input: Uint8Array): ArrayBuffer {
  const raw = Buffer.from(input);
  if (raw.readUInt32LE(0) !== 0x46546c67 || raw.readUInt32LE(4) !== 2)
    throw Error('Expected a binary glTF 2 input');
  const jsonLength = raw.readUInt32LE(12),
    document = JSON.parse(raw.subarray(20, 20 + jsonLength).toString()),
    binStart = 20 + jsonLength + 8,
    binary = raw.subarray(binStart, binStart + raw.readUInt32LE(binStart - 8));
  delete document.images;
  delete document.textures;
  delete document.materials;
  for (const mesh of document.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  const jsonBytes = Buffer.from(JSON.stringify(document)),
    padded = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20);
  jsonBytes.copy(padded);
  const glb = Buffer.alloc(28 + padded.length + binary.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + padded.length);
  glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(glb, 28 + padded.length);
  return Uint8Array.from(glb).buffer;
}
