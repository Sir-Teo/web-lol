import { expect, test } from 'vitest';
import { passiveAudioStates } from '../src/audio/ahri-passive-state';
import { passiveRecord, consumedPassiveRecord, passiveStates } from './helpers/ahri-passive-audio';
import { AHRI_PASSIVE_AUDIO_PROFILES as P } from '../src/content/ahri-passive-audio-policy';
test('local champion and minion arrival dispatch remain distinct while launches finish naturally', () => {
  const r = consumedPassiveRecord();
  expect(passiveStates([r], 130).map((s) => s.kind)).toEqual(['launch', 'hit', 'orbBuffActivate']);
  r.kind = 'minion';
  expect(passiveStates([r], 130).map((s) => s.kind)).toEqual(['launch', 'minionHeal']);
  for (const reason of ['death', 'expired', 'match-end'] as const) {
    r.end!.reason = reason;
    expect(passiveStates([r], 130).map((s) => s.kind)).toEqual(['launch']);
  }
});
test('finite masters retain original sample offsets and exact source end boundaries', () => {
  const r = consumedPassiveRecord();
  for (const s of passiveStates([r], 130)) {
    const clip = P[s.kind].variants[s.variant];
    expect(s.rate).toBe(1);
    expect(s.pitchCents).toBe(0);
    expect(s.offset).toBe((130 - s.birthTick) / 60);
    expect(s.endAge).toBe(clip.durationSeconds);
    expect(s.stopAge).toBeNull();
    expect(
      passiveStates([r], s.birthTick + clip.durationSeconds * 60 + 1e-7).some(
        (v) => v.key === s.key
      )
    ).toBe(false);
  }
  expect(passiveStates([r], 99)).toEqual([]);
  expect(passiveStates([r], Infinity)).toEqual([]);
});
test('birth audiences and current enemy visibility independently gate launch and contact', () => {
  const r = consumedPassiveRecord();
  r.audience = ['blue'];
  const scene = { team: 'red' as const, visible: () => true };
  expect(passiveAudioStates([r], 130, scene).map((s) => s.kind)).toEqual([
    'hit',
    'orbBuffActivate',
  ]);
  expect(passiveAudioStates([r], 130, { ...scene, visible: () => false })).toEqual([]);
  expect(passiveAudioStates([r], 130, { team: 'blue', visible: () => false })).toHaveLength(3);
});
test('moving launch and fixed arrival use separate points and deterministic cosmetic variants', () => {
  const r = consumedPassiveRecord(),
    before = JSON.stringify(r);
  expect(passiveStates([r], 130)).toEqual(passiveStates([structuredClone(r)], 130));
  expect(JSON.stringify(r)).toBe(before);
  r.currentPoint = { x: 300, y: 400 };
  const states = passiveStates([r], 130);
  expect(states.find((s) => s.kind === 'launch')).toMatchObject({ x: 300, y: 400 });
  expect(states.find((s) => s.kind === 'hit')).toMatchObject({ x: 20, y: 0 });
  expect(
    new Set(
      Array.from({ length: 50 }, (_, i) => {
        const n = consumedPassiveRecord();
        n.id += i;
        return passiveStates([n], 130).find((s) => s.kind === 'orbBuffActivate')!.variant;
      })
    ).size
  ).toBe(3);
});
test('an old active pursuit cannot revive its completed launch while its later arrival stays eligible', () => {
  const r = passiveRecord();
  expect(passiveStates([r], 400)).toEqual([]);
  r.end = { tick: 400, point: { x: 20, y: 0 }, reason: 'consumed', audience: ['blue'] };
  expect(passiveStates([r], 401).map((s) => s.kind)).toEqual(['hit', 'orbBuffActivate']);
});
