import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_ATTACK_AUDIO as P } from '../src/content/ahri-attack-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('ordinary alternate and critical actions preserve aliases without duplicating masters', () => {
  expect(P.events).toHaveLength(12);
  for (let variant = 0; variant < 3; variant++) {
    expect(
      P.events
        .slice(variant * 4, variant * 4 + 4)
        .map((e) => [e.actions[0].type, e.actions[0].target])
    ).toEqual([
      ['CAkActionPlay', 367977750],
      ['CAkActionPlay', 276401545],
      ['CAkActionPlay', 768158277],
      ['CAkActionStop', 276401545],
    ]);
    const stop = P.events[variant * 4 + 3].actions[0];
    expect(stop.properties).toEqual({ TransitionTime: 100 });
    expect(stop.fadeCurve).toBe(4);
  }
  expect(new Set(P.events.map((e) => e.id)).size).toBe(12);
  expect(new Set(P.events.flatMap((e) => e.actions.map((a) => a.id))).size).toBe(12);
  expect(P.sounds).toHaveLength(12);
});
test('source finite playlists retain caps and gain/pitch omissions', () => {
  const order = [367977750, 276401545, 768158277];
  expect(order.map((id) => property(id, 'MakeUpGain'))).toEqual([-12, -15, -11.5]);
  expect(order.map((id) => container(id).policy.u16MaxNumInstance)).toEqual([2, 4, 2]);
  for (const c of P.containers) {
    expect(c.policy).toMatchObject({ bIsContinuous: 0, sLoopCount: 1, bIsGlobal: 1 });
    expect(c.playlist).toHaveLength(4);
  }
  expect(property(367977750, 'Pitch')).toBe(200);
  expect(container(367977750).ranges).toEqual({ Pitch: [-300, 300] });
  for (const id of [276401545, 768158277]) {
    expect(container(id).properties).not.toHaveProperty('Pitch');
    expect(container(id).ranges).toEqual({});
  }
});
test('attack actor ancestry and its three-point attenuation stay distinct from spells', () => {
  expect(P.mixers.map((m) => [m.id, m.parentId, m.busId])).toEqual([
    [91257365, 0, 211064428],
    [362837995, 91257365, 0],
  ]);
  expect(P.mixers[0].properties).toMatchObject({ Priority: 56, AttenuationID: 134343538 });
  expect(P.attenuation).toEqual([
    { distance: 0, storedValue: 0, interpolation: 9 },
    { distance: 1350, storedValue: 0, interpolation: 4 },
    { distance: 2412, storedValue: -1, interpolation: 4 },
  ]);
  expect(P.unresolvedGlobalBus).toBe(211064428);
});
for (const sound of new Map(P.sounds.map((s) => [s.clip.id, s])).values())
  test(`Ahri attack master ${sound.clip.id} remains the unchanged float source`, () => {
    const clip = sound.clip,
      raw = readFileSync('public/' + clip.url),
      source = masters.media.find((m: { id: number }) => m.id === clip.id);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(clip.sha256);
    expect(clip.sha256).toBe(source.wavSha256);
    expect(clip.pcmSha256).toBe(source.pcmSha256);
    expect(raw.length).toBe(source.wavBytes);
    expect([clip.frames, clip.sampleRate, clip.channels, clip.peak]).toEqual([
      source.frames,
      44100,
      1,
      source.peak,
    ]);
  });
