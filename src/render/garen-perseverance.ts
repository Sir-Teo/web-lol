import * as THREE from 'three';
import p from '../content/garen-passive-particles.json';
import { GAREN_PASSIVE_TAIL_TICKS } from '../content/garen-passive-presentation';
import { garenPassiveParticles } from './garen-passive-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { loadLuxParticleTextures } from './lux-particle-textures';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let textures: ReadonlyMap<string, THREE.Texture> | undefined, pending: Promise<void> | undefined;
export function loadGarenPerseverance(): Promise<void> {
  if (textures) return Promise.resolve();
  return (pending ??= loadLuxParticleTextures([p.texture, p.lookup])
    .then((loaded) => {
      textures = loaded;
    })
    .catch((e) => {
      pending = undefined;
      throw e;
    }));
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];
/** At most one birth per simulation tick across disjoint epochs. Source life
 * bounds the combined buffer, including rapid full-health/minion-hit cycles. */
const capacity = GAREN_PASSIVE_TAIL_TICKS + 2;
export class GarenPerseverance {
  readonly models = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<number>(),
      tick = world.tick - 1 + alpha + terminalAge * 60;
    if (textures)
      for (const unit of world.units) {
        if (unit.champion !== 'garen') continue;
        const records = world.championState(unit.id)!.garenPassiveVisuals;
        const particles = garenPassiveParticles(unit.id, records, tick);
        if (!particles.length) continue;
        active.add(unit.id);
        let mesh = this.models.get(unit.id);
        if (!mesh) {
          const material = createParticleColorProductMaterial(
            textures.get(p.texture)!,
            textures.get(p.lookup)!,
            'vertex',
            undefined,
            true
          );
          Object.assign(material, {
            name: 'Perseverance healspark',
            side: THREE.DoubleSide,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            forceSinglePass: true,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
          });
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
          mesh = new THREE.Mesh(geometry, material);
          mesh.name = material.name;
          mesh.frustumCulled = false;
          this.scene.add(mesh);
          this.models.set(unit.id, mesh);
        }
        if (particles.length > capacity) throw Error('Perseverance particle capacity exceeded');
        mesh.visible = unit.team === 'blue' || world.visible(unit);
        const g = mesh.geometry,
          pos = g.getAttribute('position'),
          uv = g.getAttribute('uv'),
          tint = g.getAttribute('particleTint'),
          lookup = g.getAttribute('particleLookupUv'),
          index = g.index!;
        let count = 0;
        particles.forEach((particle, slot) => {
          const at = particle.point ?? {
              x: unit.previous.x + (unit.x - unit.previous.x) * alpha,
              y: unit.previous.y + (unit.y - unit.previous.y) * alpha,
            },
            first = slot * 6;
          corners.forEach(([cx, cy], corner) => {
            pos.setXYZ(
              first + corner,
              (at.x + particle.offset[0] + cx * particle.scale[0]) * 0.01,
              this.ground(at) + (particle.offset[1] + cy * particle.scale[1]) * 0.01,
              (at.y + particle.offset[2]) * 0.01
            );
            // Arbitrary-quad UV convention matches the existing source W adapter.
            uv.setXY(first + corner, (cy + 1) / 2, (1 - cx) / 2);
            tint.setXYZW(first + corner, ...(particle.color as [number, number, number, number]));
            lookup.setXY(first + corner, ...particle.lookup);
          });
          for (let tri = 0; tri < 6; tri += 3)
            if (
              unit.team === 'blue' ||
              [0, 1, 2].every((j) =>
                world.pointVisible({
                  x: pos.getX(first + tri + j) * 100,
                  y: pos.getZ(first + tri + j) * 100,
                })
              )
            )
              for (let j = 0; j < 3; j++) index.setX(count++, first + tri + j);
        });
        // Clear unused slots so reverse seeks reproduce complete saved buffers.
        for (const attribute of Object.values(g.attributes))
          (attribute.array as Float32Array).fill(0, particles.length * 6 * attribute.itemSize);
        (index.array as Uint16Array).fill(0, count);
        g.setDrawRange(0, count);
        index.needsUpdate = true;
        for (const attribute of Object.values(g.attributes)) attribute.needsUpdate = true;
        mesh.userData.liveParticles = particles.length;
      }
    for (const [id, mesh] of this.models)
      if (!active.has(id)) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(id);
      }
  }
}
