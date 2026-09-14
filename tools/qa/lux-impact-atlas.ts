import * as THREE from 'three';
import { particleAtlasUv } from '../../src/render/particle-atlas';
import { createParticleColorProductMaterial } from '../../src/render/particle-color-product';

const texture = await new THREE.TextureLoader().loadAsync(
  '/assets/effects/lux-hit-globaltargethit01.png'
);
texture.flipY = false;
texture.colorSpace = THREE.NoColorSpace;
texture.generateMipmaps = false;
texture.minFilter = texture.magFilter = THREE.NearestFilter;
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector<HTMLCanvasElement>('#atlas-cell')!,
});
renderer.setSize(256, 340, false);
const material = createParticleColorProductMaterial(texture, white);
const geometry = new THREE.PlaneGeometry(2, 2);
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(geometry, material));
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;
const select = document.querySelector<HTMLSelectElement>('#atlas-frame')!;
function setFrame(frame: number) {
  const uv = geometry.getAttribute('uv');
  // PlaneGeometry's vertices are top-left, top-right, bottom-left, bottom-right.
  for (let i = 0; i < 4; i++)
    uv.setXY(i, ...particleAtlasUv(2, 3, frame, i % 2, Math.floor(i / 2)));
  uv.needsUpdate = true;
  select.value = String(frame);
  renderer.render(scene, camera);
  document.querySelector('#atlas-status')!.textContent =
    `Frame ${frame} · column ${frame % 2}, row ${Math.floor(frame / 2)} · source RGBA, nearest sampling`;
}
select.addEventListener('change', () => setFrame(Number(select.value)));
setFrame(4);

async function probe(data: number[], width: number, height: number, frame: number) {
  const synthetic = new THREE.DataTexture(new Uint8Array(data), width, height);
  synthetic.needsUpdate = true;
  synthetic.flipY = false;
  synthetic.minFilter = synthetic.magFilter = THREE.NearestFilter;
  const target = new THREE.WebGLRenderTarget(width / 2, height / 3, {
    depthBuffer: false,
    stencilBuffer: false,
  });
  material.uniforms.sourceTexture.value = synthetic;
  setFrame(frame);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array((((width / 2) * height) / 3) * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width / 2, height / 3, pixels);
  renderer.setRenderTarget(null);
  material.uniforms.sourceTexture.value = texture;
  target.dispose();
  synthetic.dispose();
  setFrame(Number(select.value));
  return Array.from(pixels);
}
(window as any).__LUX_IMPACT_ATLAS__ = { ready: true, setFrame, probe };
