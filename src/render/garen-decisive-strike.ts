import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profile from '../content/garen-q-particles.json';
import castProfiles from '../content/garen-q-cast-particles.json';
import impactProfiles from '../content/garen-q-impact-particles.json';
import groundProfiles from '../content/garen-q-ground-particles.json';
import silenceProfile from '../content/garen-q-silence-particles.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { UnitModel } from './models';
import { garenQTrailParticles, garenQCastParticles } from './garen-q-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { garenQImpactParticles } from './garen-q-impact-particles';
import { writeRayQuad } from './ray-quad';
import { garenQGroundParticles } from './garen-q-ground-particles';
import { garenQSilenceParticles } from './garen-q-silence-particles';
import { unitBarHeight } from './unit-bar-height';
import { clearBillboardLabel, type OverheadLabelReader } from './billboard-label-clearance';

const selectedProfiles = [...castProfiles, ...impactProfiles, ...groundProfiles, silenceProfile];
const geometries = new Map<string, THREE.BufferGeometry>();
let ready = false;
const textures = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined;
export function loadGarenDecisiveStrike(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const candidates = new Map<string, THREE.BufferGeometry>();
    const meshPaths = [
      ...new Set([profile.mesh, ...selectedProfiles.flatMap((p) => (p.mesh ? [p.mesh] : []))]),
    ];
    const imagePaths = [
      ...new Set([
        profile.texture,
        profile.lookup,
        ...selectedProfiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]),
      ]),
    ];
    const images = new Map<string, THREE.Texture>();
    const result = await Promise.allSettled([
      ...meshPaths.map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          candidates.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!candidates.has(path)) throw new Error(`Missing Q source mesh: ${path}`);
      }),
      ...imagePaths.map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT =
          path === profile.lookup || selectedProfiles.some((p) => p.lookup === path)
            ? THREE.ClampToEdgeWrapping
            : THREE.RepeatWrapping;
        images.set(path, texture);
      }),
    ]);
    const failed = result.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      candidates.forEach((g) => g.dispose());
      images.forEach((t) => t.dispose());
      throw failed.reason;
    }
    images.forEach((t, path) => textures.set(path, t));
    candidates.forEach((g, path) => geometries.set(path, g));
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
export function createGarenQTrailMaterial(base: THREE.Texture, lookup: THREE.Texture) {
  const material = createParticleColorProductMaterial(base, lookup);
  Object.assign(material, {
    name: 'Decisive Strike source weapon trail',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
  });
  return material;
}
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const quad = new THREE.PlaneGeometry(2, 2),
  billboard = new THREE.PlaneGeometry(2, 2);
