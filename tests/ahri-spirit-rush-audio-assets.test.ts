import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_SPIRIT_RUSH_AUDIO as P } from '../src/content/ahri-spirit-rush-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('R deactivation plays its own tail without an invented activation Stop action', () => {
  expect(
    P.events.find((e) => e.role === 'deactivate')!.actions.map((a) => [a.type, a.target])
  ).toEqual([['CAkActionPlay', 598713583]]);
  expect(
    P.events
      .flatMap((e) => [...e.actions])
      .filter((a) => a.type === 'CAkActionStop')
      .map((a) => a.target)
  ).toEqual([525682343]);
  const stop = P.events.find((e) => e.role === 'stopLaunch')!.actions[0];
  expect([(stop.properties as Record<string, number>).TransitionTime, stop.fadeCurve]).toEqual([
    250, 6,
  ]);
});
test('continuous activation keeps its SampleAccurate policy and all transition values', () => {
  const activation = container(294973194);
  expect(activation.policy).toMatchObject({
    bIsContinuous: 1,
    sLoopCount: 0,
    eTransitionMode: 4,
    u16MaxNumInstance: 2,
  });
  expect(activation.transition).toEqual({
    fTransitionTime: 1000,
    fTransitionTimeModMin: 0,
    fTransitionTimeModMax: 0,
  });
  for (const c of P.containers.filter((c) => c.id !== 294973194))
    expect(c.policy).toMatchObject({ bIsContinuous: 0, sLoopCount: 1, eTransitionMode: 0 });
});
test('R retains priority, gain and pitch omissions and its own mixer ancestry', () => {
  expect(container(220652520).properties).toEqual({ MakeUpGain: -7, Priority: 75 });
  expect(container(294973194).properties).toEqual({ MakeUpGain: -19 });
  expect(container(598713583).properties).toEqual({ MakeUpGain: -19 });
  expect(container(525682343).properties).toEqual({ MakeUpGain: -13 });
  expect([
    property(806649894, 'Pitch'),
    property(806649894, 'MakeUpGain'),
    property(806649894, 'Priority'),
  ]).toEqual([200, -7, 75]);
  expect(container(806649894).ranges).toEqual({ Pitch: [-300, 300] });
  expect(P.mixers.map((m) => [m.id, m.parentId, m.busId])).toEqual([
    [353175404, 0, 1259461568],
    [601059309, 353175404, 0],
  ]);
});
test('four-variant cast, missile and hit playlists remain separate from single activation/deactivation masters', () => {
  expect(
    [220652520, 525682343, 806649894, 294973194, 598713583].map(
      (id) => container(id).playlist.length
    )
  ).toEqual([4, 4, 4, 1, 1]);
  expect(P.containers).toHaveLength(5);
  expect(P.sounds).toHaveLength(14);
  expect(P.mixers).toHaveLength(2);
  expect(P.events).toHaveLength(6);
  for (const sound of P.sounds)
    expect(
      masters.media.find((m: { id: number }) => m.id === sound.clip.id).decoderMetadata.loopingInfo
    ).toBeNull();
});

for (const sound of P.sounds)
  test(`Spirit Rush master ${sound.clip.id} remains the unchanged float source`, () => {
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
