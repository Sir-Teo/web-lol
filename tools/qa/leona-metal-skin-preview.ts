import * as THREE from 'three';
import { createLeonaEclipseSkinMaterial } from '../../src/render/leona-eclipse-skin-material';

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector<HTMLCanvasElement>('#view')!,
  antialias: false,
  alpha: true,
});
renderer.setSize(1, 1, false);
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType }),
  scene = new THREE.Scene(),
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
camera.position.z = 1000;
const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
);
geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(6), 2));
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(12), 4));
geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(12), 4));
const bones = Array.from({ length: 256 }, () => new THREE.Bone());
const skeleton = new THREE.Skeleton(
  bones,
  bones.map(() => new THREE.Matrix4())
);
const mesh = new THREE.SkinnedMesh(geometry);
mesh.frustumCulled = false;
mesh.add(...bones);
mesh.bind(skeleton, new THREE.Matrix4());
scene.add(mesh);
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function texture(bytes: number[], width = 1) {
  const t = new THREE.DataTexture(new Uint8Array(bytes), width, 1);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
function probe(o: any) {
  const source = texture(o.source, o.width ?? 1),
    erosion = texture(o.erosion.texel, o.width ?? 1),
    remap = texture(o.remap ?? [0, 0, 0, 0]);
  const material = createLeonaEclipseSkinMaterial({
    texture: source,
    fresnel: o.power,
    fresnelColor: o.rim,
    remap,
    erosion: {
      texture: erosion,
      mixer: o.erosion.mixer,
      featherIn: o.erosion.in,
      featherOut: o.erosion.out,
      sliceWidth: o.erosion.slice,
    },
  });
  material.transparent = false;
  material.blending = THREE.NoBlending;
  material.depthTest = false;
  material.polygonOffset = false;
  material.uniforms.particleColor.value.fromArray(o.tint);
  material.uniforms.erosionParameters.value.x = o.erosion.drive;
  material.uniforms.sourceUvTransform.value.fromArray(o.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const normal = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv'),
    weights = geometry.getAttribute('skinWeight'),
    indices = geometry.getAttribute('skinIndex');
  for (let i = 0; i < 3; i++) {
    normal.setXYZ(
      i,
      ...((o.normals?.slice(i * 3, i * 3 + 3) ?? o.normal) as [number, number, number])
    );
    uv.setXY(i, ...((o.uv ?? [0.25, 0.5]) as [number, number]));
    weights.setXYZW(
      i,
      ...((o.weights?.length === 12
        ? o.weights.slice(i * 4, i * 4 + 4)
        : (o.weights ?? [1, 0, 0, 0])) as [number, number, number, number])
    );
    indices.setXYZW(i, ...((o.joints ?? [0, 0, 0, 0]) as [number, number, number, number]));
  }
  for (const attribute of [normal, uv, weights, indices]) attribute.needsUpdate = true;
  bones.forEach((bone, i) => {
    const r = o.bones?.[i] ?? identity;
    bone.matrixAutoUpdate = false;
    bone.matrix.set(
      ...([...r, 0, 0, 0, 1] as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ])
    );
  });
  mesh.material = material;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
  const error = renderer.getContext().getError();
  material.dispose();
  source.dispose();
  erosion.dispose();
  remap.dispose();
  return { pixels: [...pixels], error };
}
(window as any).__METAL_SKIN__ = { ready: true, probe };
