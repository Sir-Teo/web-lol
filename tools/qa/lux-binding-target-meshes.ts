import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setSize(960, 440);
renderer.setPixelRatio(1);
renderer.setClearColor(0x101820);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 960 / 440, 0.1, 100);
camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);
const meshes: THREE.Mesh[] = [];
for (const [i, name] of [
  'lux_base_expo_cylinder',
  'lux_base_q_circle_fixed',
  'lux_base_q_portaledge_circle',
].entries()) {
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/lux-binding-target-${name}.glb`);
  const mesh = gltf.scene.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!,
    size = bounds.getSize(new THREE.Vector3());
  const scale = 2.2 / Math.max(size.x, size.y, size.z);
  const root = new THREE.Group();
  root.position.x = (i - 1) * 3.1;
  scene.add(root);
  mesh.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
  mesh.scale.setScalar(scale);
  (mesh.material as THREE.Material).dispose();
  mesh.material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader:
      'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 uv0;void main(){gl_FragColor=vec4(.15+.75*fract(uv0.x),.2+.7*fract(uv0.y),.6,1.);}',
  });
  const lines = new THREE.LineSegments(
    new THREE.WireframeGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x101820, transparent: true, opacity: 0.35 })
  );
  mesh.add(lines);
  root.add(mesh);
  meshes.push(mesh);
}
renderer.render(scene, camera);
Object.assign(window, { __BINDING_MESHES__: { renderer, scene, camera, meshes, ready: true } });
