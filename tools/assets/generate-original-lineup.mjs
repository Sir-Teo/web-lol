/** Rebuild the original lineup's offline assets from authored geometry and timing. */
import { Document, NodeIO } from '@gltf-transform/core';
import {
  Color,
  BoxGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  CylinderGeometry,
  TorusGeometry,
  Quaternion,
  Euler,
} from 'three';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ORIGINAL_CLIPS, ORIGINAL_LINEUP } from '../../src/content/original-lineup.ts';

const rigs = {
  brannic: {
    metal: 0x9b482c,
    trim: 0xe8b257,
    cloth: 0x303234,
    face: 0xa2664d,
    light: 0xff7b25,
    width: 1.2,
  },
  taviq: {
    metal: 0x49733c,
    trim: 0xaab663,
    cloth: 0x243731,
    face: 0x8b6a49,
    light: 0xa7fb61,
    width: 0.92,
  },
  irielle: {
    metal: 0x7656ad,
    trim: 0xddbffc,
    cloth: 0x222248,
    face: 0x9e747c,
    light: 0xbd8aff,
    width: 0.87,
  },
  vess: {
    metal: 0x907340,
    trim: 0xefc85f,
    cloth: 0x35424b,
    face: 0x755043,
    light: 0xffe580,
    width: 0.9,
  },
  oona: {
    metal: 0x358480,
    trim: 0xb7efce,
    cloth: 0x1e4961,
    face: 0xc39578,
    light: 0x71ffd6,
    width: 0.98,
  },
};

const bones = [
  ['root', -1, [0, 0, 0]],
  ['hips', 0, [0, 53, 0]],
  ['chest', 1, [0, 24, 0]],
  ['head', 2, [0, 31, 0]],
  ['left-arm', 2, [-21, 13, 0]],
  ['right-arm', 2, [21, 13, 0]],
  ['left-forearm', 4, [-8, -16, 0]],
  ['right-forearm', 5, [8, -16, 0]],
  ['left-leg', 1, [-10, -4, 0]],
  ['right-leg', 1, [10, -4, 0]],
  ['left-boot', 8, [0, -22, 0]],
  ['right-boot', 9, [0, -22, 0]],
];
const identity = new Quaternion();
// The drawing coordinates place the shoulders near 90. Scene units place them near 1.45.
const rigUnit = 0.016;
const tint = (hex, alpha = 1) => [...new Color(hex).toArray(), alpha];
const rgba = (position, scale, geometry, rotation = [0, 0, 0]) => {
  geometry.scale(...scale);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  return geometry;
};
const box = (p, s, r) => rgba(p, s, new BoxGeometry(1, 1, 1), r);
const jewel = (p, s, r, detail = 0) => rgba(p, s, new IcosahedronGeometry(1, detail), r);
const collar = (p, s, r, taper = 0.65) => rgba(p, s, new CylinderGeometry(taper, 1, 1, 8), r);
const halo = (p, s, r) => rgba(p, s, new TorusGeometry(1, 0.12, 5, 14), r);

