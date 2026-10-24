import * as THREE from 'three';
import { createParticleSkinMultMaterial } from '../../src/render/particle-skin-mult-material';

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector<HTMLCanvasElement>('#view')!,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }),
  scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10),
  geometry = new THREE.PlaneGeometry(2, 2),
  bone = new THREE.Bone(),
  skeleton = new THREE.Skeleton([bone]),
  mesh = new THREE.SkinnedMesh<THREE.PlaneGeometry, THREE.Material>(geometry),
  target = new THREE.WebGLRenderTarget(4, 4, { colorSpace: THREE.NoColorSpace }),
  floatTarget = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.FloatType,
    colorSpace: THREE.NoColorSpace,
  }),
  materials = new Map<string, THREE.ShaderMaterial>();
renderer.setSize(4, 4, false);
camera.position.z = 3;
geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(16).fill(0), 4));
geometry.setAttribute(
  'skinWeight',
  new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)
);
mesh.add(bone);
mesh.bind(skeleton);
mesh.frustumCulled = false;
scene.add(mesh);
function texture(values: number[], width = 1) {
  const t = new THREE.DataTexture(new Uint8Array(values), width, 1);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
function probe(o: any) {
  const source = texture(o.source, o.sourceWidth ?? 1),
    multiplier = texture(o.multiplier, o.multWidth ?? 1),
    remap = o.remap ? texture(o.remap) : undefined,
    key = `${o.alphaRef !== undefined}:${!!remap}`;
  let material = materials.get(key);
  if (!material) {
    material = createParticleSkinMultMaterial({
      texture: source,
      multiplier,
      fresnel: o.power ?? 1,
      fresnelColor: o.rim ?? [0, 0, 0],
      ...(o.alphaRef !== undefined ? { alphaRef: o.alphaRef } : {}),
      ...(remap ? { remap } : {}),
    });
    material.blending = THREE.NoBlending;
    material.transparent = false;
    material.depthTest = false;
    material.depthWrite = false;
    materials.set(key, material);
  }
  const u = material.uniforms;
  u.sourceTexture.value = source;
  u.multiplierTexture.value = multiplier;
  u.particleColor.value.fromArray(o.tint);
  u.fresnelPower.value = o.power ?? 1;
  u.fresnelColor.value.fromArray(o.rim ?? [0, 0, 0]);
  u.sourceUvTransform.value.identity();
  u.multiplierUvTransform.value.identity();
  if (o.sourceTransform) u.sourceUvTransform.value.fromArray(o.sourceTransform);
  if (o.multTransform) u.multiplierUvTransform.value.fromArray(o.multTransform);
  if (remap) u.remapTexture.value = remap;
  if (o.alphaRef !== undefined) u.alphaRef.value = o.alphaRef;
  const position = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv'),
    facing = o.facing ?? 1;
  for (let i = 0; i < position.count; i++) {
    const ray = new THREE.Vector3()
        .fromBufferAttribute(position, i)
        .negate()
        .add(camera.position)
        .normalize(),
      across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), ray).normalize(),
      n = ray.multiplyScalar(facing).addScaledVector(across, Math.sqrt(1 - facing * facing));
    normal.setXYZ(i, n.x, n.y, n.z);
    uv.setXY(i, ...((o.uv ?? [0.5, 0.5]) as [number, number]));
  }
  normal.needsUpdate = uv.needsUpdate = true;
  mesh.material = material;
  renderer.setClearColor(new THREE.Color().setRGB(0.02, 0.04, 0.06), 0.25);
  const destination = o.float ? floatTarget : target;
  renderer.setRenderTarget(destination);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = o.float ? new Float32Array(4) : new Uint8Array(4);
  renderer.readRenderTargetPixels(destination, 2, 2, 1, 1, pixels);
  const error = renderer.getContext().getError();
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(scene, camera);
  for (const t of [source, multiplier, remap]) t?.dispose();
  return { pixels: [...pixels], error };
}
(window as any).__SKIN_MULT__ = { ready: true, renderer, probe };
