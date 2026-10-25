import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LEONA_Q_AUDIO as P } from '../src/content/leona-q-audio';
import { LEONA_E_AUDIO } from '../src/content/leona-e-audio';

const kinds = ['cast', 'attack', 'hit', 'buff'] as const;
const sha = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex');

test('five source events preserve four ordered Q roles and distinguish the persistent buff from finite voices', () => {
  const raw = readFileSync('docs/reference/leona-q-audio.json'),
    graph = JSON.parse(raw.toString()),
    decoded = JSON.parse(readFileSync('docs/reference/leona-q-audio-decoded.json', 'utf8'));
  expect(decoded.sourceGraphSha256).toBe(sha(raw));
  expect(graph.extractionSha256).toBe(
    sha(readFileSync('docs/reference/leona-audio-extraction.json'))
  );
  expect(graph.events).toHaveLength(5);
  expect(graph.nodes).toHaveLength(29);
  expect(graph.media).toHaveLength(13);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(
    kinds.map((k) => [
      P[k].targetId,
      P[k].gainDb,
      P[k].variants.length,
      P[k].policy.u16MaxNumInstance,
      P[k].loop,
    ])
  ).toEqual([
    [2429, -8, 4, 2, false],
    [2432, -11, 4, 4, false],
    [2431, -9, 4, 2, false],
    [394358931, -17, 1, 0, true],
  ]);
  expect(kinds.map((k) => P[k].policy.bKillNewest)).toEqual([0, 0, 0, 0]);
  expect(kinds.map((k) => P[k].pitchCents)).toEqual([0, 0, 0, 0]);
  expect(P.buff.authoredProperties.Loop).toBe(0);
  expect(P.buff.playProperties.TransitionTime).toBe(100);
  expect(P.buff.fadeInSeconds).toBe(0.1);
  expect(P.buff.stop).toMatchObject({
    eventId: 2892014866,
    actionId: 391483191,
    targetId: 394358931,
    delaySeconds: 0,
    fadeSeconds: 0.5,
    curve: 4,
  });
  expect(P.buff.variants[0].id).toBe(526766817);
  expect(P.attenuation).toEqual(LEONA_E_AUDIO.attenuation);
  expect(sha(readFileSync(P.loopInterpretation.file))).toBe(P.loopInterpretation.sha256);
});

test('three finite random containers retain authored order, shuffle controls and disabled transition mode', () => {
  expect(P.cast.variants.map((v) => v.id)).toEqual([473450460, 57906182, 527960962, 457842275]);
  expect(P.attack.variants.map((v) => v.id)).toEqual([72849205, 180033450, 65890581, 271147565]);
  expect(P.hit.variants.map((v) => v.id)).toEqual([256570934, 149881516, 124210504, 99858069]);
  for (const kind of ['cast', 'attack', 'hit'] as const) {
    expect(P[kind].policy).toMatchObject({
      eMode: 0,
      eRandomMode: 1,
      wAvoidRepeatCount: 0,
      bResetPlayListAtEachPlay: 1,
      bIsGlobal: 1,
      bIsContinuous: 0,
      _bIsUsingWeight: 0,
      sLoopCount: 1,
      eTransitionMode: 0,
    });
    expect(P[kind].stop).toBeNull();
    expect(P[kind].fadeInSeconds).toBe(0);
  }
});

test('all thirteen untouched float masters match encoded and decoded provenance without clipping headroom', () => {
  const graph = JSON.parse(readFileSync('docs/reference/leona-q-audio.json', 'utf8')),
    decoded = JSON.parse(readFileSync('docs/reference/leona-q-audio-decoded.json', 'utf8'));
  let headroom = 0,
    bytes = 0;
  for (const kind of kinds)
    for (const variant of P[kind].variants) {
      expect(variant.url).toBe(`assets/audio/leona-q-${variant.id}.wav`);
      const raw = readFileSync('public/' + variant.url),
        chunks = new Map<string, Buffer>();
      expect(raw.toString('ascii', 0, 4)).toBe('RIFF');
      expect(raw.toString('ascii', 8, 12)).toBe('WAVE');
      expect(raw.readUInt32LE(4) + 8).toBe(raw.length);
      for (let offset = 12; offset < raw.length;) {
        const size = raw.readUInt32LE(offset + 4);
        expect(offset + 8 + size).toBeLessThanOrEqual(raw.length);
        chunks.set(
          raw.toString('ascii', offset, offset + 4),
          raw.subarray(offset + 8, offset + 8 + size)
        );
        offset += 8 + size + (size % 2);
      }
      const format = chunks.get('fmt ')!,
        pcm = chunks.get('data')!;
      expect([
        format.readUInt16LE(0),
        format.readUInt16LE(2),
        format.readUInt32LE(4),
        format.readUInt16LE(14),
      ]).toEqual([3, 1, 44100, 32]);
      expect(pcm.length).toBe(variant.frames * 4);
      expect(sha(raw)).toBe(variant.sha256);
      expect(sha(pcm)).toBe(variant.pcmSha256);
      const m = decoded.media.find((m: { id: number }) => m.id === variant.id),
        bank = graph.media.find((m: { id: number }) => m.id === variant.id);
      expect(m.encodedSha256).toBe(bank.sha256);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
      expect(m.wavSha256).toBe(variant.sha256);
      headroom += m.samplesOutsideUnitRange;
      bytes += raw.length;
    }
  expect(headroom).toBe(8);
  expect(bytes).toBe(2474956);
});