function armor(id, width, part) {
  part('cloth', 1, collar([0, 52, 0], [15 * width, 20, 10], undefined, 1.12));
  part('cloth', 2, collar([0, 72, 0], [17 * width, 30, 11], undefined, 1.13));
  part('metal', 2, jewel([0, 82, 4], [19 * width, 20, 11], [0, 0.15, 0], 1));
  part('trim', 2, collar([0, 59, 0], [17 * width, 6, 12], undefined, 1));
  part('light', 2, jewel([0, 84, 15], [5, 7, 2], [0, 0, Math.PI / 4]));
  part('face', 3, rgba([0, 107, 0], [10, 12, 9], new SphereGeometry(1, 10, 7)));
  part('metal', 3, jewel([0, 113, -2], [12, 11, 11], [0, 0.22, 0], 1));
  part('trim', 3, box([0, 110, 8], [17, 4, 3]));
  part('light', 3, box([0, 109, 10], [12, 1.6, 1]));
  for (const [side, arm, forearm, leg, boot] of [
    [-1, 4, 6, 8, 10],
    [1, 5, 7, 9, 11],
  ]) {
    part(
      'metal',
      arm,
      jewel([side * (21 + width * 3), 90, 0], [12 * width, 10, 11], [0, 0, side * 0.42], 1)
    );
    part(
      'trim',
      arm,
      jewel([side * (23 + width * 4), 94, 1], [10 * width, 5, 10], [0.12, 0, side * 0.37])
    );
    part('cloth', arm, collar([side * 25, 78, 0], [6, 18, 6], [0, 0, side * 0.33]));
    part('metal', forearm, collar([side * 30, 64, 1], [7, 16, 6], [0, 0, side * 0.15]));
    part('trim', forearm, box([side * 31, 60, 5], [10, 4, 5], [0, 0, side * 0.16]));
    part('face', forearm, jewel([side * 31, 55, 0], [5, 6, 5], undefined, 1));
    part('cloth', leg, collar([side * 10, 38, 0], [8, 24, 8], undefined, 1.16));
    part('metal', leg, jewel([side * 11, 30, 6], [8, 11, 4], undefined, 1));
    part('metal', boot, collar([side * 10, 17, 0], [7, 23, 8]));
    part('trim', boot, box([side * 10, 6, 4], [15, 10, 19]));
  }
  if (id === 'brannic') {
    part('metal', 6, jewel([-33, 67, 7], [23, 26, 8], [0, 0.06, -0.25], 1));
    part('trim', 6, halo([-33, 67, 12], [16, 18, 2]));
    part('light', 6, jewel([-33, 67, 17], [9, 10, 3]));
    part('cloth', 7, collar([32, 69, 5], [3, 56, 3], undefined, 1));
    part('metal', 7, box([32, 98, 5], [17, 17, 38], [0.25, 0.1, 0]));
    part('trim', 7, box([32, 102, 5], [22, 7, 42]));
    part('light', 7, box([32, 103, 25], [12, 2, 3]));
  }
  if (id === 'taviq') {
    part('cloth', 2, jewel([0, 76, -11], [18, 26, 8], [0.35, 0, 0], 1));
    for (let i = 0; i < 4; i++)
      part('trim', 2, jewel([0, 75 + i * 8, -15], [5, 9, 8], [-0.55, 0, 0]));
    for (const side of [-1, 1]) {
      part('trim', 3, collar([side * 8, 123, -2], [4, 20, 4], [-0.2, 0, side * 0.3], 0));
      part(
        'light',
        side < 0 ? 6 : 7,
        jewel([side * 34, 49, 4], [4, 18, 7], [0.15, 0, side * 0.31])
      );
    }
  }
  if (id === 'irielle') {
    part('cloth', 1, collar([0, 36, 0], [23, 47, 15], undefined, 0.45));
    part('metal', 2, jewel([0, 89, -8], [28, 23, 5], [0.4, 0.18, 0]));
    for (const side of [-1, 1])
      part('trim', 3, jewel([side * 8, 121, -3], [5, 15, 5], [0.1, 0, side * 0.35]));
    part('trim', 7, collar([32, 68, 2], [2.9, 120, 2.9], [0.05, 0, 0.035], 1));
    part('metal', 7, halo([32, 123, 5], [15, 19, 5]));
    part('light', 7, jewel([32, 123, 6], [10, 17, 8], [0.25, 0.35, 0.1]));
  }
  if (id === 'vess') {
    part('metal', 2, box([0, 74, -14], [27, 32, 13]));
    for (const i of [-1, 0, 1])
      part('light', 2, collar([i * 7, 78, -21], [2, 20, 2], undefined, 1));
    part('cloth', 3, collar([0, 116, 1], [12, 6, 12], undefined, 0.9));
    part('trim', 7, box([32, 57, 16], [13, 15, 42], [0.08, -0.12, 0]));
    part('metal', 7, collar([32, 58, 28], [8, 30, 8], [Math.PI / 2, 0, 0], 0.85));
    for (let i = 0; i < 3; i++) part('light', 7, halo([32, 59, 27 + i * 4], [8, 8, 2]));
  }
  if (id === 'oona') {
    part('cloth', 1, collar([0, 35, -2], [21, 54, 16], [0.1, 0, -0.11], 0.62));
    part('trim', 3, halo([0, 111, -6], [16, 19, 5], [0.16, 0, 0]));
    part('metal', 2, jewel([0, 81, -10], [24, 28, 7], [0.25, 0, 0], 1));
    part('trim', 7, collar([33, 48, 4], [3, 82, 3], undefined, 1));
    part('metal', 7, halo([33, 91, 5], [20, 18, 4]));
    part('trim', 7, halo([33, 91, 4], [13, 15, 4], [0, Math.PI / 3, 0]));
    part('light', 7, jewel([33, 91, 5], [9, 13, 10], [0.3, 0, 0.4], 1));
    part('light', 6, jewel([-34, 57, 7], [6, 10, 6], undefined, 1));
  }
}

