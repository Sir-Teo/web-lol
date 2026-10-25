import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LEONA_SUNLIGHT_AUDIO as P } from '../src/content/leona-sunlight-audio';
import { LEONA_Q_AUDIO } from '../src/content/leona-q-audio';
import { SUNLIGHT_VISUAL_HISTORY_TICKS } from '../src/content/leona-sunlight-presentation';
const sha = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex');
test('Sunlight retains its declared event, complete nine-node graph and bounded stop audit', () => {
  const raw = readFileSync('docs/reference/leona-sunlight-audio.json'),
    g = JSON.parse(raw.toString()),
    d = JSON.parse(readFileSync('docs/reference/leona-sunlight-audio-decoded.json', 'utf8'));
  expect(g.events).toHaveLength(1);
  expect(g.nodes).toHaveLength(9);
  expect(g.media).toHaveLength(3);
  expect(g.events[0]).toMatchObject({
    name: 'Play_sfx_Leona_LeonaSunlight_hit',
    id: 2146748535,
    actions: [
      {
        id: 917723274,
        type: 'CAkActionPlay',
        target: 2445,
        affectedMediaIds: [134510222, 495930967, 836514570],
      },
    ],
  });
  expect(g.extractionSha256).toBe(sha(readFileSync('docs/reference/leona-audio-extraction.json')));
  expect(g.referenceSha256).toBe(sha(readFileSync('docs/reference/leona-model.json')));
  expect(d.sourceGraphSha256).toBe(sha(raw));
  expect(g.unresolvedHierarchyIds).toEqual([1259461568]);
  for (const prior of ['q', 'w', 'e', 'r', 'aa']) {
    const old = JSON.parse(readFileSync(`docs/reference/leona-${prior}-audio.json`, 'utf8'));
    expect(
      g.media.some((m: any) => old.media.some((p: any) => p.id === m.id || p.sha256 === m.sha256))
    ).toBe(false);
  }
  expect(P.stopAudit.actions).toHaveLength(5);
  expect(P.stopAudit.matchingTargets).toEqual([]);
});
test('Sunlight preserves ordered shuffle media, separate priorities and the six-point spell attenuation', () => {
  expect(P.hit).toMatchObject({
    eventId: 2146748535,
    actionId: 917723274,
    targetId: 2445,
    gainDb: -12,
    pitchCents: 0,
    fadeInSeconds: 0,
    authoredProperties: { values: { MakeUpGain: -12 }, ranges: {} },
    playProperties: { values: {}, ranges: {} },
    policy: {
      eMode: 0,
      eRandomMode: 1,
      wAvoidRepeatCount: 0,
      bResetPlayListAtEachPlay: 1,
      bIsGlobal: 1,
      bIsContinuous: 0,
      _bIsUsingWeight: 0,
      u16MaxNumInstance: 2,
      bKillNewest: 0,
      sLoopCount: 1,
      sLoopModMin: 0,
      sLoopModMax: 0,
      eTransitionMode: 0,
    },
  });
  expect(P.hit.variants.map((v) => [v.soundId, v.id])).toEqual([
    [282110511, 134510222],
    [943926914, 495930967],
    [99903188, 836514570],
  ]);
  for (const v of P.hit.variants)
    expect(v.authoredProperties).toEqual({ values: { Priority: 60 }, ranges: {} });
  expect(P.parents.map((p) => [p.id, p.parentId])).toEqual([
    [2444, 695650395],
    [695650395, 0],
  ]);
  expect(P.parents[1].authoredProperties).toEqual({
    values: { Priority: 60, AttenuationID: 339248780 },
    ranges: {},
  });
  expect(P.attenuation).toEqual(LEONA_Q_AUDIO.attenuation);
});
test('three untouched finite float masters preserve every PCM hash and their single above-unit sample', () => {
  const d = JSON.parse(readFileSync('docs/reference/leona-sunlight-audio-decoded.json', 'utf8'));
  let bytes = 0,
    frames = 0,
    outside = 0;
  for (const v of P.hit.variants) {
    expect(v.url).toBe(`assets/audio/leona-sunlight-${v.id}.wav`);
    const raw = readFileSync('public/' + v.url);
    expect(sha(raw)).toBe(v.sha256);
    bytes += raw.length;
    frames += v.frames;
    let pcm: Buffer | undefined;
    for (let i = 12; i < raw.length;) {
      const n = raw.readUInt32LE(i + 4);
      if (raw.toString('ascii', i, i + 4) === 'data') pcm = raw.subarray(i + 8, i + 8 + n);
      i += 8 + n + (n % 2);
    }
    expect(pcm!.length).toBe(v.frames * 4);
    expect(sha(pcm!)).toBe(v.pcmSha256);
    const m = d.media.find((m: any) => m.id === v.id);
    expect(m.decoderMetadata.loopingInfo).toBeNull();
    outside += m.samplesOutsideUnitRange;
    expect(v.channels).toBe(1);
    expect(v.sampleRate).toBe(44100);
    expect(v.durationSeconds).toBe(v.frames / 44100);
  }
  expect(bytes).toBe(341848);
  expect(frames).toBe(85429);
  expect(outside).toBe(1);
  expect(Math.max(...P.hit.variants.map((v) => v.peak))).toBe(1.0305808782577515);
  expect(SUNLIGHT_VISUAL_HISTORY_TICKS).toBeGreaterThanOrEqual(
    Math.ceil(P.hit.maxDurationSeconds * 60)
  );
});
