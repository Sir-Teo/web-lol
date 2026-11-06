import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_LIFECYCLE_AUDIO as P } from '../src/content/ahri-lifecycle-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('death Stop retains its affected target and 5000 ms Linear declaration separately from Play', () => {
  expect(P.events.map((e) => [e.role, e.actions[0].type, e.actions[0].target])).toEqual([
    ['death', 'CAkActionPlay', 889858872],
    ['stopDeath', 'CAkActionStop', 889858872],
    ['respawn', 'CAkActionPlay', 451024335],
  ]);
  expect(P.events[1].actions[0]).toMatchObject({
    properties: { TransitionTime: 5000 },
    fadeCurve: 4,
  });
});
test('finite playlists preserve zero instance declarations without inventing positive native caps', () => {
  expect(P.containers).toHaveLength(2);
  expect(P.sounds).toHaveLength(2);
  expect(P.mixers).toHaveLength(1);
  for (const c of P.containers) {
    expect(c.policy).toMatchObject({
      bIsContinuous: 0,
      sLoopCount: 1,
      bIsGlobal: 1,
      u16MaxNumInstance: 0,
    });
    expect(c.playlist).toHaveLength(1);
    expect(c.properties).not.toHaveProperty('Pitch');
    expect(c.ranges).toEqual({});
  }
  expect([property(889858872, 'MakeUpGain'), property(451024335, 'MakeUpGain')]).toEqual([-12, -9]);
});
test('lifecycle actor identity remains separate despite attenuation points matching attack audio', () => {
  expect(P.mixers[0]).toMatchObject({
    id: 693628260,
    parentId: 0,
    busId: 2232828494,
    properties: { Priority: 55, AttenuationID: 687014649 },
  });
  expect(P.attenuation).toEqual([
    { distance: 0, storedValue: 0, interpolation: 9 },
    { distance: 1350, storedValue: 0, interpolation: 4 },
    { distance: 2412, storedValue: -1, interpolation: 4 },
  ]);
  expect(P.unresolvedGlobalBus).toBe(2232828494);
});
for (const sound of new Map(P.sounds.map((s) => [s.clip.id, s])).values())
  test(`Ahri lifecycle master ${sound.clip.id} remains the unchanged float source`, () => {
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
