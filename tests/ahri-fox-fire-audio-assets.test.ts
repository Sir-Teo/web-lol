import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_FOX_FIRE_AUDIO as P } from '../src/content/ahri-fox-fire-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('activation stop preserves Stop then separate tail Play', () => {
  expect(
    P.events.find((e) => e.role === 'stopActivate')!.actions.map((a) => [a.type, a.target])
  ).toEqual([
    ['CAkActionStop', 594831512],
    ['CAkActionPlay', 607705804],
  ]);
  expect(
    P.events
      .filter((e) => e.role.startsWith('stop'))
      .map((e) => [
        e.role,
        (e.actions[0].properties as Record<string, number>).TransitionTime,
        e.actions[0].fadeCurve,
      ])
  ).toEqual([
    ['stopActivate', 200, 6],
    ['stopLaunch', 500, 6],
    ['stopHit', 1000, 2],
  ]);
});
test('continuous activation retains sample-accurate transition separately from step cues', () => {
  const activation = container(594831512);
  expect(activation.policy).toMatchObject({
    bIsContinuous: 1,
    sLoopCount: 0,
    eTransitionMode: 4,
    u16MaxNumInstance: 4,
  });
  expect(activation.transition).toEqual({
    fTransitionTime: 200,
    fTransitionTimeModMin: 0,
    fTransitionTimeModMax: 0,
  });
  expect(activation.playlist).toEqual([{ id: 99228402, weight: 50000 }]);
  for (const c of P.containers.filter((c) => c.id !== 594831512))
    expect(c.policy).toMatchObject({ bIsContinuous: 0, sLoopCount: 1, eTransitionMode: 0 });
  for (const sound of P.sounds)
    expect(
      masters.media.find((m: { id: number }) => m.id === sound.clip.id).decoderMetadata.loopingInfo
    ).toBeNull();
});
test('gain, base pitch and modifiers remain separate on W ancestry', () => {
  expect([
    property(1030341802, 'MakeUpGain'),
    property(594831512, 'MakeUpGain'),
    property(607705804, 'MakeUpGain'),
  ]).toEqual([-9, -20, -24]);
  for (const [id, gain] of [
    [347259201, -14],
    [405923955, -6],
  ]) {
    expect([property(id, 'MakeUpGain'), property(id, 'Pitch')]).toEqual([gain, 100]);
    expect(container(id).ranges).toEqual({ Pitch: [-300, 300] });
  }
  expect(P.mixers.map((m) => [m.id, m.parentId, m.busId])).toEqual([
    [353175404, 0, 1259461568],
    [577453666, 353175404, 0],
  ]);
  expect(P.containers).toHaveLength(5);
  expect(P.sounds).toHaveLength(11);
  expect(P.attenuation.map((p) => p.distance)).toEqual([0, 1750, 2000, 2300, 2750, 3000]);
});
for (const sound of P.sounds)
  test(`Fox-Fire master ${sound.clip.id} remains the unchanged float source`, () => {
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
