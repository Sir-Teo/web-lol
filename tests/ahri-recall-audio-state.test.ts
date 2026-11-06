import { expect, test } from 'vitest';
import { recallAudioStates } from '../src/audio/ahri-recall-state';
import { recallRecord, recallStates, ownRecallScene } from './helpers/ahri-recall-audio';
test('finite phase follows caster and preserves natural tail after successful return', () => {
  const r = recallRecord();
  expect(recallStates([r], 99)).toEqual([]);
  expect(recallStates([r], 110)[0]).toMatchObject({
    key: '42',
    ownerKey: '42',
    offset: 10 / 60,
    rate: 1,
    x: 20,
    y: 0,
    stopAge: null,
  });
  r.end = { tick: 580, point: { x: 0, y: 0 }, reason: 'complete' };
  expect(recallStates([r], 600)[0].stopAge).toBeNull();
  expect(recallStates([r], 680)).toEqual([]);
});
test('interruption has an explicit finite twenty millisecond Linear release and exact endpoint', () => {
  const r = recallRecord();
  r.end = { tick: 110, point: { x: 30, y: 40 }, reason: 'cancelled' };
  expect(recallStates([r], 110)[0]).toMatchObject({
    stopAge: 10 / 60,
    stopFadeSeconds: 0.02,
    stopCurve: 4,
    x: 30,
    y: 40,
  });
  expect(recallStates([r], 111)).toHaveLength(1);
  expect(recallStates([r], 111.2)).toEqual([]);
  expect(recallStates([r], 112)).toEqual([]);
});
test('birth audience and current visibility independently gate enemy recall with own audio unaffected', () => {
  const r = recallRecord();
  r.audience = ['blue'];
  expect(recallAudioStates([r], 110, { ...ownRecallScene, team: 'red' })).toEqual([]);
  r.audience = ['blue', 'red'];
  expect(
    recallAudioStates([r], 110, { ...ownRecallScene, team: 'red', visible: () => false })
  ).toEqual([]);
  expect(recallAudioStates([r], 110, { ...ownRecallScene, visible: () => false })).toHaveLength(1);
});
test('restored and terminal histories are immutable finite projections with saved-point fallback', () => {
  const r = recallRecord();
  r.end = { tick: 110, point: { x: 30, y: 40 }, reason: 'match-end' };
  const saved = JSON.stringify(r);
  expect(recallStates([r], 110)).toEqual(recallStates([structuredClone(r)], 110));
  expect(JSON.stringify(r)).toBe(saved);
  expect(recallStates([r], Infinity)).toEqual([]);
  r.end = { tick: 580, point: { x: 0, y: 0 }, reason: 'complete' };
  expect(
    recallAudioStates([r], 600, { ...ownRecallScene, casterPoint: () => undefined })[0]
  ).toMatchObject({ x: 0, y: 0 });
});
