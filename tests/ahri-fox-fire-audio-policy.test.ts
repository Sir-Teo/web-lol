import { expect, test } from 'vitest';
import {
  AHRI_FOX_FIRE_AUDIO_PROFILES as P,
  AHRI_FOX_FIRE_AUDIO_STOPS as STOP,
} from '../src/content/ahri-fox-fire-audio-policy';
import { AHRI_FOX_FIRE_AUDIO_TICKS as T } from '../src/content/ahri-fox-fire-audio-timing';

test('independent Python retention bounds agree with finite TypeScript profiles', () => {
  expect([
    P.cast.maximumTicks,
    P.launch.maximumTicks,
    P.hit.maximumTicks,
    P.tail.maximumTicks,
  ]).toEqual([T.cast, T.launch, T.hit, T.tail]);
  expect(P.activation.continuous).toBe(true);
  expect(P.activation.maximumTicks).toBeNull();
  expect(P.activation.variants).toHaveLength(1);
  expect(P.activation.variants[0].id).toBe(966532132);
  expect([P.cast, P.tail, P.launch, P.hit].every((p) => !p.continuous)).toBe(true);
});
test('local additive profiles preserve W gains, independent pitch modifiers and child caps', () => {
  expect(Object.values(P).map((p) => [p.variants[0].gainDb, p.maxVoices])).toEqual([
    [-9, 2],
    [-20, 4],
    [-24, 4],
    [-14, 4],
    [-6, 2],
  ]);
  for (const p of [P.launch, P.hit])
    for (const v of p.variants) {
      expect(v.pitchCents).toBe(100);
      expect(v.pitchRangeCents).toEqual([-300, 300]);
      expect(v.ancestry.slice(-2)).toEqual([577453666, 353175404]);
    }
  expect(P.tail.actionId).toBe(649502302);
});
test('all three stop action metadata retain distinct targets, curves and finite spans', () => {
  expect(Object.values(STOP).map((s) => [s.targetId, s.seconds, s.curve])).toEqual([
    [594831512, 0.2, 6],
    [347259201, 0.5, 6],
    [405923955, 1, 2],
  ]);
  expect([STOP.activation.seconds * 60, STOP.launch.seconds * 60, STOP.hit.seconds * 60]).toEqual([
    T.activationStop,
    T.launchStop,
    T.hitStop,
  ]);
});
