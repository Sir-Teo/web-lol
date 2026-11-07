import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-layout-quad-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted layout-quad packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-layout-quad-packet-reference.json'))).toBe(
    'e1c0768d07118020f30562d30ca7e30a285a7a7be9d6421e5d93a84256abc5bd'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-layout-quad-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-layout-quad-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('f85b2455feebbe6860c13a466bbb924c731e62fd');
  expect(reference.ruleset).toBe(
    'f71c3f787f38e62d3b7dba290bb64de32da3fd7cae14e97f64e16e6853d03c6e'
  );
  expect(reference.verifiedArchiveFiles).toBe(696);
  expect(reference.samples).toHaveLength(42);
});
test.each(reference.samples)(
  'accepted layout quad seed=$seed time=$time stop=$stopSeconds retain their full packet',
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
    ).filter((p) => p.profileIndex === 50);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
