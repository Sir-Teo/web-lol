import { expect, test } from 'vitest';
import {
  AHRI_SPIRIT_RUSH_AUDIO_PROFILES as P,
  AHRI_SPIRIT_RUSH_AUDIO_LAUNCH_STOP as STOP,
  AHRI_SPIRIT_RUSH_AUDIO_LOCAL_ACTIVATION_STOP as LOCAL,
} from '../src/content/ahri-spirit-rush-audio-policy';
import { AHRI_SPIRIT_RUSH_AUDIO_TICKS as T } from '../src/content/ahri-spirit-rush-audio-timing';

test('Python finite retention bounds agree with independent TypeScript profile derivation', () => {
  expect([
    P.cast.maximumTicks,
    P.launch.maximumTicks,
    P.hit.maximumTicks,
    P.deactivate.maximumTicks,
  ]).toEqual([T.cast, T.launch, T.hit, T.deactivate]);
  expect(P.activation.continuous).toBe(true);
  expect(P.activation.maximumTicks).toBeNull();
  expect(P.activation.variants).toHaveLength(1);
  expect(P.activation.variants[0].id).toBe(698907153);
});
test('R profiles preserve source gains, hit pitch range and per-container caps', () => {
  expect(Object.values(P).map((p) => [p.variants[0].gainDb, p.maxVoices])).toEqual([
    [-7, 2],
    [-19, 2],
    [-13, 4],
    [-7, 2],
    [-19, 2],
  ]);
  for (const v of P.hit.variants) {
    expect(v.pitchCents).toBe(200);
    expect(v.pitchRangeCents).toEqual([-300, 300]);
    expect(v.ancestry.slice(-2)).toEqual([601059309, 353175404]);
  }
  expect(
    P.launch.variants.every((v) => v.pitchCents === 0 && v.pitchRangeCents.every((n) => n === 0))
  ).toBe(true);
});
test('source missile stop and local activation de-click remain distinct policies', () => {
  expect([STOP.targetId, STOP.seconds, STOP.curve]).toEqual([525682343, 0.25, 6]);
  expect(STOP.seconds * 60).toBe(T.launchStop);
  expect(LOCAL).toEqual({ seconds: 0.02, curve: 4 });
  expect(Math.ceil(LOCAL.seconds * 60)).toBe(T.activationLocalStop);
  expect(LOCAL).not.toHaveProperty('eventId');
  expect(LOCAL).not.toHaveProperty('actionId');
});
