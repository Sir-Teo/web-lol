import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-emitter-schedule-samples.json';
import { SourceEmitterSchedule } from '../src/render/source-emitter-schedule';
for (const [index, sample] of samples.samples.entries())
  test(`external schedule ${index}: ${samples.definitions[sample.definition].name}`, () => {
    const definition = samples.definitions[sample.definition].definition;
    let schedule = new SourceEmitterSchedule(definition),
      draws = 0;
    const draw = () => {
      draws++;
      return 0.25;
    };
    for (const [tick, step] of sample.steps.entries()) {
      expect(schedule.step(step, draw)).toEqual(step.births);
      expect(schedule.snapshot()).toEqual(step.state);
      expect(draws).toBe(step.draws);
      if (tick % 20 === 19) schedule = new SourceEmitterSchedule(definition, schedule.snapshot());
    }
  });
test('external schedules reproduce without the application scheduler', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-emitter-schedule-samples.mjs',
    '--check',
  ]);
});
test('partial or exhausted pools preserve planned birth shares and advance positive-spawn clocks', () => {
  const definition = samples.definitions[9].definition;
  expect(definition.window.singleParticle).toBe(true);
  const partial = new SourceEmitterSchedule(definition);
  const births = partial.step(
    { now: 1 / 30, dt: 1 / 30, stopped: false, maxAccepted: 1 },
    () => 0.25
  );
  expect(births).toHaveLength(1);
  const planned = new SourceEmitterSchedule(definition).plan(
    { now: 1 / 30, dt: 1 / 30, stopped: false, maxAccepted: 1 },
    () => 0.25
  );
  expect(planned.planned).toBe(3);
  expect(planned.births).toEqual(births);
  expect(births[0]).toMatchObject({ ordinal: 0, share: 1 / 3 });
  expect(births[0].time).toBeCloseTo(1 / 90, 15);
  expect(partial.snapshot()).toMatchObject({ spawned: 1, emitted: true, lastSpawn: 1 / 30 });
  expect(partial.step({ now: 2 / 30, dt: 1 / 30, stopped: false }, () => 0.25)).toEqual([]);
  const full = new SourceEmitterSchedule(definition);
  expect(
    full.step({ now: 1 / 30, dt: 1 / 30, stopped: false, maxAccepted: 0 }, () => 0.25)
  ).toEqual([]);
  expect(full.snapshot()).toEqual({ now: 1 / 30, lastSpawn: 1 / 30, spawned: 0, emitted: true });
});
test('schedule and snapshots own inputs, and ordinal wraps without allocating gameplay IDs', () => {
  const input = structuredClone(samples.definitions[2].definition);
  const original = structuredClone(input);
  input.window.lifetime = 10;
  original.window.lifetime = 10;
  const schedule = new SourceEmitterSchedule(input, {
    now: 1,
    lastSpawn: 1,
    emitted: true,
    spawned: 65535,
  });
  input.rate.constant[0] = 0;
  const slots: { times: number[]; values: number[]; single: number }[] = input.rate.probabilities;
  slots.push({ times: [], values: [], single: 0 });
  input.window.lifetime = 0;
  const copy = new SourceEmitterSchedule(original, schedule.snapshot());
  const step = { now: 1 + 1 / 30, dt: 1 / 30, stopped: false };
  const result = schedule.step(step, () => {
    throw Error('constant rate draws nothing');
  });
  expect(result).toEqual(copy.step(step, () => 0.25));
  expect(result.map((b) => b.ordinal)).toEqual([65535, 0, 1]);
  const snapshot = schedule.snapshot();
  snapshot.spawned = 999;
  expect(schedule.snapshot().spawned).toBe(2);
});
test('invalid steps, rate draws and restored state reject without advancing the scheduler', () => {
  const definition = samples.definitions.at(-1)!.definition;
  const schedule = new SourceEmitterSchedule(definition),
    before = schedule.snapshot();
  for (const edit of [
    { now: 0 },
    { dt: 0 },
    { dt: 0.5 },
    { maxAccepted: -1 },
    { maxAccepted: 0.5 },
  ]) {
    expect(() =>
      schedule.step({ now: 1 / 30, dt: 1 / 30, stopped: false, ...edit }, () => 0.25)
    ).toThrow();
    expect(schedule.snapshot()).toEqual(before);
  }
  expect(() => schedule.step({ now: 1 / 30, dt: 1 / 30, stopped: false }, () => 1)).toThrow();
  expect(schedule.snapshot()).toEqual(before);
  for (const edit of [
    { now: -1 },
    { lastSpawn: 1 },
    { spawned: 65536 },
    { spawned: 1 },
    { emitted: 1 },
  ])
    expect(
      () => new SourceEmitterSchedule(definition, { ...before, ...edit } as typeof before)
    ).toThrow();
});
