import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { ECLIPSE_PROFILES, eclipseParticles } from './leona-eclipse-particles';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { createLeonaEclipseSurfaceMaterial } from './leona-eclipse-surface-material';
import { createParticleDistortionMaterial } from './particle-distortion';
import { SceneDepth } from './scene-depth';
import { projectGroundQuad } from './ground-quad';
import { maskGroundWalkability } from './ground-walkability-mask';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import { writeRayQuad } from './ray-quad';

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
  rollAxis = new THREE.Vector3(0, 0, 1),
  flightTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
export type SurfaceParticle = ReturnType<typeof eclipseParticles>[number] & {
  /** World-axis terms stay outside an attachment's orientation. */
  worldOffset?: readonly number[];
  worldTravel?: readonly number[];
  /** Optional world-axis orbit about the current root, following the pinned
   * 65a7 reader. This is separate from newer emitter-frame reconstruction. */
  orbitTurn?: readonly number[];
};
type Particle = SurfaceParticle;
export type SurfaceProfile = Pick<
  (typeof ECLIPSE_PROFILES)[number],
  | 'kind'
  | 'role'
  | 'name'
  | 'mesh'
  | 'lookup'
  | 'erosion'
  | 'distortion'
  | 'soft'
  | 'uvMode'
  | 'renderOrder'
  | 'miscRenderFlags'
  | 'meshRenderFlags'
  | 'noCull'
  | 'ground'
  | 'navmesh'
  | 'local'
  | 'particleLocal'
  | 'directionOriented'
  | 'directionVelocityScale'
  | 'blend'
  | 'depthBias'
  | 'alphaRef'
> & {
  texture: string | null;
  uv: { address: number };
  multiplier: { texture: string; uv: { address: number } } | null;
  palette: { texture: string | null } | null;
};
export interface SurfaceGroup {
  key: string;
  startTick: number;
  stopTick: number;
  radius: number;
  seed: number;
  origin?: { x: number; y: number; facing: number } | null;
}
export interface SurfaceProgram<G extends SurfaceGroup> {
  name: string;
  attachment: string;
  profiles: readonly SurfaceProfile[];
  assets(): EclipseSurfaceAssets | undefined;
  accepts(index: number): boolean;
  /** Explicit caller-supplied shading for a retained source family. Geometry
   * remains asset-owned; the shared placement/lifetime path still owns material. */
  material?(
    index: number,
    assets: EclipseSurfaceAssets,
    geometry: THREE.BufferGeometry | undefined
  ): THREE.ShaderMaterial | undefined;
  /** Optional native-family tint packing. Omission retains the existing local
   * blend-zero RGB premultiplication with preserved alpha. */
  tint?(index: number, color: readonly number[]): readonly number[] | undefined;
  /** Explicit caller routing, separate from native mode/phase recovery. */
  distortionTarget?(index: number): THREE.Scene;
  records(world: World): Iterable<{ sourceId: number; castTick: number; group: G }>;
  particles(group: G, tick: number): readonly SurfaceParticle[];
  birthVisible(group: G, bornTick: number, terminal: boolean): boolean;
  /** Explicit creation-history visibility policy; omission retains point visibility. */
  visible?(group: G, particle: SurfaceParticle, tick: number): boolean;
  pose(group: G, tick: number): { x: number; y: number; facing: number } | null;
  /** Independent historical attachment point; offsets retain the program source frame. */
  attachmentPoint?(group: G, tick: number): THREE.Vector3 | null;
  /** Explicit current joint frame, restricted to fully bound/local profiles. */
  attachmentFrame?(group: G): { position: THREE.Vector3; rotation: THREE.Quaternion } | null;
  /** Local adapter for a missile object's source-Y-forward/source-Z-down frame. */
  missileFrame?(group: G): boolean;
  particleFacing?(profile: SurfaceProfile, born: number, current: number, bind: number): number;
}
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
/** Shared source surface drawing. Program-owned origins, reflected source frames,
 * ground projection, blend-0 tint premultiplication and direct distortion-strength
 * binding are local policies; native script/CPU dispatch remains unverified. */
