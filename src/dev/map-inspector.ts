import type { MapTextureResidency } from '../render/map-texture-residency';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadRift } from '../render/rift-assets';
import './map-inspector.css';

const host = document.querySelector<HTMLDivElement>('#map-root')!;
host.innerHTML = `<header><div><small>REFERENCE INSPECTION · 16.18</small><h1>Summoner’s Rift</h1></div>
<nav aria-label="Map viewpoints"><button data-view="overview">Overview</button><button data-view="blue">Blue base</button><button data-view="mid">Mid lane</button><button data-view="river">River</button><button data-view="red">Red base</button><button id="grid" aria-pressed="false">Navigation</button><a href="./">Practice game ↗</a></nav></header>
<div id="status" role="status">Loading the full-resolution map…</div>
<footer>Drag to orbit · Right-drag to pan · Scroll to zoom<span>Static terrain study · Buildings and effects pending</span></footer>`;
const status = document.querySelector<HTMLDivElement>('#status')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
host.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a151c');
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 1200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 10;
controls.maxDistance = 350;
const ambient = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambient);
// Source coordinates remain untouched in the artifact. Reflect Z so Order's
// (low X, low Z) base appears southwest, with +Y still representing elevation.
const map = new THREE.Group();
map.scale.set(0.01, 0.01, -0.01);
map.position.set(-74.25, 0, 74.25);
scene.add(map);
const views: Record<string, [number, number, number]> = {
  overview: [7425, 7425, 210],
  blue: [2200, 2200, 44],
  mid: [7425, 7425, 44],
  river: [10000, 4600, 48],
  red: [12500, 12500, 44],
};
function viewpoint(name: string): void {
  const [x, z, distance] = views[name];
  const target = new THREE.Vector3((x - 7425) * 0.01, 0, (7425 - z) * 0.01);
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(0, distance * 0.8, distance * 0.6));
  controls.update();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => viewpoint(button.dataset.view!));
}
viewpoint('overview');

interface NavigationMetadata {
  width: number;
  height: number;
  heightWidth: number;
  heightHeight: number;
  heightSpacing: [number, number];
  minimum: [number, number, number];
  cellSize: number;
  sections: { flags: [number, number]; heights: [number, number] };
}

async function navigationOverlay(): Promise<THREE.Mesh> {
  const [metadataResponse, bytesResponse] = await Promise.all([
    fetch('assets/maps/rift-nav.json'),
    fetch('assets/maps/rift-nav.bin'),
  ]);
  if (!metadataResponse.ok || !bytesResponse.ok)
    throw new Error('Navigation assets could not be loaded');
  const metadata = (await metadataResponse.json()) as NavigationMetadata;
  const data = new DataView(await bytesResponse.arrayBuffer());
  const positions: number[] = [],
    colors: number[] = [];
  function height(x: number, z: number): number {
    const gx = Math.max(
      0,
      Math.min(metadata.heightWidth - 1, (x - metadata.minimum[0]) / metadata.heightSpacing[0])
    );
    const gz = Math.max(
      0,
      Math.min(metadata.heightHeight - 1, (z - metadata.minimum[2]) / metadata.heightSpacing[1])
    );
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      tx = gx - ix,
      tz = gz - iz;
    const read = (dx: number, dz: number) =>
      data.getFloat32(
        metadata.sections.heights[0] +
          4 *
            (Math.min(iz + dz, metadata.heightHeight - 1) * metadata.heightWidth +
              Math.min(ix + dx, metadata.heightWidth - 1)),
        true
      );
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(read(0, 0), read(1, 0), tx),
      THREE.MathUtils.lerp(read(0, 1), read(1, 1), tx),
      tz
    );
  }
  for (let z = 0; z < metadata.height; z++)
    for (let x = 0; x < metadata.width; x++) {
      const flags = data.getUint16(metadata.sections.flags[0] + 2 * (z * metadata.width + x), true);
      if (!(flags & 7)) continue;
      const color = flags & 1 ? [0.1, 1, 0.35] : flags & 64 ? [0.1, 0.8, 1] : [1, 0.25, 0.15];
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 1],
        [1, 0],
        [1, 1],
      ]) {
        const px = metadata.minimum[0] + (x + dx) * metadata.cellSize;
        const pz = metadata.minimum[2] + (z + dz) * metadata.cellSize;
        positions.push(px, height(px, pz) + 12, pz);
        colors.push(...color);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
}

let ready = false;
let textureResidency: MapTextureResidency | undefined;
async function load(): Promise<void> {
  const terrain = await loadRift(
    renderer,
    new URLSearchParams(location.search).get('textures') === 'webp'
  );
  map.add(terrain);
  textureResidency = terrain.userData.textureResidency;
  const overlay = await navigationOverlay();
  overlay.visible = false;
  map.add(overlay);
  const button = document.querySelector<HTMLButtonElement>('#grid')!;
  button.addEventListener('click', () => {
    overlay.visible = !overlay.visible;
    button.setAttribute('aria-pressed', String(overlay.visible));
  });
  await renderer.compileAsync(scene, camera);
  ready = true;
  status.hidden = true;
}
void load().catch((error: unknown) => {
  status.textContent = 'Map loading failed. Reload to retry.';
  console.error(error);
});
renderer.setAnimationLoop(() => {
  controls.update();
  textureResidency?.beginFrame();
  renderer.render(scene, camera);
  textureResidency?.endFrame();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
if (import.meta.env.DEV) {
  Object.assign(window, {
    __MAP__: {
      get ready() {
        return ready;
      },
      renderer,
      scene,
      camera,
      map,
      viewpoint,
    },
  });
}
