import { expect, test } from 'vitest';
import {
  AHRI_RECALL_AUDIO_PROFILE as P,
  AHRI_RECALL_LOCAL_VOICE_LIMIT as LOCAL,
  AHRI_RECALL_LOCAL_RELEASE as RELEASE,
} from '../src/content/ahri-recall-audio-policy';
import { AHRI_RECALL_AUDIO_TICKS as T } from '../src/content/ahri-recall-audio-timing';
test('independent source ancestry agrees with finite Python master bound', () => {
  expect(P.maximumTicks).toBe(T);
  expect(T).toBe(580);
  expect(P.variants[0].ancestry).toEqual([706310825, 491713706, 693628260]);
  expect(P.variants[0].gainDb).toBe(-5);
  expect(P.variants[0].pitchCents).toBe(0);
  expect(P.variants[0].pitchRangeCents).toEqual([0, 0]);
  expect([P.eventId, P.actionId, P.containerId]).toEqual([3665710094, 37101235, 491713706]);
});
test('local ceiling and interruption release do not rewrite raw zero or invent a Stop identity', () => {
  expect(P.sourceMaximumInstances).toBe(0);
  expect(P.maxVoices).toBe(LOCAL);
  expect(LOCAL).toBe(16);
  expect(RELEASE).toEqual({ seconds: 0.02, curve: 4 });
  expect(RELEASE).not.toHaveProperty('eventId');
  expect(RELEASE).not.toHaveProperty('actionId');
});
