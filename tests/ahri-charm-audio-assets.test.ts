import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  AHRI_CHARM_AUDIO as P,
  AHRI_CHARM_STOP as S,
  AHRI_CHARM_ATTENUATION as A,
} from '../src/content/ahri-charm-audio';
import {
  AHRI_CHARM_CAST_TICKS,
  AHRI_CHARM_FLIGHT_TICKS,
  AHRI_CHARM_HIT_TICKS,
  AHRI_CHARM_STOP_FADE_TICKS,
} from '../src/content/ahri-charm-audio-timing';
const masters = JSON.parse(readFileSync('docs/reference/ahri-audio-decoded.json', 'utf8'));
const sha = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');

test('Charm retains all source plays and its distinct Exp1 stop transition', () => {
  expect(P.map((p) => [p.phase, p.gainDb, p.transitionSeconds, p.maxVoices])).toEqual([
    ['cast', -8.5, 0, 2],
    ['flight', -9.600000381469727, 0.05, 4],
    ['hit', -7, 0, 2],
  ]);
  expect(S).toEqual({
    eventId: 1033278557,
    actionId: 212144368,
    containerId: 640846733,
    fadeSeconds: 1.55,
    fadeCurve: 6,
  });
  expect([
    AHRI_CHARM_CAST_TICKS,
    AHRI_CHARM_FLIGHT_TICKS,
    AHRI_CHARM_HIT_TICKS,
    AHRI_CHARM_STOP_FADE_TICKS,
  ]).toEqual([80, 122, 157, 93]);
  expect(A.map((p) => p.distance)).toEqual([0, 1750, 2000, 2300, 2750, 3000]);
  for (const p of P) {
    expect(p.sourcePolicy).toMatchObject({
      bIsGlobal: 1,
      bIsContinuous: 0,
      sLoopCount: 1,
      bKillNewest: 0,
    });
    const bound = {
      cast: AHRI_CHARM_CAST_TICKS,
      flight: AHRI_CHARM_FLIGHT_TICKS,
      hit: AHRI_CHARM_HIT_TICKS,
    }[p.phase];
    for (const clip of p.variants) expect(clip.durationSeconds * 60).toBeLessThanOrEqual(bound);
  }
});
for (const p of P)
  for (const clip of p.variants)
    test(`Charm master ${clip.id} stays byte-identical to its private source`, () => {
      const raw = readFileSync('public/' + clip.url),
        source = masters.media.find((m: { id: number }) => m.id === clip.id);
      expect(sha(raw)).toBe(clip.sha256);
      expect(clip.sha256).toBe(source.wavSha256);
      expect(clip.pcmSha256).toBe(source.pcmSha256);
      expect(raw.length).toBe(source.wavBytes);
      expect([clip.frames, clip.sampleRate, clip.channels, clip.peak]).toEqual([
        source.frames,
        source.sampleRate,
        source.channels,
        source.peak,
      ]);
    });
