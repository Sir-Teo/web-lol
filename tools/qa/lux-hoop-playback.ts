import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LuxHoopCloud } from '../../src/render/lux-hoop-cloud';
const loader = new THREE.TextureLoader();
async function load(name: string) {
  const texture = await loader.loadAsync(`/assets/effects/lux-ba-${name}.png`);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
const [mote, ramp] = await Promise.all([load('lux_base_r_mote'), load('color-spectralbell')]);
const host = document.querySelector<HTMLDivElement>('#view')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10232b);
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(1.3, 1.1, 2.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.45, 0);
controls.update();
scene.add(new THREE.GridHelper(2, 10, 0x607573, 0x29434a));
const cloud = new LuxHoopCloud(mote, ramp);
scene.add(cloud.mesh);
const time = document.querySelector<HTMLInputElement>('#time')!,
  seed = document.querySelector<HTMLInputElement>('#seed')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
let playing = false,
  seconds = 0.3,
  previous = performance.now(),
  particles = cloud.update(42, seconds, 0.5, camera);
function draw() {
  particles = cloud.update(Number(seed.value) >>> 0, seconds, 0.5, camera);
  renderer.render(scene, camera);
  document.querySelector('#time-value')!.textContent = `${seconds.toFixed(3)} s`;
  document.querySelector('#status')!.textContent =
    `Ready · ${particles.length} live particles · ${renderer.info.render.calls} draw calls · seed ${Number(seed.value) >>> 0}`;
  play.textContent = playing ? 'Pause' : 'Play';
}
new ResizeObserver(() => {
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  draw();
}).observe(host);
controls.addEventListener('change', draw);
time.addEventListener('input', () => {
  seconds = Number(time.value);
  draw();
});
seed.addEventListener('input', draw);
play.addEventListener('click', () => {
  playing = !playing;
  previous = performance.now();
  if (playing && seconds >= 1.2) seconds = 0;
  draw();
});
document.querySelector('#restart')!.addEventListener('click', () => {
  seconds = 0;
  time.value = '0';
  draw();
});
renderer.setAnimationLoop(() => {
  const now = performance.now();
  if (playing) {
    seconds = Math.min(1.2, seconds + (now - previous) / 1000);
    if (seconds === 1.2) playing = false;
    time.value = String(seconds);
    draw();
  }
  previous = now;
});
(window as any).__HOOP__ = {
  ready: true,
  state: () => ({
    seed: Number(seed.value) >>> 0,
    seconds,
    playing,
    particles,
    calls: renderer.info.render.calls,
    instances: cloud.mesh.count,
    geometries: renderer.info.memory.geometries,
  }),
};
draw();
