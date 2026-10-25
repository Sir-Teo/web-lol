import { expect, test } from 'vitest';
import { AHRI_Q } from '../src/content/ahri-q';
import {
  acceleratingMotion,
  acceleratingTravelSeconds,
  AHRI_Q_OUTWARD_SECONDS,
  createAhriOrbMotion,
  advanceAhriOrbMotion,
} from '../src/simulation/ahri-orb-motion';

test('clamped acceleration preserves source speeds and continuous integrated distance at both limits', () => {
  const outwardClamp = (2500 - 400) / 3200;
  expect(acceleratingMotion(0, AHRI_Q.outward)).toEqual({ speed: 2500, distance: 0 });
  expect(acceleratingMotion(outwardClamp, AHRI_Q.outward)).toEqual({
    speed: 400,
    distance: 951.5625,
  });
  expect(acceleratingMotion(1, AHRI_Q.outward)).toEqual({ speed: 400, distance: 1089.0625 });
  const returnClamp = (2600 - 60) / 1900;
  expect(acceleratingMotion(returnClamp + 0.1, AHRI_Q.returning).speed).toBe(2600);
  expect(
    acceleratingMotion(returnClamp + 0.1, AHRI_Q.returning).distance -
      acceleratingMotion(returnClamp, AHRI_Q.returning).distance
  ).toBeCloseTo(260, 10);
  expect(AHRI_Q_OUTWARD_SECONDS).toBe(0.77734375);
});

test('analytic motion matches independent midpoint integration before and after source clamp times', () => {
  for (const profile of [AHRI_Q.outward, AHRI_Q.returning]) {
    for (const seconds of [0.1, 0.7, 1.5, 3]) {
      const steps = 100000,
        dt = seconds / steps;
      let numeric = 0;
      for (let i = 0; i < steps; i++)
        numeric +=
          Math.min(
            profile.maximumSpeed,
            Math.max(
              profile.minimumSpeed,
              profile.initialSpeed + profile.acceleration * (i + 0.5) * dt
            )
          ) * dt;
      expect(acceleratingMotion(seconds, profile).distance).toBeCloseTo(numeric, 5);
    }
  }
});

test('travel-time inversion is stable across short, accelerating and clamped distances', () => {
  for (const profile of [AHRI_Q.outward, AHRI_Q.returning]) {
    for (const distance of [0, 1e-8, 1, 100, 950, 1000, 3000, 20000]) {
      const seconds = acceleratingTravelSeconds(distance, profile);
      expect(acceleratingMotion(seconds, profile).distance).toBeCloseTo(distance, 9);
    }
  }
});

test('the 47th tick splits at the fixed endpoint and uses only its residual time to return', () => {
  let motion = createAhriOrbMotion({ x: 0, y: 0 }, { x: 10, y: 0 }, 100);
  for (let tick = 100; tick < 146; tick++)
    motion = advanceAhriOrbMotion(motion, tick, { x: 0, y: 0 }).motion;
  const turn = advanceAhriOrbMotion(motion, 146, { x: 0, y: 0 });
  expect(turn.segments.map((segment) => segment.leg)).toEqual(['outward', 'return']);
  expect(turn.segments[0].to).toEqual({ x: 1000, y: 0 });
  const returnSeconds = 47 / 60 - AHRI_Q_OUTWARD_SECONDS;
  expect(turn.motion.position.x).toBeCloseTo(
    1000 - (60 * returnSeconds + 950 * returnSeconds ** 2),
    10
  );
  expect(turn.finished).toBe(false);
});

test('return re-aims at a moved caster, clamps arrival and survives an exact saved-state continuation', () => {
  let motion = createAhriOrbMotion({ x: 0, y: 0 }, { x: 100, y: 0 }, 1);
  for (let tick = 1; tick < 60; tick++)
    motion = advanceAhriOrbMotion(motion, tick, { x: 0, y: 0 }).motion;
  let copy = JSON.parse(JSON.stringify(motion));
  let finished = false;
  for (let tick = 60; tick < 240 && !finished; tick++) {
    const caster = { x: -200, y: 200 };
    const result = advanceAhriOrbMotion(motion, tick, caster);
    const restored = advanceAhriOrbMotion(copy, tick, caster);
    expect(restored).toEqual(result);
    motion = result.motion;
    copy = restored.motion;
    finished = result.finished;
  }
  expect(finished).toBe(true);
  expect(motion.position).toEqual({ x: -200, y: 200 });
});

test('invalid time, launch and skipped-step inputs fail explicitly', () => {
  expect(() => acceleratingMotion(-1, AHRI_Q.outward)).toThrow(RangeError);
  expect(() => acceleratingMotion(NaN, AHRI_Q.returning)).toThrow(RangeError);
  expect(() => createAhriOrbMotion({ x: 0, y: 0 }, { x: 0, y: 0 }, 1)).toThrow(RangeError);
  const motion = createAhriOrbMotion({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
  expect(() => advanceAhriOrbMotion(motion, 2, { x: 0, y: 0 })).toThrow(RangeError);
});
