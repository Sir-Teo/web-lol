import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-layout-glow-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted layout-glow packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-layout-glow-packet-reference.json'))).toBe(
    'a7f01efd87f5ee834a7ea8fd9711c62e426392cd74c3687e9e55d7c85573f954'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-layout-glow-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-layout-glow-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('e27cc4c46998d016c890dbeaef43fc2b970e8aaa');
  expect(reference.ruleset).toBe(
    'bf6953c524b116f399a8a38b6b29cdbab23c3ccb2228774001f09aae0b681076'
  );
  expect(reference.verifiedArchiveFiles).toBe(697);
  expect(reference.samples).toHaveLength(54);
});
test.each(reference.samples)(
  'accepted layout glow seed=$seed time=$time stop=$stopSeconds retain their full packet',
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
    ).filter((p) => p.profileIndex === 53);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
