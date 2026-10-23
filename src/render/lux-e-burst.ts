import * as THREE from 'three';
import profiles from '../content/lux-e-burst.json';
import { luxEBurstParticles } from './lux-e-burst-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { particleAtlasUv } from './particle-atlas';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';

export function createLuxEBurstMaterial(
  index: number,
  textures: ReadonlyMap<string, THREE.Texture>
) {
  const p = profiles[index];
  const get = (path: string) => {
    const t = textures.get(path);
    if (!t) throw Error(`Missing Lucent burst texture ${path}`);
    return t;
  };
  const material = createParticleColorProductMaterial(
    get(p.texture),
    get(p.lookup),
    'vertex',
    undefined,
    true
  );
  Object.assign(material, {
    name: `Lucent burst moving ${p.index} ${p.name}`,
    transparent: true,
    depthTest: p.depthTest,
    depthWrite: false,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  return material;
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];

/** One fixed-capacity draw per emitter. Every corner retains its own tint,
 * birth-random lookup and authored atlas cell. Images remain borrowed. */
export class LuxEBurstCloud {
  readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private center = new THREE.Vector3();
  private vertex = new THREE.Vector3();
  constructor(textures: ReadonlyMap<string, THREE.Texture>) {
    for (const [i, p] of profiles.entries()) {
      const capacity = p.single
        ? Math.max(1, Math.trunc(p.rate))
        : Math.max(1, Math.floor((Math.floor(p.emitterLife * 60) * p.rate) / 60));
      const geometry = new THREE.BufferGeometry();
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['particleTint', 4],
        ['particleLookupUv', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * 6 * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(capacity * 6), 1));
      geometry.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geometry, createLuxEBurstMaterial(i, textures));
      mesh.name = mesh.material.name;
      mesh.renderOrder = p.passOrder;
      mesh.frustumCulled = false;
      mesh.userData.movingBurstIndex = i;
      mesh.userData.capacity = capacity;
      this.meshes.push(mesh);
    }
  }
  draw(
    world: World,
    seed: number,
    age: number,
    at: Vec2,
    origin: Vec2,
    target: Vec2,
    team: string,
    camera: THREE.Camera,
    ground: (p: Vec2) => number
  ) {
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const length = Math.hypot(target.x - origin.x, target.y - origin.y),
      fx = length ? (target.x - origin.x) / length : 0,
      fy = length ? (target.y - origin.y) / length : 1;
    const particles = luxEBurstParticles(seed, age);
    for (const [profileIndex, mesh] of this.meshes.entries()) {
      const p = profiles[profileIndex],
        selected = particles.filter((q) => q.profileIndex === profileIndex),
        g = mesh.geometry;
      if (selected.length > mesh.userData.capacity) throw Error('Lucent burst capacity exceeded');
      const position = g.getAttribute('position') as THREE.BufferAttribute,
        uv = g.getAttribute('uv'),
        tint = g.getAttribute('particleTint'),
        lookup = g.getAttribute('particleLookupUv'),
        index = g.index!;
      let count = 0;
      selected.forEach((q, slot) => {
        const x = -fy * q.position[0] + fx * q.position[2],
          y = fx * q.position[0] + fy * q.position[2];
        this.center.set(
          (at.x + x) * 0.01,
          ground(at) + 1 + q.position[1] * 0.01,
          (at.y + y) * 0.01
        );
        this.direction.set(
          -fy * q.travel[0] + fx * q.travel[2],
          q.travel[1],
          fx * q.travel[0] + fy * q.travel[2]
        );
        let dx = this.direction.dot(this.right),
          dy = this.direction.dot(this.up),
          d = Math.hypot(dx, dy);
        if (!p.direction || d === 0) {
          dx = 0;
          dy = 1;
          d = 1;
        }
        dx /= d;
        dy /= d;
        const first = slot * 6;
        corners.forEach(([cx, cy], corner) => {
          const sx = q.scale[0] * 0.01,
            sy = q.scale[1] * q.stretch * 0.01;
          const a = dy * cx * sx + dx * cy * sy,
            b = -dx * cx * sx + dy * cy * sy;
          this.vertex.copy(this.center).addScaledVector(this.right, a).addScaledVector(this.up, b);
          position.setXYZ(first + corner, this.vertex.x, this.vertex.y, this.vertex.z);
          uv.setXY(
            first + corner,
            ...particleAtlasUv(
              p.atlas.grid[0],
              p.atlas.grid[1],
              q.frame,
              (cx + 1) / 2,
              (1 - cy) / 2
            )
          );
          tint.setXYZW(first + corner, ...(q.color as [number, number, number, number]));
          lookup.setXY(first + corner, ...q.lookup);
        });
        for (let tri = 0; tri < 6; tri += 3)
          if (
            team === 'blue' ||
            [0, 1, 2].every((j) =>
              world.pointVisible({
                x: position.getX(first + tri + j) * 100,
                y: position.getZ(first + tri + j) * 100,
              })
            )
          )
            for (let j = 0; j < 3; j++) index.setX(count++, first + tri + j);
      });
      g.setDrawRange(0, count);
      index.needsUpdate = true;
      for (const a of Object.values(g.attributes)) a.needsUpdate = true;
      mesh.userData.liveParticles = selected.length;
    }
    return particles;
  }
  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
