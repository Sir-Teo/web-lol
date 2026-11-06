import { expect, test } from 'vitest';
import {
  AHRI_ATTACK_AUDIO_PROFILES as P,
  AHRI_ATTACK_AUDIO_LAUNCH_STOP as STOP,
} from '../src/content/ahri-attack-audio-policy';
import { AHRI_ATTACK_AUDIO_TICKS as T } from '../src/content/ahri-attack-audio-timing';
test('independent Python finite bounds agree with TypeScript additive ancestry', () => {
  for (const kind of Object.keys(P) as (keyof typeof P)[]) {
    expect(P[kind].maximumTicks).toBe(T[kind]);
    expect(P[kind].aliases).toHaveLength(3);
    for (const v of P[kind].variants) expect(v.ancestry.slice(-2)).toEqual([362837995, 91257365]);
  }
});
test('per-container caps and source gain/pitch modifiers remain distinct', () => {
  expect(Object.values(P).map((p) => [p.variants[0].gainDb, p.maxVoices])).toEqual([
    [-11, 2],
    [-15, 4],
    [-11.5, 2],
  ]);
  expect(P.cast.variants.map((v) => [v.id, v.gainDb])).toEqual(
    P.cast.variants.map((v) => [v.id, v.id === 1071743868 ? -11 : -12])
  );
  for (const v of P.cast.variants) {
    expect(v.pitchCents).toBe(200);
    expect(v.pitchRangeCents).toEqual([-300, 300]);
  }
  for (const p of [P.launch, P.hit])
    for (const v of p.variants) {
      expect(v.pitchCents).toBe(0);
      expect(v.pitchRangeCents).toEqual([0, 0]);
    }
});
test('three distinct source Stop aliases share the same 100 ms Linear target and retention', () => {
  expect(STOP).toMatchObject({ targetId: 276401545, seconds: 0.1, curve: 4 });
  expect(STOP.aliases).toHaveLength(3);
  expect(new Set(STOP.aliases.map((a) => a.actionId)).size).toBe(3);
  expect(STOP.seconds * 60).toBe(T.launchStop);
});
