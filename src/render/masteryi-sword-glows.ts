import { SWORD_GLOW_TAIL_TICKS } from '../content/masteryi-sword-timing';
import * as THREE from 'three';
import data from '../content/masteryi-sword-particles.json';
import { swordGlowAudio, type SwordGlowVisual } from '../simulation/masteryi-sword-glow';
import type { UnitModel } from './models';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { masterYiTextures } from './masteryi-source-textures';
import { swordGlowParticles } from './masteryi-sword-particles';
import { SwordParticleInstances } from './masteryi-sword-instances';
import { SourceParticleSurfaces, type SurfaceGroup } from './source-particle-surfaces';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { actorRootKnown, actorRootPose } from '../simulation/actor-root-history';

const textures = new Map<string, THREE.Texture>(),
  samplers = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined,
  ready = false;
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.colorSpace = THREE.NoColorSpace;
white.generateMipmaps = false;
white.needsUpdate = true;
const assets: EclipseSurfaceAssets = {
  texture(path, address = 0) {
    if (!path) return white;
    if (address !== 0 && address !== 2) throw RangeError('Unsupported Sword glow texture address');
    const loaded = textures.get(path);
    if (!loaded) throw Error('Missing Sword glow source texture');
    const wrap = address === 2 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (loaded.wrapS === wrap) return loaded;
    const key = `${path}:${address}`;
    let texture = samplers.get(key);
    if (!texture) {
      texture = loaded.clone();
      texture.wrapS = texture.wrapT = wrap;
      texture.needsUpdate = true;
      samplers.set(key, texture);
    }
    return texture;
  },
  mesh() {
    throw Error('Sword glow has no source mesh');
  },
};
/** All selected source assets must load. Preserve verified successes for explicit retry. */
export function loadSwordGlows(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const results = await Promise.allSettled([
      ...data.textures
        .filter((asset) => !textures.has(asset.url))
        .map(async (asset) => {
          const lookup = data.profiles.some((profile) => profile.lookup === asset.url);
          const resource = await masterYiTextures.load(asset, lookup);
          textures.set(asset.url, resource);
        }),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
interface Group extends SurfaceGroup {
  record: SwordGlowVisual;
  unitId: number;
  system: string;
  bone: string;
  emissionStop: number;
}
interface JointFrame {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}
export class SwordGlows extends SourceParticleSurfaces<Group> {
  readonly instances: SwordParticleInstances;
  private readonly frames: Map<string, JointFrame | null>;
  private readonly context: { models: ReadonlyMap<number, UnitModel> };
  constructor(scene: THREE.Scene, ground: (p: Vec2) => number) {
    const frames = new Map<string, JointFrame | null>(),
      context = { models: new Map<number, UnitModel>() as ReadonlyMap<number, UnitModel> },
      bones = new WeakMap<UnitModel, Map<string, THREE.Object3D | undefined>>();
    super(scene, scene, ground, {
      name: 'Sword glow',
      attachment: 'authored-sword-joint',
      profiles: data.profiles,
      assets: () => (ready ? assets : undefined),
      accepts: () => true,
      *records(world: World) {
        for (const unit of world.units) {
          if (unit.champion !== 'masteryi') continue;
          const owner = world.championState(unit.id)!;
          for (const record of owner.swordGlowVisuals) {
            const audio = swordGlowAudio(owner, record.condition).find(
              (a) => a.startTick === record.castTick
            )!;
            for (const binding of data.bindings.filter(
              (b) => b.conditionIndex === record.condition
            ))
              yield {
                sourceId: unit.id,
                castTick: record.castTick,
                group: {
                  key: `${unit.id}:${record.condition}:${record.castTick}:${binding.index}`,
                  startTick: record.castTick,
                  stopTick: audio.stop ? audio.stop.tick + SWORD_GLOW_TAIL_TICKS : Infinity,
                  radius: unit.radius,
                  seed:
                    unit.id ^
                    Math.imul(record.castTick, 0x9e3779b9) ^
                    Math.imul(binding.index + 1 + record.condition * 4, 0x85ebca6b),
                  record,
                  unitId: unit.id,
                  system: binding.effectKey,
                  bone: binding.sourceBone,
                  emissionStop: audio.stop?.tick ?? Infinity,
                },
              };
          }
        }
      },
      particles: (g, tick) =>
        swordGlowParticles(
          g.seed,
          (tick - g.startTick) / 60,
          (g.emissionStop - g.startTick) / 60,
          g.system
        ),
      birthVisible: (g, born) => actorRootKnown(g.record.frames, g.startTick + born, 'blue'),
      pose: (g, tick) => actorRootPose(g.record.frames, tick),
      visible: (g, _p, tick) => actorRootKnown(g.record.frames, tick, 'blue'),
      attachmentFrame: (g) => {
        const key = `${g.unitId}:${g.bone}`;
        if (frames.has(key)) return frames.get(key)!;
        const model = context.models.get(g.unitId);
        if (!model?.root.visible) {
          frames.set(key, null);
          return null;
        }
        let names = bones.get(model);
        if (!names) bones.set(model, (names = new Map()));
        const lower = g.bone.toLowerCase();
        if (!names.has(lower)) {
          let found: THREE.Object3D | undefined;
          model.root.traverse((node) => {
            if (node.name.toLowerCase() !== lower) return;
            if (found) throw Error('Ambiguous authored sword joint');
            found = node;
          });
          names.set(lower, found);
        }
        const bone = names.get(lower);
        if (!bone) {
          frames.set(key, null);
          return null;
        }
        const result = {
          position: bone.getWorldPosition(new THREE.Vector3()),
          rotation: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
        };
        frames.set(key, result);
        return result;
      },
    });
    this.instances = new SwordParticleInstances(scene);
    this.frames = frames;
    this.context = context;
  }
  updateAttached(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    models: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    this.frames.clear();
    this.context.models = models;
    super.update(world, alpha, camera, terminalAge);
  }
  prepare(camera: THREE.Camera) {
    this.instances.prepare(this.models.values(), camera);
  }
  override dispose() {
    this.instances.dispose();
    super.dispose();
  }
}
