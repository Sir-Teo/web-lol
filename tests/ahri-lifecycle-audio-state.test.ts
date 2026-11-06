import { expect, test } from 'vitest';
import { lifecycleAudioStates } from '../src/audio/ahri-lifecycle-state';
import { AHRI_LIFECYCLE_AUDIO_PROFILES as P } from '../src/content/ahri-lifecycle-audio-policy';
import {
  lifecycleRecord,
  respawnedLifecycleRecord,
  lifecycleStates,
  ownLifecycleScene,
} from './helpers/ahri-lifecycle-audio';
test('silent pending history never loops or extends the finite death master', () => {
  const r = lifecycleRecord(),
    state = lifecycleStates([r], 110)[0];
  expect(state.kind).toBe('death');
  expect(state.endAge).toBe(P.death.variants[0].durationSeconds);
  expect(state.stopAge).toBeNull();
  expect(lifecycleStates([r], 99)).toEqual([]);
  expect(lifecycleStates([r], 333)).toEqual([]);
  expect(lifecycleStates([r], 500)).toEqual([]);
});
test('only the actual respawn creates a fresh finite cue under the existing death identity', () => {
  const r = lifecycleRecord();
  expect(lifecycleStates([r], 699)).toEqual([]);
  r.respawn = { tick: 700, point: { x: 0, y: 0 }, audience: ['blue'] };
  const state = lifecycleStates([r], 710)[0];
  expect(state).toMatchObject({
    key: '42:respawn',
    ownerKey: '42',
    birthTick: 700,
    rate: 1,
    pitchCents: 0,
    offset: 10 / 60,
  });
  expect(state.endAge).toBe(P.respawn.variants[0].durationSeconds);
});
test('death and respawn audiences remain independent and current enemy visibility still gates each cue', () => {
  const r = respawnedLifecycleRecord();
  r.audience = ['blue'];
  const scene = { ...ownLifecycleScene, team: 'red' as const };
  expect(lifecycleAudioStates([r], 110, scene)).toEqual([]);
  expect(lifecycleAudioStates([r], 710, scene).map((s) => s.kind)).toEqual(['respawn']);
  expect(lifecycleAudioStates([r], 710, { ...scene, visible: () => false })).toEqual([]);
  expect(
    lifecycleAudioStates([r], 110, { ...ownLifecycleScene, visible: () => false })
  ).toHaveLength(1);
});
test('death stays at the captured point while respawn follows the current owner or saved spawn fallback', () => {
  const r = respawnedLifecycleRecord(),
    scene = { ...ownLifecycleScene, casterPoint: () => ({ x: 300, y: 200 }) };
  expect(lifecycleAudioStates([r], 110, scene)[0]).toMatchObject({ x: 400, y: 0 });
  expect(lifecycleAudioStates([r], 710, scene)[0]).toMatchObject({ x: 300, y: 200 });
  expect(
    lifecycleAudioStates([r], 710, { ...scene, casterPoint: () => undefined })[0]
  ).toMatchObject({ x: 0, y: 0 });
});
test('terminal closure does not invent a five-second source Stop clock or mutate the saved record', () => {
  const r = lifecycleRecord();
  r.terminalTick = 110;
  const saved = JSON.stringify(r),
    a = lifecycleStates([r], 110);
  expect(a).toEqual(lifecycleStates([structuredClone(r)], 110));
  expect(JSON.stringify(r)).toBe(saved);
  expect(a[0].stopAge).toBeNull();
  expect(a[0].stopFadeSeconds).toBe(0);
  expect(a[0].endAge).toBe(P.death.variants[0].durationSeconds);
});
test('expired and non-finite cue clocks never consult enemy vision or restart old audio', () => {
  const scene = {
    ...ownLifecycleScene,
    team: 'red' as const,
    visible: () => {
      throw Error('Expired lifecycle cue consulted vision');
    },
  };
  expect(lifecycleAudioStates([respawnedLifecycleRecord()], 1100, scene)).toEqual([]);
  expect(lifecycleStates([lifecycleRecord()], NaN)).toEqual([]);
  expect(lifecycleStates([lifecycleRecord()], Infinity)).toEqual([]);
});
