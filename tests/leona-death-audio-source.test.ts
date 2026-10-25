import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LEONA_DEATH_AUDIO as P } from '../src/content/leona-death-audio';
import { LEONA_DEATH_AUDIO_TICKS } from '../src/content/leona-death-audio-timing';
import { LEONA_AA_AUDIO } from '../src/content/leona-aa-audio';
const sha = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex');

test('Death3D retains both ordered Play layers, direct sound policy and complete seven-node provenance', () => {
  const raw = readFileSync('docs/reference/leona-death-audio.json'),
    g = JSON.parse(raw.toString()),
    d = JSON.parse(readFileSync('docs/reference/leona-death-audio-decoded.json', 'utf8'));
  expect(g.events).toHaveLength(1);
  expect(g.nodes).toHaveLength(7);
  expect(g.media).toHaveLength(2);
  expect(g.events[0]).toMatchObject({
    name: 'Play_sfx_Leona_Death3D_cast',
    id: 1647906331,
    actions: [
      { id: 22612475, type: 'CAkActionPlay', target: 461770655, affectedMediaIds: [455387691] },
      { id: 148653763, type: 'CAkActionPlay', target: 267995038, affectedMediaIds: [558948421] },
    ],
  });
  expect(g.nodes.some((n: any) => n.type === 'CAkRanSeqCntr')).toBe(false);
  expect(g.extractionSha256).toBe(sha(readFileSync('docs/reference/leona-audio-extraction.json')));
  expect(g.referenceSha256).toBe(sha(readFileSync('docs/reference/leona-model.json')));
  expect(d.sourceGraphSha256).toBe(sha(raw));
  expect(g.unresolvedHierarchyIds).toEqual([2232828494]);
  expect(P.event.actionIds).toEqual([22612475, 148653763]);
  expect(
    [P.first, P.second].map((r) => [r.actionId, r.targetId, r.variants.map((v) => v.id)])
  ).toEqual([
    [22612475, 461770655, [455387691]],
    [148653763, 267995038, [558948421]],
  ]);
  for (const r of [P.first, P.second]) {
    expect(r).toMatchObject({
      gainDb: -10,
      pitchCents: 0,
      fadeInSeconds: 0,
      authoredProperties: { values: { MakeUpGain: -10 }, ranges: {} },
      policy: { u16MaxNumInstance: 4, bKillNewest: 0, bIgnoreParentMaxNumInst: 1 },
    });
    expect(r.variants).toHaveLength(1);
  }
  expect(P.first.playProperties).toEqual({ values: {}, ranges: {} });
  expect(P.second.playProperties).toEqual({ values: { DelayTime: 1750 }, ranges: {} });
  for (const prior of ['q', 'w', 'e', 'r', 'aa', 'sunlight']) {
    const old = JSON.parse(readFileSync(`docs/reference/leona-${prior}-audio.json`, 'utf8'));
    expect(
      g.media.some((m: any) => old.media.some((p: any) => p.id === m.id || p.sha256 === m.sha256))
    ).toBe(false);
  }
});

test('the delayed layer extends the finite bound to 338 ticks and preserves separate death attenuation and parent policy', () => {
  expect(P.first.delaySeconds).toBe(0);
  expect(P.second.delaySeconds).toBe(1.75);
  expect(LEONA_DEATH_AUDIO_TICKS).toBe(338);
  expect(LEONA_DEATH_AUDIO_TICKS).toBe(
    Math.ceil(
      Math.max(...[P.first, P.second].map((r) => r.delaySeconds + r.maxDurationSeconds)) * 60
    )
  );
  expect(LEONA_DEATH_AUDIO_TICKS).toBeGreaterThan(150);
  expect(P.parents).toHaveLength(1);
  expect(P.parents[0]).toMatchObject({
    id: 212757264,
    parentId: 0,
    authoredProperties: { values: { Priority: 55, AttenuationID: 687014649 }, ranges: {} },
  });
  expect(P.attenuation).toMatchObject({
    id: 687014649,
    scaling: 2,
    unresolvedOutputBusId: 2232828494,
  });
  expect(P.attenuation.points).toEqual(LEONA_AA_AUDIO.attenuation.points);
  expect(P.attenuation.id as number).not.toBe(LEONA_AA_AUDIO.attenuation.id);
  expect(P.stopAudit.actions).toHaveLength(5);
  expect(P.stopAudit.matchingTargets).toEqual([]);
});

test('both layered masters retain every float sample, full duration and independent PCM provenance', () => {
  const d = JSON.parse(readFileSync('docs/reference/leona-death-audio-decoded.json', 'utf8'));
  let bytes = 0,
    frames = 0,
    outside = 0;
  for (const r of [P.first, P.second])
    for (const v of r.variants) {
      expect(v.url).toBe(`assets/audio/leona-death-${v.id}.wav`);
      const raw = readFileSync('public/' + v.url);
      expect(sha(raw)).toBe(v.sha256);
      bytes += raw.length;
      frames += v.frames;
      let pcm: Buffer | undefined, fmt: Buffer | undefined;
      for (let i = 12; i < raw.length;) {
        const n = raw.readUInt32LE(i + 4),
          tag = raw.toString('ascii', i, i + 4);
        if (tag === 'data') pcm = raw.subarray(i + 8, i + 8 + n);
        if (tag === 'fmt ') fmt = raw.subarray(i + 8, i + 8 + n);
        i += 8 + n + (n % 2);
      }
      expect(fmt!.readUInt16LE(0)).toBe(3);
      expect(fmt!.readUInt16LE(14)).toBe(32);
      expect(pcm!.length).toBe(v.frames * 4);
      expect(sha(pcm!)).toBe(v.pcmSha256);
      const m = d.media.find((m: any) => m.id === v.id);
      expect(m.decoderMetadata.loopingInfo).toBeNull();
      outside += m.samplesOutsideUnitRange;
      expect(v.channels).toBe(1);
      expect(v.sampleRate).toBe(44100);
      expect(v.durationSeconds).toBe(v.frames / 44100);
    }
  expect(bytes).toBe(1325344);
  expect(frames).toBe(331314);
  expect(outside).toBe(0);
  expect(P.first.maxDurationSeconds).toBe(160378 / 44100);
  expect(P.second.maxDurationSeconds).toBe(170936 / 44100);
  expect(Math.max(P.first.variants[0].peak, P.second.variants[0].peak)).toBe(0.9752417802810669);
});
