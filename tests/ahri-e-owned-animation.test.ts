import { expect, test } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { eVisualGameplaySamples } from './helpers/ahri-e-visual-gameplay';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { EAttachmentRoots } from '../src/render/ahri-e-attachments';
import { eVisualAnimation, eVisualGroups } from '../src/render/ahri-e-history';

const samples = eVisualGameplaySamples(World, PRACTICE_FIXTURE, 'moving-caster');
const state = (tick: number) => JSON.parse(samples.find((s) => s.tick === tick)!.snapshot);
const restore = (value: unknown) => World.fromSnapshot(JSON.stringify(value), PRACTICE_FIXTURE);
function roots() {
  return new EAttachmentRoots(
    () => 2,
    (rig) => {
      const reference = new THREE.Group(),
        bone = new THREE.Bone();
      reference.scale.setScalar(0.01);
      bone.name = 'C_Buffbone_Glb_Center_Loc';
      reference.add(bone);
      return new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS[rig]).map(
          ([name, duration], index) =>
            new THREE.AnimationClip(name, duration, [
              new THREE.NumberKeyframeTrack(
                bone.name + '.position[y]',
                [0, duration],
                [100 + index * 25, 140 + index * 25]
              ),
            ])
        )
      );
    }
  );
}
test('historical animated roots reconstruct after the current Unit has discarded its old transition', () => {
  const early = restore(state(20)),
    late = restore(state(120));
  const a = eVisualGroups(early.ahriEVisuals[0])[0],
    b = eVisualGroups(late.ahriEVisuals[0])[0];
  const old = eVisualAnimation(b, 10)!;
  expect(old.timeline!.primary.clip).not.toBe(
    late.unit(b.record.sourceId)!.animationTimeline!.primary.clip
  );
  const cached = roots();
  cached.begin(early);
  const expected = cached.position(a, 10)!.toArray();
  cached.begin(late);
  expect(cached.position(b, 10)!.toArray()).toEqual(expected);
  const fresh = roots();
  fresh.begin(late);
  expect(fresh.position(b, 10)!.toArray()).toEqual(expected);
  cached.dispose();
  fresh.dispose();
});
test('strict E admission rejects missing, future, stale, unknown and mismatched owned animation facts', () => {
  const original = state(60);
  const mutations: ((s: any) => void)[] = [
    (s) => {
      delete s.ahriEVisuals[0].sourceFrames[0].animationTimeline;
    },
    (s) => {
      s.ahriEVisuals[0].sourceFrames[0].animationTimeline = null;
    },
    (s) => {
      const f = s.ahriEVisuals[0].sourceFrames[1];
      f.animationTimeline.tick = f.tick + 1;
    },
    (s) => {
      const f = s.ahriEVisuals[0].sourceFrames[10];
      f.animationTimeline.tick = f.tick - 2;
    },
    (s) => {
      s.ahriEVisuals[0].sourceFrames[1].animationTimeline.primary.clip = 'missing';
    },
    (s) => {
      s.ahriEVisuals[0].sourceFrames[1].animationTimeline.debug = true;
    },
    (s) => {
      s.ahriEVisuals[0].hit.targetRig = null;
    },
    (s) => {
      s.ahriEVisuals[0].hit.targetRig = 'ahri-base';
    },
    (s) => {
      s.ahriEVisuals[0].targetFrames[0].animationTimeline.primary.time = 1000;
    },
    (s) => {
      const t = s.ahriEVisuals[0].sourceFrames.at(-1).animationTimeline;
      t.primary.time += 0.001;
      t.primary.unclampedTime += 0.001;
    },
  ];
  expect(restore(original).snapshot()).toBe(JSON.stringify(original));
  for (const mutate of mutations) {
    const changed = structuredClone(original);
    mutate(changed);
    expect(() => restore(changed)).toThrow();
  }
});
test('observed animation transitions are owned independently from live Unit state', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  caster.ai = false;
  w.learnSpell('e', caster.id);
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step();
  const observed = w.ahriEVisuals[0].sourceFrames[0].animationTimeline!,
    live = caster.animationTimeline!;
  expect(observed).not.toBe(live);
  expect(observed.primary).not.toBe(live.primary);
  if (live.transition) {
    expect(observed.transition).not.toBe(live.transition);
    expect(observed.transition!.outgoing).not.toBe(live.transition.outgoing);
  }
  const saved = JSON.stringify(live);
  observed.primary.time += 1;
  expect(JSON.stringify(live)).toBe(saved);
});

test('a target-ending animation is owned separately from the last frame and live corpse', () => {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
  });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri'),
    target = w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux');
  caster.ai = target.ai = false;
  target.hp = target.maxHp = 10000;
  w.learnSpell('e', caster.id);
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 900, y: 0 } });
  w.step(40);
  w.damage(caster, target, 1e6, 'true');
  const r = w.ahriEVisuals[0],
    last = r.targetFrames.at(-1)!.animationTimeline!,
    end = r.targetEnd!.pose.animationTimeline!;
  expect(end).toEqual(last);
  expect(end).not.toBe(last);
  expect(end.primary).not.toBe(last.primary);
  expect(last).not.toBe(target.animationTimeline);
  const before = JSON.stringify(last);
  end.primary.time += 1;
  expect(JSON.stringify(last)).toBe(before);
});
