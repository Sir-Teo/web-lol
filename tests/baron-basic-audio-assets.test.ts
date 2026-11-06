import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BARON_BASIC_AUDIO as P,
  BARON_BASIC_ATTENUATION as A,
} from '../src/content/baron-basic-audio';

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const masters = JSON.parse(readFileSync('docs/reference/baron-basic-audio-decoded.json', 'utf8'));

describe('Baron candidate source audio export', () => {
  it('retains action probability, delay and the independent pitch range', () => {
    expect(
      P.map((p) => [
        p.actionId,
        p.delaySeconds,
        p.probability,
        p.gainDb,
        p.pitchCents,
        [...p.pitchRangeCents],
      ])
    ).toEqual([
      [368143698, 0.2, 1, -14, 0, [0, 0]],
      [309000490, 0, 0.35, -14, 0, [0, 0]],
      [700850838, 0, 1, -12, 0, [-500, 500]],
    ]);
    expect(A).toEqual([
      { distance: 0, storedValue: 0, interpolation: 9 },
      { distance: 1175.3731689453125, storedValue: 0, interpolation: 2 },
      { distance: 2100, storedValue: -1, interpolation: 4 },
    ]);
  });
  for (const clip of P.flatMap((p) => [...p.variants]))
    it(`preserves float master ${clip.id} including over-unity samples`, () => {
      const raw = readFileSync('public/' + clip.url);
      const master = masters.media.find((m: { id: number }) => m.id === clip.id);
      expect(hash(raw)).toBe(clip.sha256);
      expect(clip.sha256).toBe(master.wavSha256);
      expect(raw.length).toBe(master.wavBytes);
      const chunks = new Map<string, Buffer>();
      for (let cursor = 12; cursor < raw.length;) {
        const size = raw.readUInt32LE(cursor + 4);
        chunks.set(
          raw.toString('ascii', cursor, cursor + 4),
          raw.subarray(cursor + 8, cursor + 8 + size)
        );
        cursor += 8 + size + (size % 2);
      }
      const fmt = chunks.get('fmt ')!,
        pcm = chunks.get('data')!;
      expect([
        fmt.readUInt16LE(0),
        fmt.readUInt16LE(2),
        fmt.readUInt32LE(4),
        fmt.readUInt16LE(14),
      ]).toEqual([3, 1, 44100, 32]);
      expect(pcm.length).toBe(clip.frames * 4);
      expect(hash(pcm)).toBe(master.pcmSha256);
      let peak = 0,
        outside = 0;
      for (let offset = 0; offset < pcm.length; offset += 4) {
        const sample = pcm.readFloatLE(offset);
        expect(Number.isFinite(sample)).toBe(true);
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) > 1) outside++;
      }
      expect(peak).toBe(clip.peak);
      expect(outside).toBe(master.samplesOutsideUnitRange);
    });
});
