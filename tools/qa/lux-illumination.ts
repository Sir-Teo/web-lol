import * as THREE from 'three';
import {
  loadIlluminationTextures,
  LuxIlluminationCloud,
} from '../../src/render/lux-illumination-cloud';
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setSize(1000, 620, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101d27');
const camera = new THREE.PerspectiveCamera(35, 1000 / 620, 0.1, 100);
camera.position.set(0, 3, 7);
camera.lookAt(0, 0, 0);
const textures = await loadIlluminationTextures('/');
const cloud = new LuxIlluminationCloud(textures);
scene.add(cloud.root);
const frame = new THREE.Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1),
  center = new THREE.Vector3();
const age = document.querySelector<HTMLInputElement>('#age')!,
  steel = document.querySelector<HTMLInputElement>('#steel')!;
let currentTime = Number(age.value);
let playing = false,
  last = performance.now();
function draw(time: number) {
  currentTime = time;
  age.value = String(time);
  const particles = cloud.draw(
    123,
    time,
    camera,
    center,
    frame,
    Infinity,
    steel.checked ? ['SteelLegionLux'] : []
  );
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent =
    `${time.toFixed(2)} s · ${particles.length} particles · ${cloud.meshes.map((mesh) => `${mesh.name}: ${mesh.geometry.drawRange.count / 6}`).join(' · ')}`;
  return particles;
}
age.oninput = () => {
  playing = false;
  document.querySelector('#play')!.textContent = 'Play';
  draw(Number(age.value));
};
steel.onchange = () => draw(Number(age.value));
document.querySelector('#play')!.addEventListener('click', () => {
  playing = !playing;
  document.querySelector('#play')!.textContent = playing ? 'Pause' : 'Play';
  last = performance.now();
});
renderer.setAnimationLoop(() => {
  const now = performance.now();
  if (playing) draw((currentTime + (now - last) / 1000) % 7.2);
  last = now;
});
draw(Number(age.value));
Object.assign(window, {
  __ILLUMINATION__: { renderer, scene, camera, cloud, textures, draw, ready: true },
});
