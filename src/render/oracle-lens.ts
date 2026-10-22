import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ORACLE_SOURCE as S } from '../content/trinkets';
import type { World } from '../simulation/world';
import type { TrinketState } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import { SCALE } from './terrain';
import { makeModel, disposeModel, type UnitModel } from './models';
import { sampleParticleCurve } from './particle-curves';

let reference: {
  rig: THREE.Group;
  clip: THREE.AnimationClip;
  radar: THREE.BufferGeometry;
  texture: THREE.Texture;
} | null = null;
let pending: Promise<void> | null = null;
/** Prepare only the selected scanner/radar layers. Failure leaves equipment untouched. */
export async function loadOracleLens(): Promise<void> {
  if (reference) return;
  if (!pending)
    pending = (async () => {
      const loader = new GLTFLoader();
      const [rig, radar, texture] = await Promise.all([
        loader.loadAsync(import.meta.env.BASE_URL + S.bindings.Trinket_Red.mesh),
        loader.loadAsync(import.meta.env.BASE_URL + S.bindings.RadarMesh.mesh),
        new THREE.TextureLoader().loadAsync(
          import.meta.env.BASE_URL + S.bindings.RadarMesh.texture
        ),
      ]);
      const clip = rig.animations.find((c) => c.name === S.clip);
      if (!clip) throw new Error('Oracle scanner animation is missing');
      let geometry: THREE.BufferGeometry | null = null;
      radar.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometry = o.geometry;
      });
      if (!geometry) throw new Error('Oracle radar geometry is missing');
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      reference = { rig: rig.scene, clip, radar: geometry, texture };
    })();
  const request = pending;
  try {
    await request;
  } finally {
    if (pending === request) pending = null;
  }
}
interface ScanModel {
  startTick: number;
  root: THREE.Group;
  rig: UnitModel;
  radar: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  texture: THREE.Texture;
  guide: THREE.LineLoop;
}
/** First two source layers; the remaining emitters and native material dispatch are open.
 * Ground geometry uses local vertical projection. The thin radius guide and
 * sampled solid champion silhouettes are explicit local presentation adapters.
 */