function pose(id, name, t) {
  const angles = bones.map(() => [0, 0, 0]);
  let lift = 0;
  if (name === 'idle1') {
    const wave = Math.sin(t * Math.PI * 2);
    lift = wave * 1.3;
    angles[2] = [0.025 * wave, 0.045 * wave, 0];
    angles[4] = [0, 0, -0.12 + 0.04 * wave];
    angles[5] = [0, 0, 0.12 - 0.04 * wave];
  } else if (name === 'run') {
    const stride = Math.sin(t * Math.PI * 2);
    lift = Math.abs(stride) * 3;
    angles[2] = [0.15, stride * 0.08, 0];
    angles[4] = [stride * 0.52, 0, -0.12];
    angles[5] = [-stride * 0.52, 0, 0.12];
    angles[8] = [-stride * 0.7, 0, 0];
    angles[9] = [stride * 0.7, 0, 0];
    angles[10] = [0.45 * Math.max(0, stride), 0, 0];
    angles[11] = [0.45 * Math.max(0, -stride), 0, 0];
  } else if (name === 'death') {
    lift = -38 * t;
    angles[1] = [0.16 * t, 0, -1.42 * Math.sin(t * 1.57)];
    angles[2] = [-0.25 * t, 0, -0.08 * t];
    angles[4] = [0.3 * t, 0, -0.7 * t];
    angles[5] = [-0.35 * t, 0, 0.8 * t];
  } else {
    const burst = Math.sin(t * Math.PI);
    const slot = name.startsWith('spell') ? Number(name.at(-1)) - 1 : -1;
    const profile = Object.keys(rigs).indexOf(id);
    angles[2] = [-0.09 * burst, (profile % 2 ? -1 : 1) * 0.28 * burst, 0.12 * burst];
    angles[4] = [-burst * (slot === 3 ? 2.25 : 0.7), 0, -0.52 * burst];
    angles[5] = [-burst * (slot < 0 ? 1.36 : 0.95 + slot * 0.38), 0.21 * burst, 0.62 * burst];
    angles[7] = [-burst * (slot === 1 ? 1.2 : 0.35), slot === 2 ? 0.7 * burst : 0, 0];
    if (name === 'recall') {
      lift = 10 * burst;
      angles[4] = [-0.45 * burst, 0, -1.35 * burst];
      angles[5] = [-0.45 * burst, 0, 1.35 * burst];
    } else if (slot === 2 || slot === 3) {
      lift = (slot === 2 ? 4 : 6) * burst;
    }
  }
  return { angles, lift };
}

