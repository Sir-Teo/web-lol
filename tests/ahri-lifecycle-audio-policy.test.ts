import { expect, test } from 'vitest';
import {
  AHRI_LIFECYCLE_AUDIO_PROFILES as P,
  AHRI_LIFECYCLE_LOCAL_VOICE_LIMIT as LOCAL,
  AHRI_LIFECYCLE_SOURCE_DEATH_STOP as STOP,
} from '../src/content/ahri-lifecycle-audio-policy';
import { AHRI_LIFECYCLE_AUDIO_TICKS as T } from '../src/content/ahri-lifecycle-audio-timing';
test('Python and TypeScript independently agree on finite master bounds and actor ancestry', () => {
  expect([P.death.maximumTicks, P.respawn.maximumTicks]).toEqual([T.death, T.respawn]);
  for (const p of Object.values(P)) {
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0].ancestry.at(-1)).toBe(693628260);
    expect(p.variants[0].pitchCents).toBe(0);
    expect(p.variants[0].pitchRangeCents).toEqual([0, 0]);
  }
  expect([P.death.variants[0].gainDb, P.respawn.variants[0].gainDb]).toEqual([-12, -9]);
});
test('zero source instance declarations remain distinct from the explicit local voice ceiling', () => {
  expect(LOCAL).toBe(16);
  for (const p of Object.values(P)) {
    expect(p.sourceMaximumInstances).toBe(0);
    expect(p.maxVoices).toBe(LOCAL);
  }
});
test('the source five-second Linear death Stop retains identity without a local callback clock', () => {
  expect(STOP).toEqual({
    eventId: 2947637328,
    actionId: 1021566158,
    targetId: 889858872,
    seconds: 5,
    curve: 4,
  });
  expect(STOP.seconds * 60).toBe(T.sourceDeathStop);
  expect(STOP).not.toHaveProperty('tick');
});
