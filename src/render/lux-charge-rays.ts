import * as THREE from 'three';
import profile from '../content/lux-charge-rays.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { luxChargeRayParticles } from './lux-charge-ray-particles';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxChargeRayTextures() {
  await Promise.all(
    [profile.texture, profile.mult].map(async (path) => {
      const texture = await new THREE.TextureLoader().loadAsync(path);
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textures.set(path, texture);
    })
  );
}

export class LuxChargeRays {
  readonly models = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}
  private create() {
    const geometry = new THREE.BufferGeometry();
    for (const [name, size] of [
      ['position', 3],
      ['uv', 2],
      ['particleColor', 4],
      ['particleOffset', 2],
    ] as const)
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(new Float32Array(profile.count * 6 * size), size).setUsage(
          THREE.DynamicDrawUsage
        )
      );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: (profile.miscRenderFlags & 1) === 0,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendEquationAlpha: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.SrcAlphaFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: {
        base: { value: textures.get(profile.texture) },
        mult: { value: textures.get(profile.mult) },
        baseRotation: { value: (profile.baseRotation * Math.PI) / 180 },
        multScale: { value: new THREE.Vector2().fromArray(profile.multScale) },
      },
      vertexShader: `attribute vec4 particleColor; attribute vec2 particleOffset; varying vec4 tint; varying vec2 at; varying vec2 offset;
        void main(){tint=particleColor;at=uv;offset=particleOffset;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D base; uniform sampler2D mult; uniform float baseRotation; uniform vec2 multScale; varying vec4 tint; varying vec2 at; varying vec2 offset;
        void main(){vec2 p=at-0.5;float c=cos(baseRotation),s=sin(baseRotation);vec2 b=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+0.5;
          gl_FragColor=texture2D(base,fract(b))*texture2D(mult,fract((at-0.5)*multScale+0.5+offset))*tint;}`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = profile.name;
    mesh.renderOrder = profile.pass;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }
  update(world: World, alpha: number, camera: THREE.Camera) {
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize(),
      up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const active = new Set<number>();
    for (const unit of world.units) {
      const cast = world.championState(unit.id)?.pendingCast;
      if (unit.champion !== 'lux' || cast?.ability !== 'r' || !cast.origin) continue;
      const age = (world.tick - cast.startTick + alpha - 1) / 60;
      const seed =
        unit.id ^
        Math.imul(cast.startTick, 0x9e3779b9) ^
        Math.imul(profile.emitterIndex, 0x85ebca6b);
      const particles = luxChargeRayParticles(seed, age);
      if (!particles.length) continue;
      const dx = cast.point.x - cast.origin.x,
        dy = cast.point.y - cast.origin.y,
        length = Math.hypot(dx, dy);
      if (!length) continue;
      const center = {
        x: cast.origin.x + (dx / length) * profile.offset[2],
        y: cast.origin.y + (dy / length) * profile.offset[2],
      };
      if (unit.team !== 'blue' && !world.pointVisible(center)) continue;
      let mesh = this.models.get(unit.id);
      if (!mesh) {
        mesh = this.create();
        this.models.set(unit.id, mesh);
      }
      const geometry = mesh.geometry,
        position = geometry.getAttribute('position'),
        uv = geometry.getAttribute('uv'),
        color = geometry.getAttribute('particleColor'),
        offset = geometry.getAttribute('particleOffset');
      let vertex = 0;
      for (const particle of particles) {
        // The reference camera quad rotates the corner, then applies anisotropic size.
        const angle = (-particle.rotation * Math.PI) / 180,
          c = Math.cos(angle),
          s = Math.sin(angle);
        for (const [x, y] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          const a = (x * c - y * s) * particle.halfSize[0] * 0.01,
            b = (x * s + y * c) * particle.halfSize[1] * 0.01;
          position.setXYZ(
            vertex,
            center.x * 0.01 + right.x * a + up.x * b,
            this.ground(cast.origin) + 0.18 + right.y * a + up.y * b,
            center.y * 0.01 + right.z * a + up.z * b
          );
          uv.setXY(vertex, (x + 1) / 2, (1 - y) / 2);
          color.setXYZW(vertex, ...(particle.color as [number, number, number, number]));
          offset.setXY(vertex, ...(particle.multOffset as [number, number]));
          vertex++;
        }
      }
      for (const attr of [position, uv, color, offset]) attr.needsUpdate = true;
      geometry.setDrawRange(0, vertex);
      active.add(unit.id);
    }
    for (const [id, mesh] of this.models)
      if (!active.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(id);
      }
  }
}
