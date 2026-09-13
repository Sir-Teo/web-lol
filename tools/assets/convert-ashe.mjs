// Archival reconstruction only. Runtime Ashe uses convert-ashe-base.mjs.
/**
 * Convert the pinned archived Ashe reference mesh and animation into standard GLB.
 * Format reference: tengge1/lol-model-viewer resource/js/viewer.js (MIT repository).
 * This implementation writes glTF directly; no legacy viewer code runs in the game.
 * The Riot-owned art is archival reference content, not certified 26.18 animation.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Matrix4, Vector3, Quaternion } from 'three';

const REVISION = 'ef5635c5fbe0c315275c9bcccf83558cfe7ee436';
const SOURCE = `https://raw.githubusercontent.com/tengge1/lol-model-viewer/${REVISION}/LOLModelViewer/LOLModelViewer/resource/`;
const files = ['models/22_0.lmesh', 'models/22_0.lanim', 'textures/22/ashe_base_2011_tx_cm.png'];
await mkdir('.cache/ashe', { recursive: true });
await mkdir('public/assets/models', { recursive: true });
const sources = [];
for (const path of files) {
  const local = `.cache/ashe/${path.split('/').pop()}`;
  // Always fetch the explicit immutable revision; preserve the source response hash.
  execFileSync('curl', ['-fLsS', '--max-time', '30', `${SOURCE}${path}`, '-o', local]);
  const bytes = await readFile(local);
  sources.push({
    url: `${SOURCE}${path}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  });
}
class Reader {
  offset = 0;
  constructor(buffer) {
    this.buffer = buffer;
  }
  u32() {
    const v = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }
  i32() {
    const v = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return v;
  }
  u16() {
    const v = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }
  u8() {
    return this.buffer[this.offset++];
  }
  float() {
    const v = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    if (!Number.isFinite(v)) throw new Error('Invalid float');
    return v;
  }
  floats(n) {
    return Array.from({ length: n }, () => this.float());
  }
  string() {
    const n = this.u16();
    const v = this.buffer.toString('utf8', this.offset, this.offset + n);
    this.offset += n;
    return v.toLowerCase();
  }
}
const r = new Reader(await readFile('.cache/ashe/22_0.lmesh'));
if (r.u32() !== 604210091) throw new Error('Unsupported mesh signature');
const version = r.u32(),
  animationFile = r.string(),
  textureFile = r.string();
const submeshes = Array.from({ length: r.u32() }, () => ({
  name: r.string(),
  vertexStart: r.u32(),
  vertexCount: r.u32(),
  indexStart: r.u32(),
  indexCount: r.u32(),
}));
const vertices = Array.from({ length: r.u32() }, () => ({
  position: r.floats(3),
  normal: r.floats(3),
  uv: r.floats(2),
  joints: Array.from({ length: 4 }, () => r.u8()),
  weights: r.floats(4),
}));
const indices = Array.from({ length: r.u32() }, () => r.u16());
const bones = Array.from({ length: r.u32() }, () => {
  const name = r.string(),
    parent = r.i32(),
    scale = r.float();
  const world = new Matrix4().fromArray(r.floats(16)).transpose();
  const incremental =
    version >= 2 ? new Matrix4().fromArray(r.floats(16)).transpose() : new Matrix4();
  return { name, parent, scale, world, incremental };
});
// Bake source handedness and centimeters into every geometry and skeletal space.
const basis = new Matrix4().makeScale(-0.01, 0.01, 0.01),
  inverseBasis = basis.clone().invert();
for (const bone of bones) bone.world.premultiply(basis).multiply(inverseBasis);
const position = (p) => [-p[0] * 0.01, p[1] * 0.01, p[2] * 0.01];
if (r.offset !== r.buffer.length)
  throw new Error(`Unexpected mesh trailer at ${r.offset}/${r.buffer.length}`);
let ar = new Reader(await readFile('.cache/ashe/22_0.lanim'));
if (ar.u32() !== 604210092) throw new Error('Unsupported animation signature');
const animVersion = ar.u32();
if (animVersion >= 2) ar = new Reader(inflateSync(ar.buffer.subarray(ar.offset)));
const animations = Array.from({ length: ar.u32() }, () => {
  const name = ar.string(),
    fps = ar.i32();
  const tracks = Array.from({ length: ar.u32() }, () => {
    const frames = ar.u32(),
      bone = ar.string(),
      flags = ar.u32();
    return {
      bone,
      flags,
      frames: Array.from({ length: frames }, () => ({
        position: ar.floats(3),
        rotation: ar.floats(4),
        scale: animVersion >= 3 ? ar.floats(3) : [1, 1, 1],
      })),
    };
  });
  return { name, fps, tracks };
});
const gltf = {
  asset: {
    version: '2.0',
    generator: 'web-lol reference converter 0.1',
    copyright: 'Character artwork and animation © Riot Games. Archival reference.',
  },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Ashe_reference_skeleton', children: [] }],
  buffers: [{ byteLength: 0 }],
  bufferViews: [],
  accessors: [],
  meshes: [],
  skins: [],
  animations: [],
  materials: [
    {
      name: 'Painted character',
      doubleSided: true,
      alphaMode: 'MASK',
      alphaCutoff: 0.4,
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      extensions: { KHR_materials_unlit: {} },
    },
  ],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  images: [],
  extensionsUsed: ['KHR_materials_unlit'],
};
const chunks = [];
let offset = 0;
function bufferView(bytes) {
  const padding = (4 - (offset % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    offset += padding;
  }
  const view = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  chunks.push(bytes);
  offset += bytes.length;
  return view;
}
function accessor(values, type, componentType = 5126, bounds = false) {
  const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
  const array = componentType === 5126 ? new Float32Array(values) : new Uint16Array(values);
  const result = {
    bufferView: bufferView(Buffer.from(array.buffer)),
    componentType,
    count: values.length / dimensions,
    type,
  };
  if (bounds) {
    result.min = Array.from({ length: dimensions }, (_, d) =>
      Math.min(...values.filter((_, i) => i % dimensions === d))
    );
    result.max = Array.from({ length: dimensions }, (_, d) =>
      Math.max(...values.filter((_, i) => i % dimensions === d))
    );
  }
  gltf.accessors.push(result);
  return gltf.accessors.length - 1;
}
const attributes = {
  POSITION: accessor(
    vertices.flatMap((v) => position(v.position)),
    'VEC3',
    5126,
    true
  ),
  NORMAL: accessor(
    vertices.flatMap((v) =>
      new Vector3(-v.normal[0], v.normal[1], v.normal[2]).normalize().toArray()
    ),
    'VEC3'
  ),
  TEXCOORD_0: accessor(
    vertices.flatMap((v) => v.uv),
    'VEC2'
  ),
  JOINTS_0: accessor(
    vertices.flatMap((v) => v.joints.map((joint, i) => (v.weights[i] === 0 ? 0 : joint))),
    'VEC4',
    5123
  ),
  WEIGHTS_0: accessor(
    vertices.flatMap((v) => {
      const total = v.weights.reduce((a, b) => a + b, 0);
      if (total <= 0) throw new Error('Unweighted vertex');
      return v.weights.map((w) => w / total);
    }),
    'VEC4'
  ),
};
for (const [i, bone] of bones.entries()) {
  const local =
    bone.parent < 0
      ? bone.world.clone()
      : bones[bone.parent].world.clone().invert().multiply(bone.world);
  const p = new Vector3(),
    q = new Quaternion(),
    s = new Vector3();
  local.decompose(p, q, s);
  gltf.nodes.push({
    name: bone.name,
    translation: p.toArray(),
    rotation: q.toArray(),
    scale: s.toArray(),
    children: [],
  });
  if (bone.parent < 0) gltf.nodes[0].children.push(i + 1);
}
bones.forEach((b, i) => {
  if (b.parent >= 0) gltf.nodes[b.parent + 1].children.push(i + 1);
});
gltf.skins.push({
  joints: bones.map((_, i) => i + 1),
  inverseBindMatrices: accessor(
    bones.flatMap((b) => b.world.clone().invert().toArray()),
    'MAT4'
  ),
});
for (let i = 0; i < indices.length; i += 3)
  [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
gltf.meshes.push({
  name: 'Ashe',
  primitives: submeshes.map((m) => ({
    attributes,
    indices: accessor(indices.slice(m.indexStart, m.indexStart + m.indexCount), 'SCALAR', 5123),
    material: 0,
  })),
});
gltf.scenes[0].nodes.push(gltf.nodes.length);
gltf.nodes.push({ name: 'AsheMesh', mesh: 0, skin: 0 });
for (const index of Object.values(attributes))
  gltf.bufferViews[gltf.accessors[index].bufferView].target = 34962;
for (const primitive of gltf.meshes[0].primitives)
  gltf.bufferViews[gltf.accessors[primitive.indices].bufferView].target = 34963;
const keep = new Set([
  'idle1',
  'run',
  'run_walk',
  'run_jog',
  'attack1',
  'attack2',
  'spell1',
  'spell2',
  'spell3',
  'death',
  'channel',
  'channel_windup',
]);
for (const animation of animations) {
  const name = animation.name.replace(/^ashe_/, '');
  if (!keep.has(name) || animation.fps <= 1) continue;
  const result = { name, samplers: [], channels: [] };
  for (const track of animation.tracks) {
    const boneIndex = bones.findIndex((b) => b.name === track.bone);
    if (boneIndex < 0 || !track.frames.length) continue;
    const times = track.frames.map((_, i) => i / animation.fps);
    const input = accessor(times, 'SCALAR', 5126, true);
    for (const [field, path, type] of [
      ['position', 'translation', 'VEC3'],
      ['rotation', 'rotation', 'VEC4'],
      ['scale', 'scale', 'VEC3'],
    ]) {
      const output = accessor(
        track.frames.flatMap((f) =>
          field === 'position'
            ? position(f.position)
            : field === 'rotation'
              ? new Quaternion(f.rotation[0], -f.rotation[1], -f.rotation[2], f.rotation[3])
                  .normalize()
                  .toArray()
              : f.scale
        ),
        type
      );
      const sampler = result.samplers.length;
      result.samplers.push({ input, output, interpolation: 'LINEAR' });
      result.channels.push({ sampler, target: { node: boneIndex + 1, path } });
    }
  }
  gltf.animations.push(result);
}
const texture = await readFile('.cache/ashe/ashe_base_2011_tx_cm.png');
gltf.images.push({ bufferView: bufferView(texture), mimeType: 'image/png' });
for (const node of gltf.nodes) if (node.children?.length === 0) delete node.children;
gltf.buffers[0].byteLength = offset;
let binary = Buffer.concat(chunks);
binary = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)]);
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(json.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(binary.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jh, json, bh, binary]);
await writeFile('public/assets/models/ashe-reference.glb', output);
const manifest = {
  status:
    'Archival reference art. Not certified against patch 26.18. Redistribution permission not established.',
  repositoryRevision: REVISION,
  sources,
  output: {
    path: '/assets/models/ashe-reference.glb',
    sha256: createHash('sha256').update(output).digest('hex'),
    bytes: output.length,
  },
  meshVersion: version,
  animationVersion: animVersion,
  animationFile,
  textureFile,
  vertices: vertices.length,
  triangles: indices.length / 3,
  bones: bones.length,
  clips: gltf.animations.map((a) => a.name),
};
await writeFile(
  'public/assets/models/ashe-reference.json',
  JSON.stringify(manifest, null, 2) + '\n'
);
console.log(JSON.stringify(manifest, null, 2));
