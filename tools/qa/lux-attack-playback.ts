import { luxEmissionCount } from '../../src/content/lux-emission';
import { LUX_BASIC_TRAIL } from '../../src/content/lux-basic-trail';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadLuxCrescentAssets, LuxCrescentMesh } from '../../src/render/lux-attack-crescents';
import { luxCrescentParticles } from '../../src/render/lux-crescent-particles';
import { LuxRibbonMesh } from '../../src/render/lux-attack-trails';
import { luxTrailParticles } from '../../src/render/lux-trail-particles';
import { luxTrailRibbon } from '../../src/render/lux-trail-ribbon';
import { LuxHoopCloud } from '../../src/render/lux-hoop-cloud';
import { luxAttackHoopParticles } from '../../src/render/lux-attack-hoops';
import type { LuxAttackVisual } from '../../src/simulation/types';
const crescentAssets = await loadLuxCrescentAssets();
const textures = await Promise.all(
  ['lux_base_q_trail', 'lux_base_r_rainbowmult', 'lux_base_r_mote', 'color-spectralbell'].map(
    async (name, i) => {
      const t = await new THREE.TextureLoader().loadAsync(`/assets/effects/lux-ba-${name}.png`);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      if (i < 2) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    }
  )
);
const host = document.querySelector<HTMLDivElement>('#view')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10232b);
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(6, 7, 9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();
scene.add(new THREE.GridHelper(10, 10, 0x607573, 0x29434a));
const crescents = new LuxCrescentMesh(
  crescentAssets.geometry,
  crescentAssets.source,
  crescentAssets.ramp
);
const ribbon = new LuxRibbonMesh(textures[0], textures[1]),
  hoop = new LuxHoopCloud(textures[2], textures[3]);
scene.add(crescents.mesh, ribbon.mesh, hoop.mesh);
const effect: LuxAttackVisual = {
  id: 42,
  sourceId: 1,
  team: 'blue',
  origin: { x: -250, y: 0 },
  launchTick: 0,
  stopTick: 21,
  frames: [],
};
let trailDistance = 0;
let previousBirth: { x: number; y: number } | undefined;
for (let tick = 0; tick <= 21; tick++) {
  const x = -250 + tick * 20,
    y = 50 * Math.sin(tick / 8);
  const count = luxEmissionCount(
    LUX_BASIC_TRAIL.rate,
    tick,
    LUX_BASIC_TRAIL.emitterLife,
    effect.stopTick!
  );
  const prior = luxEmissionCount(
    LUX_BASIC_TRAIL.rate,
    tick - 1,
    LUX_BASIC_TRAIL.emitterLife,
    effect.stopTick!
  );
  if (count > prior) {
    if (previousBirth) trailDistance += Math.hypot(x - previousBirth.x, y - previousBirth.y);
    previousBirth = { x, y };
  }
  effect.frames.push({
    tick,
    x,
    y,
    facing: Math.atan2(20, 6.25 * Math.cos(tick / 8)),
    trailDistance,
  });
}
const time = document.querySelector<HTMLInputElement>('#time')!,
  play = document.querySelector<HTMLButtonElement>('#play')!;
let seconds = 0.2,
  playing = false,
  previous = performance.now();
function draw() {
  const meshParticles = luxCrescentParticles(effect, seconds * 60),
    vertices = luxTrailRibbon(luxTrailParticles(effect, seconds * 60));
  const motes = luxAttackHoopParticles(effect, seconds * 60).map((p) => ({
    ...p,
    position: [p.position[0], p.position[1] + 90, p.position[2]] as const,
  }));
  crescents.update(meshParticles, () => 0);
  ribbon.update(vertices, () => 0);
  hoop.draw(motes, camera);
  for (const [id, mesh, count] of [
    ['crescent', crescents.mesh, meshParticles.length],
    ['ribbon', ribbon.mesh, vertices.length],
    ['hoop', hoop.mesh, motes.length],
  ] as const)
    mesh.visible = count > 0 && document.querySelector<HTMLInputElement>(`#${id}`)!.checked;
  renderer.render(scene, camera);
  document.querySelector('#time-value')!.textContent = `${seconds.toFixed(3)} s`;
  document.querySelector('#status')!.textContent =
    `Ready · ${meshParticles.length} crescents · ${vertices.length / 3} ribbon triangles · ${motes.length} motes · ${renderer.info.render.calls} draw calls`;
  play.textContent = playing ? 'Pause' : 'Play';
  return {
    seconds,
    playing,
    meshParticles,
    vertices,
    motes,
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
for (const id of ['crescent', 'ribbon', 'hoop'])
  document.querySelector(`#${id}`)!.addEventListener('change', draw);
play.addEventListener('click', () => {
  playing = !playing;
  previous = performance.now();
  if (playing && seconds >= 1) seconds = 0;
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
    seconds = Math.min(1, seconds + (now - previous) / 1000);
    if (seconds === 1) playing = false;
    time.value = String(seconds);
    draw();
  }
  previous = now;
});
(window as any).__LUX_ATTACK__ = { ready: true, state: draw };
draw();
