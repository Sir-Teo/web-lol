/**
 * Deterministic offline generator for Milestone 6 skeletal GLB 2.0 rigs, sidecar manifests,
 * and 64x64 PNG icons (champions, abilities, items, trinkets, runes, and epic objectives).
 *
 * Asset provenance is explicitly recorded as `authored-local-milestone6` for the Reference
 * Coverage Ledger while external Riot CDNs are offline.
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function quatFromEulerXYZ(rx, ry, rz) {
  const cx = Math.cos(rx * 0.5),
    sx = Math.sin(rx * 0.5);
  const cy = Math.cos(ry * 0.5),
    sy = Math.sin(ry * 0.5);
  const cz = Math.cos(rz * 0.5),
    sz = Math.sin(rz * 0.5);
  const x = sx * cy * cz + cx * sy * sz;
  const y = cx * sy * cz - sx * cy * sz;
  const z = cx * cy * sz + sx * sy * cz;
  const w = cx * cy * cz - sx * sy * sz;
  const len = Math.hypot(x, y, z, w) || 1;
  return [x / len, y / len, z / len, w / len];
}

function translationInverseMatrix(tx, ty, tz) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -tx, -ty, -tz, 1]);
}

class MeshBuilder {
  positions = [];
  normals = [];
  joints = [];
  weights = [];
  indices = [];

  addVertex(px, py, pz, nx, ny, nz, boneIndex) {
    const idx = this.positions.length / 3;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    this.positions.push(px, py, pz);
    this.normals.push(nx / nLen, ny / nLen, nz / nLen);
    this.joints.push(boneIndex, 0, 0, 0);
    this.weights.push(1, 0, 0, 0);
    return idx;
  }

  addQuad(v0, v1, v2, v3, boneIndex) {
    const ux = v1[0] - v0[0],
      uy = v1[1] - v0[1],
      uz = v1[2] - v0[2];
    const vx = v2[0] - v0[0],
      vy = v2[1] - v0[1],
      vz = v2[2] - v0[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const i0 = this.addVertex(v0[0], v0[1], v0[2], nx, ny, nz, boneIndex);
    const i1 = this.addVertex(v1[0], v1[1], v1[2], nx, ny, nz, boneIndex);
    const i2 = this.addVertex(v2[0], v2[1], v2[2], nx, ny, nz, boneIndex);
    const i3 = this.addVertex(v3[0], v3[1], v3[2], nx, ny, nz, boneIndex);
    this.indices.push(i0, i1, i2, i0, i2, i3);
  }

  addBox(cx, cy, cz, sx, sy, sz, boneIndex) {
    const hx = sx * 0.5,
      hy = sy * 0.5,
      hz = sz * 0.5;
    const x0 = cx - hx,
      x1 = cx + hx;
    const y0 = cy - hy,
      y1 = cy + hy;
    const z0 = cz - hz,
      z1 = cz + hz;
    this.addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], boneIndex);
    this.addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], boneIndex);
    this.addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], boneIndex);
    this.addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], boneIndex);
    this.addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], boneIndex);
    this.addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], boneIndex);
  }

  addPrismY(cx, y0, y1, cz, rBottom, rTop, sides, boneIndex, scaleZ = 1) {
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      const c0 = Math.cos(a0),
        sn0 = Math.sin(a0);
      const c1 = Math.cos(a1),
        sn1 = Math.sin(a1);
      const b0 = [cx + c0 * rBottom, y0, cz + sn0 * rBottom * scaleZ];
      const b1 = [cx + c1 * rBottom, y0, cz + sn1 * rBottom * scaleZ];
      const t1 = [cx + c1 * rTop, y1, cz + sn1 * rTop * scaleZ];
      const t0 = [cx + c0 * rTop, y1, cz + sn0 * rTop * scaleZ];
      if (rTop > 1e-4 && rBottom > 1e-4) {
        this.addQuad(b0, t0, t1, b1, boneIndex);
      } else if (rTop <= 1e-4) {
        const apex = [cx, y1, cz];
        const ux = apex[0] - b0[0],
          uy = apex[1] - b0[1],
          uz = apex[2] - b0[2];
        const vx = b1[0] - b0[0],
          vy = b1[1] - b0[1],
          vz = b1[2] - b0[2];
        const nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        const i0 = this.addVertex(b0[0], b0[1], b0[2], nx, ny, nz, boneIndex);
        const i1 = this.addVertex(apex[0], apex[1], apex[2], nx, ny, nz, boneIndex);
        const i2 = this.addVertex(b1[0], b1[1], b1[2], nx, ny, nz, boneIndex);
        this.indices.push(i0, i1, i2);
      }
      if (rBottom > 1e-4) {
        const cb = this.addVertex(cx, y0, cz, 0, -1, 0, boneIndex);
        const p0 = this.addVertex(b0[0], b0[1], b0[2], 0, -1, 0, boneIndex);
        const p1 = this.addVertex(b1[0], b1[1], b1[2], 0, -1, 0, boneIndex);
        this.indices.push(cb, p0, p1);
      }
      if (rTop > 1e-4) {
        const ct = this.addVertex(cx, y1, cz, 0, 1, 0, boneIndex);
        const q0 = this.addVertex(t0[0], t0[1], t0[2], 0, 1, 0, boneIndex);
        const q1 = this.addVertex(t1[0], t1[1], t1[2], 0, 1, 0, boneIndex);
        this.indices.push(ct, q1, q0);
      }
    }
  }
}

function buildPrimitive(doc, buffer, mat, builder) {
  const pos = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('VEC3')
    .setArray(new Float32Array(builder.positions));
  const norm = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('VEC3')
    .setArray(new Float32Array(builder.normals));
  const jnt = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('VEC4')
    .setArray(new Uint16Array(builder.joints));
  const wgt = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('VEC4')
    .setArray(new Float32Array(builder.weights));
  const idx = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('SCALAR')
    .setArray(new Uint16Array(builder.indices));
  return doc
    .createPrimitive()
    .setMaterial(mat)
    .setAttribute('POSITION', pos)
    .setAttribute('NORMAL', norm)
    .setAttribute('JOINTS_0', jnt)
    .setAttribute('WEIGHTS_0', wgt)
    .setIndices(idx);
}

function addRotChannel(doc, buffer, anim, node, times, eulers) {
  const input = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('SCALAR')
    .setArray(new Float32Array(times));
  const values = new Float32Array(eulers.flatMap(([rx, ry, rz]) => quatFromEulerXYZ(rx, ry, rz)));
  const output = doc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(values);
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation('LINEAR');
  const channel = doc
    .createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath('rotation')
    .setSampler(sampler);
  anim.addSampler(sampler).addChannel(channel);
}

function addTransChannel(doc, buffer, anim, node, times, offsets, basePos) {
  const input = doc
    .createAccessor()
    .setBuffer(buffer)
    .setType('SCALAR')
    .setArray(new Float32Array(times));
  const values = new Float32Array(
    offsets.flatMap(([dx, dy, dz]) => [basePos[0] + dx, basePos[1] + dy, basePos[2] + dz])
  );
  const output = doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(values);
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation('LINEAR');
  const channel = doc
    .createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath('translation')
    .setSampler(sampler);
  anim.addSampler(sampler).addChannel(channel);
}

async function writeRig(io, name, spec) {
  const doc = new Document();
  const buffer = doc.createBuffer('main');
  const scene = doc.createScene(name);

  const bones = [];
  const worldRest = [];
  for (const b of spec.bones) {
    const node = doc.createNode(b.name).setTranslation(b.local);
    if (b.parent === null) {
      scene.addChild(node);
      worldRest.push([...b.local]);
    } else {
      bones[b.parent].addChild(node);
      const pw = worldRest[b.parent];
      worldRest.push([pw[0] + b.local[0], pw[1] + b.local[1], pw[2] + b.local[2]]);
    }
    bones.push(node);
  }

  const ibmFloats = new Float32Array(bones.length * 16);
  for (let i = 0; i < bones.length; i++) {
    const [wx, wy, wz] = worldRest[i];
    ibmFloats.set(translationInverseMatrix(wx, wy, wz), i * 16);
  }
  const ibmAccessor = doc.createAccessor().setBuffer(buffer).setType('MAT4').setArray(ibmFloats);
  const skin = doc
    .createSkin(`${name}-skin`)
    .setSkeleton(bones[0])
    .setInverseBindMatrices(ibmAccessor);
  for (const bone of bones) skin.addJoint(bone);

  const mesh = doc.createMesh(`${name}-mesh`);
  let totalTriangles = 0;
  for (const part of spec.parts) {
    const mat = doc
      .createMaterial(part.name)
      .setBaseColorFactor(part.color)
      .setMetallicFactor(part.metallic ?? 0.25)
      .setRoughnessFactor(part.roughness ?? 0.65);
    if (part.emissive) mat.setEmissiveFactor(part.emissive);
    const builder = new MeshBuilder();
    part.build(builder);
    totalTriangles += builder.indices.length / 3;
    mesh.addPrimitive(buildPrimitive(doc, buffer, mat, builder));
  }

  const meshNode = doc.createNode(`${name}-skinned`).setMesh(mesh).setSkin(skin);
  scene.addChild(meshNode);

  const clipMeta = [];
  for (const clip of spec.clips) {
    const anim = doc.createAnimation(clip.name);
    clip.build(doc, buffer, anim, bones, spec.bones);
    clipMeta.push({ name: clip.name, durationSeconds: clip.duration });
  }

  const glbBytes = await io.writeBinary(doc);
  const glbPath = `public/assets/models/${name}.glb`;
  writeFileSync(glbPath, glbBytes);
  const sidecar = {
    referenceVersion: '26.18-authored-milestone6',
    provenance: 'authored-local-milestone6',
    status:
      'Authored skeletal GLB 2.0 rig and atomic animations for Milestone 6 offline compatibility; native Riot WAD skin/pose calibration documented as a deviation.',
    output: {
      path: `/assets/models/${name}.glb`,
      bytes: glbBytes.length,
      sha256: sha256(glbBytes),
    },
    triangles: totalTriangles,
    clips: clipMeta,
  };
  writeFileSync(`public/assets/models/${name}.json`, JSON.stringify(sidecar, null, 2) + '\n');
  return { name, bytes: glbBytes.length, triangles: totalTriangles, clips: clipMeta };
}

function humanoidClips() {
  return [
    {
      name: 'idle1',
      duration: 2.0,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 1.0, 2.0],
          [
            [0, 0, 0],
            [0, 0.04, 0],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 1.0, 2.0],
          [
            [0, 0, 0],
            [0.03, 0.04, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 1.0, 2.0],
          [
            [0.08, 0, 0.06],
            [0.14, 0, 0.1],
            [0.08, 0, 0.06],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 1.0, 2.0],
          [
            [0.08, 0, -0.06],
            [0.14, 0, -0.1],
            [0.08, 0, -0.06],
          ]
        );
      },
    },
    {
      name: 'run',
      duration: 0.8,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.2, 0.4, 0.6, 0.8],
          [
            [0, 0, 0],
            [0, 0.07, 0.02],
            [0, 0, 0],
            [0, 0.07, 0.02],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.4, 0.8],
          [
            [0.18, 0.08, 0],
            [0.18, -0.08, 0],
            [0.18, 0.08, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.4, 0.8],
          [
            [-0.55, 0, 0.1],
            [0.55, 0, 0.1],
            [-0.55, 0, 0.1],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.4, 0.8],
          [
            [0.55, 0, -0.1],
            [-0.55, 0, -0.1],
            [0.55, 0, -0.1],
          ]
        );
      },
    },
    {
      name: 'attack1',
      duration: 1.0,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.28, 0.45, 1.0],
          [
            [0, 0, 0],
            [-0.15, -0.35, 0],
            [0.22, 0.42, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.28, 0.45, 1.0],
          [
            [0.1, 0, -0.1],
            [-0.85, -0.3, -0.25],
            [0.95, 0.25, -0.05],
            [0.1, 0, -0.1],
          ]
        );
      },
    },
    {
      name: 'attack2',
      duration: 1.0,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.28, 0.45, 1.0],
          [
            [0, 0, 0],
            [-0.12, 0.35, 0],
            [0.22, -0.4, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.28, 0.45, 1.0],
          [
            [0.1, 0, 0.1],
            [-0.8, 0.28, 0.25],
            [0.9, -0.2, 0.05],
            [0.1, 0, 0.1],
          ]
        );
      },
    },
    {
      name: 'crit',
      duration: 1.0,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.25, 0.42, 1.0],
          [
            [0, 0, 0],
            [-0.3, -0.45, 0],
            [0.35, 0.55, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.25, 0.42, 1.0],
          [
            [0, 0, 0],
            [-1.2, -0.2, -0.2],
            [1.15, 0.2, 0],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'spell1',
      duration: 0.9,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.35, 0.7, 0.9],
          [
            [0, 0, 0],
            [0.18, 0.65, 0],
            [0.1, -0.55, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.35, 0.9],
          [
            [0, 0, 0],
            [-0.95, 0.2, 0.3],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.35, 0.9],
          [
            [0, 0, 0],
            [-0.95, -0.2, -0.3],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'spell2',
      duration: 0.85,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.3, 0.85],
          [
            [0, 0, 0],
            [0.25, 0, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.3, 0.85],
          [
            [0, 0, 0],
            [-1.1, 0.15, 0],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'spell3',
      duration: 0.85,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.25, 0.55, 0.85],
          [
            [0, 0, 0],
            [-0.2, 0, 0],
            [0.35, 0, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.3, 0.85],
          [
            [0, 0, 0],
            [-0.85, 0.4, 0.4],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'spell4',
      duration: 1.2,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.4, 0.7, 1.2],
          [
            [0, 0, 0],
            [0, 0.35, 0],
            [0, -0.05, 0.08],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.4, 0.7, 1.2],
          [
            [0, 0, 0],
            [-0.35, 0, 0],
            [0.45, 0, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.4, 0.7, 1.2],
          [
            [0, 0, 0],
            [-1.35, 0, 0.3],
            [0.7, 0, 0.1],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.4, 0.7, 1.2],
          [
            [0, 0, 0],
            [-1.35, 0, -0.3],
            [0.7, 0, -0.1],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'channel',
      duration: 1.2,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.6, 1.2],
          [
            [-0.9, 0.2, 0.3],
            [-1.1, 0.25, 0.35],
            [-0.9, 0.2, 0.3],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[5],
          [0, 0.6, 1.2],
          [
            [-0.9, -0.2, -0.3],
            [-1.1, -0.25, -0.35],
            [-0.9, -0.2, -0.3],
          ]
        );
      },
    },
    {
      name: 'death',
      duration: 1.8,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.7, 1.8],
          [
            [0, 0, 0],
            [0, -0.65, -0.2],
            [0, -0.78, -0.28],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.7, 1.8],
          [
            [0, 0, 0],
            [-1.42, 0.1, 0],
            [-1.52, 0.12, 0],
          ]
        );
      },
    },
  ];
}

const HUMANOID_BONES = [
  { name: 'Root', parent: null, local: [0, 0, 0] },
  { name: 'Pelvis', parent: 0, local: [0, 0.9, 0] },
  { name: 'Torso', parent: 1, local: [0, 0.35, 0] },
  { name: 'Head', parent: 2, local: [0, 0.52, 0] },
  { name: 'ArmL', parent: 2, local: [-0.42, 0.32, 0] },
  { name: 'ArmR', parent: 2, local: [0.42, 0.32, 0] },
];

function monsterClips() {
  return [
    {
      name: 'spawn',
      duration: 1.2,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.7, 1.2],
          [
            [0, -1.2, 0],
            [0, 0.2, 0],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.6, 1.2],
          [
            [-0.4, 0, 0],
            [0.2, 0, 0],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'idle1',
      duration: 2.2,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 1.1, 2.2],
          [
            [0, 0, 0],
            [0, 0.12, 0],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[3],
          [0, 1.1, 2.2],
          [
            [0, 0, 0.12],
            [0, 0, -0.18],
            [0, 0, 0.12],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 1.1, 2.2],
          [
            [0, 0, -0.12],
            [0, 0, 0.18],
            [0, 0, -0.12],
          ]
        );
      },
    },
    {
      name: 'run',
      duration: 1.0,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.5, 1.0],
          [
            [0, 0, 0],
            [0, 0.18, 0.05],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[3],
          [0, 0.5, 1.0],
          [
            [0.2, 0, 0.35],
            [-0.2, 0, -0.25],
            [0.2, 0, 0.35],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[4],
          [0, 0.5, 1.0],
          [
            [0.2, 0, -0.35],
            [-0.2, 0, 0.25],
            [0.2, 0, -0.35],
          ]
        );
      },
    },
    {
      name: 'attack1',
      duration: 1.1,
      build(doc, buf, anim, bones) {
        addRotChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.35, 0.55, 1.1],
          [
            [0, 0, 0],
            [-0.22, 0, 0],
            [0.32, 0, 0],
            [0, 0, 0],
          ]
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[2],
          [0, 0.35, 0.55, 1.1],
          [
            [0, 0, 0],
            [-0.35, 0, 0],
            [0.5, 0, 0],
            [0, 0, 0],
          ]
        );
      },
    },
    {
      name: 'death',
      duration: 2.0,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.9, 2.0],
          [
            [0, 0, 0],
            [0, -0.85, -0.15],
            [0, -1.05, -0.25],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.9, 2.0],
          [
            [0, 0, 0],
            [0.35, 0, 1.25],
            [0.45, 0, 1.45],
          ]
        );
      },
    },
  ];
}

// --- Pure Node PNG Icon Generator (64x64 RGBA) ---
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tag = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([len, tag, data, crc]);
}

function encodePng64(drawPixel) {
  const w = 64,
    h = 64;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = drawPixel(x, y, w, h);
      const off = row + 1 + x * 4;
      raw[off] = Math.max(0, Math.min(255, Math.round(r)));
      raw[off + 1] = Math.max(0, Math.min(255, Math.round(g)));
      raw[off + 2] = Math.max(0, Math.min(255, Math.round(b)));
      raw[off + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(bgA, bgB, accent, secondary, shape) {
  return encodePng64((x, y, w, h) => {
    const u = (x + 0.5) / w,
      v = (y + 0.5) / h;
    const dx = u - 0.5,
      dy = v - 0.5;
    const dist = Math.hypot(dx, dy);
    const border = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (border < 2) return [196, 162, 92, 255];
    if (border === 2) return [36, 30, 22, 255];

    const t = Math.min(1, dist * 1.45);
    let r = bgA[0] * (1 - t) + bgB[0] * t;
    let g = bgA[1] * (1 - t) + bgB[1] * t;
    let b = bgA[2] * (1 - t) + bgB[2] * t;

    let glyph = 0;
    let sub = 0;
    if (shape === 'axe') {
      const blade = Math.abs(Math.hypot(dx - 0.04, dy + 0.02) - 0.24) < 0.08 && Math.abs(dy) < 0.25;
      const shaft = Math.abs(dx + dy * 0.45) < 0.038 && Math.abs(dy) < 0.34;
      glyph = blade ? 1 : 0;
      sub = shaft ? 1 : 0;
    } else if (shape === 'fist') {
      const palm = Math.abs(dx) < 0.19 && Math.abs(dy - 0.02) < 0.17;
      const knuckles = Math.abs(dy + 0.16) < 0.06 && Math.abs(dx) < 0.21;
      const core = Math.hypot(dx, dy - 0.03) < 0.08;
      glyph = palm || knuckles ? 1 : 0;
      sub = core ? 1 : 0;
    } else if (shape === 'arc') {
      const ring = Math.abs(Math.hypot(dx + 0.05, dy) - 0.24) < 0.055 && dx > -0.08;
      const bolt = Math.abs(dy - dx * 0.35) < 0.038 && dx > -0.25 && dx < 0.28;
      glyph = ring || bolt ? 1 : 0;
      sub = Math.hypot(dx + 0.12, dy) < 0.07 ? 1 : 0;
    } else if (shape === 'wings') {
      const wing =
        Math.abs(Math.abs(dx) - 0.18 - dy * 0.25) < 0.065 &&
        Math.abs(dy) < 0.28 &&
        Math.abs(dx) > 0.05;
      const orb = Math.hypot(dx, dy) < 0.095;
      glyph = wing ? 1 : 0;
      sub = orb ? 1 : 0;
    } else if (shape === 'shield') {
      const inShield = Math.abs(dx) < 0.24 * (1 - Math.max(0, dy) * 1.1) && dy > -0.26 && dy < 0.3;
      const rim =
        inShield && (Math.abs(Math.abs(dx) - 0.2 * (1 - Math.max(0, dy))) < 0.04 || dy < -0.2);
      glyph = inShield ? 0.75 : 0;
      sub = rim ? 1 : 0;
    } else if (shape === 'eye') {
      const almond = Math.abs(dy) < 0.16 * (1 - (dx / 0.3) ** 2) && Math.abs(dx) < 0.3;
      const pupil = Math.hypot(dx, dy) < 0.085;
      glyph = almond ? 1 : 0;
      sub = pupil ? 1 : 0;
    } else if (shape === 'sword') {
      const d1 = (dx + dy) * 0.7071,
        d2 = (dx - dy) * 0.7071;
      const blade = Math.abs(d2) < 0.045 && d1 > -0.28 && d1 < 0.26;
      const guard = Math.abs(d1 - 0.12) < 0.035 && Math.abs(d2) < 0.15;
      glyph = blade ? 1 : 0;
      sub = guard ? 1 : 0;
    } else if (shape === 'boot') {
      const leg = dx > -0.14 && dx < 0.04 && dy > -0.25 && dy < 0.18;
      const sole = dx > -0.14 && dx < 0.24 && dy >= 0.06 && dy < 0.22;
      glyph = leg || sole ? 1 : 0;
      sub = dy >= 0.17 && dy < 0.22 && dx > -0.14 && dx < 0.24 ? 1 : 0;
    } else if (shape === 'star') {
      const ang = Math.atan2(dy, dx);
      const starR = 0.18 + 0.09 * Math.cos(ang * 5);
      glyph = dist < starR ? 1 : 0;
      sub = dist < 0.08 ? 1 : 0;
    } else {
      const diamond = Math.abs(dx) + Math.abs(dy) < 0.28;
      glyph = diamond ? 1 : 0;
      sub = Math.abs(dx) + Math.abs(dy) < 0.12 ? 1 : 0;
    }

    if (glyph > 0) {
      r = r * (1 - glyph) + accent[0] * glyph;
      g = g * (1 - glyph) + accent[1] * glyph;
      b = b * (1 - glyph) + accent[2] * glyph;
    }
    if (sub > 0) {
      r = r * (1 - sub) + secondary[0] * sub;
      g = g * (1 - sub) + secondary[1] * sub;
      b = b * (1 - sub) + secondary[2] * sub;
    }
    return [r, g, b, 255];
  });
}

async function main() {
  const io = new NodeIO();

  // 1. Champion Rigs (height ~2.0-2.35 GLB units, +Z forward)
  await writeRig(io, 'darius-base', {
    bones: HUMANOID_BONES,
    parts: [
      {
        name: 'darius-armor',
        color: [0.22, 0.2, 0.23, 1],
        metallic: 0.65,
        roughness: 0.4,
        build(b) {
          b.addBox(-0.16, 0.45, 0, 0.22, 0.9, 0.24, 1);
          b.addBox(0.16, 0.45, 0, 0.22, 0.9, 0.24, 1);
          b.addPrismY(0, 0.88, 1.62, 0, 0.28, 0.38, 8, 2, 0.78);
          b.addBox(-0.46, 1.56, 0, 0.34, 0.24, 0.36, 4);
          b.addBox(0.46, 1.56, 0, 0.34, 0.24, 0.36, 5);
          b.addBox(-0.46, 1.2, 0.04, 0.18, 0.52, 0.18, 4);
          b.addBox(0.46, 1.2, 0.04, 0.18, 0.52, 0.18, 5);
        },
      },
      {
        name: 'darius-crimson',
        color: [0.68, 0.12, 0.14, 1],
        metallic: 0.2,
        roughness: 0.7,
        build(b) {
          b.addBox(0, 1.05, -0.22, 0.62, 1.05, 0.06, 2);
          b.addPrismY(0, 1.64, 1.98, 0.02, 0.16, 0.14, 8, 3);
        },
      },
      {
        name: 'darius-axe',
        color: [0.76, 0.78, 0.82, 1],
        metallic: 0.85,
        roughness: 0.25,
        build(b) {
          b.addBox(0.52, 1.15, 0.42, 0.06, 0.06, 1.45, 5);
          b.addBox(0.52, 1.15, 0.95, 0.05, 0.68, 0.38, 5);
        },
      },
    ],
    clips: humanoidClips(),
  });

  await writeRig(io, 'vi-base', {
    bones: HUMANOID_BONES,
    parts: [
      {
        name: 'vi-suit',
        color: [0.25, 0.18, 0.28, 1],
        metallic: 0.35,
        roughness: 0.55,
        build(b) {
          b.addBox(-0.14, 0.44, 0, 0.18, 0.88, 0.2, 1);
          b.addBox(0.14, 0.44, 0, 0.18, 0.88, 0.2, 1);
          b.addPrismY(0, 0.88, 1.56, 0, 0.22, 0.28, 8, 2, 0.75);
        },
      },
      {
        name: 'vi-hair-trim',
        color: [0.88, 0.24, 0.48, 1],
        metallic: 0.15,
        roughness: 0.65,
        build(b) {
          b.addPrismY(0, 1.58, 1.95, 0.02, 0.15, 0.12, 8, 3);
          b.addBox(0, 1.96, -0.02, 0.22, 0.18, 0.28, 3);
        },
      },
      {
        name: 'vi-gauntlets',
        color: [0.82, 0.58, 0.22, 1],
        metallic: 0.8,
        roughness: 0.3,
        emissive: [0.06, 0.22, 0.32],
        build(b) {
          b.addBox(-0.52, 1.12, 0.22, 0.36, 0.38, 0.52, 4);
          b.addBox(0.52, 1.12, 0.22, 0.36, 0.38, 0.52, 5);
        },
      },
    ],
    clips: humanoidClips(),
  });

  await writeRig(io, 'ezreal-base', {
    bones: HUMANOID_BONES,
    parts: [
      {
        name: 'ezreal-jacket',
        color: [0.14, 0.32, 0.68, 1],
        metallic: 0.25,
        roughness: 0.6,
        build(b) {
          b.addBox(-0.13, 0.44, 0, 0.17, 0.88, 0.18, 1);
          b.addBox(0.13, 0.44, 0, 0.17, 0.88, 0.18, 1);
          b.addPrismY(0, 0.86, 1.54, 0, 0.21, 0.26, 8, 2, 0.74);
          b.addBox(0.38, 1.24, 0.04, 0.14, 0.48, 0.15, 5);
        },
      },
      {
        name: 'ezreal-gold-hair',
        color: [0.92, 0.76, 0.28, 1],
        metallic: 0.45,
        roughness: 0.45,
        build(b) {
          b.addPrismY(0, 1.56, 1.92, 0.02, 0.15, 0.13, 8, 3);
          b.addBox(0, 1.93, 0.03, 0.26, 0.14, 0.26, 3);
        },
      },
      {
        name: 'ezreal-gauntlet',
        color: [0.32, 0.84, 0.98, 1],
        metallic: 0.6,
        roughness: 0.2,
        emissive: [0.14, 0.48, 0.68],
        build(b) {
          b.addBox(-0.42, 1.18, 0.2, 0.24, 0.24, 0.42, 4);
        },
      },
    ],
    clips: humanoidClips(),
  });

  await writeRig(io, 'morgana-base', {
    bones: HUMANOID_BONES,
    parts: [
      {
        name: 'morgana-gown',
        color: [0.24, 0.11, 0.36, 1],
        metallic: 0.2,
        roughness: 0.68,
        build(b) {
          b.addPrismY(0, 0.02, 1.05, -0.04, 0.56, 0.24, 10, 1, 1.08);
          b.addPrismY(0, 1.02, 1.58, 0, 0.22, 0.25, 8, 2, 0.78);
          b.addBox(-0.36, 1.26, 0.06, 0.14, 0.46, 0.14, 4);
          b.addBox(0.36, 1.26, 0.06, 0.14, 0.46, 0.14, 5);
        },
      },
      {
        name: 'morgana-wings',
        color: [0.52, 0.22, 0.78, 1],
        metallic: 0.35,
        roughness: 0.45,
        emissive: [0.14, 0.05, 0.24],
        build(b) {
          b.addPrismY(0, 1.6, 1.95, 0.02, 0.15, 0.13, 8, 3);
          b.addBox(-0.62, 1.28, -0.22, 0.68, 0.72, 0.07, 2);
          b.addBox(0.62, 1.28, -0.22, 0.68, 0.72, 0.07, 2);
          b.addBox(-0.52, 0.72, -0.26, 0.52, 0.52, 0.06, 2);
          b.addBox(0.52, 0.72, -0.26, 0.52, 0.52, 0.06, 2);
        },
      },
    ],
    clips: humanoidClips(),
  });

  // 2. Epic Objective Monster Rigs
  const monsterBones = [
    { name: 'Root', parent: null, local: [0, 0, 0] },
    { name: 'Body', parent: 0, local: [0, 1.3, 0] },
    { name: 'Head', parent: 1, local: [0, 0.8, 1.1] },
    { name: 'WingL', parent: 1, local: [-0.9, 0.4, 0] },
    { name: 'WingR', parent: 1, local: [0.9, 0.4, 0] },
  ];

  await writeRig(io, 'sru-dragon-base', {
    bones: monsterBones,
    parts: [
      {
        name: 'dragon-scales',
        color: [0.78, 0.28, 0.14, 1],
        metallic: 0.35,
        roughness: 0.5,
        emissive: [0.16, 0.04, 0.01],
        build(b) {
          b.addPrismY(0, 0.65, 2.15, 0, 0.85, 0.62, 8, 1, 1.45);
          b.addBox(0, 2.25, 1.15, 0.62, 0.58, 0.95, 2);
          b.addBox(0, 1.1, -1.45, 0.36, 0.36, 1.5, 1);
          b.addBox(-1.65, 1.95, -0.1, 1.55, 0.1, 1.35, 3);
          b.addBox(1.65, 1.95, -0.1, 1.55, 0.1, 1.35, 4);
        },
      },
    ],
    clips: monsterClips(),
  });

  await writeRig(io, 'sru-elder-dragon-base', {
    bones: monsterBones,
    parts: [
      {
        name: 'elder-scales',
        color: [0.88, 0.86, 0.94, 1],
        metallic: 0.55,
        roughness: 0.35,
        emissive: [0.16, 0.24, 0.36],
        build(b) {
          b.addPrismY(0, 0.7, 2.65, 0, 1.08, 0.78, 10, 1, 1.55);
          b.addBox(0, 2.75, 1.35, 0.78, 0.72, 1.15, 2);
          b.addBox(0, 1.25, -1.8, 0.44, 0.44, 1.85, 1);
          b.addBox(-2.1, 2.35, -0.1, 2.05, 0.12, 1.7, 3);
          b.addBox(2.1, 2.35, -0.1, 2.05, 0.12, 1.7, 4);
        },
      },
    ],
    clips: monsterClips(),
  });

  await writeRig(io, 'sru-riftherald-base', {
    bones: monsterBones,
    parts: [
      {
        name: 'herald-carapace',
        color: [0.36, 0.18, 0.52, 1],
        metallic: 0.45,
        roughness: 0.48,
        emissive: [0.12, 0.04, 0.22],
        build(b) {
          b.addPrismY(0, 0.35, 2.25, 0, 1.05, 0.85, 8, 1, 1.2);
          b.addBox(0, 1.85, 0.95, 0.75, 0.65, 0.75, 2);
          b.addBox(-1.15, 1.35, 0.65, 0.55, 0.55, 1.15, 3);
          b.addBox(1.15, 1.35, 0.65, 0.55, 0.55, 1.15, 4);
        },
      },
      {
        name: 'herald-eye',
        color: [0.94, 0.42, 0.88, 1],
        metallic: 0.2,
        roughness: 0.2,
        emissive: [0.45, 0.12, 0.42],
        build(b) {
          b.addPrismY(0, 1.45, 2.05, -0.55, 0.36, 0.28, 8, 1);
        },
      },
    ],
    clips: monsterClips(),
  });

  await writeRig(io, 'sru-voidgrub-base', {
    bones: [
      { name: 'Root', parent: null, local: [0, 0, 0] },
      { name: 'Body', parent: 0, local: [0, 0.55, 0] },
      { name: 'Head', parent: 1, local: [0, 0.15, 0.45] },
      { name: 'MandibleL', parent: 1, local: [-0.35, 0.1, 0.35] },
      { name: 'MandibleR', parent: 1, local: [0.35, 0.1, 0.35] },
    ],
    parts: [
      {
        name: 'voidgrub-shell',
        color: [0.48, 0.22, 0.68, 1],
        metallic: 0.35,
        roughness: 0.5,
        emissive: [0.16, 0.06, 0.26],
        build(b) {
          b.addPrismY(0, 0.15, 1.05, 0, 0.58, 0.42, 8, 1, 1.35);
          b.addBox(0, 0.68, 0.52, 0.46, 0.42, 0.48, 2);
          b.addBox(-0.35, 0.55, 0.72, 0.16, 0.18, 0.42, 3);
          b.addBox(0.35, 0.55, 0.72, 0.16, 0.18, 0.42, 4);
        },
      },
    ],
    clips: monsterClips(),
  });

  // 3. Ward Variant Rigs (matching WARD_SOURCE.clips names: attack1, entry_3a224d98, entry_bd28bd4d)
  const wardClips = [
    {
      name: 'attack1',
      duration: 1.6,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.8, 1.6],
          [
            [0, 0, 0],
            [0, 0.08, 0],
            [0, 0, 0],
          ],
          defs[1].local
        );
        addRotChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.8, 1.6],
          [
            [0, 0, 0],
            [0, 1.57, 0],
            [0, 3.14, 0],
          ]
        );
      },
    },
    {
      name: 'entry_3a224d98',
      duration: 0.4,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.4],
          [
            [0, -0.5, 0],
            [0, 0, 0],
          ],
          defs[1].local
        );
      },
    },
    {
      name: 'entry_bd28bd4d',
      duration: 0.77,
      build(doc, buf, anim, bones, defs) {
        addTransChannel(
          doc,
          buf,
          anim,
          bones[1],
          [0, 0.77],
          [
            [0, 0, 0],
            [0, -0.65, 0],
          ],
          defs[1].local
        );
      },
    },
  ];

  for (const [wardName, color, emissive] of [
    ['farsightward-base', [0.22, 0.68, 0.98, 1], [0.1, 0.35, 0.62]],
    ['controlward-base', [0.88, 0.18, 0.32, 1], [0.42, 0.06, 0.14]],
  ]) {
    await writeRig(io, wardName, {
      bones: [
        { name: 'Root', parent: null, local: [0, 0, 0] },
        { name: 'Core', parent: 0, local: [0, 0.55, 0] },
      ],
      parts: [
        {
          name: `${wardName}-crystal`,
          color,
          metallic: 0.5,
          roughness: 0.25,
          emissive,
          build(b) {
            b.addPrismY(0, 0.02, 0.32, 0, 0.34, 0.22, 6, 0);
            b.addPrismY(0, 0.36, 1.02, 0, 0.22, 0.04, 6, 1);
          },
        },
      ],
      clips: wardClips,
    });
  }

  // 4. Icons (64x64 PNG) + reference-manifest.json
  const icons = [
    // Champions
    ['darius.png', [72, 16, 20], [20, 10, 12], [224, 58, 58], [220, 224, 232], 'axe'],
    ['DariusPassive.png', [68, 12, 16], [18, 8, 10], [236, 48, 48], [255, 196, 120], 'diamond'],
    ['DariusQ.png', [76, 18, 22], [22, 10, 12], [238, 72, 64], [232, 236, 242], 'axe'],
    ['DariusW.png', [64, 20, 20], [18, 10, 12], [244, 112, 64], [240, 220, 180], 'sword'],
    ['DariusE.png', [58, 22, 28], [16, 10, 14], [212, 78, 88], [220, 224, 232], 'arc'],
    ['DariusR.png', [92, 14, 18], [24, 6, 8], [255, 64, 48], [255, 228, 132], 'axe'],

    ['vi.png', [72, 22, 54], [20, 12, 26], [242, 82, 148], [96, 228, 255], 'fist'],
    ['ViPassive.png', [32, 48, 76], [14, 18, 30], [98, 224, 255], [244, 192, 96], 'shield'],
    ['ViQ.png', [78, 26, 58], [22, 12, 28], [248, 108, 162], [255, 212, 108], 'fist'],
    ['ViW.png', [68, 36, 24], [20, 14, 12], [250, 176, 72], [116, 232, 255], 'shield'],
    ['ViE.png', [36, 58, 88], [14, 20, 34], [108, 232, 255], [248, 186, 88], 'fist'],
    ['ViR.png', [88, 24, 52], [24, 10, 24], [255, 96, 152], [255, 228, 124], 'star'],

    ['ezreal.png', [20, 52, 98], [10, 20, 42], [96, 216, 255], [248, 204, 88], 'arc'],
    ['EzrealPassive.png', [24, 58, 104], [12, 22, 44], [112, 228, 255], [255, 220, 112], 'star'],
    ['EzrealQ.png', [22, 64, 112], [10, 24, 48], [128, 236, 255], [255, 236, 164], 'sword'],
    ['EzrealW.png', [72, 56, 18], [24, 18, 10], [255, 214, 88], [128, 232, 255], 'arc'],
    ['EzrealE.png', [48, 42, 96], [16, 16, 38], [164, 216, 255], [255, 218, 96], 'star'],
    ['EzrealR.png', [28, 68, 118], [12, 24, 48], [255, 224, 108], [116, 236, 255], 'arc'],

    ['morgana.png', [48, 18, 76], [16, 8, 28], [186, 104, 255], [238, 212, 255], 'wings'],
    ['MorganaPassive.png', [44, 16, 72], [14, 8, 26], [192, 112, 255], [132, 244, 208], 'diamond'],
    ['MorganaQ.png', [52, 18, 86], [16, 8, 30], [204, 124, 255], [248, 224, 255], 'star'],
    ['MorganaW.png', [38, 14, 62], [12, 6, 22], [168, 88, 242], [228, 176, 255], 'eye'],
    ['MorganaE.png', [56, 22, 92], [18, 10, 34], [196, 128, 255], [244, 218, 148], 'shield'],
    ['MorganaR.png', [64, 16, 88], [20, 6, 30], [222, 116, 255], [255, 228, 164], 'wings'],

    // Vision & Consumables
    ['3363.png', [16, 56, 96], [8, 22, 42], [96, 212, 255], [236, 248, 255], 'eye'],
    ['2055.png', [82, 16, 34], [24, 8, 14], [248, 72, 108], [255, 224, 232], 'eye'],
    ['2003.png', [76, 18, 24], [22, 8, 12], [242, 64, 72], [255, 216, 216], 'diamond'],

    // Starters & Components
    ['1056.png', [24, 48, 88], [10, 18, 36], [108, 198, 255], [236, 204, 112], 'arc'],
    ['1054.png', [44, 56, 36], [16, 22, 14], [168, 214, 124], [228, 198, 116], 'shield'],
    ['1042.png', [58, 48, 34], [20, 16, 12], [224, 208, 172], [168, 132, 76], 'sword'],
    ['1043.png', [42, 58, 38], [16, 22, 14], [196, 228, 132], [236, 192, 96], 'arc'],
    ['1053.png', [72, 16, 28], [22, 8, 12], [228, 56, 84], [216, 188, 116], 'sword'],
    ['3057.png', [24, 58, 96], [10, 22, 38], [116, 222, 255], [244, 232, 188], 'sword'],
    ['3067.png', [68, 28, 24], [22, 10, 10], [236, 92, 76], [244, 208, 116], 'diamond'],
    ['3134.png', [68, 22, 26], [22, 10, 12], [232, 84, 84], [212, 216, 224], 'sword'],
    ['6660.png', [82, 38, 16], [26, 12, 8], [255, 148, 56], [255, 228, 128], 'star'],

    // Boots
    ['3006.png', [68, 48, 20], [22, 16, 8], [244, 196, 76], [236, 236, 242], 'boot'],
    ['3020.png', [48, 24, 84], [16, 10, 32], [184, 116, 255], [244, 208, 112], 'boot'],
    ['3047.png', [62, 42, 28], [20, 14, 10], [216, 172, 124], [188, 196, 208], 'boot'],
    ['3111.png', [22, 62, 76], [10, 22, 28], [104, 224, 236], [224, 204, 132], 'boot'],
    ['3158.png', [76, 28, 36], [24, 10, 14], [242, 108, 116], [248, 228, 184], 'boot'],

    // Completed Items
    ['6672.png', [18, 62, 84], [8, 22, 32], [96, 232, 248], [244, 208, 108], 'sword'],
    ['3046.png', [20, 68, 64], [8, 24, 22], [108, 242, 212], [236, 248, 244], 'wings'],
    ['3036.png', [36, 54, 82], [14, 20, 32], [156, 208, 255], [244, 198, 96], 'arc'],
    ['3072.png', [84, 14, 22], [26, 6, 10], [248, 52, 68], [244, 198, 104], 'sword'],
    ['6655.png', [54, 22, 88], [18, 8, 32], [196, 116, 255], [124, 228, 255], 'star'],
    ['3157.png', [82, 64, 18], [26, 20, 8], [255, 214, 72], [124, 224, 255], 'diamond'],
    ['3135.png', [46, 20, 82], [16, 8, 30], [188, 108, 255], [116, 228, 255], 'sword'],
    ['6653.png', [58, 32, 68], [20, 12, 24], [228, 218, 238], [124, 236, 255], 'eye'],
    ['3078.png', [78, 56, 18], [26, 18, 8], [255, 204, 76], [255, 244, 196], 'star'],
    ['3071.png', [74, 22, 20], [24, 8, 8], [236, 76, 64], [196, 200, 208], 'axe'],
    ['3053.png', [78, 24, 22], [26, 8, 8], [244, 88, 72], [244, 204, 116], 'fist'],
    ['3153.png', [18, 64, 58], [8, 22, 20], [96, 236, 196], [216, 196, 248], 'sword'],
    ['3142.png', [76, 24, 58], [24, 8, 20], [248, 108, 184], [248, 224, 168], 'sword'],
    ['3068.png', [86, 42, 14], [28, 14, 6], [255, 164, 52], [255, 232, 136], 'shield'],
    ['4401.png', [20, 68, 54], [8, 24, 18], [108, 238, 176], [236, 212, 116], 'shield'],
    ['3190.png', [76, 56, 22], [24, 18, 8], [248, 204, 88], [255, 244, 212], 'shield'],
    ['3075.png', [62, 24, 24], [20, 10, 10], [216, 84, 76], [208, 214, 222], 'shield'],

    // Runes
    ['RunePTA.png', [74, 58, 18], [24, 18, 8], [255, 214, 84], [255, 248, 204], 'star'],
    ['RuneConqueror.png', [82, 52, 16], [26, 16, 6], [255, 192, 68], [248, 108, 76], 'axe'],
    ['RuneElectrocute.png', [82, 18, 24], [26, 8, 10], [255, 68, 84], [255, 224, 164], 'star'],
    ['RuneComet.png', [36, 32, 88], [12, 12, 32], [148, 164, 255], [228, 238, 255], 'arc'],
    ['RuneGrasp.png', [24, 68, 36], [10, 24, 14], [108, 236, 132], [216, 255, 224], 'fist'],
    ['RuneFirstStrike.png', [22, 64, 84], [8, 22, 30], [116, 232, 255], [255, 224, 108], 'diamond'],

    // Epic Objectives
    ['ObjectiveDragon.png', [84, 34, 16], [26, 10, 6], [255, 128, 56], [255, 224, 128], 'wings'],
    ['ObjectiveHerald.png', [56, 22, 84], [18, 8, 28], [212, 104, 255], [255, 188, 248], 'eye'],
    ['ObjectiveGrubs.png', [48, 20, 74], [16, 8, 24], [188, 96, 248], [148, 236, 212], 'star'],
  ];

  const manifestPath = 'public/assets/reference-manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byPath = new Map(manifest.assets.map((row) => [row.path, row]));

  for (const [filename, bgA, bgB, accent, secondary, shape] of icons) {
    const png = renderIcon(bgA, bgB, accent, secondary, shape);
    const diskPath = `public/assets/icons/${filename}`;
    const webPath = `/assets/icons/${filename}`;
    writeFileSync(diskPath, png);
    byPath.set(webPath, {
      path: webPath,
      source: 'authored-local-milestone6',
      sha256: sha256(png),
      bytes: png.length,
    });
  }
  manifest.assets = [...byPath.values()];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated 10 GLB rigs and ${icons.length} PNG icons successfully.`);
}

await main();
