import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GAREN_Q_AUDIO as P } from '../src/content/garen-q-audio';
import graph from '../docs/reference/garen-q-audio.json';
import decoded from '../docs/reference/garen-q-audio-decoded.json';

const kinds = ['cast', 'active', 'end', 'attack', 'attackDelayed'] as const;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
test('Decisive Strike retains all five declared events, both QAttack actions, gains and source stop policy', () => {
  expect(graph.extractionSha256).toBe(
    hash(readFileSync('docs/reference/garen-audio-extraction.json'))
  );
  expect(graph.referenceSha256).toBe(hash(readFileSync('docs/reference/garen-model.json')));
  expect(decoded.sourceGraphSha256).toBe(hash(readFileSync('docs/reference/garen-q-audio.json')));
  expect(graph.events.map((e) => [e.name, e.actions.length])).toEqual([
    ['Play_sfx_Garen_GarenQAttack_OnCast', 2],
    ['Play_sfx_Garen_GarenQ_OnBuffActivate', 1],
    ['Play_sfx_Garen_GarenQ_OnBuffDeactivate', 1],
    ['Play_sfx_Garen_GarenQ_OnCast', 1],
    ['Stop_sfx_Garen_GarenQ_OnBuffActivate', 1],
  ]);
  expect(graph.unresolvedHierarchyIds).toEqual([1259461568]);
  expect(
    kinds.map((k) => [
      P[k].variants.length,
      P[k].gainDb,
      P[k].delaySeconds,
      P[k].policy.u16MaxNumInstance,
    ])
  ).toEqual([
    [3, -12, 0, 2],
    [2, -12, 0, 4],
    [1, -14, 0, 4],
    [3, -12, 0, 2],
    [4, -14, 0.23, 2],
  ]);
  expect(P.attack.eventId).toBe(P.attackDelayed.eventId);
  expect(P.attack.actionId).not.toBe(P.attackDelayed.actionId);
  expect(P.active.stop).toMatchObject({ fadeSeconds: 0.25, curve: 4 });
  expect(P.cast.variants.map((v) => v.gainDb)).toEqual([0, -2, -1]);
  expect(P.active.variants.map((v) => v.gainDb)).toEqual([0, -4]);
  for (const kind of kinds) {
    const p = P[kind],
      event = graph.events.find((e) => e.id === p.eventId)!;
    const action = event.actions.find((a) => a.id === p.actionId)!;
    expect(action.target).toBe(p.targetId);
    expect(action.affectedMediaIds).toEqual(p.variants.map((v) => v.id).sort((a, b) => a - b));
    expect(p.policy).toMatchObject({
      eMode: 0,
      eRandomMode: 1,
      bIsContinuous: 0,
      sLoopCount: 1,
      bIsGlobal: 1,
      bResetPlayListAtEachPlay: 1,
    });
  }
  const variants = kinds.flatMap((k) => [...P[k].variants]);
  expect(new Set(variants.map((v) => v.id)).size).toBe(13);
  expect(variants.map((v) => v.id).sort((a, b) => a - b)).toEqual(graph.media.map((m) => m.id));
  expect(variants.every((v) => v.loop === null)).toBe(true);
  expect(P.active.variants.map((v) => v.durationSeconds)).toEqual([340041 / 44100, 346185 / 44100]);
});

test('all thirteen Decisive Strike WAVs preserve complete mono float PCM, original headroom and encoded-media provenance', () => {
  let bytes = 0,
    outside = 0;
  for (const kind of kinds)
    for (const v of P[kind].variants) {
      const raw = readFileSync('public/' + v.url),
        m = decoded.media.find((m) => m.id === v.id)!;
      expect(hash(raw)).toBe(v.sha256);
      expect(raw.length).toBe(m.wavBytes);
      expect(m.encodedSha256).toBe(graph.media.find((e) => e.id === v.id)!.sha256);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
      const chunks = new Map<string, Buffer>();
      for (let offset = 12; offset < raw.length;) {
        const size = raw.readUInt32LE(offset + 4);
        chunks.set(
          raw.toString('ascii', offset, offset + 4),
          raw.subarray(offset + 8, offset + 8 + size)
        );
        offset += 8 + size + (size % 2);
      }
      const fmt = chunks.get('fmt ')!,
        pcm = chunks.get('data')!;
      expect([
        fmt.readUInt16LE(0),
        fmt.readUInt16LE(2),
        fmt.readUInt32LE(4),
        fmt.readUInt16LE(14),
      ]).toEqual([3, 1, 44100, 32]);
      expect(pcm.length / 4).toBe(v.frames);
      expect(hash(pcm)).toBe(v.pcmSha256);
      let peak = 0,
        finite = true,
        count = 0;
      for (let i = 0; i < pcm.length; i += 4) {
        const sample = pcm.readFloatLE(i);
        finite &&= Number.isFinite(sample);
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) > 1) count++;
      }
      expect(finite).toBe(true);
      expect(peak).toBe(v.peak);
      expect(count).toBe(m.samplesOutsideUnitRange);
      bytes += raw.length;
      outside += count;
    }
  expect(bytes).toBe(7630148);
  expect(outside).toBe(8092);
});
