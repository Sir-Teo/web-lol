import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { applyMobileAnimation } from '../src/render/mobile-animation';
import type { MobilePose } from '../src/render/mobile-pose';
import type { PoseLayer } from '../src/simulation/animation-timeline';

function rig() {
  const root = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = 'bone';
  bone.position.set(2, 3, 4);
  root.add(bone);
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(
    ['idle', 'run', 'death'].map((name, i) => {
      const clip = new THREE.AnimationClip(name, 1, [
        new THREE.VectorKeyframeTrack(
          'bone.position',
          [0, 0.5, 1],
          [i, 1, 2, 2, i + 2, 3, i + 4, 5, 6]
        ),
        new THREE.QuaternionKeyframeTrack(
          'bone.quaternion',
          [0, 1],
          [0, 0, 0, 1, 0, Math.sin((i + 1) / 4), 0, Math.cos((i + 1) / 4)]
        ),
      ]);
      return [name, mixer.clipAction(clip)];
    })
  );
  return { root, bone, mixer, actions };
}

test('retained bindings reproduce the previous mixer across blends, cuts, seeks, and death', () => {
  const reference = rig(),
    current = rig();
  const stop = vi.spyOn(current.mixer, 'stopAllAction');
  const samples = [
    ...Array.from({ length: 90 }, (_, i) => ({
      clip: 'idle',
      time: (i / 60) % 1,
      layers: [{ clip: 'idle', weight: 1 }],
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      clip: 'run',
      time: i / 60,
      layers: [
        { clip: 'run', weight: i / 5 },
        { clip: 'idle', weight: 1 - i / 5 },
      ].filter((l) => l.weight > 0),
    })),
    { clip: 'death', time: 0, layers: [{ clip: 'death', weight: 1 }] },
    { clip: 'death', time: 1, layers: [{ clip: 'death', weight: 1 }] },
    { clip: 'death', time: 1, layers: [{ clip: 'death', weight: 1 }] },
    { clip: 'death', time: 0.4, layers: [{ clip: 'death', weight: 1 }] },
    { clip: 'idle', time: 0.72, layers: [{ clip: 'idle', weight: 1 }] },
    {
      clip: 'run',
      time: 0.1,
      layers: [
        { clip: 'run', weight: 0.3 },
        { clip: 'idle', weight: 0.4 },
        { clip: 'death', weight: 0.3 },
      ],
    },
    {
      clip: 'run',
      time: 0.2,
      layers: [
        { clip: 'run', weight: 0.5 },
        { clip: 'idle', weight: 0.35 },
        { clip: 'death', weight: 0.15 },
      ],
    },
    { clip: 'idle', time: 0.35, layers: [] },
  ];
  for (const sample of samples) {
    const pose: MobilePose = {
      ...sample,
      kind: sample.clip === 'death' ? 'death' : 'idle',
      loop: sample.clip !== 'death',
      rate: 1,
      cut: false,
      settled: true,
      unclampedTime: sample.time,
    };
    const layers: PoseLayer[] = sample.layers.map((l) => ({
      ...l,
      time: sample.time,
      unclampedTime: sample.time,
      rate: 1,
      loop: l.clip !== 'death',
    }));
    // Prior renderer: release every binding, reset/play the primary, then layers.
    reference.mixer.stopAllAction();
    const primary = reference.actions[pose.clip];
    primary
      .reset()
      .setLoop(pose.loop ? THREE.LoopRepeat : THREE.LoopOnce, pose.loop ? Infinity : 1)
      .setEffectiveWeight(0)
      .play();
    primary.time = pose.time;
    primary.paused = true;
    primary.clampWhenFinished = !pose.loop;
    for (const layer of layers) {
      const a = reference.actions[layer.clip];
      a.reset()
        .setLoop(layer.loop ? THREE.LoopRepeat : THREE.LoopOnce, layer.loop ? Infinity : 1)
        .setEffectiveWeight(layer.weight)
        .play();
      a.time = layer.time;
      a.paused = true;
      a.clampWhenFinished = !layer.loop;
      a.timeScale = layer.rate;
    }
    reference.mixer.update(0);
    applyMobileAnimation(current.mixer, current.actions, pose, layers);
    for (const r of [reference, current]) r.root.updateMatrixWorld(true);
    expect(current.bone.matrixWorld.toArray()).toEqual(reference.bone.matrixWorld.toArray());
  }
  expect(stop.mock.calls.length).toBeLessThan(12);
  expect(samples.length).toBeGreaterThan(100);
});
