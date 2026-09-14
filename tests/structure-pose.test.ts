import { expect, it } from 'vitest';
import { structurePose } from '../src/render/structure-pose';
import type { StructureAnimationProfile } from '../src/content/structure-animation';
const profile: StructureAnimationProfile = {
  destroyedClip: 'death',
  animateDestruction: true,
  deadIdleClip: 'rubble',
  durations: { idle1: 2, death: 1, rubble: 0.5 },
};
const intact = { destroyed: false, idleStartTick: 100, deathTick: null };
const destroyed = { destroyed: true, idleStartTick: 0, deathTick: 100 };
it('selects explicit intact phases from observed entry and clamps before entry', () => {
  expect(structurePose(intact, profile, 100, 0)).toEqual({
    kind: 'idle',
    clip: 'idle1',
    time: 0,
    loop: true,
  });
  expect(structurePose(intact, profile, 221, 0.5).time).toBeCloseTo(0.5 / 60, 12);
  expect(structurePose(intact, profile, 100, 1, 0.25).time).toBe(0.25);
});
it('plays destruction, enters the dead-idle loop at its exact boundary and holds without that loop', () => {
  expect(structurePose(destroyed, profile, 160, 0.5)).toEqual({
    kind: 'destroyed',
    clip: 'death',
    time: 59.5 / 60,
    loop: false,
  });
  expect(structurePose(destroyed, profile, 160, 1)).toEqual({
    kind: 'dead-idle',
    clip: 'rubble',
    time: 0,
    loop: true,
  });
  expect(structurePose(destroyed, profile, 191, 0.5).time).toBeCloseTo(0.5 / 60, 12);
  expect(structurePose(destroyed, { ...profile, deadIdleClip: null }, 1000, 0.5).time).toBe(1);
  expect(structurePose(destroyed, profile, 100, 1, 1.2).time).toBeCloseTo(0.2, 12);
});
it('retains static rubble, supports zero-length clips and rejects missing event/clip data', () => {
  expect(structurePose(destroyed, { ...profile, animateDestruction: false }, 1000, 1)).toEqual({
    kind: 'destroyed',
    clip: 'death',
    time: 0,
    loop: false,
  });
  expect(
    structurePose(
      destroyed,
      { ...profile, durations: { ...profile.durations, rubble: 0 } },
      1000,
      1
    ).time
  ).toBe(0);
  expect(() => structurePose({ ...destroyed, deathTick: null }, profile, 1000, 1)).toThrow(
    'death tick'
  );
  expect(() => structurePose(intact, { ...profile, durations: {} }, 100, 1)).toThrow('idle1');
  expect(() =>
    structurePose(destroyed, { ...profile, destroyedClip: 'toString' }, 1000, 1)
  ).toThrow('toString');
});
