import { expect, test } from 'vitest';
import { attackAudioStates } from '../src/audio/ahri-attack-state';
import { AHRI_ATTACK_AUDIO_PROFILES as P } from '../src/content/ahri-attack-audio-policy';
import {
  attackRecord,
  firedAttackRecord,
  attackStates,
  ownAttackScene,
} from './helpers/ahri-attack-audio';
test('finite cast continues after windup cancellation without inventing a source cast Stop', () => {
  const r = attackRecord();
  expect(attackStates([r], 110).map((s) => s.kind)).toEqual(['cast']);
  r.cancel = { tick: 105, reason: 'cancelled' };
  const state = attackStates([r], 110)[0];
  expect(state.kind).toBe('cast');
  expect(state.stopAge).toBeNull();
  expect(attackStates([r], 99)).toEqual([]);
});
test('actual hit dispatch and the original 100 ms Linear missile stop use independent clocks', () => {
  const r = firedAttackRecord(),
    states = attackStates([r], 132);
  expect(states.map((s) => s.kind)).toEqual(['cast', 'launch', 'hit']);
  const launch = states.find((s) => s.kind === 'launch')!;
  expect(launch).toMatchObject({ stopAge: 0.2, stopFadeSeconds: 0.1, stopCurve: 4, age: 14 / 60 });
  expect(launch.endAge).toBeCloseTo(0.3, 12);
  expect(attackStates([r], 136).some((s) => s.kind === 'launch')).toBe(false);
  for (const reason of ['lost-target', 'range', 'match-end'] as const) {
    r.launch!.end!.reason = reason;
    expect(attackStates([r], 132).some((s) => s.kind === 'hit')).toBe(false);
  }
});
test('source pitch ranges, unchanged sample phases and alias-sharing stay deterministic', () => {
  const r = firedAttackRecord(),
    saved = JSON.stringify(r),
    states = attackStates([r], 132);
  expect(attackStates([structuredClone(r)], 132)).toEqual(states);
  expect(JSON.stringify(r)).toBe(saved);
  for (const s of states) {
    const clip = P[s.kind].variants[s.variant];
    expect(s.offset).toBe(s.age * s.rate);
    if (s.kind === 'cast') expect(s.pitchCents).toBeGreaterThanOrEqual(-100);
    else expect(s.pitchCents).toBe(0);
    expect(s.endAge).toBeLessThanOrEqual(clip.durationSeconds / s.rate);
  }
  r.critical = true;
  expect(attackStates([r], 132)).toEqual(states);
  const variants = new Set(
    Array.from({ length: 100 }, (_, i) => {
      const n = firedAttackRecord();
      n.sourceId += i;
      return attackStates([n], 132).find((s) => s.kind === 'cast')!.variant;
    })
  );
  expect(variants.size).toBe(4);
});
test('cast launch and contact have separate birth audiences and current enemy visibility gates', () => {
  const r = firedAttackRecord();
  r.audience = ['blue'];
  r.launch!.audience = ['blue'];
  const scene = { ...ownAttackScene, team: 'red' as const };
  expect(attackAudioStates([r], 132, scene).map((s) => s.kind)).toEqual(['hit']);
  expect(attackAudioStates([r], 132, { ...scene, visible: () => false })).toEqual([]);
  expect(attackAudioStates([r], 132, { ...ownAttackScene, visible: () => false })).toHaveLength(3);
});
test('cast follows the owner while missile and contact keep their saved points', () => {
  const r = firedAttackRecord(),
    states = attackAudioStates([r], 132, {
      ...ownAttackScene,
      casterPoint: () => ({ x: -300, y: 0 }),
    });
  expect(states.find((s) => s.kind === 'cast')).toMatchObject({ x: -300, y: 0 });
  expect(states.filter((s) => s.kind !== 'cast').every((s) => s.x === 350)).toBe(true);
});
test('expired cues do not consult enemy vision or revive, and non-finite clocks are silent', () => {
  const scene = {
    ...ownAttackScene,
    team: 'red' as const,
    visible: () => {
      throw Error('Expired cue exposed vision');
    },
  };
  expect(attackAudioStates([firedAttackRecord()], 1000, scene)).toEqual([]);
  expect(attackStates([firedAttackRecord()], NaN)).toEqual([]);
  expect(attackStates([firedAttackRecord()], Infinity)).toEqual([]);
});
