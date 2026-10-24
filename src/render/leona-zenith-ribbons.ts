import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { ZENITH_PROFILES } from './leona-zenith-particles';
import { zenithDrawGroups } from './leona-zenith-history';
import {
  zenithTrailPoints,
  zenithTrailRibbon,
  type ZenithRibbonVertex,
} from './leona-zenith-trails';
import { zenithMissileTrailPoints } from './leona-zenith-trail-frame';
import { zenithTrailAssets, type ZenithTrailAssets } from './leona-zenith-trail-assets';
import { createParticleRibbonMaterial } from './particle-ribbon-material';
import { eclipseValue } from './leona-eclipse-values';
export { loadLeonaZenithTrails } from './leona-zenith-trail-assets';

/** Two source arbitrary trails, seeked entirely from saved weapon histories.
 * Quality reach 3, neutral missing lookup, absent global remap, zero depth push,
 * sampler/blend/polygon state and missile attachment are local binding policies.
 * Native CPU dispatch/frame parity remain unverified. */
export class LeonaZenithRibbons {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number,
    private resources?: ZenithTrailAssets
  ) {}
  private create(index: number, assets: ZenithTrailAssets) {
    const p = ZENITH_PROFILES[index],
      palette = p.palette;
    const material = createParticleRibbonMaterial({
      texture: assets.texture(p.texture, p.uv.address),
      lookup: assets.texture(p.lookup ?? '', 2),
      ...(palette
        ? {
            palette: {
              texture: assets.texture(palette.texture!, 2),
              sourceMix: eclipseValue(palette.mix, 0) as [number, number, number, number],
              row: (eclipseValue(palette.selector, 0)[0] + 0.5) / palette.count,
            },
          }
        : {}),
    });
    material.uniforms.alphaRef.value = p.alphaRef;
    Object.assign(material, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      depthTest: (p.miscRenderFlags & 1) === 0,
      polygonOffset: p.depthBias.some((v) => v !== 0),
      polygonOffsetFactor: p.depthBias[0],
      polygonOffsetUnits: p.depthBias[1],
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = p.renderOrder;
    mesh.name = `Leona E weapon ${p.name} ribbon`;
    Object.assign(mesh.userData, {
      profileIndex: index,
      ownedGeometry: true,
      attachment: 'saved-missile-root',
      capacity: 0,
    });
    this.scene.add(mesh);
    return mesh;
  }
  private write(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>,
    vertices: readonly ZenithRibbonVertex[]
  ) {
    let geometry = mesh.geometry;
    if (mesh.userData.capacity < vertices.length) {
      geometry.dispose();
      geometry = mesh.geometry = new THREE.BufferGeometry();
      const capacity = Math.max(24, 2 ** Math.ceil(Math.log2(vertices.length)));
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['particleTint', 4],
        ['particleLookupUv', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      mesh.userData.capacity = capacity;
    }
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      geometry
        .getAttribute('position')
        .setXYZ(i, v.position[0] * 0.01, v.position[1] * 0.01, v.position[2] * 0.01);
      geometry.getAttribute('uv').setXY(i, ...v.uv);
      geometry
        .getAttribute('particleTint')
        .setXYZW(i, v.color[0], v.color[1], v.color[2], v.color[3]);
      geometry.getAttribute('particleLookupUv').setXY(i, ...v.lookup);
    }
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    geometry.setDrawRange(0, vertices.length);
  }
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<string>(),
      assets = this.resources ?? zenithTrailAssets();
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (assets)
      for (const source of world.units) {
        for (const r of world.championState(source.id)?.leonaEVisuals ?? []) {
          for (const group of zenithDrawGroups(source.id, r)) {
            if (group.role !== 'weapon') continue;
            const points = zenithMissileTrailPoints(
              group,
              zenithTrailPoints(group, tick, !!world.winner, 'blue', this.ground),
              this.ground
            );
            for (const index of new Set(points.map((p) => p.profileIndex))) {
              const profile = ZENITH_PROFILES[index],
                vertices = zenithTrailRibbon(
                  points.filter((p) => p.profileIndex === index),
                  profile.trail!.cutoff,
                  (p) => world.pointVisible({ x: p.position[0], y: p.position[2] })
                );
              if (!vertices.length) continue;
              const key = `${group.key}:${index}`;
              let mesh = this.models.get(key);
              if (!mesh) {
                mesh = this.create(index, assets);
                this.models.set(key, mesh);
              }
              this.write(mesh, vertices);
              Object.assign(mesh.userData, {
                sourceId: source.id,
                castTick: r.startTick,
                groupKey: group.key,
              });
              active.add(key);
            }
          }
        }
      }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.release(mesh);
        this.models.delete(key);
      }
  }
  private release(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  dispose() {
    for (const mesh of this.models.values()) this.release(mesh);
    this.models.clear();
  }
}
