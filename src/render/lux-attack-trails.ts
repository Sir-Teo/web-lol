import { luxAttackPresentation } from './lux-attack-clock';
import depthProfiles from '../content/lux-flight-depth.json';
import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { luxTrailParticles } from './lux-trail-particles';
import { luxTrailRibbon, type LuxRibbonVertex } from './lux-trail-ribbon';
import { createParticleColorProductMaterial } from './particle-color-product';

let textures: [THREE.Texture, THREE.Texture] | undefined;
export async function loadLuxTrailTextures() {
  textures = (await Promise.all(
    ['lux_base_q_trail', 'lux_base_r_rainbowmult'].map(async (name) => {
      const texture = await new THREE.TextureLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/effects/lux-ba-${name}.png`
      );
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      return texture;
    })
  )) as [THREE.Texture, THREE.Texture];
}

export function createLuxTrailMaterial(base: THREE.Texture, mult: THREE.Texture) {
  // The quad ramp defaults to white on this emitter: its full product reduces to
  // base * per-vertex tint * mult, with mult UVs independent of the base layer.
  const material = createParticleColorProductMaterial(base, mult, 'vertex', undefined, true);
  material.name = 'Lux Trail source-alpha additive reconstruction';
  material.transparent = true;
  material.depthTest = (depthProfiles.Trail.miscRenderFlags & 1) === 0;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneFactor;
  material.blendSrcAlpha = THREE.SrcAlphaFactor;
  material.blendDstAlpha = THREE.OneFactor;
  return material;
}
const CAPACITY = 192; // At most 25 live points at 50 Hz / 0.5 s, 24 * 6 vertices.
export class LuxRibbonMesh {
  readonly geometry = new THREE.BufferGeometry();
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  constructor(base: THREE.Texture, mult: THREE.Texture) {
    for (const [name, size] of [
      ['position', 3],
      ['uv', 2],
      ['particleLookupUv', 2],
      ['particleTint', 4],
    ] as const)
      this.geometry.setAttribute(
        name,
        new THREE.BufferAttribute(new Float32Array(CAPACITY * size), size).setUsage(
          THREE.DynamicDrawUsage
        )
      );
    this.mesh = new THREE.Mesh(this.geometry, createLuxTrailMaterial(base, mult));
    this.mesh.name = 'Lux basic-attack ribbon';
    this.mesh.frustumCulled = false;
    this.geometry.setDrawRange(0, 0);
  }
  update(vertices: readonly LuxRibbonVertex[], ground: (p: Vec2) => number) {
    if (vertices.length > CAPACITY) throw new Error('Lux trail vertex capacity exceeded');
    const pos = this.geometry.getAttribute('position'),
      uv = this.geometry.getAttribute('uv'),
      mult = this.geometry.getAttribute('particleLookupUv'),
      tint = this.geometry.getAttribute('particleTint');
    vertices.forEach((v, i) => {
      const [x, y, z] = v.position;
      pos.setXYZ(i, x * 0.01, y * 0.01 + ground({ x, y: z }) + 0.9, z * 0.01);
      uv.setXY(i, ...v.uv);
      mult.setXY(i, ...v.multUv);
      tint.setXYZW(i, v.color[0], v.color[1], v.color[2], v.color[3]);
    });
    for (const attr of [pos, uv, mult, tint]) attr.needsUpdate = true;
    this.geometry.setDrawRange(0, vertices.length);
    this.mesh.visible = vertices.length > 0;
  }
  dispose() {
    this.geometry.dispose();
    this.mesh.material.dispose();
  }
}
export class LuxAttackTrails {
  readonly ribbons = new Map<number, LuxRibbonMesh>();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, terminalAge = 0) {
    if (!textures) return;
    const active = new Set<number>();
    const { tick, effects } = luxAttackPresentation(world, alpha, terminalAge);
    for (const effect of effects) {
      active.add(effect.id);
      let ribbon = this.ribbons.get(effect.id);
      if (!ribbon) {
        ribbon = new LuxRibbonMesh(...textures);
        this.ribbons.set(effect.id, ribbon);
        this.scene.add(ribbon.mesh);
      }
      const points = luxTrailParticles(effect, tick);
      ribbon.update(
        luxTrailRibbon(
          points,
          (p) =>
            effect.team === 'blue' || world.pointVisible({ x: p.position[0], y: p.position[2] })
        ),
        this.ground
      );
    }
    for (const [id, ribbon] of this.ribbons) {
      if (active.has(id)) continue;
      this.scene.remove(ribbon.mesh);
      ribbon.dispose();
      this.ribbons.delete(id);
    }
  }
}
