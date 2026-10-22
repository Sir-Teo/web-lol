import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  COMPANION_SOURCE as S,
  companionStage,
  type CompanionKind,
} from '../content/companion-policy';
import type { World } from '../simulation/world';
import { SCALE } from './terrain';
import type { Vec2 } from '../simulation/math';
const references = new Map<CompanionKind, { root: THREE.Group; clips: THREE.AnimationClip[] }>();
const pending = new Map<CompanionKind, Promise<void>>();
export async function loadOwnedCompanions(kinds: readonly CompanionKind[]): Promise<void> {
  await Promise.all(
    [...new Set(kinds)].map(async (kind) => {
      if (references.has(kind)) return;
      let request = pending.get(kind);
      if (!request) {
        request = (async () => {
          const gltf = await new GLTFLoader().loadAsync(
            `assets/models/${S.profiles[kind].rig}.glb`
          );
          for (const c of Object.values(S.profiles[kind].clips))
            if (!gltf.animations.some((a) => a.name === c.name))
              throw new Error(`Companion lacks ${c.name}`);
          references.set(kind, { root: gltf.scene, clips: gltf.animations });
        })();
        pending.set(kind, request);
      }
      try {
        await request;
      } finally {
        if (pending.get(kind) === request) pending.delete(kind);
      }
    })
  );
}
export class OwnedCompanions {
  readonly entries = new Map<
    number,
    {
      root: THREE.Group;
      mixer: THREE.AnimationMixer;
      action?: THREE.AnimationAction;
      key?: string;
      kind: CompanionKind;
    }
  >();
  constructor(private scene: THREE.Scene) {}
  update(w: World, alpha: number, ground: (p: Vec2) => number): void {
    const alive = new Set<number>();
    for (const p of w.companions) {
      alive.add(p.ownerId);
      const owner = w.unit(p.ownerId)!;
      let entry = this.entries.get(p.ownerId);
      if (!entry) {
        const ref = references.get(p.kind);
        if (!ref) throw new Error('Companion rig was not prepared');
        const root = clone(ref.root) as THREE.Group;
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) o.frustumCulled = false;
        });
        entry = { root, mixer: new THREE.AnimationMixer(root), kind: p.kind };
        this.scene.add(root);
        this.entries.set(p.ownerId, entry);
      }
      entry.root.visible = w.alive(owner) && w.visible(owner, w.hero.team);
      if (!entry.root.visible) continue;
      entry.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const form = mats[0]?.userData.sourceSubmesh;
          if (form === 'Adult' || form === 'Baby')
            o.visible = form === (companionStage(p.fed) === 2 ? 'Adult' : 'Baby');
        }
      });
      const point = {
        x: p.previous.x + (p.x - p.previous.x) * alpha,
        y: p.previous.y + (p.y - p.previous.y) * alpha,
      };
      entry.root.position.set(point.x * SCALE, ground(point), point.y * SCALE);
      entry.root.rotation.y = p.facing;
      const key = `${p.pose.action}:${p.pose.startTick}`;
      if (entry.key !== key) {
        entry.mixer.stopAllAction();
        const clip = references
          .get(p.kind)!
          .clips.find((c) => c.name === S.profiles[p.kind].clips[p.pose.action].name)!;
        entry.action = entry.mixer
          .clipAction(clip)
          .setLoop(
            ['idle', 'run'].includes(p.pose.action) ? THREE.LoopRepeat : THREE.LoopOnce,
            Infinity
          );
        entry.action.clampWhenFinished = true;
        entry.action.reset().play();
        entry.key = key;
      }
      entry.action!.paused = false;
      entry.mixer.setTime(Math.max(0, (w.tick - 1 + alpha - p.pose.startTick) / 60));
    }
    for (const [id, e] of this.entries)
      if (!alive.has(id)) {
        e.mixer.stopAllAction();
        e.mixer.uncacheRoot(e.root);
        this.scene.remove(e.root);
        this.entries.delete(id);
      }
  }
}
