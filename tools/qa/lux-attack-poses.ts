import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { luxAttackOrigin } from '../../src/content/lux-attack-origin';
import first from '../../src/content/lux-attack-origin.json';
import second from '../../src/content/lux-attack-origin-2.json';
import { LUX } from '../../src/content/lux-progression';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1c25');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1200, 600, false);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.querySelector('#viewport')!.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(35, 2, 0.01, 100);
camera.position.set(0, 2.6, 6.3);
camera.lookAt(0, 0.95, 0);
scene.add(new THREE.GridHelper(12, 24, '#38515d', '#213946'));
const gltf = await new GLTFLoader().loadAsync('/assets/models/lux-base.glb');
const actors = [first, second].map((curve, i) => {
  const root = new THREE.Group();
  root.position.x = i === 0 ? -2 : 2;
  const model = clone(gltf.scene);
  root.add(model);
  scene.add(root);
  const clip = gltf.animations.find((a) => a.name === curve.clip)!;
  const mixer = new THREE.AnimationMixer(model),
    action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const geometry = new THREE.BufferGeometry().setFromPoints(
    curve.positions.map((p) => new THREE.Vector3().fromArray(p))
  );
  const path = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: '#e8bc65', transparent: true, opacity: 0.7 })
  );
  root.add(path);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#70f4f0', depthTest: false })
  );
  marker.renderOrder = 10;
  root.add(marker);
  const hand = model.getObjectByName('R_Hand')!;
  return { root, mixer, action, path, marker, hand, clip };
});
const phaseInput = document.querySelector<HTMLInputElement>('#phase')!;
const paths = document.querySelector<HTMLInputElement>('#paths')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const periodTicks = Math.round(60 / LUX.attackSpeed),
  period = periodTicks / 60;
let phase = LUX.windupTicks / periodTicks,
  playing = false,
  previous = 0;
function draw() {
  const errors = actors.map((actor, i) => {
    actor.action.time = actor.clip.duration * phase;
    actor.mixer.update(0);
    actor.root.updateMatrixWorld(true);
    actor.hand.getWorldPosition(actor.marker.position);
    actor.root.worldToLocal(actor.marker.position);
    const expected = new THREE.Vector3(
      ...luxAttackOrigin(actor.action.time, i === 0 ? 'attack1' : 'attack2')
    );
    actor.path.visible = paths.checked;
    actor.marker.visible = paths.checked;
    return actor.marker.position.distanceTo(expected);
  });
  phaseInput.value = String(phase);
  document.querySelector('#status')!.textContent =
    `Cycle ${(phase * period).toFixed(3)} s · clip ${(phase * actors[0].clip.duration).toFixed(3)} s · hand error ${Math.max(...errors).toExponential(2)} world units`;
  renderer.render(scene, camera);
  return { phase, playing, paths: paths.checked, errors, clips: actors.map((a) => a.clip.name) };
}
phaseInput.addEventListener('input', () => {
  playing = false;
  play.textContent = 'Play';
  phase = Number(phaseInput.value);
  draw();
});
play.addEventListener('click', () => {
  playing = !playing;
  play.textContent = playing ? 'Pause' : 'Play';
});
document.querySelector('#release')!.addEventListener('click', () => {
  playing = false;
  play.textContent = 'Play';
  phase = LUX.windupTicks / periodTicks;
  draw();
});
paths.addEventListener('change', draw);
renderer.setAnimationLoop((time) => {
  if (playing && previous) phase = (phase + Math.min(0.1, (time - previous) / 1000) / period) % 1;
  previous = time;
  if (playing) draw();
});
draw();
(window as any).__LUX_POSES__ = { ready: true, state: draw };
