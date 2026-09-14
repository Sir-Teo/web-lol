import * as THREE from 'three';
import { createParticleColorProductMaterial } from '../../src/render/particle-color-product';

function dataTexture(data: number[], width = 1, height = 1) {
  const t = new THREE.DataTexture(new Uint8Array(data), width, height);
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}
const loader = new THREE.TextureLoader();
const [spark, palette] = await Promise.all(
  ['lux_base_r_spark', 'flame_trail_gradient'].map(async (name) => {
    const t = await loader.loadAsync(`/assets/effects/lux-hit-${name}.png`);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    return t;
  })
);
const white = dataTexture([255, 255, 255, 255]);
const scene = new THREE.Scene();
const geometry = new THREE.PlaneGeometry(2, 2);
const uv = geometry.getAttribute('uv');
for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
const rawMaterial = createParticleColorProductMaterial(spark, white);
const paletteMaterial = createParticleColorProductMaterial(
  spark,
  white,
  'uniform',
  undefined,
  false,
  {
    texture: palette,
    sourceMix: [0, 1, 0, 0],
    row: 0.95,
  }
);
const mesh = new THREE.Mesh(geometry, rawMaterial);
scene.add(mesh);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;
const sourceRenderer = new THREE.WebGLRenderer({
  canvas: document.querySelector<HTMLCanvasElement>('#source')!,
});
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector<HTMLCanvasElement>('#palette')!,
});
for (const r of [sourceRenderer, renderer]) r.setSize(320, 320, false);
mesh.material = rawMaterial;
sourceRenderer.render(scene, camera);
const row = document.querySelector<HTMLInputElement>('#row')!;
function draw() {
  paletteMaterial.uniforms.paletteRow.value = (Number(row.value) + 0.5) / 10;
  mesh.material = paletteMaterial;
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent =
    ` ${row.value} / 9 · V=${paletteMaterial.uniforms.paletteRow.value.toFixed(2)}`;
}
row.addEventListener('input', draw);
draw();
interface Probe {
  source: number[];
  lookup: number[];
  palette: number[];
  width: number;
  height: number;
  mix: [number, number, number, number];
  row: number;
  scroll: [number, number];
  tint: number[];
  multiplier?: number[];
}
function probe(p: Probe) {
  const textures = [
    dataTexture(p.source),
    dataTexture(p.lookup),
    dataTexture(p.palette, p.width, p.height),
  ];
  const mult = p.multiplier ? dataTexture(p.multiplier) : undefined;
  if (mult) textures.push(mult);
  const material = createParticleColorProductMaterial(
    textures[0],
    textures[1],
    'uniform',
    mult,
    false,
    {
      texture: textures[2],
      sourceMix: p.mix,
      row: p.row,
      scroll: p.scroll,
    }
  );
  material.uniforms.particleColor.value.fromArray(p.tint);
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  mesh.material = material;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixel = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
  renderer.setRenderTarget(null);
  target.dispose();
  material.dispose();
  textures.forEach((t) => t.dispose());
  draw();
  return Array.from(pixel);
}
(window as any).__PARTICLE_PALETTE__ = { ready: true, probe };
