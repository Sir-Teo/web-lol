import { expect, test } from 'vitest';
import { orbAudioStates } from '../src/audio/ahri-orb-state';
import { sourceEnvelopeValue } from '../src/audio/source-envelope';
import {
  orbRecord,
  turnedOrbRecord,
  caughtOrbRecord,
  orbStates,
  ownOrbScene,
} from './helpers/ahri-orb-audio';

test('cast, pitched outward flight and contact use independent saved clocks and positions', () => {
  const states = orbStates([orbRecord()], 140);
  expect(states.map((s) => [s.kind, s.age, s.x])).toEqual([
    ['cast', 40 / 60, 20],
    ['outward', 25 / 60, 400],
    ['hitOutwardFirst', 10 / 60, 350],
  ]);
  const out = states.find((s) => s.kind === 'outward')!;
  expect(out.pitchCents).toBe(400);
  expect(out.rate).toBeCloseTo(2 ** (400 / 1200), 14);
  expect(out.offset).toBe(out.age * out.rate);
  expect(out.stopAge).toBeNull();
  expect(orbStates([orbRecord()], 99)).toEqual([]);
  expect(orbStates([structuredClone(orbRecord())], 140)).toEqual(states);
});
test('outward and return stop actions retain their distinct original curves', () => {
  const out = orbStates([turnedOrbRecord()], 160).find((s) => s.kind === 'outward')!;
  expect([out.stopAge, out.stopFadeSeconds, out.stopCurve, out.x]).toEqual([35 / 60, 0.5, 6, 1000]);
  const returning = orbStates([caughtOrbRecord()], 190).find((s) => s.kind === 'return')!;
  expect([returning.stopAge, returning.stopFadeSeconds, returning.stopCurve, returning.x]).toEqual([
    0.5, 0.75, 4, 20,
  ]);
  expect(sourceEnvelopeValue(returning)).toBeCloseTo(1 - (returning.age - 0.5) / 0.75, 14);
});
test('deactivation is local catch-only and its randomized pitch is separate from zero base pitch', () => {
  const caught = caughtOrbRecord(),
    state = orbStates([caught], 190).find((s) => s.kind === 'deactivate')!;
  expect(state.pitchCents).toBeGreaterThanOrEqual(-200);
  expect(state.pitchCents).toBeLessThan(200);
  expect(state.offset).toBe(state.age * state.rate);
  for (const reason of ['expired', 'match-end', 'lost-source'] as const) {
    const r = structuredClone(caught);
    r.end!.reason = reason;
    expect(orbStates([r], 190).some((s) => s.kind === 'deactivate')).toBe(false);
  }
});
test('hidden hits still advance the explicit per-cast seven-position sequence', () => {
  const r = orbRecord();
  r.castAudience = r.launch!.audience = ['blue'];
  r.hits = Array.from({ length: 9 }, (_, i) => ({
    tick: 130 + i,
    point: { x: 300 + i, y: 0 },
    targetId: 99 + i,
    leg: 'outward',
    audience: i === 0 ? ['blue'] : ['blue', 'red'],
  }));
  const states = orbAudioStates([r], 145, { ...ownOrbScene, team: 'red' });
  expect(states.map((s) => s.kind)).toEqual([
    'hitOutwardLater',
    'hitOutwardLater',
    'hitOutwardLater',
    'hitOutwardLater',
    'hitOutwardLater',
    'hitOutwardLater',
    'hitOutwardFirst',
    'hitOutwardLater',
  ]);
  expect(new Set(states.map((s) => s.key)).size).toBe(8);
});
test('saved audience and current visibility both gate enemies; own cues survive current fog', () => {
  const r = orbRecord();
  r.castAudience = r.launch!.audience = r.hits[0].audience = ['blue'];
  expect(orbAudioStates([r], 140, { ...ownOrbScene, team: 'red' })).toEqual([]);
  expect(orbAudioStates([r], 140, { ...ownOrbScene, visible: () => false })).toHaveLength(3);
  const visible = orbRecord();
  expect(
    orbAudioStates([visible], 140, { ...ownOrbScene, team: 'red', visible: () => false })
  ).toEqual([]);
});
test('cancelled windup has only its finite cast and ended clips cannot become loops', () => {
  const r = orbRecord();
  r.launch = null;
  r.hits = [];
  r.cancelTick = 110;
  expect(orbStates([r], 140).map((s) => s.kind)).toEqual(['cast']);
  for (const tick of [1000, NaN, Infinity]) expect(orbStates([r], tick)).toEqual([]);
});
