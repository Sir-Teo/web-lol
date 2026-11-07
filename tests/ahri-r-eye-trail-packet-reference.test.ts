import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-eye-trail-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted eye-trail packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-eye-trail-packet-reference.json'))).toBe(
    '4bf5b93268216ae918c7536b9bef67bddf1bedf80ac4c3de849218628cc84cc0'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-eye-trail-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-eye-trail-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('69a05a865069face8bcbc7826d02a87d1b80363e');
  expect(reference.ruleset).toBe(
    '0cbdb13a8ae7a5bdbd1ff2dba9d8798fa486c7a4f003a3fe14cba6eab32fe8c9'
  );
  expect(reference.verifiedArchiveFiles).toBe(696);
  expect(reference.samples).toHaveLength(54);
});
test.each(reference.samples)(
  'accepted eye trails seed=$seed time=$time stop=$stopSeconds retain their full packet',
  (sample) => {
    const particles = ahriRParticles(
      'Ahri_R_Eyes',
      sample.seed,
      sample.time,
      sample.stopSeconds ?? Infinity,
      {
        boundObjectSize: 100,
        root: (time) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
      }
    ).filter((p) => p.profileIndex === 47 || p.profileIndex === 48);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
