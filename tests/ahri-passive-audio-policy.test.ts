import { expect, test } from 'vitest';
import { AHRI_PASSIVE_AUDIO_PROFILES as P } from '../src/content/ahri-passive-audio-policy';
import { AHRI_PASSIVE_AUDIO_TICKS as T } from '../src/content/ahri-passive-audio-timing';

test('finite passive bounds agree with independent Python ancestry derivation', () => {
  for (const kind of Object.keys(P) as (keyof typeof P)[]) {
    expect(P[kind].maximumTicks).toBe(T[kind]);
    expect(P[kind].continuous).toBe(false);
    expect(P[kind].maxVoices).toBe(4);
    for (const v of P[kind].variants) {
      expect(v.pitchCents).toBe(0);
      expect(v.pitchRangeCents).toEqual([0, 0]);
      expect(v.ancestry.slice(-2)).toEqual([595867950, 353175404]);
    }
  }
});
test('shared healing PCM keeps separate source sound identities and gain ownership', () => {
  expect(Object.values(P).map((p) => p.variants[0].gainDb)).toEqual([-15, -12, -8, -12]);
  expect(P.orbBuffActivate.variants.map((v) => v.id)).toEqual(
    P.minionHeal.variants.map((v) => v.id)
  );
  expect(P.orbBuffActivate.variants.map((v) => v.soundId)).not.toEqual(
    P.minionHeal.variants.map((v) => v.soundId)
  );
  expect(P.orbBuffActivate.eventId).not.toBe(P.minionHeal.eventId);
});
