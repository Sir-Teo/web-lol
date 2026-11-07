import { expect, test } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import reference from '../docs/reference/source-noise-motion-samples.json';
import { SourceNoiseFieldValues } from '../src/render/source-noise-field-values';
import {
  SourceNoiseMotionTimeline,
  SourceNoiseSchedule,
} from '../src/render/source-noise-motion-timeline';
const bits = (value: Float32Array) =>
  Array.from(new Uint32Array(value.buffer, value.byteOffset, value.length));
const scheduleFor = (profile: number) =>
  new SourceNoiseSchedule(
    new SourceNoiseFieldValues(data.profiles[profile].fieldCollection),
    data.profiles[profile].emitterLife!,
    422
  );
const schedules = new Map([10, 27].map((profile) => [profile, scheduleFor(profile)]));
test.each(reference.trajectories)(
  'external motion profile=$input.profile birth=$input.birthTick scenario=$input.scenario',
  ({ input, rows }) => {
    const motion = new SourceNoiseMotionTimeline(
      input.position,
      input.velocity,
      input.drag,
      input.maximumSteps,
      input.birthTick,
      input.serial,
      schedules.get(input.profile)!
    );
    for (const row of rows) {
      const sample = motion.sample(row.steps, 0);
      expect(bits(sample.position), 'position step ' + row.steps).toEqual(row.positionBits);
      expect(bits(sample.velocity), 'velocity step ' + row.steps).toEqual(row.velocityBits);
    }
    expect(motion.computedSteps).toBe(input.maximumSteps);
  }
);
test('backward and fractional seeks use owned float32 rows and leave the shared schedule immutable', () => {
  const { input, rows } = reference.trajectories[0],
    schedule = schedules.get(input.profile)!;
  const position = [...input.position],
    velocity = [...input.velocity],
    drag = [...input.drag];
  const motion = new SourceNoiseMotionTimeline(
    position,
    velocity,
    drag,
    input.maximumSteps,
    input.birthTick,
    input.serial,
    schedule
  );
  position.fill(999);
  velocity.fill(999);
  drag.fill(999);
  motion.sample(119, 0);
  const sample = motion.sample(20, 0.5),
    a = rows[20],
    b = rows[21];
  expect(Array.from(sample.position)).toEqual(
    a.position.map((value, axis) => Math.fround(value + (b.position[axis] - value) * 0.5))
  );
  sample.position.fill(999);
  expect(bits(motion.sample(0, 0).position)).toEqual(rows[0].positionBits);
  expect(Object.isFrozen(schedule.at(1))).toBe(true);
  expect(Object.isFrozen(schedule.at(1)[0].axes)).toBe(true);
  expect(() => motion.sample(119, 0.1)).toThrow(RangeError);
  expect(() => schedule.at(0)).toThrow(RangeError);
});
