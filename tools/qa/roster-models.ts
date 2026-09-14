import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x101b23);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(0, 3.8, 7);
camera.lookAt(0, 1, 0);
const grid = new THREE.GridHelper(10, 20, 0x546571, 0x243540);
scene.add(grid);
const select = document.querySelector<HTMLSelectElement>('#champion')!;
const clips = document.querySelector<HTMLSelectElement>('#clip')!;
const scrub = document.querySelector<HTMLInputElement>('#time')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const entries = new Map<
  string,
  { root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[] }
>();
for (const name of ['Garen', 'Ahri']) {
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name.toLowerCase()}-base.glb`);
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some((material) => material.userData.defaultHidden)) object.visible = false;
      object.frustumCulled = false; // Inspect all animated poses without stale bind-pose bounds.
    }
  });
  gltf.scene.visible = false;
  scene.add(gltf.scene);
  entries.set(name, {
    root: gltf.scene,
    mixer: new THREE.AnimationMixer(gltf.scene),
    clips: gltf.animations,
  });
}
let active = entries.get('Garen')!,
  action: THREE.AnimationAction,
  playing = false;
function render() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
}
function seek(time: number) {
  active.mixer.setTime(time);
  scrub.value = String(time);
  render();
}
function chooseClip(name: string) {
  const clip = active.clips.find((c) => c.name === name);
  if (!clip) throw new Error(`Unknown clip: ${name}`);
  active.mixer.stopAllAction();
  action = active.mixer.clipAction(clip);
  action.play();
  clips.value = name;
  scrub.max = String(clip.duration);
  seek(0);
}
function choose(name: string) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Unknown champion: ${name}`);
  for (const e of entries.values()) {
    e.root.visible = false;
    e.mixer.stopAllAction();
  }
  active = entry;
  active.root.visible = true;
  select.value = name;
  clips.replaceChildren(...active.clips.map((c) => new Option(c.name, c.name)));
  chooseClip(
    active.clips.find((c) => ['idle1_base', 'idle1', 'idle_var2'].includes(c.name))?.name ??
      active.clips[0].name
  );
  document.querySelector('#status')!.textContent =
    `${name} · ${active.clips.length} atomic clips · source units converted to metres`;
}
function resize() {
  const height = Math.max(360, innerHeight - 165);
  renderer.setSize(innerWidth, height);
  camera.aspect = innerWidth / height;
  camera.updateProjectionMatrix();
  render();
}
select.onchange = () => choose(select.value);
clips.onchange = () => chooseClip(clips.value);
scrub.oninput = () => {
  playing = false;
  play.textContent = 'Play';
  seek(Number(scrub.value));
};
play.onclick = () => {
  playing = !playing;
  play.textContent = playing ? 'Pause' : 'Play';
};
window.addEventListener('resize', resize);
choose('Garen');
resize();
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing) {
    active.mixer.update(dt);
    scrub.value = String(action.time);
    render();
  }
});
Object.assign(window, {
  __ROSTER_MODELS__: { ready: true, entries, choose, chooseClip, seek, renderer, scene, camera },
});
