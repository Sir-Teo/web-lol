import * as THREE from 'three';
import { createParticleColorProductMaterial } from '../../src/render/particle-color-product';

const canvas = (id: string) => document.querySelector<HTMLCanvasElement>(`#${id}`)!;
const loader = new THREE.TextureLoader();
const load = async (name: string) => {
  const texture = await loader.loadAsync(`/assets/effects/lux-ba-${name}.png`);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};
const [ring, ramp, mote, spectral, trail, rainbow] = await Promise.all([
  load('ring04'),
  load('color-rampdown'),
  load('lux_base_r_mote'),
  load('color-spectralbell'),
  load('lux_base_q_trail'),
  load('lux_base_r_rainbowmult'),
]);
const pairs = {
  trail: {
    source: trail,
    lookup: rainbow,
    name: 'Lux Q trail · 128 × 128 · mesh MULT_PASS inspection',
  },
  crescent: { source: ring, lookup: ramp, name: 'Ring04 · 256 × 256' },
  hoop: { source: mote, lookup: spectral, name: 'Lux R mote · 128 × 128' },
};
const renderer = new THREE.WebGLRenderer({ canvas: canvas('product'), alpha: false });
renderer.setSize(384, 384, false);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;
const material = createParticleColorProductMaterial(ring, ramp);
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);
const emitter = document.querySelector<HTMLSelectElement>('#emitter')!;
const display = document.querySelector<HTMLSelectElement>('#display')!;
const x = document.querySelector<HTMLInputElement>('#x')!;
const y = document.querySelector<HTMLInputElement>('#y')!;
function redraw() {
  const composite = display.value === 'over-black';
  material.transparent = composite;
  material.blending = composite ? THREE.NormalBlending : THREE.NoBlending;
  document.querySelector('#product-caption')!.textContent = composite
    ? 'Color product · RGBA over black'
    : 'Color product · raw RGB';
  const pair = pairs[emitter.value as keyof typeof pairs];
  material.uniforms.sourceTexture.value = pair.source;
  material.uniforms.particleColorTexture.value = pair.lookup;
  material.uniforms.lookupUv.value.set(Number(x.value), Number(y.value));
  for (const id of ['x', 'y'])
    document.querySelector(`#${id}-value`)!.textContent = Number(
      id === 'x' ? x.value : y.value
    ).toFixed(2);
  for (const [id, texture] of [
    ['source', pair.source],
    ['lookup', pair.lookup],
  ] as const) {
    const ctx = canvas(id).getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 384, 384);
    ctx.drawImage(texture.image, 0, 0, 384, 384);
    if (id === 'lookup') {
      const px = Number(x.value) * 384,
        py = (1 - Number(y.value)) * 384;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 8, py - 8, 16, 16);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 10, py - 10, 20, 20);
    }
  }
  renderer.render(scene, camera);
  document.querySelector('#source-name')!.textContent = pair.name;
  document.querySelector('#status')!.textContent =
    `Ready · ${emitter.value} · lookup (${x.value}, ${y.value}) · source coordinates remain unresolved`;
}
for (const el of [emitter, x, y, display]) el.addEventListener('input', redraw);
redraw();

/** Read actual GPU RGBA with source texels and explicit inspection sampler state.
 * Tests supply independent CPU expectations from decoded PNG bytes.
 */
async function probe(options: {
  emitter: keyof typeof pairs;
  sourcePixel: [number, number];
  lookupPixel: [number, number];
  color: [number, number, number, number];
  coordinates: 'uniform' | 'vertex';
  quadMultiplier?: boolean;
}) {
  const pair = pairs[options.emitter];
  const base = pair.source.clone(),
    lookup = pair.lookup.clone();
  base.minFilter = base.magFilter = lookup.minFilter = lookup.magFilter = THREE.NearestFilter;
  base.needsUpdate = lookup.needsUpdate = true;
  const multiplier = options.quadMultiplier ? rainbow.clone() : undefined;
  if (multiplier) {
    multiplier.minFilter = multiplier.magFilter = THREE.NearestFilter;
    multiplier.needsUpdate = true;
  }
  const tested = createParticleColorProductMaterial(base, lookup, options.coordinates, multiplier);
  tested.uniforms.particleColor.value.fromArray(options.color);
  const uv = new THREE.Vector2(
    (options.lookupPixel[0] + 0.5) / lookup.image.width,
    1 - (options.lookupPixel[1] + 0.5) / lookup.image.height
  );
  tested.uniforms.lookupUv.value.copy(uv);
  if (options.coordinates === 'vertex') tested.uniforms.lookupUv.value.set(-1, -1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const sourceUv = geometry.getAttribute('uv');
  for (let i = 0; i < sourceUv.count; i++)
    sourceUv.setXY(
      i,
      (options.sourcePixel[0] + 0.5) / base.image.width,
      1 - (options.sourcePixel[1] + 0.5) / base.image.height
    );
  geometry.setAttribute(
    'particleLookupUv',
    new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => uv.toArray()).flat(), 2)
  );
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const probeScene = new THREE.Scene();
  probeScene.add(new THREE.Mesh(geometry, tested));
  const result = new Uint8Array(4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(probeScene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, result);
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    geometry.dispose();
    tested.dispose();
    base.dispose();
    lookup.dispose();
    multiplier?.dispose();
    redraw();
  }
  return Array.from(result);
}
(window as any).__PARTICLE_COLOR__ = { ready: true, probe };
