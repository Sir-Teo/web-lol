import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_CAST_AUDIO as audio } from '../src/content/hawkshot-cast-audio';

test('cast playback uses the pinned bank delay/gain and unmodified float masters', () => {
  const graph = JSON.parse(readFileSync('docs/reference/hawkshot-audio.json', 'utf8'));
  const decoded = JSON.parse(readFileSync('docs/reference/hawkshot-audio-decoded.json', 'utf8'));
  const event = graph.events.find((e: any) => e.id === audio.eventId);
  expect(event.name).toBe('Play_sfx_Ashe_AsheSpiritOfTheHawk_OnCast');
  expect(audio.variants.map((v) => v.id)).toEqual(event.mediaIds);
  const property = (id: number, label: string) => {
    const fields = graph.nodes.find((n: any) => n.id === id).parameters;
    const pid = fields.find((p: any) => p[0].endsWith('/pID') && p[3]?.includes(`[${label}]`));
    return Number(fields.find((p: any) => p[0] === pid[0].slice(0, -3) + 'pValue')[2]);
  };
  expect(audio.delaySeconds).toBe(property(event.actions[0], 'DelayTime') / 1000);
  expect(audio.gainDb).toBe(property(3432, 'MakeUpGain'));
  for (const variant of audio.variants) {
    const bytes = readFileSync(`public${variant.url}`);
    const master = decoded.media.find((m: any) => m.id === variant.id);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(master.wavSha256);
    expect(variant.sha256).toBe(master.wavSha256);
  }
});
