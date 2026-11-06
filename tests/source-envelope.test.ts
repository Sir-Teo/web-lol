import { expect, test } from 'vitest';
import {
  sourceEnvelopeEvents,
  sourceEnvelopeValue,
  type SourceEnvelope,
} from '../src/audio/source-envelope';

function evaluate(events: ReturnType<typeof sourceEnvelopeEvents>, age: number) {
  let prior = events[0];
  for (const next of events.slice(1)) {
    if (age < next.age)
      return next.kind === 'linear'
        ? prior.value + ((next.value - prior.value) * (age - prior.age)) / (next.age - prior.age)
        : prior.value;
    prior = next;
  }
  return prior.value;
}
test('Linear stop uses one exact ramp while Log1/Exp1 preserve a bounded original-domain approximation', () => {
  for (const stopCurve of [2, 4, 6] as const)
    for (const stopAge of [0.025, 0.25])
      for (const age of [0, 0.1, 0.4]) {
        const state: SourceEnvelope = {
          age,
          endAge: stopAge + 0.75,
          fadeInSeconds: 0.05,
          stopAge,
          stopFadeSeconds: 0.75,
          stopCurve,
        };
        const events = sourceEnvelopeEvents(state);
        if (age === 0 && stopAge === 0.25) expect(evaluate(events, 0.05)).toBe(1);
        for (let i = 0; i <= 2000; i++) {
          const at = age + ((state.endAge - age) * i) / 2000;
          expect(Math.abs(evaluate(events, at) - sourceEnvelopeValue(state, at))).toBeLessThan(
            stopCurve === 4 ? 1e-12 : 0.000008
          );
        }
        if (stopCurve === 4 && age >= stopAge) expect(events).toHaveLength(2);
      }
});
test('finite natural ending and future stop retain their own boundaries', () => {
  const state: SourceEnvelope = {
    age: 0,
    endAge: 0.4,
    fadeInSeconds: 0,
    stopAge: 0.25,
    stopFadeSeconds: 0.75,
    stopCurve: 4,
  };
  const events = sourceEnvelopeEvents(state);
  expect(events.at(-1)!.age).toBe(0.4);
  expect(events.at(-1)!.value).toBeCloseTo(0.8);
  const unbornStop = { ...state, stopAge: 1 };
  expect(sourceEnvelopeEvents(unbornStop)).toEqual([{ kind: 'set', age: 0, value: 1 }]);
  for (const bad of [
    { age: NaN },
    { age: -0.1 },
    { endAge: 0 },
    { stopFadeSeconds: 0 },
    { fadeInSeconds: -1 },
  ])
    expect(() => sourceEnvelopeEvents({ ...state, ...bad })).toThrow();
});
