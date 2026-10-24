import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createLeonaEclipseSkinMaterial } from '../../src/render/leona-eclipse-skin-material';
import descriptions from '../../docs/reference/leona-w-skin-materials.json';
import { sampleParticleCurve } from '../../src/render/particle-curves';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setSize(1280, 600, false);
renderer.setClearColor(0x10171e, 1);
const camera = new THREE.PerspectiveCamera(28, 1280 / 600, 0.01, 100);
camera.position.set(0, 1.3, 10);
camera.lookAt(0, 1, 0);
const scene = new THREE.Scene();
// A scene background reapplies the clear color after WebGL context restoration.
scene.background = new THREE.Color(0x10171e);
const textures = new Map<string, THREE.Texture>();
async function texture(path: string, nearest = false) {
  const key = path + nearest;
  if (!textures.has(key)) {
    const t = await new THREE.TextureLoader().loadAsync('/' + path);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.wrapS = t.wrapT = path.includes('erosion')
      ? THREE.MirroredRepeatWrapping
      : THREE.ClampToEdgeWrapping;
    textures.set(key, t);
  }
  return textures.get(key)!;
}
const gltf = await new GLTFLoader().loadAsync('/assets/models/leona-base.glb');
const layers: {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  mesh: THREE.SkinnedMesh;
  cpu: THREE.Mesh;
  material: THREE.ShaderMaterial;
}[] = [];
for (const [i, p] of descriptions.profiles.entries()) {
  const root = clone(gltf.scene),
    meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) meshes.push(o);
  });
  if (meshes.length !== 1) throw Error('Expected one complete Leona source skin');
  const mesh = meshes[0],
    e = p.erosion;
  const material = createLeonaEclipseSkinMaterial({
    texture: await texture(p.texture),
    fresnel: p.fresnel,
    fresnelColor: p.fresnelColor as [number, number, number],
    ...(e
      ? {
          erosion: {
            texture: await texture(e.texture),
            mixer: e.mixer as [number, number, number, number],
            featherIn: e.featherIn,
            featherOut: e.featherOut,
            sliceWidth: e.sliceWidth,
          },
        }
      : {}),
  });
  mesh.material = material;
  mesh.frustumCulled = false;
  const cpu = new THREE.Mesh(mesh.geometry.clone(), material);
  cpu.geometry.deleteAttribute('skinIndex');
  cpu.geometry.deleteAttribute('skinWeight');
  cpu.matrixAutoUpdate = false;
  cpu.frustumCulled = false;
  cpu.visible = false;
  mesh.parent!.add(cpu);
  const bounds = new THREE.Box3().setFromObject(root),
    scale = 2.2 / (bounds.max.y - bounds.min.y);
  const holder = new THREE.Group();
  holder.position.set((i - 1.5) * 2.05, -bounds.min.y * scale, 0);
  holder.scale.setScalar(scale);
  holder.add(root);
  scene.add(holder);
  layers.push({ root, mesh, cpu, material, mixer: new THREE.AnimationMixer(root) });
}
function pose(clip: string, time: number, phase: number, cpuSkinning = false) {
  const animation = gltf.animations.find((c) => c.name === clip);
  if (!animation) throw Error('Missing source clip ' + clip);
  scene.updateMatrixWorld(true);
  layers.forEach((l, i) => {
    l.mixer.stopAllAction();
    const action = l.mixer.clipAction(animation);
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    action.time = Math.min(time, animation.duration);
    action.paused = true;
    l.mixer.update(0);
    l.root.updateMatrixWorld(true);
    l.mesh.skeleton.update();
    const p = descriptions.profiles[i],
      c = p.color;
    l.material.uniforms.particleColor.value.fromArray(
      p.birthColor.map((v, j) => v * sampleParticleCurve(c, phase, j))
    );
    if (p.erosion)
      l.material.uniforms.erosionParameters.value.x = sampleParticleCurve(
        { times: p.erosion.drive.times, values: p.erosion.drive.values.map((v) => [v]) },
        phase,
        0
      );
    if (cpuSkinning) {
      const source = l.mesh.geometry,
        position = l.cpu.geometry.getAttribute('position'),
        normal = l.cpu.geometry.getAttribute('normal'),
        indices = source.getAttribute('skinIndex'),
        weights = source.getAttribute('skinWeight'),
        n = new THREE.Vector3(),
        v = new THREE.Vector3(),
        blended = new THREE.Matrix4(),
        bone = new THREE.Matrix4(),
        transform = new THREE.Matrix4();
      for (let j = 0; j < position.count; j++) {
        v.fromBufferAttribute(source.getAttribute('position'), j);
        l.mesh.applyBoneTransform(j, v);
        position.setXYZ(j, v.x, v.y, v.z);
        blended.elements.fill(0);
        for (let k = 0; k < 4; k++) {
          bone.fromArray(l.mesh.skeleton.boneMatrices!, indices.getComponent(j, k) * 16);
          const weight = weights.getComponent(j, k);
          for (let q = 0; q < 16; q++) blended.elements[q] += bone.elements[q] * weight;
        }
        transform.copy(l.mesh.bindMatrixInverse).multiply(blended).multiply(l.mesh.bindMatrix);
        n.fromBufferAttribute(source.getAttribute('normal'), j).applyMatrix3(
          new THREE.Matrix3().setFromMatrix4(transform)
        );
        normal.setXYZ(j, n.x, n.y, n.z);
      }
      position.needsUpdate = normal.needsUpdate = true;
      l.cpu.matrix.copy(l.mesh.matrix);
    }
    l.mesh.visible = !cpuSkinning;
    l.cpu.visible = cpuSkinning;
  });
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent =
    `${clip} · ${time.toFixed(2)}s · erosion phase ${phase.toFixed(2)} · ${cpuSkinning ? 'CPU' : 'GPU'} skinning`;
}
function frame() {
  const gl = renderer.getContext(),
    pixels = new Uint8Array(1280 * 600 * 4);
  gl.readPixels(0, 0, 1280, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}
const gpuRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
gpuRenderer.setSize(4, 4);
const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType });
const probeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
probeCamera.position.z = 3;
const probeScene = new THREE.Scene(),
  geometry = new THREE.PlaneGeometry(2, 2);
const probeMesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(geometry);
probeScene.add(probeMesh);
const probeMaterials = new Map<string, THREE.ShaderMaterial>();
function data(values: number[], width = 1) {
  const t = new THREE.DataTexture(new Uint8Array(values), width, 1);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
async function probe(o: any) {
  const own: THREE.Texture[] = [];
  const make = (values: number[], width = 1) => {
    const t = data(values, width);
    own.push(t);
    return t;
  };
  const source = o.sourcePath ? await texture(o.sourcePath, true) : make(o.source, o.width ?? 1);
  const erosionTexture = o.erosionPath
    ? await texture(o.erosionPath, true)
    : o.erosion
      ? make(o.erosion.texel, o.width ?? 1)
      : undefined;
  const remap = o.remap ? make(o.remap) : undefined;
  const key = `${!!erosionTexture}:${!!remap}`;
  let material = probeMaterials.get(key);
  if (!material) {
    material = createLeonaEclipseSkinMaterial({
      texture: source,
      fresnel: o.power,
      fresnelColor: o.rim,
      ...(erosionTexture
        ? {
            erosion: {
              texture: erosionTexture,
              mixer: o.erosion.mixer,
              featherIn: o.erosion.in,
              featherOut: o.erosion.out,
              sliceWidth: o.erosion.slice,
            },
          }
        : {}),
      ...(remap ? { remap } : {}),
    });
    material.transparent = false;
    material.blending = THREE.NoBlending;
    material.depthTest = false;
    material.polygonOffset = false;
    probeMaterials.set(key, material);
  }
  material.uniforms.sourceTexture.value = source;
  material.uniforms.particleColor.value.fromArray(o.tint);
  material.uniforms.fresnelPower.value = o.power;
  material.uniforms.fresnelColor.value.fromArray(o.rim);
  material.uniforms.sourceUvTransform.value.identity();
  if (o.transform) material.uniforms.sourceUvTransform.value.fromArray(o.transform);
  if (remap) material.uniforms.remapTexture.value = remap;
  if (erosionTexture) {
    material.uniforms.erosionTexture.value = erosionTexture;
    material.uniforms.erosionMixer.value.fromArray(o.erosion.mixer);
    material.uniforms.erosionParameters.value.set(
      o.erosion.drive,
      o.erosion.slice,
      1 / o.erosion.in,
      1 / o.erosion.out
    );
  }
  const normal = geometry.getAttribute('normal'),
    position = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const ray = new THREE.Vector3()
      .fromBufferAttribute(position, i)
      .negate()
      .add(probeCamera.position)
      .normalize();
    // The square's symmetric XY coordinates cancel exactly at grazing incidence.
    // A Y-axis cross introduced tiny positive dot error, amplified by power 0.05.
    const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), ray).normalize();
    const n = ray
      .multiplyScalar(o.facing)
      .addScaledVector(across, Math.sqrt(1 - o.facing * o.facing));
    normal.setXYZ(i, n.x, n.y, n.z);
    uv.setXY(i, ...((o.uv ?? [0.5, 0.5]) as [number, number]));
  }
  normal.needsUpdate = uv.needsUpdate = true;
  probeMesh.material = material;
  gpuRenderer.setRenderTarget(target);
  gpuRenderer.clear();
  gpuRenderer.render(probeScene, probeCamera);
  const pixels = new Uint8Array(4);
  gpuRenderer.readRenderTargetPixels(target, 2, 2, 1, 1, pixels);
  const error = gpuRenderer.getContext().getError();
  own.forEach((t) => t.dispose());
  return { pixels: [...pixels], error };
}
pose('spell2_idle', 0.4, 0.45);
// Finish the initial skin/bone-texture upload before publishing readiness.
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
pose('spell2_idle', 0.4, 0.45);
document.querySelector('#idle')!.addEventListener('click', () => pose('spell2_idle', 0.4, 0.45));
document.querySelector('#walk')!.addEventListener('click', () => pose('spell2_run', 0.22, 0.45));
document.querySelector('#burst')!.addEventListener('click', () => pose('spell2_attack', 0.35, 0.9));
(window as any).__ECLIPSE_SKIN__ = {
  ready: true,
  renderer,
  scene,
  camera,
  layers,
  pose,
  frame,
  probe,
};
