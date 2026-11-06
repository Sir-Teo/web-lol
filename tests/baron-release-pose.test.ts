import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { captureBaronReleasePose } from '../src/simulation/baron-release-pose';
import { capturePoseFrame, validPoseFrame } from '../src/simulation/pose-history';

function pendingRelease() {
  const w = createBaronEncounter({ ...PRACTICE_FIXTURE, developmentBaron: true });
  const b = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, b, 1, 'true');
  w.step();
  w.step(b.releaseTick! - w.tick - 1);
  return { w, b, tick: w.tick + 1 };
}

test('release preview equals the finalized body pose without advancing the world', () => {
  const { w, b, tick } = pendingRelease();
  const before = w.snapshot();
  const pose = captureBaronReleasePose(b, tick);
  expect(w.snapshot()).toBe(before);
  expect(validPoseFrame(pose, 'sru-baron-base', true)).toBe(true);
  expect(pose.animationTimeline?.primary.kind).toBe('attack');
  w.step();
  expect(pose).toEqual(capturePoseFrame(b, tick));
});

test('release preview owns its timeline after subsequent damage and animation', () => {
  const { w, b, tick } = pendingRelease();
  const pose = captureBaronReleasePose(b, tick),
    saved = JSON.stringify(pose);
  expect(pose.animationTimeline).not.toBe(b.animationTimeline);
  expect(pose.animationTimeline?.primary).not.toBe(b.animationTimeline?.primary);
  w.damage(w.hero, b, 1e6, 'true');
  w.step(10);
  expect(b.animationTimeline?.primary.kind).toBe('death');
  expect(JSON.stringify(pose)).toBe(saved);
});

test('rejects non-release ticks and dead or unrelated sources', () => {
  const { w, b, tick } = pendingRelease();
  for (const invalid of [-1, NaN, Infinity, tick + 0.5, tick - 1])
    expect(() => captureBaronReleasePose(b, invalid)).toThrow();
  expect(() => captureBaronReleasePose(w.hero, tick)).toThrow();
  w.damage(w.hero, b, 1e6, 'true');
  expect(() => captureBaronReleasePose(b, tick)).toThrow();
});
