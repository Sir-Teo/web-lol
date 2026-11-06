import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_ORB_AUDIO as P } from '../src/content/ahri-orb-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('Q preserves reset/reset/play action order and the distinct source stop curves', () => {
  expect(P.events.find((e) => e.role === 'cast')!.actions.map((a) => [a.type, a.target])).toEqual([
    ['CAkActionResetPlaylist', 910996742],
    ['CAkActionResetPlaylist', 1066170488],
    ['CAkActionPlay', 838875043],
  ]);
  const stop = P.events.filter((e) => e.role.startsWith('stop'));
  expect(
    stop.map((e) => [
      e.role,
      (e.actions[0].properties as Record<string, number>).TransitionTime,
      e.actions[0].fadeCurve,
    ])
  ).toEqual([
    ['stopOutward', 500, 6],
    ['stopReturn', 750, 4],
  ]);
});
test('nested seven-entry hit sequences retain repeated IDs and their own voice limits', () => {
  for (const [root, first, next] of [
    [910996742, 914991319, 439670778],
    [1066170488, 395437231, 178405558],
  ]) {
    const c = container(root);
    expect(c.playlist.map((p) => p.id)).toEqual([first, next, next, next, next, next, next]);
    expect(c.policy).toMatchObject({
      eMode: 1,
      bIsContinuous: 0,
      bResetPlayListAtEachPlay: 1,
      bIsGlobal: 1,
      u16MaxNumInstance: 8,
    });
    expect([
      container(first).policy.u16MaxNumInstance,
      container(next).policy.u16MaxNumInstance,
    ]).toEqual([2, 2]);
  }
});
test('local pitches, gains and ranged modifiers remain separate instead of being flattened', () => {
  expect([property(1069572417, 'Pitch'), property(1069572417, 'MakeUpGain')]).toEqual([400, -13]);
  expect([
    property(914991319, 'Pitch'),
    property(914991319, 'MakeUpGain'),
    property(439670778, 'MakeUpGain'),
  ]).toEqual([200, -3.5, -10]);
  expect([property(395437231, 'MakeUpGain'), property(178405558, 'MakeUpGain')]).toEqual([-6, -10]);
  expect(container(755654114).properties).toEqual({ MakeUpGain: -18 });
  expect(container(755654114).ranges).toEqual({ Pitch: [-200, 200] });
  expect(
    P.sounds
      .filter((s) => 'MakeUpGain' in s.properties)
      .map((s) => [s.id, (s.properties as Record<string, number>).MakeUpGain])
  ).toEqual([
    [244232343, 0.5],
    [888015484, 0.5],
  ]);
});
test('all ten finite step containers and the two local mixers retain source scope data', () => {
  expect(P.containers).toHaveLength(10);
  expect(P.sounds).toHaveLength(22);
  expect(P.mixers).toHaveLength(2);
  for (const c of P.containers)
    expect(c.policy).toMatchObject({
      bIsGlobal: 1,
      bIsContinuous: 0,
      bKillNewest: 0,
      sLoopCount: 1,
    });
  expect(P.mixers.map((m) => [m.id, m.parentId, m.busId])).toEqual([
    [150405345, 353175404, 0],
    [353175404, 0, 1259461568],
  ]);
  expect(P.attenuation.map((p) => p.distance)).toEqual([0, 1750, 2000, 2300, 2750, 3000]);
  expect(P.unresolvedGlobalBus).toBe(1259461568);
});
for (const sound of P.sounds)
  test(`Orb master ${sound.clip.id} remains the unchanged float source`, () => {
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
