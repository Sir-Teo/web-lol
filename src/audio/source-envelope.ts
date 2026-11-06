import { wwise145Fade } from './wwise145-fade';

export interface SourceEnvelope {
  age: number;
  endAge: number;
  fadeInSeconds: number;
  stopAge: number | null;
  stopFadeSeconds: number;
  stopCurve: 2 | 4 | 6;
}
export function sourceEnvelopeValue(state: SourceEnvelope, age = state.age): number {
  const incoming = (time: number) =>
    state.fadeInSeconds ? wwise145Fade(4, time / state.fadeInSeconds, 0, 1) : 1;
  if (state.stopAge === null || age < state.stopAge) return incoming(age);
  return wwise145Fade(
    state.stopCurve,
    (age - state.stopAge) / state.stopFadeSeconds,
    incoming(state.stopAge),
    0
  );
}
/** Exact Linear endpoints; only curved Log1/Exp1 requires piecewise interpolation.
 * Every event evaluates the original domain, including late seeks. */
export function sourceEnvelopeEvents(state: SourceEnvelope) {
  const { age: start, endAge: end, stopAge, fadeInSeconds, stopFadeSeconds } = state;
  if (
    ![start, end, fadeInSeconds, stopFadeSeconds].every(Number.isFinite) ||
    start < 0 ||
    end <= start ||
    fadeInSeconds < 0 ||
    stopFadeSeconds < 0 ||
    ![2, 4, 6].includes(state.stopCurve) ||
    (stopAge !== null && (!Number.isFinite(stopAge) || stopAge < 0 || stopFadeSeconds <= 0))
  )
    throw new RangeError('Invalid finite source envelope');
  const events: { kind: 'set' | 'linear'; age: number; value: number }[] = [
    { kind: 'set', age: start, value: sourceEnvelopeValue(state) },
  ];
  const rampEnd = Math.min(fadeInSeconds, stopAge ?? Infinity, end);
  if (start < rampEnd)
    events.push({ kind: 'linear', age: rampEnd, value: sourceEnvelopeValue(state, rampEnd) });
  if (stopAge === null || stopAge >= end) return events;
  const begin = Math.max(start, stopAge);
  if (begin > Math.max(start, rampEnd))
    events.push({ kind: 'set', age: begin, value: sourceEnvelopeValue(state, begin) });
  const count = state.stopCurve === 4 ? 1 : 127;
  for (let i = 1; i <= count; i++) {
    const age = begin + ((end - begin) * i) / count;
    events.push({ kind: 'linear', age, value: sourceEnvelopeValue(state, age) });
  }
  return events;
}
