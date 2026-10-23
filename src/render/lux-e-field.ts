import * as THREE from 'three';
import profiles from '../content/lux-e-field.json';
import { LUX_E_FIELD_BIRTHS, luxEFieldParticles } from './lux-e-field-particles';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import { createParticleColorProductMaterial } from './particle-color-product';
import { particleAtlasUv } from './particle-atlas';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';

export function createLuxEFieldMaterial(
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
    true,
    p.palette
      ? {
          texture: get(p.palette.texture),
          sourceMix: p.palette.mix as [number, number, number, number],
          row: p.palette.row,
        }
      : undefined
  );
  Object.assign(material, {
    name: `Lucent ${p.role} field motion ${p.index} ${p.name}`,
    transparent: true,
    depthTest: p.depthTest,
    depthWrite: false,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  if (p.ground) groundEffectMaterial(material);
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
export class LuxEFieldCloud {
  readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private center = new THREE.Vector3();
  private vertex = new THREE.Vector3();
  constructor(
    readonly role: 'ally' | 'enemy',
    textures: ReadonlyMap<string, THREE.Texture>
  ) {
    for (const [i, p] of profiles.entries()) {
      if (p.role !== role) continue;
      const capacity = Math.max(1, LUX_E_FIELD_BIRTHS[i].length);
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
      const mesh = new THREE.Mesh(geometry, createLuxEFieldMaterial(i, textures));
      mesh.name = mesh.material.name;
      mesh.renderOrder = p.passOrder;
      mesh.frustumCulled = false;
      mesh.userData.fieldProfileIndex = i;
      if (p.ground) setGroundRenderStage(mesh, 'ground');
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
    const particles = luxEFieldParticles(this.role, seed, age);
    for (const mesh of this.meshes) {
      const profileIndex = mesh.userData.fieldProfileIndex,
        p = profiles[profileIndex],
        selected = particles.filter((q) => q.profileIndex === profileIndex),
        g = mesh.geometry;
      if (selected.length > mesh.userData.capacity) throw Error('Lucent field capacity exceeded');
      const position = g.getAttribute('position') as THREE.BufferAttribute,
        uv = g.getAttribute('uv'),
        tint = g.getAttribute('particleTint'),
        lookup = g.getAttribute('particleLookupUv'),
        index = g.index!;
      // Retired slots remain deterministic across reverse seeks and fresh
      // restores; the next cast must not inherit unused GPU buffer bytes.
      for (const a of Object.values(g.attributes)) a.array.fill(0);
      index.array.fill(0);
      let count = 0;
      selected.forEach((q, slot) => {
        const x = p.local ? -fy * q.position[0] + fx * q.position[2] : q.position[0],
          y = p.local ? fx * q.position[0] + fy * q.position[2] : q.position[2];
        this.center.set(
          (at.x + x) * 0.01,
          ground(at) + 1 + q.position[1] * 0.01,
          (at.y + y) * 0.01
        );
        this.direction.set(
          p.local ? -fy * q.travel[0] + fx * q.travel[2] : q.travel[0],
          q.travel[1],
          p.local ? fx * q.travel[0] + fy * q.travel[2] : q.travel[2]
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
          const roll = (-q.rotation[0] * Math.PI) / 180,
            c = Math.cos(roll),
            s = Math.sin(roll),
            rx = cx * c - cy * s,
            ry = cx * s + cy * c;
          const sx = q.scale[0] * 0.01,
            sy = q.scale[1] * q.stretch * 0.01;
          const a = dy * rx * sx + dx * ry * sy,
            b = -dx * rx * sx + dy * ry * sy;
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
