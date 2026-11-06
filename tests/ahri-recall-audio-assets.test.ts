import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_RECALL_AUDIO as P } from '../src/content/ahri-recall-audio';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const container = (id: number) => P.containers.find((c) => c.id === id)!;
const property = (id: number, key: string) =>
  (container(id).properties as Record<string, number>)[key];

test('one named Recall Play retains its finite master target and no invented Stop', () => {
  expect(P.events).toHaveLength(1);
  expect(P.events[0]).toMatchObject({ role: 'recall', id: 3665710094 });
  expect(P.events[0].actions).toHaveLength(1);
  expect(P.events[0].actions[0]).toMatchObject({
    id: 37101235,
    type: 'CAkActionPlay',
    target: 491713706,
  });
  expect(P.containers).toHaveLength(1);
  expect(P.sounds).toHaveLength(1);
  expect(P.containers[0].playlist).toEqual([{ id: 706310825, weight: 50000 }]);
  expect(P.sounds[0].clip.id).toBe(795142737);
});
test('zero source cap and shared actor identity stay raw beside Recall gain and pitch omissions', () => {
  expect(P.containers[0].policy).toMatchObject({
    bIsContinuous: 0,
    sLoopCount: 1,
    bIsGlobal: 1,
    u16MaxNumInstance: 0,
  });
  expect(property(491713706, 'MakeUpGain')).toBe(-5);
  expect(P.containers[0].properties).not.toHaveProperty('Pitch');
  expect(P.containers[0].ranges).toEqual({});
  expect(P.mixers).toHaveLength(1);
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
});
for (const sound of new Map(P.sounds.map((s) => [s.clip.id, s])).values())
  test(`Ahri Recall master ${sound.clip.id} remains the unchanged float source`, () => {
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
