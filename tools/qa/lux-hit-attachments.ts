import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TargetPoseSampler } from '../../src/render/target-pose-sampler';
import { luxHitBone } from '../../src/render/lux-hit-bone';
import audit from '../../docs/reference/lux-hit-attachments.json';
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setSize(1000, 560, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#132a36');
const camera = new THREE.PerspectiveCamera(40, 1000 / 560, 0.01, 100);
const markers = [0x65efef, 0xffbb5d].map((color) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 12),
    new THREE.MeshBasicMaterial({ color, depthTest: false })
  );
  m.renderOrder = 10;
  scene.add(m);
  return m;
});
scene.add(new THREE.GridHelper(12, 24, 0x416572, 0x28424e));
const modelSelect = document.querySelector<HTMLSelectElement>('#model')!,
  clipSelect = document.querySelector<HTMLSelectElement>('#clip')!,
  phase = document.querySelector<HTMLInputElement>('#phase')!;
for (const m of audit.models) {
  const o = new Option(m.name, m.name);
  modelSelect.add(o);
}
let model: THREE.Group,
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  action: THREE.AnimationAction | undefined;
let bones: (THREE.Object3D | undefined)[] = [],
  selected = '',
  serial = 0;
let poseSampler: TargetPoseSampler;
const sampled = new THREE.Vector3();
function draw() {
  if (!model) return;
  if (action) {
    action.time = Number(phase.value) * action.getClip().duration;
    mixer.update(0);
  }
  model.updateMatrixWorld(true);
  const positions = bones.map((bone, i) => {
    markers[i].visible = !!bone;
    if (!bone) return null;
    bone.getWorldPosition(markers[i].position);
    return markers[i].position.toArray();
  });
  poseSampler.sample(action ? [{ clip: action.getClip().name, time: action.time, weight: 1 }] : []);
  const sampleErrors = positions.map((position, i) => {
    const found = poseSampler.hitPosition(i === 1, sampled);
    if (found !== (position !== null)) throw new Error('Attachment sampler presence differs');
    return position ? sampled.distanceTo(new THREE.Vector3(...position)) : 0;
  });
  document.querySelector('#status')!.textContent =
    `${selected} · ${clipSelect.value} · phase ${Number(phase.value).toFixed(3)}\n` +
    positions
      .map(
        (p, i) =>
          `${i ? 'Critical chest' : 'Normal centre'}: ${p ? p.map((n) => n.toFixed(4)).join(', ') : 'MISSING'}`
      )
      .join('\n') +
    `\nPrivate sampler error: ${Math.max(...sampleErrors).toExponential(2)}`;
  renderer.render(scene, camera);
  return {
    model: selected,
    clip: clipSelect.value,
    positions,
    phase: Number(phase.value),
    sampleErrors,
  };
}
function chooseClip() {
  mixer.stopAllAction();
  const clip = clips.find((c) => c.name === clipSelect.value);
  action = clip ? mixer.clipAction(clip) : undefined;
  if (action) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;
  }
  draw();
}
function disposeTarget(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      geometries.add(node.geometry);
      for (const m of Array.isArray(node.material) ? node.material : [node.material])
        materials.add(m);
    }
  });
  for (const m of materials)
    for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
async function chooseModel() {
  const token = ++serial;
  const name = modelSelect.value;
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}.glb`);
  if (token !== serial) {
    disposeTarget(gltf.scene);
    return;
  }
  if (model) {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    poseSampler.dispose();
    scene.remove(model);
    disposeTarget(model);
  }
  selected = name;
  model = gltf.scene;
  scene.add(model);
  clips = gltf.animations;
  poseSampler = new TargetPoseSampler(model, clips);
  mixer = new THREE.AnimationMixer(model);
  bones = [luxHitBone(model, false), luxHitBone(model, true)];
  clipSelect.replaceChildren(...clips.map((c) => new Option(c.name, c.name)));
  clipSelect.value = clips.some((c) => c.name === 'idle1') ? 'idle1' : (clips[0]?.name ?? '');
  phase.value = '0';
  const bounds = new THREE.Box3().setFromObject(model),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 1);
  camera.position.set(center.x + extent * 0.6, center.y + extent * 0.35, center.z + extent * 2);
  camera.lookAt(center);
  chooseClip();
  (window as any).__LUX_HIT_ATTACHMENTS__ = { ready: true, state: draw };
}
modelSelect.addEventListener('change', () => void chooseModel());
clipSelect.addEventListener('change', chooseClip);
phase.addEventListener('input', draw);
await chooseModel();
