import { AHRI_CHARM_AUDIO as P } from '../src/content/ahri-charm-audio';
import { expect, test } from 'vitest';
import {
  charmAudioStates,
  charmEnvelope,
  charmEnvelopeEvents,
} from '../src/audio/ahri-charm-state';

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

test('automation preserves exact Linear endpoints and bounds Exp1 interpolation over whole and sliced spans', () => {
  const template = states([charmRecord()], 116).find((s) => s.profileIndex === 1)!;
  for (const variant of [0, 1, 2])
    for (const stopAge of [null, 0.025, 0.25])
      for (const offset of [0, 0.025, 0.15, 0.9]) {
        const state = {
          ...template,
          variant,
          offset,
          stopAge,
          endAge: Math.min(
            P[1].variants[variant].durationSeconds,
            stopAge === null ? Infinity : stopAge + 1.55
          ),
        };
        const events = charmEnvelopeEvents(state);
        const evaluate = (age: number) => {
          let prior = events[0];
          for (const next of events.slice(1)) {
            if (age < next.age)
              return next.kind === 'linear'
                ? prior.value +
                    ((next.value - prior.value) * (age - prior.age)) / (next.age - prior.age)
                : prior.value;
            prior = next;
          }
          return prior.value;
        };
        if (offset < 0.05 && (stopAge === null || stopAge >= 0.05)) {
          expect(evaluate(0.025 < offset ? offset : 0.025)).toBeCloseTo(
            charmEnvelope(state, Math.max(offset, 0.025)),
            14
          );
          expect(evaluate(0.05)).toBe(1);
        }
        for (let i = 0; i <= 2000; i++) {
          const age = offset + ((state.endAge - offset) * i) / 2000;
          expect(Math.abs(evaluate(age) - charmEnvelope(state, age))).toBeLessThan(0.000008);
        }
      }
});
