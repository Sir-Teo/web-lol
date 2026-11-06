import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_PASSIVE_AUDIO as P } from '../src/content/ahri-passive-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('all four passive events preserve only their own Play actions and source targets', () => {
  expect(
    P.events.map((e) => [e.role, e.actions.length, e.actions[0].type, e.actions[0].target])
  ).toEqual([
    ['launch', 1, 'CAkActionPlay', 447547134],
    ['hit', 1, 'CAkActionPlay', 761154906],
    ['orbBuffActivate', 1, 'CAkActionPlay', 549126052],
    ['minionHeal', 1, 'CAkActionPlay', 650258815],
  ]);
});
test('finite step scope, per-container caps and local ancestry remain explicit', () => {
  expect(P.containers).toHaveLength(4);
  expect(P.sounds).toHaveLength(8);
  expect(P.mixers).toHaveLength(2);
  for (const c of P.containers)
    expect(c.policy).toMatchObject({
      bIsContinuous: 0,
      sLoopCount: 1,
      eTransitionMode: 0,
      bIsGlobal: 1,
      u16MaxNumInstance: 4,
    });
  expect(P.mixers.map((m) => [m.id, m.parentId, m.busId])).toEqual([
    [353175404, 0, 1259461568],
    [595867950, 353175404, 0],
  ]);
});
test('shared heal PCM keeps distinct sound IDs, parents, gain and event identity', () => {
  const champion = container(549126052),
    minion = container(650258815);
  expect(champion.playlist.map((p) => p.id)).not.toEqual(minion.playlist.map((p) => p.id));
  const clips = (id: number) =>
    container(id).playlist.map((p) => P.sounds.find((s) => s.id === p.id)!.clip.id);
  expect(clips(champion.id)).toEqual(clips(minion.id));
  expect([...clips(champion.id)].sort((a, b) => a - b)).toEqual([158983157, 282828401, 704313670]);
  expect([property(champion.id, 'MakeUpGain'), property(minion.id, 'MakeUpGain')]).toEqual([
    -8, -12,
  ]);
  expect(new Set(P.sounds.map((s) => s.clip.url)).size).toBe(5);
});
test('launch/hit gain and omitted pitch/modifiers stay separate from the heal branches', () => {
  expect([property(447547134, 'MakeUpGain'), property(761154906, 'MakeUpGain')]).toEqual([
    -15, -12,
  ]);
  for (const c of P.containers) {
    expect(c.properties).not.toHaveProperty('Pitch');
    expect(c.ranges).toEqual({});
  }
  for (const sound of P.sounds)
    expect(
      masters.media.find((m: { id: number }) => m.id === sound.clip.id).decoderMetadata.loopingInfo
    ).toBeNull();
});
for (const sound of new Map(P.sounds.map((s) => [s.clip.id, s])).values())
  test(`Essence Theft master ${sound.clip.id} remains the unchanged float source`, () => {
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
