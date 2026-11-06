import { expect, test } from 'vitest';
import * as THREE from 'three';
import { BaronContactAttachment } from '../src/render/baron-contact-attachment';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { capturePoseFrame } from '../src/simulation/pose-history';
import type { BaronAttackContact } from '../src/simulation/baron-attack-visuals';
function fixture(boneName = BARON.basicAttack.hitBone) {
  const reference = new THREE.Group(),
    bone = new THREE.Bone();
  reference.scale.setScalar(0.01);
  bone.name = boneName;
  bone.position.set(10, 20, 30);
  reference.add(bone);
  const clips = Object.entries(MOBILE_CLIP_DURATIONS['ashe-base']).map(
    ([name, duration]) => new THREE.AnimationClip(name, duration, [])
  );
  const sampler = new TargetPoseSampler(reference, clips),
    w = createBaronEncounter({ ...PRACTICE_FIXTURE, developmentBaron: true });
  const a = {
    ...capturePoseFrame(w.hero, w.tick),
    x: 100,
    y: 200,
    facing: 0,
    audience: ['blue' as const],
  };
  w.step();
  const b = {
    ...capturePoseFrame(w.hero, w.tick),
    x: 200,
    y: 200,
    facing: Math.PI / 2,
    audience: ['blue' as const],
  };
  const contact: BaronAttackContact = {
    startTick: a.tick,
    point: { x: a.x, y: a.y },
    targetTeam: 'blue',
    targetRadius: 65,
    targetRig: 'ashe-base',
    detachedTick: null,
    frames: [a, b],
  };
  return { contact, reference, sampler };
}
test('saved chest matrices retain rig scale, facing, terrain and fractional interpolation', () => {
  const f = fixture(),
    attachment = new BaronContactAttachment('ashe-base', f.sampler, () => 4);
  const first = attachment.matrix(f.contact, 0),
    last = attachment.matrix(f.contact, 1),
    middle = attachment.matrix(f.contact, 0.5);
  const position = (matrix: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(matrix);
  for (const [actual, expected] of [
    [position(first), [1.1, 4.2, 2.3]],
    [position(last), [2.3, 4.2, 1.9]],
    [position(middle), [1.7, 4.2, 2.1]],
  ] as const)
    actual.toArray().forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));
  expect(new THREE.Vector3().setFromMatrixColumn(first, 0).length()).toBeCloseTo(0.01, 12);
  first.elements.fill(99);
  expect(position(attachment.matrix(f.contact, 0)).x).toBeCloseTo(1.1, 12);
  expect(f.reference.children[0].position.toArray()).toEqual([10, 20, 30]);
  attachment.dispose();
  attachment.dispose();
  expect(() => attachment.matrix(f.contact, 0)).toThrow('disposed');
});
test('detached saved poses keep their original skeleton clock', () => {
  const f = fixture(),
    attachment = new BaronContactAttachment('ashe-base', f.sampler, () => 0);
  f.contact.detachedTick = 0;
  const frozen = structuredClone(f.contact.frames[0]);
  frozen.tick = 1;
  f.contact.frames[1] = frozen;
  expect(attachment.matrix(f.contact, 1).elements).toEqual(
    attachment.matrix(f.contact, 0).elements
  );
  attachment.dispose();
});
test('missing joints, edited clocks, rig mismatch, absent history and bad terrain reject', () => {
  const f = fixture('Other'),
    missing = new BaronContactAttachment('ashe-base', f.sampler, () => 0);
  expect(() => missing.matrix(f.contact, 0)).toThrow('authored contact joint');
  missing.dispose();
  const g = fixture(),
    badHeight = new BaronContactAttachment('ashe-base', g.sampler, () => NaN);
  expect(() => badHeight.matrix(g.contact, 0)).toThrow('terrain');
  badHeight.dispose();
  const h = fixture(),
    attachment = new BaronContactAttachment('ashe-base', h.sampler, () => 0);
  for (const tick of [-1, 2, NaN])
    expect(() => attachment.matrix(h.contact, tick)).toThrow('retained pose');
  h.contact.targetRig = 'lux-base';
  expect(() => attachment.matrix(h.contact, 0)).toThrow('contact pose');
  h.contact.targetRig = 'ashe-base';
  h.contact.frames[0].animationTimeline!.tick++;
  expect(() => attachment.matrix(h.contact, 0)).toThrow('contact pose');
  attachment.dispose();
});
