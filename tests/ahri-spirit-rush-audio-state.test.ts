import { expect, test } from 'vitest';
import { spiritRushAudioStates } from '../src/audio/ahri-spirit-rush-state';
import { AHRI_SPIRIT_RUSH_AUDIO_PROFILES as P } from '../src/content/ahri-spirit-rush-audio-policy';
import { sourceEnvelopeValue } from '../src/audio/source-envelope';
import {
  spiritRushRecord,
  firedSpiritRushRecord,
  spiritRushStates,
  ownSpiritRushScene,
} from './helpers/ahri-spirit-rush-audio';

test('activation keeps a single per-window full-master phase after finite burst cues end', () => {
  const r = spiritRushRecord(),
    duration = P.activation.variants[0].durationSeconds,
    age = duration * 3 + 0.13;
  const states = spiritRushStates([r], r.startTick + age * 60),
    activation = states.find((s) => s.kind === 'activation')!;
  expect(activation.loop).toBe(true);
  expect(activation.endAge).toBe(Infinity);
  expect(activation.stopAge).toBeNull();
  expect(activation.offset).toBeCloseTo(0.13, 12);
  expect(activation.x).toBe(20);
  expect(spiritRushStates([structuredClone(r)], r.startTick + age * 60)).toEqual(states);
  expect(spiritRushStates([r], 500).map((s) => s.kind)).toEqual(['activation']);
});
test('window closure uses an explicitly local Linear release and a separately born deactivation cue', () => {
  const r = spiritRushRecord();
  r.end = { tick: 150, point: { x: 20, y: 0 }, reason: 'match-end', audience: ['blue', 'red'] };
  const states = spiritRushStates([r], 150.6),
    activation = states.find((s) => s.kind === 'activation')!,
    tail = states.find((s) => s.kind === 'deactivate')!;
  expect([activation.stopAge, activation.stopFadeSeconds, activation.stopCurve]).toEqual([
    50 / 60,
    0.02,
    4,
  ]);
  expect(sourceEnvelopeValue(activation)).toBeCloseTo(0.5, 12);
  expect([tail.birthTick, tail.loop, tail.stopAge, tail.x]).toEqual([150, false, null, 20]);
  expect(spiritRushStates([r], 152).some((s) => s.kind === 'activation')).toBe(false);
});
test('three missiles keep zero source pitch while contacts draw independent hit pitch modifiers', () => {
  const r = firedSpiritRushRecord(),
    states = spiritRushStates([r], 130),
    flights = states.filter((s) => s.kind === 'launch'),
    hits = states.filter((s) => s.kind === 'hit');
  expect(flights).toHaveLength(3);
  expect(hits).toHaveLength(3);
  expect(
    flights.every(
      (s) =>
        s.pitchCents === 0 &&
        s.rate === 1 &&
        s.stopAge === 25 / 60 &&
        s.stopFadeSeconds === 0.25 &&
        s.stopCurve === 6
    )
  ).toBe(true);
  expect(new Set(hits.map((s) => s.pitchCents)).size).toBe(3);
  for (const s of hits) {
    expect(s.pitchCents).toBeGreaterThanOrEqual(-100);
    expect(s.pitchCents).toBeLessThan(500);
    expect(s.offset).toBe(s.age * s.rate);
    expect(s.stopAge).toBeNull();
    expect(s.loop).toBe(false);
  }
  expect(new Set(states.map((s) => s.key)).size).toBe(states.length);
});
test('recasts retain the original activation phase and get distinct cast keys', () => {
  const r = spiritRushRecord();
  r.bursts.push({ ...structuredClone(r.bursts[0]), index: 1, tick: 160, dashEndTick: null });
  const states = spiritRushStates([r], 170),
    activation = states.filter((s) => s.kind === 'activation');
  expect(activation).toHaveLength(1);
  expect(activation[0].birthTick).toBe(100);
  expect(states.find((s) => s.key.endsWith(':cast:1'))?.birthTick).toBe(160);
  expect(states.find((s) => s.key.endsWith(':cast:1'))?.x).toBe(20);
});
test('visible recasts and deactivation do not retroactively reveal a hidden activation', () => {
  const r = spiritRushRecord();
  r.audience = r.bursts[0].audience = ['blue'];
  r.bursts.push({
    ...structuredClone(r.bursts[0]),
    index: 1,
    tick: 160,
    audience: ['blue', 'red'],
  });
  const scene = { ...ownSpiritRushScene, team: 'red' as const };
  expect(spiritRushAudioStates([r], 170, scene).map((s) => s.key)).toEqual(['42:cast:1']);
  expect(spiritRushAudioStates([r], 170, { ...scene, visible: () => false })).toEqual([]);
  r.end = { tick: 180, point: { x: 20, y: 0 }, reason: 'match-end', audience: ['blue', 'red'] };
  expect(spiritRushAudioStates([r], 180.6, scene).some((s) => s.kind === 'deactivate')).toBe(true);
  expect(spiritRushAudioStates([r], 170, { ...ownSpiritRushScene, visible: () => false })).toEqual(
    spiritRushStates([r], 170)
  );
});
test('lost or expired bolts do not invent hits, and stopped finite cues never become loops', () => {
  for (const reason of ['lost-target', 'expired', 'match-end'] as const) {
    const r = firedSpiritRushRecord();
    for (const p of r.bursts[0].bolts) p.end!.reason = reason;
    expect(spiritRushStates([r], 130).some((s) => s.kind === 'hit')).toBe(false);
    expect(spiritRushStates([r], 130).some((s) => s.kind === 'deactivate')).toBe(false);
  }
  const r = spiritRushRecord();
  r.end = { tick: 150, point: { x: 20, y: 0 }, reason: 'match-end', audience: ['blue'] };
  for (const tick of [99, 10000, NaN, Infinity]) expect(spiritRushStates([r], tick)).toEqual([]);
});
