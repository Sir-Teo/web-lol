import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { ECLIPSE_PROFILES, eclipseParticles } from './leona-eclipse-particles';
import { eclipseBirthFrame, eclipseDrawGroups, eclipsePoseAt } from './leona-eclipse-history';
import { eclipseSurfaceAssets, type EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { createLeonaEclipseSurfaceMaterial } from './leona-eclipse-surface-material';
import { createParticleDistortionMaterial } from './particle-distortion';
import { SceneDepth } from './scene-depth';
import { projectGroundQuad } from './ground-quad';
import { maskGroundWalkability } from './ground-walkability-mask';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import { writeRayQuad } from './ray-quad';
export { loadLeonaEclipseSurfaces } from './leona-eclipse-surface-assets';

const billboard = new THREE.PlaneGeometry(2, 2),
  quad = new THREE.PlaneGeometry(2, 2);
for (let i = 0; i < 4; i++) {
  const b = billboard.getAttribute('uv');
  b.setY(i, 1 - b.getY(i));
  const q = quad.getAttribute('uv'),
    u = q.getX(i),
    v = q.getY(i);
  q.setXY(i, v, 1 - u);
}
const up = new THREE.Vector3(0, 1, 0),
  rollAxis = new THREE.Vector3(0, 0, 1);
type Particle = ReturnType<typeof eclipseParticles>[number];
function uvMatrix(matrix: THREE.Matrix3, uv: Particle['uv']) {
  matrix.set(
    uv.scale[0] * uv.cellSize[0],
    0,
    ((1 - uv.scale[0]) * 0.5 + uv.offset[0]) * uv.cellSize[0] + uv.cell[0],
    0,
    uv.scale[1] * uv.cellSize[1],
    ((1 - uv.scale[1]) * 0.5 + uv.offset[1]) * uv.cellSize[1] + uv.cell[1],
    0,
    0,
    1
  );
}
/** All non-skin enabled W primitives. Unit-root origins, reflected source frames,
 * ground projection, blend-0 tint premultiplication and direct distortion-strength
 * binding are local policies; native script/CPU dispatch remains unverified. */
export class LeonaEclipseSurfaces {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  readonly depth = new SceneDepth();
  private sourceRotation = new THREE.Quaternion();
  private reflectedRotation = new THREE.Quaternion();
  private frameRotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private cameraRotation = new THREE.Quaternion();
  private vector = new THREE.Vector3();
  private eye = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    private distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private resources?: EclipseSurfaceAssets
  ) {}
  private create(index: number, assets: EclipseSurfaceAssets) {
    const p = ECLIPSE_PROFILES[index],
      e = p.erosion,
      sourceGeometry = p.mesh ? assets.mesh(p.mesh) : undefined;
    const material = p.distortion
      ? createParticleDistortionMaterial({
          texture: assets.texture(p.texture, p.uv.address),
          lookup: assets.texture(p.lookup ?? '', 2),
          normal: assets.texture(p.distortion.texture, p.uv.address),
        })
      : createLeonaEclipseSurfaceMaterial({
          kind: p.kind === 'mesh' ? 'mesh' : 'quad',
          texture: assets.texture(p.texture, p.uv.address),
          lookup: assets.texture(p.lookup ?? '', 2),
          vertexBgra: !!sourceGeometry?.getAttribute('_source_vertex_bgra'),
          ...(p.multiplier
            ? { multiplier: assets.texture(p.multiplier.texture, p.multiplier.uv.address) }
            : {}),
          ...(p.uvMode === 2 ? { lockAlpha: true } : {}),
          ...(e
            ? {
                erosion: {
                  texture: assets.texture(e.texture, e.address),
                  mixer: e.mixer.constant as [number, number, number, number],
                  featherIn: e.featherIn,
                  featherOut: e.featherOut,
                  sliceWidth: e.sliceWidth,
                },
              }
            : {}),
          ...(p.soft
            ? {
                soft: {
                  ...p.soft,
                  // Local blend-aware binding avoids applying the same fade
                  // twice through RGB and SrcAlpha. Native CPU control values
                  // still require comparison; the shader supports both routes.
                  control: (p.blend === 0 ? [0, 1, 0, 1] : [1, 0, 0, 1]) as [
                    number,
                    number,
                    number,
                    number,
                  ],
                },
              }
            : {}),
        });
    const owned = p.kind === 'ray' || (p.kind === 'quad' && p.ground);
    const geometry =
      p.kind === 'ray'
        ? new THREE.BufferGeometry()
            .setAttribute(
              'position',
              new THREE.BufferAttribute(new Float32Array(18), 3).setUsage(THREE.DynamicDrawUsage)
            )
            .setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2))
        : owned
          ? new THREE.BufferGeometry()
          : p.mesh
            ? sourceGeometry!
            : p.kind === 'quad'
              ? quad
              : billboard;
    Object.assign(material, {
      depthWrite: false,
      depthTest: (p.miscRenderFlags & 1) === 0,
      transparent: true,
      forceSinglePass: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
      blendDst: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
      polygonOffset: p.depthBias.some((v) => v !== 0),
      polygonOffsetFactor: p.depthBias[0],
      polygonOffsetUnits: p.depthBias[1],
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = p.renderOrder;
    mesh.name = `Leona W ${p.role} ${p.name}`;
    Object.assign(mesh.userData, {
      profileIndex: index,
      role: p.role,
      ownedGeometry: owned,
      sourceMesh: p.mesh,
      unboundPalette: !!p.palette && !p.palette.texture,
      sourceMeshRenderFlags: p.meshRenderFlags,
      sourceNoCull: p.noCull,
      attachment: 'local-unit-root',
      sourceVertexColors: !!geometry.getAttribute('_source_vertex_bgra'),
      sourceFaceColors: !!geometry.getAttribute('_source_face_rgb'),
    });
    // The source vertex format selects the observed native BGRA color path.
    // Exact native CPU flag dispatch/culling and the separate face-RGB stream
    // remain unverified. Keep all raw streams; do not fabricate normals or
    // multiply the authored all-zero face stream into the visible mesh.
    if (p.ground) {
      groundEffectMaterial(material);
      setGroundRenderStage(mesh, 'ground');
    }
    (p.distortion ? this.distortion : this.scene).add(mesh);
    return mesh;
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    const active = new Set<string>(),
      assets = this.resources ?? eclipseSurfaceAssets(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    camera.getWorldQuaternion(this.cameraRotation);
    camera.getWorldPosition(this.eye);
    if (assets)
      for (const source of world.units) {
        const state = world.championState(source.id);
        if (!state?.leonaWVisuals.length) continue;
        for (const r of state.leonaWVisuals)
          for (const group of eclipseDrawGroups(source.id, r)) {
            for (const p of eclipseParticles(
              group.role,
              group.seed,
              (tick - group.startTick) / 60,
              (group.stopTick - group.startTick) / 60,
              group.radius
            )) {
              const profile = ECLIPSE_PROFILES[p.profileIndex];
              if (profile.kind === 'skin') continue;
              const birth = eclipseBirthFrame(group, p.bornTick, !!world.winner);
              if (!birth) continue;
              const born =
                  group.origin ?? eclipsePoseAt(group.frames, group.startTick + p.bornTick),
                now = group.origin ?? eclipsePoseAt(group.frames, tick),
                bind = Math.max(0, Math.min(1, p.bind)),
                origin = {
                  x: born.x + (now.x - born.x) * bind,
                  y: born.y + (now.y - born.y) * bind,
                },
                facing = profile.local ? (bind === 1 ? now.facing : born.facing) : 0;
              this.frameRotation.setFromAxisAngle(up, facing);
              this.vector
                .set(-p.offset[0], p.offset[1], p.offset[2])
                .multiplyScalar(0.01)
                .applyQuaternion(this.frameRotation);
              const position = new THREE.Vector3(
                origin.x * 0.01,
                this.ground(origin),
                origin.y * 0.01
              ).add(this.vector);
              if (!world.pointVisible({ x: position.x * 100, y: position.z * 100 })) continue;
              const id = `${group.key}:${p.profileIndex}:${p.ordinal}`;
              active.add(id);
              let mesh = this.models.get(id);
              if (!mesh) this.models.set(id, (mesh = this.create(p.profileIndex, assets)));
              mesh.position.copy(position);
              mesh.quaternion.identity();
              mesh.scale.setScalar(1);
              this.sourceRotation.setFromEuler(
                this.euler.set(
                  ...(p.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                  'YXZ'
                )
              );
              this.reflectedRotation.set(
                this.sourceRotation.x,
                -this.sourceRotation.y,
                -this.sourceRotation.z,
                this.sourceRotation.w
              );
              if (profile.kind === 'ray') {
                const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.sourceRotation),
                  across = new THREE.Vector3(1, 0, 0).applyQuaternion(this.sourceRotation);
                axis.x *= -1;
                across.x *= -1;
                axis.applyQuaternion(this.frameRotation);
                across.applyQuaternion(this.frameRotation);
                const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
                  uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
                writeRayQuad(
                  positions,
                  uv,
                  0,
                  {
                    center: new THREE.Vector3(),
                    axis,
                    fallbackAcross: across,
                    size: p.size.map((v) => v * 0.01) as [number, number, number],
                  },
                  this.eye.clone().sub(position)
                );
                positions.needsUpdate = uv.needsUpdate = true;
                // Three uses the sphere centre for transparent sorting even when
                // frustum culling is disabled. A sphere cached under the startup
                // camera would otherwise survive a saved-camera restore.
                mesh.geometry.computeBoundingSphere();
              } else if (profile.kind === 'quad' && profile.ground) {
                projectGroundQuad(
                  mesh.geometry,
                  {
                    origin,
                    target: { x: origin.x + Math.sin(facing), y: origin.y + Math.cos(facing) },
                    offset: p.offset,
                    halfSize: p.size,
                    rotation: p.rotation,
                  },
                  (q) => this.ground(q) * 100,
                  50,
                  2
                );
                if (profile.navmesh)
                  maskGroundWalkability(mesh.geometry, (q) =>
                    world.battlefield.lineWalkable(q, q, 0)
                  );
                mesh.position.set(0, 0, 0);
              } else if (profile.kind === 'billboard') {
                mesh.quaternion.copy(this.cameraRotation);
                if (profile.directionOriented && Math.hypot(...p.travel) > 0) {
                  this.vector
                    .set(-p.travel[0], p.travel[1], p.travel[2])
                    .applyQuaternion(this.frameRotation)
                    .applyQuaternion(this.cameraRotation.clone().invert());
                  mesh.rotateZ(Math.atan2(-this.vector.x, this.vector.y));
                } else
                  mesh.quaternion.multiply(
                    new THREE.Quaternion().setFromAxisAngle(
                      rollAxis,
                      -THREE.MathUtils.degToRad(p.rotation[0])
                    )
                  );
                mesh.scale.set(p.size[0] * 0.01, p.size[1] * p.stretch * 0.01, 1);
              } else {
                mesh.quaternion.copy(this.frameRotation).multiply(this.reflectedRotation);
                mesh.scale.fromArray(p.size).multiplyScalar(profile.kind === 'mesh' ? 1 : 0.01);
                mesh.scale.x *= -1;
              }
              const uniforms = mesh.material.uniforms,
                color = [...p.color];
              if (profile.blend === 0) for (let i = 0; i < 3; i++) color[i] *= color[3];
              uniforms.particleColor.value.fromArray(color);
              uniforms.lookupUv.value.fromArray(p.lookup);
              if (profile.distortion) uniforms.distortionPower.value = profile.distortion.strength;
              else {
                uvMatrix(uniforms.sourceUvTransform.value, p.uv);
                if (p.multUv) uvMatrix(uniforms.multiplierUvTransform.value, p.multUv);
                uniforms.alphaRef.value = profile.alphaRef;
                if (profile.erosion) uniforms.erosionParameters.value.x = p.erosion;
              }
              Object.assign(mesh.userData, {
                sourceId: source.id,
                castTick: r.startTick,
                ordinal: p.ordinal,
                bornTick: group.startTick + p.bornTick,
                age: p.age,
                phase: p.phase,
                facing,
              });
            }
          }
      }
    for (const [id, mesh] of this.models) if (!active.has(id)) this.retire(id, mesh);
  }
  prepareDepth(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    const materials = [...this.models.values()]
      .map((m) => m.material)
      .filter((m) => m.uniforms.softDepth);
    if (!materials.length) {
      this.depth.dispose();
      return;
    }
    const target = this.depth.capture(renderer, this.scene, camera);
    for (const m of materials) {
      m.uniforms.softDepth.value = target.depthTexture;
      m.uniforms.softSize.value.set(target.width, target.height);
      m.uniforms.depthConversion.value.set(1 / camera.near, 1 / camera.far - 1 / camera.near);
    }
  }
  private retire(id: string, mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>) {
    mesh.removeFromParent();
    mesh.material.dispose();
    if (mesh.userData.ownedGeometry) mesh.geometry.dispose();
    this.models.delete(id);
  }
  dispose() {
    for (const [id, m] of this.models) this.retire(id, m);
    this.depth.dispose();
  }
}
