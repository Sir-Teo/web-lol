import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profiles from '../content/garen-spin.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { garenSpinParticles } from './garen-spin-particles';

let sourceMesh: THREE.BufferGeometry | undefined;
const textures = new Map<string, THREE.Texture>();
const quad = new THREE.PlaneGeometry(2, 2);
// Source arbitrary-quad UV convention: local Y is U, reversed local X is V.
const quadUv = quad.getAttribute('uv');
for (let i = 0; i < quadUv.count; i++) {
  const u = quadUv.getX(i),
    v = quadUv.getY(i);
  quadUv.setXY(i, v, 1 - u);
}
export async function loadGarenSpin() {
  await Promise.all([
    new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}assets/models/garen-spin.glb`)
      .then((gltf) => {
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          sourceMesh = o.geometry;
          for (const material of Array.isArray(o.material) ? o.material : [o.material])
            material.dispose();
        });
        if (!sourceMesh) throw new Error('Judgment source mesh is missing');
      }),
    ...[...new Set(profiles.map((p) => p.texture))].map(async (path) => {
      const texture = await new THREE.TextureLoader().loadAsync(
        `${import.meta.env.BASE_URL}${path}`
      );
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      textures.set(path, texture);
    }),
  ]);
}

export class GarenSpin {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private readonly frame = new THREE.Object3D();
  private readonly anchor = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, terminalAge = 0) {
    if (!sourceMesh || !textures.size) return;
    const active = new Set<string>();
    for (const unit of world.units) {
      const effect = world.championState(unit.id)?.garenEVisual;
      if (!effect || (unit.team !== 'blue' && !world.visible(unit))) continue;
      const tick = world.tick - 1 + alpha + terminalAge * 60;
      const x = unit.previous.x + (unit.x - unit.previous.x) * alpha,
        y = unit.previous.y + (unit.y - unit.previous.y) * alpha;
      this.anchor.set(x * 0.01, this.ground({ x, y }), y * 0.01);
      this.frame.rotation.set(0, effect.facing, 0);
      for (const p of garenSpinParticles(unit.id, effect, tick)) {
        const profile = profiles[p.emitterIndex],
          key = `${unit.id}:${effect.startTick}:${p.emitterIndex}:${p.ordinal}`;
        active.add(key);
        let mesh = this.models.get(key);
        if (!mesh) {
          const material = new THREE.ShaderMaterial({
            name: `Judgment ${profile.name}`,
            uniforms: {
              map: { value: textures.get(profile.texture) },
              tint: { value: new THREE.Vector4() },
              scroll: { value: new THREE.Vector2() },
            },
            vertexShader:
              'varying vec2 at;void main(){at=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:
              'uniform sampler2D map;uniform vec4 tint;uniform vec2 scroll;varying vec2 at;void main(){gl_FragColor=texture2D(map,at+scroll)*tint;}',
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            toneMapped: false,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: profile.blend === 4 ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
          });
          // Match a source no-cull draw without Three's two-pass transparent path.
          material.forceSinglePass = true;
          mesh = new THREE.Mesh(profile.kind === 'mesh' ? sourceMesh : quad, material);
          mesh.name = `Garen Judgment ${profile.name}`;
          mesh.renderOrder = profile.renderOrder;
          mesh.frustumCulled = false;
          this.models.set(key, mesh);
          this.scene.add(mesh);
        }
        mesh.position
          .fromArray(p.offset)
          .multiplyScalar(0.01)
          .applyQuaternion(this.frame.quaternion);
        mesh.position.add(this.anchor);
        this.rotation.setFromEuler(
          this.euler.set(
            ...(p.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
            'YXZ'
          )
        );
        mesh.quaternion.copy(this.frame.quaternion).multiply(this.rotation);
        // GLB is already in world units; quad extents are authored in source units.
        mesh.scale.fromArray(p.scale).multiplyScalar(profile.kind === 'mesh' ? 1 : 0.01);
        mesh.material.uniforms.tint.value.fromArray(p.color);
        mesh.material.uniforms.scroll.value.fromArray(p.scroll);
      }
    }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.models.delete(key);
      }
  }
}
