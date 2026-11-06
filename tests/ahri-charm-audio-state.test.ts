import { expect, test } from 'vitest';
import { charmAudioStates, charmEnvelope } from '../src/audio/ahri-charm-state';

import { charmRecord, states } from './helpers/ahri-charm-audio';
test('three phases seek independently and preserve current caster, stopped flight and contact points', () => {
  const r = charmRecord();
  const result = states([r], 140);
  expect(result.map((s) => [s.profileIndex, s.offset, s.x])).toEqual([
    [0, 40 / 60, 20],
    [1, 25 / 60, 400],
    [2, 10 / 60, 400],
  ]);
  expect(states([r], 99)).toEqual([]);
  expect(states([r], 400)).toEqual([]);
  expect(states([structuredClone(r)], 140)).toEqual(result);
});
test('Linear play fade and original Exp1 stop domain survive late seeks', () => {
  const flight = states([charmRecord()], 116).find((s) => s.profileIndex === 1)!;
  expect(charmEnvelope(flight, 0.025)).toBeCloseTo(0.5);
  expect(charmEnvelope(flight, 0.25)).toBe(1);
  expect(charmEnvelope(flight, 0.25 + 1.55 / 2)).toBeCloseTo(0.625);
  expect(charmEnvelope(flight, 0.25 + 1.55)).toBeCloseTo(0);
  const early = { ...flight, stopAge: 0.025 };
  expect(charmEnvelope(early, 0.025)).toBeCloseTo(0.5);
  expect(charmEnvelope(early, 0.025 + 1.55 / 2)).toBeCloseTo(0.3125);
});
test('both saved birth audience and current visibility gate enemy playback', () => {
  const r = charmRecord();
  r.castAudience = r.launch!.audience = r.hit!.audience = ['blue'];
  expect(
    charmAudioStates(
      [r],
      140,
      'red',
      () => true,
      () => undefined
    )
  ).toEqual([]);
  expect(states([r], 140)).toHaveLength(3);
  r.castAudience = r.launch!.audience = r.hit!.audience = ['blue', 'red'];
  expect(
    charmAudioStates(
      [r],
      140,
      'red',
      () => false,
      () => undefined
    )
  ).toEqual([]);
});
