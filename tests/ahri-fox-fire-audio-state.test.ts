import { expect, test } from 'vitest';
import { foxFireAudioStates } from '../src/audio/ahri-fox-fire-state';
import { AHRI_FOX_FIRE_AUDIO_PROFILES as P } from '../src/content/ahri-fox-fire-audio-policy';
import { sourceEnvelopeValue } from '../src/audio/source-envelope';
import {
  foxFireRecord,
  firedFoxFireRecord,
  foxFireStates,
  ownFoxFireScene,
} from './helpers/ahri-fox-fire-audio';

test('activation retains its full-master phase over multiple local cycles without a finite end', () => {
  const r = foxFireRecord(),
    duration = P.activation.variants[0].durationSeconds,
    age = duration * 3 + 0.13;
  const state = foxFireStates([r], r.startTick + age * 60).find((s) => s.kind === 'activation')!;
  expect(state.loop).toBe(true);
  expect(state.endAge).toBe(Infinity);
  expect(state.offset).toBeCloseTo(0.13, 12);
  expect(state.stopAge).toBeNull();
  expect(state.x).toBe(20);
  expect(foxFireStates([structuredClone(r)], r.startTick + age * 60)).toEqual(
    foxFireStates([r], r.startTick + age * 60)
  );
});
test('activation stop has its own Exp1 clock and a separately born finite tail', () => {
  const r = firedFoxFireRecord(),
    states = foxFireStates([r], 140);
  const activation = states.find((s) => s.kind === 'activation')!,
    tail = states.find((s) => s.kind === 'tail')!;
  expect([
    activation.stopAge,
    activation.stopFadeSeconds,
    activation.stopCurve,
    activation.endAge,
  ]).toEqual([0.5, 0.2, 6, 0.7]);
  const t = (activation.age - 0.5) / 0.2;
  expect(sourceEnvelopeValue(activation)).toBeCloseTo(1 - ((t + 1) * t) / 2, 14);
  expect([tail.birthTick, tail.age, tail.loop, tail.stopAge, tail.x]).toEqual([
    130,
    10 / 60,
    false,
    null,
    20,
  ]);
  expect(foxFireStates([r], 143).some((s) => s.kind === 'activation')).toBe(false);
});
test('three finite missiles and contacts preserve distinct deterministic pitch and sample offsets', () => {
  const states = foxFireStates([firedFoxFireRecord()], 150);
  const flights = states.filter((s) => s.kind === 'launch'),
    hits = states.filter((s) => s.kind === 'hit');
  expect(flights).toHaveLength(3);
  expect(hits).toHaveLength(3);
  expect(new Set(flights.map((s) => s.pitchCents)).size).toBe(3);
  for (const s of [...flights, ...hits]) {
    expect(s.pitchCents).toBeGreaterThanOrEqual(-200);
    expect(s.pitchCents).toBeLessThan(400);
    expect(s.offset).toBe(s.age * s.rate);
    expect(s.loop).toBe(false);
    expect(s.x).toBe(500);
  }
  expect(
    flights.every((s) => s.stopAge === 0.25 && s.stopFadeSeconds === 0.5 && s.stopCurve === 6)
  ).toBe(true);
  expect(hits.every((s) => s.stopAge === null)).toBe(true);
  expect(new Set(states.map((s) => s.key)).size).toBe(states.length);
});
test('lost targets and expiry do not invent hits or an extra activation tail', () => {
  for (const reason of ['lost-target', 'expired', 'match-end'] as const) {
    const r = firedFoxFireRecord();
    for (const f of r.fires) f.end!.reason = reason;
    const states = foxFireStates([r], 150);
    expect(states.some((s) => s.kind === 'hit')).toBe(false);
    expect(states.filter((s) => s.kind === 'tail')).toHaveLength(1);
  }
});
test('saved birth audience and current enemy visibility gate each independently born cue', () => {
  const r = firedFoxFireRecord();
  r.audience = ['blue'];
  const scene = { ...ownFoxFireScene, team: 'red' as const };
  expect(
    foxFireAudioStates([r], 140, scene).some((s) => s.kind === 'activation' || s.kind === 'cast')
  ).toBe(false);
  expect(foxFireAudioStates([r], 140, scene).some((s) => s.kind === 'tail')).toBe(true);
  expect(foxFireAudioStates([r], 150, { ...scene, visible: () => false })).toEqual([]);
  expect(foxFireAudioStates([r], 150, { ...ownFoxFireScene, visible: () => false })).toEqual(
    foxFireStates([r], 150)
  );
});
test('windup death has only cast, activation stop and tail; all finite cues expire', () => {
  const r = foxFireRecord();
  r.activationStop = { tick: 110, point: { x: 20, y: 0 }, reason: 'death', audience: ['blue'] };
  for (const f of r.fires)
    f.end = { tick: 110, point: { x: 150, y: 0 }, reason: 'death', audience: ['blue'] };
  expect(foxFireStates([r], 115).map((s) => s.kind)).toEqual(['cast', 'activation', 'tail']);
  for (const tick of [99, 10000, NaN, Infinity]) expect(foxFireStates([r], tick)).toEqual([]);
});
