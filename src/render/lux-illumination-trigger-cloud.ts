import { loadLuxParticleTextures } from './lux-particle-textures';
import * as THREE from 'three';
import { LUX_ILLUMINATION_TRIGGER_VFX as profiles } from '../content/lux-illumination-trigger-vfx';
import { luxIlluminationTriggerBirths } from './lux-illumination-trigger-births';
import { luxIlluminationTriggerAppearance } from './lux-illumination-trigger-appearance';
import { luxIlluminationTriggerStaticMotion } from './lux-illumination-trigger-motion';
import { createParticleColorProductMaterial } from './particle-color-product';
import { particleAtlasUv } from './particle-atlas';
import { writeRayQuad } from './ray-quad';
import { luxIlluminationTriggerAttachment } from './lux-illumination-trigger-attachment';

export async function loadIlluminationTriggerTextures(base = import.meta.env.BASE_URL) {
  const paths = new Set<string>(
    profiles.flatMap((p) => [
      p.texture,
      ...(p.lookup ? [p.lookup] : []),
      ...(p.palette ? [p.palette.texture] : []),
    ])
  );
  return loadLuxParticleTextures(paths, base);
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** Five-layer detonation study. Borrowed textures; optional source-space origin
 * history applies per-emitter binding. No gameplay event or bone selection. The unresolved outer-ring block is not interpreted. */
export class LuxIlluminationTriggerCloud {
  readonly root = new THREE.Group();
  readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private eye = new THREE.Vector3();
  private place = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private across = new THREE.Vector3();
  private rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(textures: ReadonlyMap<string, THREE.Texture>) {
    this.root.name = 'Lux Illumination detonation';
    const texture = (path: string | null) => {
      const found = textures.get(path ?? '');
      if (!found) throw new Error(`Missing Illumination trigger texture: ${path}`);
      return found;
    };
    for (const p of profiles) {
      const capacity = p.single ? p.rate : Math.ceil(p.rate * p.emitterLife) + 1;
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
      geometry.setDrawRange(0, 0);
      const palette = p.palette
        ? {
            texture: texture(p.palette.texture),
            sourceMix: p.palette.mix.value as readonly [number, number, number, number],
            row: (p.palette.selector.value[0] + 0.5) / p.palette.count,
          }
        : undefined;
      const material = createParticleColorProductMaterial(
        texture(p.texture),
        texture(p.lookup),
        'vertex',
        undefined,
        true,
        palette
      );
      material.fragmentShader = material.fragmentShader.replace(
        /}\s*$/,
        'if(gl_FragColor.a < 5.0/255.0) discard;\n}'
      );
      material.transparent = true;
      material.depthTest = (p.miscRenderFlags & 1) === 0;
      material.blending = THREE.CustomBlending;
      material.blendEquation = material.blendEquationAlpha = THREE.AddEquation;
      material.blendSrc = material.blendSrcAlpha =
        p.blend === 4 ? THREE.SrcAlphaFactor : THREE.OneFactor;
      material.blendDst = material.blendDstAlpha = THREE.OneFactor;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = p.name;
      mesh.renderOrder = p.pass;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.root.add(mesh);
    }
  }
  /** center/frame convert source coordinates to the scene. Optional origin history
   * supplies translation in source units. frame is reflected and orthonormal;
   * source lengths convert at 0.01. Motion is evaluated before scene conversion. */
  draw(
    seed: number,
    time: number,
    camera: THREE.Camera,
    center: THREE.Vector3,
    frame: THREE.Matrix3,
    stopSeconds = Infinity,
    origin?: (seconds: number) => THREE.Vector3
  ) {
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.eye);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const particles = luxIlluminationTriggerBirths(seed, time, stopSeconds);
    this.meshes.forEach((mesh, index) => {
      const profile = profiles[index],
        selected = particles.filter((p) => p.profileIndex === index);
      const geometry = mesh.geometry;
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
      const tint = geometry.getAttribute('particleTint'),
        lookup = geometry.getAttribute('particleLookupUv');
      if (selected.length * 6 > position.count)
        throw new RangeError('Detonation particle capacity exceeded');
      selected.forEach((p, ordinal) => {
        const appearance = luxIlluminationTriggerAppearance(p)!,
          motion = luxIlluminationTriggerStaticMotion(p)!;
        const attachment = origin ? luxIlluminationTriggerAttachment(p, origin)! : null;
        const travel = motion.travel.map(
          (v, axis) => v + (attachment?.travel.getComponent(axis) ?? 0)
        );
        const speed = Math.hypot(...travel);
        const stretch =
          profile.directionOriented && speed > 0
            ? Math.max(profile.directionMin, speed * profile.directionScale)
            : 1;
        const first = ordinal * 6;
        this.place.fromArray(motion.position);
        if (attachment) this.place.add(attachment.position);
        this.place.applyMatrix3(frame).multiplyScalar(0.01).add(center);
        if (profile.primitive === 'ray') {
          this.rotation.set(
            (appearance.rotation[0] * Math.PI) / 180,
            (appearance.rotation[1] * Math.PI) / 180,
            (appearance.rotation[2] * Math.PI) / 180,
            'YXZ'
          );
          this.axis.set(0, 0, 1).applyEuler(this.rotation).applyMatrix3(frame);
          this.across.set(1, 0, 0).applyEuler(this.rotation).applyMatrix3(frame);
          writeRayQuad(
            position,
            uv,
            first,
            {
              center: this.place,
              axis: this.axis,
              fallbackAcross: this.across,
              size: appearance.size.map((v) => v * 0.01) as [number, number, number],
            },
            this.eye
          );
        } else {
          let dx = 0,
            dy = 1;
          if (profile.directionOriented) {
            this.direction.fromArray(travel);
            if (this.direction.lengthSq() === 0) this.direction.set(0, 1, 0);
            this.rotation.set(
              motion.orbitRadians[0],
              motion.orbitRadians[1],
              motion.orbitRadians[2],
              'YXZ'
            );
            this.direction.applyEuler(this.rotation).applyMatrix3(frame);
            dx = this.direction.dot(this.right);
            dy = this.direction.dot(this.up);
            const length = Math.hypot(dx, dy);
            if (length > 0) {
              dx /= length;
              dy /= length;
            } else {
              dx = 0;
              dy = 1;
            }
          }
          const roll = (-appearance.rotation[0] * Math.PI) / 180,
            c = Math.cos(roll),
            s = Math.sin(roll);
          corners.forEach(([x, y], i) => {
            const sx = appearance.size[0] * 0.01,
              sy = appearance.size[1] * stretch * 0.01;
            const a = profile.directionOriented ? dy * x * sx + dx * y * sy : (x * c - y * s) * sx;
            const b = profile.directionOriented ? -dx * x * sx + dy * y * sy : (x * s + y * c) * sy;
            position.setXYZ(
              first + i,
              this.place.x + this.right.x * a + this.up.x * b,
              this.place.y + this.right.y * a + this.up.y * b,
              this.place.z + this.right.z * a + this.up.z * b
            );
            uv.setXY(
              first + i,
              ...particleAtlasUv(
                appearance.atlas.columns,
                appearance.atlas.rows,
                appearance.atlas.frame,
                (x + 1) / 2,
                (1 - y) / 2
              )
            );
          });
        }
        const [r, g, b, a] = appearance.color,
          add = profile.blend === 0;
        for (let i = first; i < first + 6; i++) {
          tint.setXYZW(i, r * (add ? a : 1), g * (add ? a : 1), b * (add ? a : 1), add ? 1 : a);
          lookup.setXY(i, appearance.lookup[0], appearance.lookup[1]);
        }
      });
      geometry.setDrawRange(0, selected.length * 6);
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    });
    return particles;
  }
  dispose() {
    this.root.removeFromParent();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.root.clear();
  }
}