export class OracleLens {
  readonly scans = new Map<number, ScanModel>();
  readonly echoes = new Map<number, UnitModel>();
  constructor(private scene: THREE.Scene) {}
  private removeScan(id: number, entry: ScanModel): void {
    this.scene.remove(entry.root);
    disposeModel(entry.rig);
    entry.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
    entry.radar.geometry.dispose();
    entry.radar.material.dispose();
    entry.texture.dispose();
    entry.guide.geometry.dispose();
    (entry.guide.material as THREE.Material).dispose();
    this.scans.delete(id);
  }
  update(w: World, alpha: number, ground: (p: Vec2) => number): void {
    const active = new Set<number>();
    const echoes = new Map<number, NonNullable<TrinketState['scan']>['echoes'][number]>();
    for (const owner of w.units) {
      const scan = w.championState(owner.id)?.trinket.scan;
      if (!scan || scan.endTick <= w.tick) continue;
      active.add(owner.id);
      if (owner.team === w.hero.team)
        for (const echo of scan.echoes) {
          const previous = echoes.get(echo.targetId);
          if (echo.endTick > w.tick && (!previous || previous.createdTick < echo.createdTick))
            echoes.set(echo.targetId, echo);
        }
      let entry = this.scans.get(owner.id);
      if (entry && entry.startTick !== scan.startTick) {
        this.removeScan(owner.id, entry);
        entry = undefined;
      }
      if (!entry) {
        if (!reference) throw new Error('Oracle Lens assets were not prepared');
        const rigRoot = clone(reference.rig) as THREE.Group;
        rigRoot.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.frustumCulled = false;
            o.material = Array.isArray(o.material)
              ? o.material.map((m) => m.clone())
              : o.material.clone();
          }
        });
        const mixer = new THREE.AnimationMixer(rigRoot);
        mixer.clipAction(reference.clip).play();
        const texture = reference.texture.clone();
        const radar = new THREE.Mesh(
          reference.radar.clone(),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        radar.frustumCulled = false;
        const guide = new THREE.LineLoop(
          new THREE.BufferGeometry().setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(64 * 3), 3)
          ),
          new THREE.LineBasicMaterial({
            color: 0xe27b70,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          })
        );
        guide.frustumCulled = false;
        const root = new THREE.Group();
        root.add(rigRoot, radar, guide);
        this.scene.add(root);
        entry = {
          startTick: scan.startTick,
          root,
          rig: { root: rigRoot, mixer, referenceAsset: S.rig },
          radar,
          texture,
          guide,
        };
        this.scans.set(owner.id, entry);
      }
      entry.root.visible = w.visible(owner, w.hero.team);
      if (!entry.root.visible) continue;
      const point = {
        x: owner.previous.x + (owner.x - owner.previous.x) * alpha,
        y: owner.previous.y + (owner.y - owner.previous.y) * alpha,
      };
      const age = Math.max(0, (w.tick + alpha - 1 - scan.startTick) / 60);
      const rig = S.renderEmitters.Trinket_Red,
        radar = S.renderEmitters.RadarMesh;
      const rigAge = Math.max(0, age - rig.timeBeforeFirstEmission);
      entry.rig.root.visible = age >= rig.timeBeforeFirstEmission;
      entry.rig.root.position.set(
        point.x * SCALE,
        ground(point) + rig.SpawnShape.emitOffset[1] * SCALE,
        point.y * SCALE
      );
      entry.rig.root.scale.set(
        ...(rig.birthScale0.constantValue.map(
          (v, i) =>
            v *
            sampleParticleCurve(rig.scale0.dynamics, rigAge / rig.particleLifetime.constantValue, i)
        ) as [number, number, number])
      );
      // The source probability table has a single Y rotation value of -20.
      entry.rig.root.rotation.y = (-20 * Math.PI) / 180;
      entry.rig.mixer!.setTime(rigAge);
      entry.rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.opacity = sampleParticleCurve(
              rig.Color.dynamics,
              rigAge / rig.particleLifetime.constantValue,
              3
            );
        }
      });
      const yaw =
        ((radar.birthRotation0.constantValue[1] +
          radar.birthRotationalVelocity0.constantValue[1] * age) *
          Math.PI) /
        180;
      const c = Math.cos(yaw),
        s = Math.sin(yaw),
        positions = entry.radar.geometry.getAttribute('position') as THREE.BufferAttribute;
      const original = reference!.radar.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = original.getX(i) * radar.birthScale0.constantValue[0],
          z = original.getZ(i) * radar.birthScale0.constantValue[2];
        const p = { x: point.x + (c * x + s * z) / SCALE, y: point.y + (-s * x + c * z) / SCALE };
        positions.setXYZ(
          i,
          p.x * SCALE,
          ground(p) + radar.SpawnShape.emitOffset[1] * SCALE,
          p.y * SCALE
        );
      }
      positions.needsUpdate = true;
      const color = radar.Color.dynamics;
      entry.radar.material.color.setRGB(
        ...([0, 1, 2].map((i) =>
          sampleParticleCurve(color, age / radar.particleLifetime.constantValue, i)
        ) as [number, number, number])
      );
      entry.radar.material.opacity = sampleParticleCurve(
        color,
        age / radar.particleLifetime.constantValue,
        3
      );
      entry.texture.offset.set(
        ...(radar.birthUvScrollRate.constantValue.map((v) => v * age) as [number, number])
      );
      entry.guide.visible = owner.team === w.hero.team;
      const guide = entry.guide.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < guide.count; i++) {
        const theta = (i / guide.count) * Math.PI * 2,
          p = {
            x: point.x + Math.cos(theta) * scan.radius,
            y: point.y + Math.sin(theta) * scan.radius,
          };
        guide.setXYZ(i, p.x * SCALE, ground(p) + 0.04, p.y * SCALE);
      }
      guide.needsUpdate = true;
    }
    for (const [id, entry] of this.scans) if (!active.has(id)) this.removeScan(id, entry);
    const visibleEchoes = new Set<number>();
    for (const [id, echo] of echoes) {
      const target = w.unit(id);
      if (!target || w.visible(target, w.hero.team)) continue;
      visibleEchoes.add(id);
      let model = this.echoes.get(id);
      if (!model) {
        model = makeModel(target);
        model.root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material = new THREE.MeshBasicMaterial({
              color: 0xe95642,
              transparent: true,
              opacity: 0.6,
              depthTest: false,
              depthWrite: false,
            });
            o.renderOrder = 1000;
            o.frustumCulled = false;
          }
        });
        this.echoes.set(id, model);
        this.scene.add(model.root);
      }
      model.root.position.set(echo.point.x * SCALE, ground(echo.point), echo.point.y * SCALE);
      model.root.rotation.y = echo.facing;
    }
    for (const [id, model] of this.echoes)
      if (!visibleEchoes.has(id)) {
        this.scene.remove(model.root);
        disposeModel(model);
        model.root.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
        });
        this.echoes.delete(id);
      }
  }
}