for (let i = 0; i < 4; i++) {
  const uv = quad.getAttribute('uv'),
    u = uv.getX(i),
    v = uv.getY(i);
  uv.setXY(i, v, 1 - u);
  const cameraUv = billboard.getAttribute('uv');
  cameraUv.setY(i, 1 - cameraUv.getY(i));
}
export function createGarenQCastMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = castProfiles[index];
  return createQMaterial(p, `Decisive Strike ${p.role} ${p.index}`, base, lookup);
}
export function createGarenQImpactMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = impactProfiles[index];
  return createQMaterial(p, `Decisive Strike impact ${p.index}`, base, lookup);
}
function createQMaterial(
  p: { blend: number; miscRenderFlags: number; uvMode?: number },
  name: string,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const material = createParticleColorProductMaterial(base, lookup);
  material.uniforms.sourceUvScale = { value: new THREE.Vector2(1, 1) };
  material.vertexShader = material.vertexShader
    .replace(
      'uniform vec2 sourceUvOffset;',
      'uniform vec2 sourceUvOffset;\nuniform vec2 sourceUvScale;'
    )
    .replace('sourceUv = uv + sourceUvOffset;', 'sourceUv = uv * sourceUvScale + sourceUvOffset;');
  if (p.uvMode === 2) {
    // These selected records have no UV rotation/scale animation. Both quad's
    // corner alpha and mesh's untranslated alpha therefore read the raw UV.
    material.vertexShader = material.vertexShader
      .replace('varying vec2 sourceUv;', 'varying vec2 sourceUv;\nvarying vec2 rawUv;')
      .replace('void main() {', 'void main() {\nrawUv = uv;');
    material.fragmentShader = material.fragmentShader
      .replace('varying vec2 sourceUv;', 'varying vec2 sourceUv;\nvarying vec2 rawUv;')
      .replace(
        'vec4 sourceColor = texture2D(sourceTexture, sourceUv);',
        'vec4 sourceColor = texture2D(sourceTexture, sourceUv);\nsourceColor.a = texture2D(sourceTexture, rawUv).a;'
      );
  }
  Object.assign(material, {
    name,
    transparent: true,
    depthWrite: false,
    depthTest: (p.miscRenderFlags & 1) === 0,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc:
      p.blend === 2 ? THREE.ZeroFactor : p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst:
      p.blend === 2
        ? THREE.OneMinusSrcColorFactor
        : p.blend === 1
          ? THREE.OneMinusSrcAlphaFactor
          : THREE.OneFactor,
    blendSrcAlpha:
      p.blend === 2 ? THREE.ZeroFactor : p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDstAlpha: p.blend === 2 || p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
  });
  return material;
}
export function createGarenQGroundMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = groundProfiles[index];
  return createQMaterial(p, `Decisive Strike ${p.role} ${p.index}`, base, lookup);
}
export function createGarenQSilenceMaterial(base: THREE.Texture, lookup: THREE.Texture) {
  return createQMaterial(silenceProfile, 'Decisive Strike silence', base, lookup);
}
export class GarenDecisiveStrike {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private bones = new WeakMap<UnitModel, THREE.Object3D | null>();
  private anchor = new THREE.Vector3();
  private heading = new THREE.Quaternion();
  private offset = new THREE.Vector3();
  private castRotation = new THREE.Quaternion();
  private identity = new THREE.Quaternion();
  private direction = new THREE.Vector3();
  private aim = new THREE.Quaternion();
  private rayAxis = new THREE.Vector3();
  private rayAcross = new THREE.Vector3();
  private rayEye = new THREE.Vector3();
  private rayOrigin = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(profile.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
      'YXZ'
    )
  );
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number,
    private labels?: OverheadLabelReader
  ) {}
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    unitModels: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    const active = new Set<string>();
    if (ready)
      for (const unit of world.units) {
        if (unit.champion !== 'garen' || (unit.team !== 'blue' && !world.visible(unit))) continue;
        const model = unitModels.get(unit.id);
        if (!model?.root.visible) continue;
        if (!this.bones.has(model)) {
          let bone: THREE.Object3D | null = null;
          model.root.traverse((o) => {
            if (o.name === profile.bone) bone = o;
          });
          this.bones.set(model, bone);
        }
        const bone = this.bones.get(model);
        if (bone) bone.getWorldPosition(this.anchor);
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        for (const p of bone
          ? garenQTrailParticles(world.championState(unit.id)!.garenQVisuals, tick)
          : []) {
          const key = `${unit.id}:${p.startTick}:${p.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              geometries.get(profile.mesh)!,
              createGarenQTrailMaterial(
                textures.get(profile.texture)!,
                textures.get(profile.lookup)!
              )
            );
            mesh.name = 'Garen Q WeaponTrail';
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              startTick: p.startTick,
              castTick: p.castTick,
              bornTick: p.bornTick,
              bone: profile.bone,
            });
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.facing);
          this.offset
            .fromArray(profile.position)
            .multiplyScalar(0.01)
            .applyQuaternion(this.heading);
          mesh.position.copy(this.anchor).add(this.offset);
          mesh.quaternion.copy(this.heading).multiply(this.rotation);
          mesh.scale.fromArray(profile.scale);
          mesh.material.uniforms.particleColor.value.fromArray(profile.color);
          mesh.material.uniforms.lookupUv.value.fromArray(p.lookup);
          mesh.material.uniforms.sourceUvOffset.value.fromArray(p.scroll);
        }
        model.root.getWorldPosition(this.anchor);
        this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, unit.facing);
        for (const particle of garenQCastParticles(
          unit.id,
          world.championState(unit.id)!.garenQVisuals,
          tick
        )) {
          const p = castProfiles[particle.profileIndex];
          const key = `${unit.id}:cast:${particle.castTick}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              p.mesh ? geometries.get(p.mesh)! : p.kind === 'quad' ? quad : billboard,
              createGarenQCastMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen Q ${p.role} ${p.index} ${p.name}`;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              castTick: particle.castTick,
              profileIndex: particle.profileIndex,
              attachment: 'local-caster-root',
            });
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.heading);
          mesh.position.copy(this.anchor).add(this.offset);
          if (p.kind === 'billboard' && !p.particleLocal) {
            mesh.quaternion.copy(camera.quaternion);
            mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            this.castRotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            mesh.quaternion
              .copy(p.local ? this.heading : this.identity)
              .multiply(this.castRotation);
          }
          mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const tint = [...particle.color];
          if (p.blend === 0 || p.blend === 2) {
            for (let i = 0; i < 3; i++) tint[i] *= tint[3];
            tint[3] = 1;
          }
          const uniforms = mesh.material.uniforms;
          uniforms.particleColor.value.fromArray(tint);
          uniforms.lookupUv.value.fromArray(particle.lookup);
          const [columns, rows] = p.atlas.grid;
          uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
          uniforms.sourceUvOffset.value.set(
            particle.scroll[0] + (particle.frame % columns) / columns,
            particle.scroll[1] + Math.floor(particle.frame / columns) / rows
          );
        }
      }
    // Impact is independent of the caster model/visibility/pose. Each world-space
    // particle is sight-gated at its own position, including after lethal hits.
    if (ready)
      for (const unit of world.units) {
        const records = world.championState(unit.id)?.garenQVisuals;
        if (unit.champion !== 'garen' || !records?.length) continue;
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        for (const particle of garenQImpactParticles(unit.id, records, tick)) {
          const p = impactProfiles[particle.profileIndex];
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, particle.facing);
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.heading);
          this.anchor
            .set(particle.point.x * 0.01, this.ground(particle.point), particle.point.y * 0.01)
            .add(this.offset);
          if (
            unit.team !== 'blue' &&
            !world.pointVisible({ x: this.anchor.x * 100, y: this.anchor.z * 100 })
          )
            continue;
          const key = `${unit.id}:impact:${particle.startTick}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            const geometry =
              p.kind === 'ray'
                ? new THREE.BufferGeometry()
                    .setAttribute(
                      'position',
                      new THREE.BufferAttribute(new Float32Array(18), 3).setUsage(
                        THREE.DynamicDrawUsage
                      )
                    )
                    .setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2))
                : p.mesh
                  ? geometries.get(p.mesh)!
                  : p.kind === 'quad'
                    ? quad
                    : billboard;
            mesh = new THREE.Mesh(
              geometry,
              createGarenQImpactMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen Q impact ${p.index} ${p.name}`;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              castTick: particle.castTick,
              startTick: particle.startTick,
              impactTick: particle.impactTick,
              impactProfileIndex: particle.profileIndex,
              attachment: 'local-confirmed-contact-ground',
              ownedGeometry: p.kind === 'ray',
            });
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          mesh.position.copy(this.anchor);
          if (p.kind === 'ray') {
            this.castRotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            if (p.local) this.castRotation.premultiply(this.heading);
            this.rayAxis.set(0, 0, 1).applyQuaternion(this.castRotation);
            this.rayAcross.set(1, 0, 0).applyQuaternion(this.castRotation);
            camera.getWorldPosition(this.rayEye).sub(mesh.position);
            const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
              uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
            writeRayQuad(
              position,
              uv,
              0,
              {
                center: this.rayOrigin,
                axis: this.rayAxis,
                fallbackAcross: this.rayAcross,
                size: particle.scale.map((v) => v * 0.01) as [number, number, number],
              },
              this.rayEye
            );
            position.needsUpdate = uv.needsUpdate = true;
            mesh.quaternion.identity();
            mesh.scale.setScalar(1);
          } else if (p.kind === 'billboard') {
            mesh.quaternion.copy(camera.quaternion);
            this.direction
              .fromArray(particle.travel)
              .applyQuaternion(this.heading)
              .applyQuaternion(this.aim.copy(camera.quaternion).invert());
            if (p.direction && this.direction.lengthSq() > 0)
              mesh.rotateZ(Math.atan2(-this.direction.x, this.direction.y));
            else mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            this.castRotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            mesh.quaternion
              .copy(p.local ? this.heading : this.identity)
              .multiply(this.castRotation);
          }
          if (p.kind !== 'ray')
            mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const tint = [...particle.color];
          if (p.blend === 0) {
            for (let i = 0; i < 3; i++) tint[i] *= tint[3];
            tint[3] = 1;
          }
          const uniforms = mesh.material.uniforms,
            [columns, rows] = p.atlas.grid;
          uniforms.particleColor.value.fromArray(tint);
          uniforms.lookupUv.value.fromArray(particle.lookup);
          uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
          uniforms.sourceUvOffset.value.set(
            (particle.frame % columns) / columns,
            Math.floor(particle.frame / columns) / rows
          );
        }
      }
    if (ready)
      for (const unit of world.units) {
        const records = world.championState(unit.id)?.garenQVisuals;
        if (unit.champion !== 'garen' || !records?.length) continue;
        for (const particle of garenQGroundParticles(
          unit.id,
          records,
          world.tick - 1 + alpha + terminalAge * 60
        )) {
          const p = groundProfiles[particle.profileIndex];
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, particle.facing);
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.heading);
          this.anchor
            .set(particle.point.x * 0.01, this.ground(particle.point), particle.point.y * 0.01)
            .add(this.offset);
          if (
            unit.team !== 'blue' &&
            !world.pointVisible({ x: this.anchor.x * 100, y: this.anchor.z * 100 })
          )
            continue;
          const key = `${unit.id}:ground:${particle.startTick}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              p.mesh ? geometries.get(p.mesh)! : p.kind === 'quad' ? quad : billboard,
              createGarenQGroundMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen Q ${p.role} ${p.index} ${p.name}`;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              castTick: particle.castTick,
              startTick: particle.startTick,
              groundProfileIndex: particle.profileIndex,
              eventTick: particle.eventTick,
              bornTick: particle.bornTick,
              attachment: 'saved-ground-event',
            });
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          mesh.position.copy(this.anchor);
          if (p.kind === 'billboard') {
            mesh.quaternion.copy(camera.quaternion);
            mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            if (p.direction && this.direction.fromArray(particle.travel).lengthSq() > 0) {
              this.direction.normalize();
              this.rayAcross
                .set(
                  ...((Math.abs(this.direction.y) < 0.99 ? [0, 1, 0] : [1, 0, 0]) as [
                    number,
                    number,
                    number,
                  ])
                )
                .cross(this.direction)
                .normalize();
              this.rayAxis.crossVectors(this.rayAcross, this.direction);
              this.castRotation.setFromRotationMatrix(
                this.basis.makeBasis(this.rayAcross, this.direction, this.rayAxis)
              );
            } else
              this.castRotation.setFromEuler(
                this.euler.set(
                  ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                  'YXZ'
                )
              );
            mesh.quaternion
              .copy(p.local ? this.heading : this.identity)
              .multiply(this.castRotation);
          }
          mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const tint = [...particle.color];
          if (p.blend === 0 || p.blend === 2) {
            for (let i = 0; i < 3; i++) tint[i] *= tint[3];
            tint[3] = 1;
          }
          const uniforms = mesh.material.uniforms,
            [columns, rows] = p.atlas.grid;
          uniforms.particleColor.value.fromArray(tint);
          uniforms.lookupUv.value.fromArray(particle.lookup);
          uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
          uniforms.sourceUvOffset.value.set(
            particle.scroll[0] + (particle.frame % columns) / columns,
            particle.scroll[1] + Math.floor(particle.frame / columns) / rows
          );
        }
      }
    if (ready && !world.winner) {
      const tick = world.tick - 1 + alpha;
      const sources = world.units
        .filter((u) => u.champion === 'garen')
        .map((u) => ({ id: u.id, records: world.championState(u.id)!.garenQVisuals }));
      for (const particle of garenQSilenceParticles(sources, tick)) {
        const target = world.unit(particle.targetId),
          model = unitModels.get(particle.targetId);
        if (
          !target ||
          !world.alive(target) ||
          tick >= target.silenceUntil ||
          !model?.root.visible ||
          (target.team !== 'blue' && !world.visible(target))
        )
          continue;
        const key = `silence:${target.id}`;
        active.add(key);
        let mesh = this.models.get(key);
        if (!mesh) {
          mesh = new THREE.Mesh(
            billboard,
            createGarenQSilenceMaterial(
              textures.get(silenceProfile.texture)!,
              textures.get(silenceProfile.lookup)!
            )
          );
          mesh.name = 'Garen Q Silence';
          mesh.renderOrder = silenceProfile.renderOrder;
          mesh.frustumCulled = false;
          this.models.set(key, mesh);
          this.scene.add(mesh);
        }
        Object.assign(mesh.userData, {
          sourceId: particle.sourceId,
          targetId: target.id,
          castTick: particle.castTick,
          startTick: particle.startTick,
          attackTick: particle.attackTick,
          endTick: particle.endTick,
          attachment: 'local-health-bar-plus-source-offset',
          silence: true,
        });
        model.root.getWorldPosition(mesh.position);
        this.offset.fromArray(silenceProfile.offset).multiplyScalar(0.01);
        this.offset.y += unitBarHeight(target, model);
        mesh.position.add(this.offset);
        mesh.quaternion.copy(camera.quaternion);
        mesh.scale.fromArray(particle.scale).multiplyScalar(0.01);
        mesh.position.toArray((mesh.userData.preferredPosition ??= []));
        const label = this.labels?.(target.id);
        mesh.userData.layoutLiftPixels = label
          ? clearBillboardLabel(mesh.position, mesh.scale, camera, label.viewport, label.label)
          : 0;
        const uniforms = mesh.material.uniforms,
          [columns, rows] = silenceProfile.atlas.grid;
        uniforms.particleColor.value.fromArray(silenceProfile.color);
        uniforms.lookupUv.value.fromArray(particle.lookup);
        uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
        uniforms.sourceUvOffset.value.set(0, 0);
      }
    }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        if (mesh.userData.ownedGeometry) mesh.geometry.dispose();
        this.models.delete(key);
      }
  }
}