async function build(id, palette) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(id);
  const access = (type, values) =>
    doc.createAccessor().setType(type).setArray(values).setBuffer(buffer);
  const nodes = bones.map(([name, , translate]) =>
    doc.createNode(name).setTranslation(translate.map((value) => value * rigUnit))
  );
  for (const [i, [, parent]] of bones.entries()) {
    if (parent < 0) scene.addChild(nodes[i]);
    else nodes[parent].addChild(nodes[i]);
  }
  const global = [];
  const matrices = [];
  for (const [, parent, position] of bones) {
    const offset = position.map((value, axis) => value * rigUnit + (global[parent]?.[axis] ?? 0));
    global.push(offset);
    matrices.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -offset[0], -offset[1], -offset[2], 1);
  }
  const skin = doc
    .createSkin(id + ' skeleton')
    .setSkeleton(nodes[0])
    .setInverseBindMatrices(access('MAT4', new Float32Array(matrices)));
  nodes.forEach((joint) => skin.addJoint(joint));
  const mesh = doc.createMesh(id + ' armor');
  const batches = new Map();
  armor(id, palette.width, (key, joint, geometry) => {
    const batch = batches.get(key) ?? {
      position: [],
      normal: [],
      joints: [],
      weights: [],
      indices: [],
    };
    const index = batch.position.length / 3;
    const p = geometry.getAttribute('position'),
      n = geometry.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      batch.position.push(p.getX(i) * rigUnit, p.getY(i) * rigUnit, p.getZ(i) * rigUnit);
      batch.normal.push(n.getX(i), n.getY(i), n.getZ(i));
      batch.joints.push(joint, 0, 0, 0);
      batch.weights.push(1, 0, 0, 0);
    }
    const indices = geometry.getIndex();
    for (let i = 0; i < (indices?.count ?? p.count); i++)
      batch.indices.push(index + (indices ? indices.getX(i) : i));
    batches.set(key, batch);
  });
  let triangles = 0;
  for (const [key, batch] of batches) {
    const material = doc
      .createMaterial(key)
      .setBaseColorFactor(tint(palette[key]))
      .setRoughnessFactor(key === 'cloth' ? 0.91 : 0.42)
      .setMetallicFactor(key === 'metal' || key === 'trim' ? 0.36 : 0);
    if (key === 'light')
      material.setEmissiveFactor(
        tint(palette.light)
          .slice(0, 3)
          .map((c) => c * 0.52)
      );
    triangles += batch.indices.length / 3;
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', access('VEC3', Float32Array.from(batch.position)))
        .setAttribute('NORMAL', access('VEC3', Float32Array.from(batch.normal)))
        .setAttribute('JOINTS_0', access('VEC4', Uint8Array.from(batch.joints)))
        .setAttribute('WEIGHTS_0', access('VEC4', Float32Array.from(batch.weights)))
        .setIndices(access('SCALAR', Uint16Array.from(batch.indices)))
    );
  }
  scene.addChild(
    doc
      .createNode(id + ' skin')
      .setMesh(mesh)
      .setSkin(skin)
  );
  const clips = [];
  for (const [name, duration] of Object.entries(ORIGINAL_CLIPS)) {
    const spell = name.startsWith('spell')
      ? ORIGINAL_LINEUP[id].spells[['q', 'w', 'e', 'r'][Number(name.at(-1)) - 1]]
      : null;
    const cue = spell ? spell.windup / (60 * duration) : 0.5;
    const fractions = [0, cue / 2, cue, (cue + 1) / 2, 1];
    const poses = fractions.map((t, i) => pose(id, name, name.startsWith('spell') ? i / 4 : t));
    const animation = doc.createAnimation(name);
    const input = access('SCALAR', Float32Array.from(fractions.map((t) => t * duration)));
    const channel = (target, path, type, values) => {
      const sampler = doc
        .createAnimationSampler()
        .setInput(input)
        .setOutput(access(type, Float32Array.from(values)));
      animation
        .addSampler(sampler)
        .addChannel(
          doc.createAnimationChannel().setSampler(sampler).setTargetNode(target).setTargetPath(path)
        );
    };
    for (const [i, node] of nodes.entries()) {
      const rotations = poses.map((frame) =>
        new Quaternion().setFromEuler(new Euler(...frame.angles[i]))
      );
      if (rotations.some((q) => !q.equals(identity)))
        channel(
          node,
          'rotation',
          'VEC4',
          rotations.flatMap((q) => q.toArray())
        );
    }
    channel(
      nodes[0],
      'translation',
      'VEC3',
      poses.flatMap(({ lift }) => [0, lift * rigUnit, 0])
    );
    clips.push({
      name,
      durationSeconds: duration,
      ...(spell ? { impactSeconds: spell.windup / 60 } : {}),
    });
  }
  const bytes = await new NodeIO().writeBinary(doc);
  const file = 'public/assets/models/' + id + '-base';
  writeFileSync(file + '.glb', bytes);
  writeFileSync(
    file + '.json',
    JSON.stringify(
      {
        provenance: 'original-lineup',
        output: {
          path: '/assets/models/' + id + '-base.glb',
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
        triangles,
        clips,
      },
      null,
      2
    ) + '\n'
  );
  console.log(id, triangles, 'triangles', bytes.length, 'bytes');
}

for (const [id, palette] of Object.entries(rigs)) await build(id, palette);
execFileSync('python3', ['tools/assets/generate-original-lineup-icons.py', JSON.stringify(rigs)], {
  stdio: 'inherit',
});
