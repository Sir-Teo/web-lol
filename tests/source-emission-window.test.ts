import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-emission-window-samples.json';
import {
  sourceEmissionWindow,
  type SourceEmissionWindow,
} from '../src/render/source-emission-window';
for (const sample of samples.samples)
  test(`external emission window ${sample.name}`, () => {
    const before = structuredClone(sample.profile);
    expect(sourceEmissionWindow(sample.profile, sample.age)).toEqual({
      ...sample.expected,
      phase: Buffer.from(sample.phaseHex, 'hex').readDoubleLE(),
    });
    expect(sample.profile).toEqual(before);
  });
test('external clock fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-emission-window-samples.mjs',
    '--check',
  ]);
});
test('delay does not shift lifetime end and periodic phase never wraps or clamps', () => {
  const profile = {
    ...samples.samples[0].profile,
    delay: 0.25,
    lifetime: 1,
    period: { length: 0.5, active: 0.25 },
  };
  expect(sourceEmissionWindow(profile, 1.5)).toMatchObject({ phase: 5, ended: true, active: true });
  expect(sourceEmissionWindow(profile, 0)).toMatchObject({ phase: -1, waiting: true });
});
for (const edit of [
  { lifetime: NaN },
  { particleLifetimeMaximum: Infinity },
  { delay: NaN },
  { emitterLinger: Infinity },
  { simple: 1 },
  { period: { length: NaN, active: 1 } },
])
  test(`rejects invalid source window ${JSON.stringify(edit)}`, () => {
    expect(() =>
      sourceEmissionWindow({ ...samples.samples[0].profile, ...edit } as SourceEmissionWindow, 1)
    ).toThrow();
  });
for (const age of [-1, NaN, Infinity])
  test(`rejects invalid window age ${age}`, () => {
    expect(() => sourceEmissionWindow(samples.samples[0].profile, age)).toThrow();
  });
