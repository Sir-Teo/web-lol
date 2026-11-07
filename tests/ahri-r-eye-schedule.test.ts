import { expect, test, vi } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import { rEyeBirthEvents, AHRI_R_EYE_PERIOD_POLICY } from '../src/render/ahri-r-eye-schedule';
import { SourceEmitterSchedule } from '../src/render/source-emitter-schedule';
function fullSchedule(index: number) {
  const p = data.profiles[index];
  return new SourceEmitterSchedule({
    rate: p.rate,
    window: {
      lifetime: null,
      particleLifetimeMaximum: p.life.constant[0],
      simple: false,
      singleParticle: false,
      overridesMaterials: false,
      delay: 0,
      emitterLinger: p.emitterLinger ?? 0,
      period: { length: p.period, active: p.timeActiveDuringPeriod },
    },
    variableStart: false,
    maxPerFrame: 0,
    segmentLimit: null,
    rateScale: 1,
  });
}
test.each([47, 48])(
  'periodic profile %i matches a complete 5,000-second kernel replay, including wrapped counters',
  (index) => {
    const schedule = fullSchedule(index),
      life = data.profiles[index].life.constant[0];
    const times = [
      0,
      1 / 60,
      0.59999999,
      0.6,
      Math.fround(0.6),
      0.6166666667,
      2.49999999,
      2.5,
      2.5166666667,
      2.99999999,
      3,
      3.0166666667,
      5.6,
      49.5,
      50.5,
      120,
      1000,
      2200,
      3000,
      5000,
    ];
    let completed = 0,
      totalBirths = 0;
    let recent: ReturnType<typeof rEyeBirthEvents> = [];
    for (const time of times) {
      const whole = Math.floor(time * 60 + 1e-8),
        earliest = Math.max(1, whole - Math.ceil(life * 60) - 1);
      while (completed < whole) {
        const tick = ++completed;
        const births = schedule.step({ now: tick / 60, dt: 1 / 60, stopped: false }, () => 0);
        totalBirths += births.length;
        if (tick >= earliest)
          births.forEach((birth, slot) =>
            recent.push({ ...birth, ordinal: tick * 2 + slot, updateTick: tick })
          );
      }
      recent = recent.filter((birth) => birth.updateTick >= earliest);
      expect(rEyeBirthEvents(index, time)).toEqual(recent);
    }
    expect(AHRI_R_EYE_PERIOD_POLICY.nativeConstructorVerified).toBe(false);
    expect(totalBirths).toBeGreaterThan(0xffff);
    expect(schedule.snapshot().spawned).toBe(totalBirths & 0xffff);
  }
);
test('the authored active window resumes in later cycles without a gap catch-up burst or a fifty-second cap', () => {
  expect(rEyeBirthEvents(48, 1)).toEqual([]);
  expect(rEyeBirthEvents(48, 2.5)).toEqual([]);
  expect(rEyeBirthEvents(48, 2.6).length).toBeGreaterThan(0);
  expect(rEyeBirthEvents(47, 70).length).toBeGreaterThan(0);
  expect(rEyeBirthEvents(48, 70.3).length).toBeGreaterThan(0);
  for (const index of [47, 48]) {
    const forward = rEyeBirthEvents(index, 70.3);
    rEyeBirthEvents(index, 1);
    expect(rEyeBirthEvents(index, 70.3)).toEqual(forward);
    expect(new Set(forward.map((b) => b.ordinal)).size).toBe(forward.length);
  }
});
test('a distant valid clock has bounded work and retained births, while invalid seeks fail closed', () => {
  const step = vi.spyOn(SourceEmitterSchedule.prototype, 'step');
  for (const index of [47, 48]) {
    step.mockClear();
    const events = rEyeBirthEvents(index, 1e6 + 0.3);
    expect(step.mock.calls.length).toBeLessThanOrEqual(200);
    expect(events.length).toBeLessThanOrEqual(32);
  }
  step.mockRestore();
  for (const index of [45, 46, -1, 55]) expect(() => rEyeBirthEvents(index, 1)).toThrow();
  for (const time of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() => rEyeBirthEvents(47, time)).toThrow();
});
