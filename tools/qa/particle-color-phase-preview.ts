import * as THREE from 'three';
import {
  particleColorMaterial,
  renderParticleColorPhase,
} from '../../src/render/particle-color-phase';
import { ParticleDistortionPass } from '../../src/render/particle-distortion-pass';
import { createParticleDistortionMaterial } from '../../src/render/particle-distortion';

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector<HTMLCanvasElement>('#view')!,
    antialias: false,
    preserveDrawingBuffer: true,
  }),
  scene = new THREE.Scene(),
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
  early = new ParticleDistortionPass(),
  late = new ParticleDistortionPass(),
  geometry = new THREE.PlaneGeometry(2, 2);
renderer.setSize(64, 32, false);
renderer.setPixelRatio(1);
camera.position.z = 5;
scene.background = new THREE.Color(0);
function flat(rgb: string, tagged = false) {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `void main(){gl_FragColor=vec4(${rgb},1.);}`,
  });
  return tagged ? particleColorMaterial(material) : material;
}
const backdrop = new THREE.Mesh(geometry, flat('0.,1.,0.')),
  actor = new THREE.Mesh(geometry, flat('0.,0.,1.')),
  particle = new THREE.Mesh(geometry, flat('1.,0.,0.', true));
actor.scale.set(0.25, 0.5, 1);
actor.position.set(0.5, 0, 1);
actor.renderOrder = 1;
particle.scale.copy(actor.scale);
particle.position.set(0.5, 0, 2);
particle.renderOrder = 2;
scene.add(backdrop, actor, particle);
function tex(values: number[]) {
  const t = new THREE.DataTexture(
    new Float32Array(values),
    1,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  t.needsUpdate = true;
  return t;
}
const textures = [tex([1, 1, 1, 1]), tex([1, 1, 1, 1]), tex([1, 0.5, 1, 1])],
  material = createParticleDistortionMaterial({
    texture: textures[0],
    lookup: textures[1],
    normal: textures[2],
  }),
  warp = new THREE.Mesh(geometry, material);
material.uniforms.distortionPower.value = 0.5;
material.depthTest = false;
warp.scale.set(0.25, 0.5, 1);
warp.position.set(-0.5, 0, 3);
early.scene.add(warp);
function read() {
  const gl = renderer.getContext(),
    p = new Uint8Array(64 * 32 * 4);
  gl.readPixels(0, 0, 64, 32, gl.RGBA, gl.UNSIGNED_BYTE, p);
  return p;
}
function at(p: Uint8Array, x: number, y = 16) {
  return [...p.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)];
}
function probe() {
  early.scene.add(warp);
  renderParticleColorPhase(renderer, scene, camera, early);
  const first = read();
  late.scene.add(warp);
  renderer.render(scene, camera);
  late.render(renderer, camera);
  const last = read();
  early.scene.add(warp);
  renderParticleColorPhase(renderer, scene, camera, early);
  const repeated = read();
  const copies = { early: !!early.frame, late: !!late.frame };
  warp.visible = false;
  renderParticleColorPhase(renderer, scene, camera, early);
  late.render(renderer, camera);
  return {
    early: [at(first, 16), at(first, 48)],
    late: [at(last, 16), at(last, 48)],
    same: first.every((v, i) => v === repeated[i]),
    copies,
    retired: { early: !early.frame, late: !late.frame },
    state: {
      clear: renderer.autoClear,
      shadows: renderer.shadowMap.autoUpdate,
      reset: renderer.info.autoReset,
      visible: [backdrop.material.visible, actor.material.visible, particle.material.visible],
      background: scene.background instanceof THREE.Color,
    },
    error: renderer.getContext().getError(),
  };
}
(window as any).__PARTICLE_PHASE__ = {
  probe,
  async recover() {
    await new Promise<void>((resolve) => {
      renderer.domElement.addEventListener('webglcontextrestored', () => setTimeout(resolve, 50), {
        once: true,
      });
      renderer.forceContextLoss();
      setTimeout(() => renderer.forceContextRestore(), 100);
    });
    warp.visible = true;
    return probe();
  },
};
