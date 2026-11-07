import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-layout-base-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted layout-base packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-layout-base-packet-reference.json'))).toBe(
    'f9326ccd8c47c928c567e80fb07999c133f5c3865679d2458d83752d147e316f'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-layout-base-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-layout-base-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('d343a9f9221c7d46ce34f01010983db5dd84b86a');
  expect(reference.ruleset).toBe(
    'b71e747721c1c4a56c5d5773ca9b3b3c6b9c39ddcb46fadbb8214c381d0708a0'
  );
  expect(reference.verifiedArchiveFiles).toBe(698);
  expect(reference.samples).toHaveLength(72);
});
test.each(reference.samples)(
  'accepted layout base seed=$seed time=$time stop=$stopSeconds retain their full packet',
  (sample) => {
    const particles = ahriRParticles(
      'Ahri_R_Ready_tar',
      sample.seed,
      sample.time,
      sample.stopSeconds ?? Infinity,
      {
        boundObjectSize: 100,
        root: (time) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
      }
    ).filter((p) => p.profileIndex === 49);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
