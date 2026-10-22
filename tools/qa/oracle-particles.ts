import * as THREE from 'three';
import profiles from '../../src/content/oracle-particles.json';
import {
  loadOracleParticles,
  OracleParticles,
  type OracleEffectInput,
  type OracleAnchor,
} from '../../src/render/oracle-particles';
import { oracleChildTick } from '../../src/render/oracle-particle-state';

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x101b23);
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
const effects = new OracleParticles(scene);
const system = document.querySelector<HTMLSelectElement>('#system')!,
  layer = document.querySelector<HTMLSelectElement>('#layer')!,
  scrub = document.querySelector<HTMLInputElement>('#time')!,
  move = document.querySelector<HTMLInputElement>('#move')!,
  terrain = document.querySelector<HTMLInputElement>('#terrain')!,
  play = document.querySelector<HTMLButtonElement>('#play')!;
for (const [index, p] of profiles.entries()) {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `${p.role} · ${p.name}${p.kind === 'child' ? ' · invisible child driver' : ''}`;
  layer.add(option);
}
const ground = (x: number, z: number) =>
  terrain.checked ? 0.8 * Math.sin(x / 220) * Math.cos(z / 300) : 0;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x20343a, side: THREE.DoubleSide })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.03;
scene.add(floor);
const grid = new THREE.GridHelper(30, 30, 0x486369, 0x2c4349);
scene.add(grid);
let playing = false,
  seconds = 0.3;
function anchorAt(tick: number): OracleAnchor {
  const x = move.checked ? Math.sin(tick / 120) * 230 : 0;
  return { position: [x, ground(x, 0) / 0.01, 0], facing: move.checked ? tick / 180 : 0 };
}
function inputs(): OracleEffectInput[] {
  const role = system.value,
    base = { id: 'preview', ownerId: 17, anchorAt };
  if (role !== 'sequence')
    return [
      {
        ...base,
        window: {
          role: role as 'buff' | 'death' | 'alert',
          startTick: 0,
          stopTick: role === 'buff' ? 480 : role === 'alert' ? 60 : null,
        },
      },
    ];
  const result: OracleEffectInput[] = [
    { ...base, window: { role: 'buff', startTick: 0, stopTick: 480 } },
  ];
  const child = oracleChildTick(0, 480)!;
  if (seconds * 60 >= child) {
    const born = anchorAt(child);
    result.push({
      ...base,
      id: 'child',
      window: { role: 'death', startTick: child, stopTick: null },
      anchorAt: () => ({
        position: [born.position[0], born.position[1] + 450, born.position[2]],
        facing: born.facing,
      }),
    });
  }
  return result;
}
function render() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
}
function seek(time: number) {
  seconds = time;
  scrub.value = String(time);
  effects.update(
    inputs(),
    time * 60,
    camera,
    ground,
    layer.value === 'all' ? null : Number(layer.value)
  );
  document.querySelector('#status')!.textContent =
    `${time.toFixed(3)}s · ${effects.models.size} visible particle objects · child dispatch ${(oracleChildTick(0, 480)! / 60).toFixed(3)}s · ${layer.value === '9' ? 'invisible driver has no geometry' : system.value}`;
  render();
}
function fit() {
  const box = new THREE.Box3();
  for (const model of effects.models.values()) box.expandByObject(model.root);
  if (box.isEmpty())
    box.setFromCenterAndSize(new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(12, 7, 12));
  const size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.25);
  camera.position.copy(center).add(new THREE.Vector3(0.9, 0.85, 1.5).multiplyScalar(span));
  camera.lookAt(center);
  camera.near = span / 1000;
  camera.far = Math.max(100, span * 20);
  camera.updateProjectionMatrix();
  seek(seconds);
}
function choose(index: number | null) {
  layer.value = index === null ? 'all' : String(index);
  if (index !== null) system.value = profiles[index].role;
  seek(seconds);
}
system.onchange = () => {
  layer.value = 'all';
  seek(seconds);
};
layer.onchange = () => choose(layer.value === 'all' ? null : Number(layer.value));
scrub.oninput = () => {
  playing = false;
  play.textContent = 'Play';
  seek(Number(scrub.value));
};
play.onclick = () => {
  playing = !playing;
  play.textContent = playing ? 'Pause' : 'Play';
};
document.querySelector<HTMLButtonElement>('#fit')!.onclick = fit;
move.onchange = () => seek(seconds);
terrain.onchange = () => {
  const positions = floor.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++)
    positions.setZ(i, ground(positions.getX(i) / 0.01, -positions.getY(i) / 0.01));
  positions.needsUpdate = true;
  grid.visible = !terrain.checked;
  seek(seconds);
};
function resize() {
  const height = Math.max(360, innerHeight - 180);
  renderer.setSize(innerWidth, height);
  camera.aspect = innerWidth / height;
  camera.updateProjectionMatrix();
  render();
}
await loadOracleParticles();
camera.position.set(14, 14, 20);
camera.lookAt(0, 2.5, 0);
resize();
seek(seconds);
window.addEventListener('resize', resize);
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing) seek((seconds + dt) % 13);
});
Object.assign(window, {
  __ORACLE_PARTICLES__: {
    ready: true,
    effects,
    profiles,
    choose,
    seek,
    fit,
    render,
    renderer,
    scene,
    camera,
    ground,
    inputs,
  },
});
