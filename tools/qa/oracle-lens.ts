import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import source from '../../src/content/oracle-lens.json';

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x101b23);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
const select = document.querySelector<HTMLSelectElement>('#asset')!;
const scrub = document.querySelector<HTMLInputElement>('#time')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const entries = new Map<
  string,
  { root: THREE.Group; mixer: THREE.AnimationMixer; clip?: THREE.AnimationClip }
>();
for (const [key, binding] of Object.entries(source.bindings)) {
  const gltf = await new GLTFLoader().loadAsync('/' + binding.mesh);
  const texture = await new THREE.TextureLoader().loadAsync('/' + binding.texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      if (!(object instanceof THREE.SkinnedMesh))
        object.material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: binding.blendMode === 4 ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
    }
  });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  gltf.scene.visible = false;
  scene.add(gltf.scene);
  entries.set(key, { root: gltf.scene, mixer, clip: gltf.animations[0] });
}
let active = entries.get('Trinket_Red')!,
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
function choose(name: string) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Unknown source geometry: ${name}`);
  for (const e of entries.values()) e.root.visible = false;
  active = entry;
  active.root.visible = true;
  select.value = name;
  scrub.disabled = !active.clip;
  play.disabled = !active.clip;
  seek(0);
  const box = new THREE.Box3().setFromObject(active.root),
    size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1);
  camera.position.copy(center).add(new THREE.Vector3(0.9, 0.75, 1.5).multiplyScalar(span));
  camera.lookAt(center);
  camera.near = span / 1000;
  camera.far = span * 20;
  camera.updateProjectionMatrix();
  document.querySelector('#status')!.textContent = `${name} · ${size
    .toArray()
    .map((n) => n.toFixed(2))
    .join(
      ' × '
    )} converted units · ${active.clip ? `${active.clip.duration}s source animation` : 'source static mesh'}`;
  render();
}
function resize() {
  const height = Math.max(360, innerHeight - 165);
  renderer.setSize(innerWidth, height);
  camera.aspect = innerWidth / height;
  camera.updateProjectionMatrix();
  render();
}
select.onchange = () => choose(select.value);
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
choose('Trinket_Red');
resize();
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing && active.clip) seek((Number(scrub.value) + dt) % active.clip.duration);
});
Object.assign(window, {
  __ORACLE_SOURCE__: { ready: true, entries, choose, seek, render, renderer, scene, camera },
});
