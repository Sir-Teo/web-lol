import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LuxRibbonMesh } from '../../src/render/lux-attack-trails';
import { luxTrailParticles } from '../../src/render/lux-trail-particles';
import { luxTrailRibbon } from '../../src/render/lux-trail-ribbon';
import type { LuxAttackVisual } from '../../src/simulation/types';
const loader = new THREE.TextureLoader();
const textures = await Promise.all(
  ['lux_base_q_trail', 'lux_base_r_rainbowmult'].map(async (name) => {
    const t = await loader.loadAsync(`/assets/effects/lux-ba-${name}.png`);
    t.colorSpace = THREE.NoColorSpace;
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  })
);
const host = document.querySelector<HTMLDivElement>('#view')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10232b);
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(0, 8, 9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();
scene.add(new THREE.GridHelper(12, 12, 0x607573, 0x29434a));
const ribbon = new LuxRibbonMesh(textures[0], textures[1]);
scene.add(ribbon.mesh);
const effect: LuxAttackVisual = {
  id: 42,
  sourceId: 1,
  team: 'blue',
  origin: { x: -400, y: 0 },
  launchTick: 0,
  stopTick: 42,
  frames: [],
};
let distance = 0;
for (let tick = 0; tick <= 42; tick++) {
  const x = -400 + tick * 20,
    y = 100 * Math.sin(tick / 10);
  const last = effect.frames.at(-1) ?? effect.origin;
  distance += Math.hypot(x - last.x, y - last.y);
  effect.frames.push({ tick, x, y, facing: Math.atan2(20, 10 * Math.cos(tick / 10)), distance });
}
const time = document.querySelector<HTMLInputElement>('#time')!,
  play = document.querySelector<HTMLButtonElement>('#play')!;
let seconds = 0.3,
  playing = false,
  previous = performance.now();
function draw() {
  const points = luxTrailParticles(effect, seconds * 60),
    vertices = luxTrailRibbon(points);
  ribbon.update(vertices, () => 0);
  renderer.render(scene, camera);
  document.querySelector('#time-value')!.textContent = `${seconds.toFixed(3)} s`;
  document.querySelector('#status')!.textContent =
    `Ready · ${points.length} live points · ${vertices.length / 3} triangles · ${renderer.info.render.calls} draw calls`;
  play.textContent = playing ? 'Pause' : 'Play';
  return {
    seconds,
    playing,
    points,
    vertices,
    calls: renderer.info.render.calls,
    geometries: renderer.info.memory.geometries,
  };
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
document.querySelector<HTMLInputElement>('#wireframe')!.addEventListener('change', (e) => {
  ribbon.mesh.material.wireframe = (e.target as HTMLInputElement).checked;
  draw();
});
play.addEventListener('click', () => {
  playing = !playing;
  previous = performance.now();
  if (playing && seconds >= 1.3) seconds = 0;
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
    seconds = Math.min(1.3, seconds + (now - previous) / 1000);
    if (seconds === 1.3) playing = false;
    time.value = String(seconds);
    draw();
  }
  previous = now;
});
(window as any).__TRAIL__ = { ready: true, state: draw };
draw();
