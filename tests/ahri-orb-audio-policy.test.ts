import { AHRI_ORB_AUDIO_TICKS as T } from '../src/content/ahri-orb-audio-timing';
import { expect, test } from 'vitest';
import {
  AHRI_ORB_AUDIO_PROFILES as P,
  AHRI_ORB_AUDIO_STOPS as STOP,
  orbHitAudioKind,
} from '../src/content/ahri-orb-audio-policy';

test('local profile derivation retains distinct base/ranged pitch and per-sound gain', () => {
  expect(P.cast.variants.every((v) => v.gainDb === -7 && v.pitchCents === 0)).toBe(true);
  expect(P.outward.variants.every((v) => v.gainDb === -13 && v.pitchCents === 400)).toBe(true);
  expect(P.hitOutwardFirst.variants.every((v) => v.gainDb === -3.5 && v.pitchCents === 200)).toBe(
    true
  );
  expect(P.hitOutwardLater.variants.every((v) => v.gainDb === -10 && v.pitchCents === 200)).toBe(
    true
  );
  expect(P.deactivate.variants[0]).toMatchObject({
    gainDb: -18,
    pitchCents: 0,
    pitchRangeCents: [-200, 200],
  });
  const altered = [...P.hitReturnFirst.variants, ...P.hitReturnLater.variants].filter((v) =>
    [244232343, 888015484].includes(v.soundId)
  );
  expect(altered).toHaveLength(2);
  for (const variant of altered) expect([-5.5, -9.5]).toContain(variant.gainDb);
});
test('source hierarchy caps remain independent and all slowest variants fit finite bounds', () => {
  for (const p of Object.values(P)) {
    expect(p.maxVoices).toBe(p === P.outward || p === P.return ? 4 : 2);
    expect(p.rootMaxVoices).toBe(p.rootId === p.containerId ? p.maxVoices : 8);
    for (const v of p.variants)
      expect(
        (v.durationSeconds / 2 ** ((v.pitchCents + v.pitchRangeCents[0]) / 1200)) * 60
      ).toBeLessThanOrEqual(p.maximumTicks);
  }
  expect(P.cast.maximumTicks).toBe(130);
  expect(P.outward.maximumTicks).toBe(60);
  expect(P.return.maximumTicks).toBe(96);
  expect(P.deactivate.maximumTicks).toBe(67);
  expect(STOP).toEqual({
    outward: { seconds: 0.5, curve: 6, ticks: 30 },
    return: { seconds: 0.75, curve: 4, ticks: 45 },
  });
});
test('explicit local per-cast sequence policy follows all seven retained positions', () => {
  for (const leg of ['outward', 'return'] as const) {
    const first = leg === 'outward' ? 'hitOutwardFirst' : 'hitReturnFirst';
    const later = leg === 'outward' ? 'hitOutwardLater' : 'hitReturnLater';
    expect(Array.from({ length: 15 }, (_, i) => orbHitAudioKind(leg, i))).toEqual([
      first,
      later,
      later,
      later,
      later,
      later,
      later,
      first,
      later,
      later,
      later,
      later,
      later,
      later,
      first,
    ]);
  }
  for (const n of [-1, 0.5, NaN, Infinity]) expect(() => orbHitAudioKind('outward', n)).toThrow();
});

test('generated retention bounds agree with independent local profile derivation', () => {
  expect(T).toEqual({
    cast: P.cast.maximumTicks,
    outward: P.outward.maximumTicks,
    return: P.return.maximumTicks,
    hitOutward: Math.max(P.hitOutwardFirst.maximumTicks, P.hitOutwardLater.maximumTicks),
    hitReturn: Math.max(P.hitReturnFirst.maximumTicks, P.hitReturnLater.maximumTicks),
    deactivate: P.deactivate.maximumTicks,
    stopOutward: STOP.outward.ticks,
    stopReturn: STOP.return.ticks,
  });
});