export class SourceParticleSurfaces<G extends SurfaceGroup> {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  readonly depth = new SceneDepth();
  private sourceRotation = new THREE.Quaternion();
  private reflectedRotation = new THREE.Quaternion();
  private orbitRotation = new THREE.Quaternion();
  private frameRotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private cameraRotation = new THREE.Quaternion();
  private vector = new THREE.Vector3();
  private eye = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    private distortion: THREE.Scene,
    private ground: (p: Vec2) => number,
    private program: SurfaceProgram<G>,
    private resources?: EclipseSurfaceAssets
  ) {}
  private create(index: number, assets: EclipseSurfaceAssets) {
    const p = this.program.profiles[index],
      e = p.erosion,
      destination = p.distortion
        ? (this.program.distortionTarget?.(index) ?? this.distortion)
        : this.scene,
      sourceGeometry = p.mesh ? assets.mesh(p.mesh) : undefined;
    if (!p.texture) throw Error('Source surface requires an explicit base texture');
    const material =
      this.program.material?.(index, assets, sourceGeometry) ??
      (p.distortion
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
          }));
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
      blending: p.blend === 3 ? THREE.NoBlending : THREE.CustomBlending,
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
    mesh.name = `${this.program.name} ${p.role} ${p.name}`;
    Object.assign(mesh.userData, {
      profileIndex: index,
      role: p.role,
      ownedGeometry: owned,
      sourceMesh: p.mesh,
      unboundPalette: !!p.palette && !p.palette.texture,
      sourceMeshRenderFlags: p.meshRenderFlags,
      sourceNoCull: p.noCull,
      attachment: this.program.attachment,
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
    destination.add(mesh);
    return mesh;
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    const active = new Set<string>(),
      assets = this.resources ?? this.program.assets(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    camera.getWorldQuaternion(this.cameraRotation);
    camera.getWorldPosition(this.eye);
    if (assets)
      for (const { sourceId, castTick, group } of this.program.records(world)) {
        const attachmentFrame = this.program.attachmentFrame?.(group);
        if (this.program.attachmentFrame && !attachmentFrame) continue;
        for (const p of this.program.particles(group, tick)) {
          const profile = this.program.profiles[p.profileIndex];
          if (!this.program.accepts(p.profileIndex)) continue;
          const birth = this.program.birthVisible(group, p.bornTick, !!world.winner);
          if (!birth) continue;
          const born = group.origin ?? this.program.pose(group, group.startTick + p.bornTick),
            now = group.origin ?? this.program.pose(group, tick),
            bind = Math.max(0, Math.min(1, p.bind));
          if (!born || !now) continue;
          const origin = {
              x: born.x + (now.x - born.x) * bind,
              y: born.y + (now.y - born.y) * bind,
            },
            facing = profile.local
              ? (this.program.particleFacing?.(profile, born.facing, now.facing, bind) ??
                (bind === 1 ? now.facing : born.facing))
              : 0,
            missileFrame = profile.local && !!this.program.missileFrame?.(group);
          if (attachmentFrame) {
            if (bind !== 1 || !profile.local || !profile.particleLocal)
              throw Error('Joint surface requires fully bound local particles');
            this.frameRotation.copy(attachmentFrame.rotation);
          } else this.frameRotation.setFromAxisAngle(up, facing);
          if (missileFrame) this.frameRotation.multiply(flightTilt);
          this.vector
            .set(-p.offset[0], p.offset[1], p.offset[2])
            .multiplyScalar(0.01)
            .applyQuaternion(this.frameRotation);
          const position = new THREE.Vector3(
            (origin.x - (p.worldOffset?.[0] ?? 0)) * 0.01,
            this.ground(origin) + (p.worldOffset?.[1] ?? 0) * 0.01,
            (origin.y + (p.worldOffset?.[2] ?? 0)) * 0.01
          );
          if (this.program.attachmentPoint) {
            const birthPoint = this.program.attachmentPoint(group, group.startTick + p.bornTick),
              currentPoint = this.program.attachmentPoint(group, tick);
            if (!birthPoint || !currentPoint) continue;
            position
              .copy(birthPoint)
              .lerp(currentPoint, bind)
              .add(
                new THREE.Vector3(
                  -(p.worldOffset?.[0] ?? 0),
                  p.worldOffset?.[1] ?? 0,
                  p.worldOffset?.[2] ?? 0
                ).multiplyScalar(0.01)
              );
          }
          if (attachmentFrame)
            position
              .copy(attachmentFrame.position)
              .add(
                new THREE.Vector3(
                  -(p.worldOffset?.[0] ?? 0) * 0.01,
                  (p.worldOffset?.[1] ?? 0) * 0.01,
                  (p.worldOffset?.[2] ?? 0) * 0.01
                )
              );
          position.add(this.vector);
          const orbit = p.orbitTurn?.some((v, i) => i < 3 && v !== 0);
          if (orbit) {
            const q = p.orbitTurn!,
              center = new THREE.Vector3(now.x * 0.01, this.ground(now), now.y * 0.01),
              acceleration = new THREE.Vector3(
                -(p.worldOffset?.[0] ?? 0),
                p.worldOffset?.[1] ?? 0,
                p.worldOffset?.[2] ?? 0
              ).multiplyScalar(0.01);
            // S R S is the exact change of coordinates for the source-X mirror.
            // Acceleration is added after orbit and never turned with the root.
            this.orbitRotation.set(q[0], -q[1], -q[2], q[3]);
            position
              .sub(acceleration)
              .sub(center)
              .applyQuaternion(this.orbitRotation)
              .add(center)
              .add(acceleration);
          }
          if (!(
            this.program.visible?.(group, p, tick) ??
            world.pointVisible({ x: position.x * 100, y: position.z * 100 })
          ))
            continue;
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
                origin: p.worldOffset
                  ? { x: origin.x - p.worldOffset[0], y: origin.y + p.worldOffset[2] }
                  : origin,
                target: { x: origin.x + Math.sin(facing), y: origin.y + Math.cos(facing) },
                offset: p.offset,
                halfSize: p.size,
                rotation: p.rotation,
                ...(missileFrame ? { attachment: 'missile' as const } : {}),
              },
              (q) => this.ground(q) * 100,
              50,
              2
            );
            if (profile.navmesh)
              maskGroundWalkability(mesh.geometry, (q) => world.battlefield.lineWalkable(q, q, 0));
            mesh.position.set(0, 0, 0);
          } else if (profile.kind === 'billboard' && !attachmentFrame) {
            mesh.quaternion.copy(this.cameraRotation);
            let stretch = p.stretch;
            if (
              profile.directionOriented &&
              (Math.hypot(...p.travel) > 0 || p.worldTravel?.some((v) => v !== 0))
            ) {
              this.vector
                .set(-p.travel[0], p.travel[1], p.travel[2])
                .applyQuaternion(this.frameRotation);
              if (p.worldTravel) {
                this.vector.x -= p.worldTravel[0];
                this.vector.y += p.worldTravel[1];
                this.vector.z += p.worldTravel[2];
                stretch = Math.max(1, this.vector.length() * profile.directionVelocityScale);
              }
              if (orbit) this.vector.applyQuaternion(this.orbitRotation);
              this.vector.applyQuaternion(this.cameraRotation.clone().invert());
              mesh.rotateZ(Math.atan2(-this.vector.x, this.vector.y));
            } else
              mesh.quaternion.multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  rollAxis,
                  -THREE.MathUtils.degToRad(p.rotation[0])
                )
              );
            mesh.scale.set(p.size[0] * 0.01, p.size[1] * stretch * 0.01, 1);
          } else {
            mesh.quaternion.copy(this.frameRotation).multiply(this.reflectedRotation);
            mesh.scale.fromArray(p.size).multiplyScalar(profile.kind === 'mesh' ? 1 : 0.01);
            mesh.scale.x *= -1;
          }
          const uniforms = mesh.material.uniforms,
            packed = this.program.tint?.(p.profileIndex, p.color),
            color = [...(packed ?? p.color)];
          if (!packed && profile.blend === 0) for (let i = 0; i < 3; i++) color[i] *= color[3];
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
            sourceId,
            castTick,
            ordinal: p.ordinal,
            bornTick: group.startTick + p.bornTick,
            age: p.age,
            phase: p.phase,
            facing,
          });
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
