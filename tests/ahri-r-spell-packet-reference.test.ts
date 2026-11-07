import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-spell-packet-reference.json';
import { ahriRParticles, type AhriRSystem } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the spell-packet baseline retains its verified accepted-archive producer and bytes', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-spell-packet-reference.json'))).toBe(
    '297ee009b2bb66257c5ba2afbfe4f9c6d1853f5277330186fca10cda506dd1ed'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-spell-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-spell-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.sourceRevision).toBe('a7092caa82f751cc1eb6064bd795cd7309b480c5');
  expect(reference.ruleset).toBe(
    'a68ca14b74c144ccb6b0d183f2d41395403a8defa0ae514756463c369f46b90d'
  );
  expect(reference.verifiedArchiveFiles).toBe(690);
  expect(reference.samples).toHaveLength(72);
});
test.each(reference.samples)(
  'accepted $system seed=$seed time=$time stop=$stopSeconds full packet',
  (sample) => {
    const particles = ahriRParticles(
      sample.system as AhriRSystem,
      sample.seed,
      sample.time,
      sample.stopSeconds ?? Infinity,
      {
        boundObjectSize: 100,
        root: (time) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
      }
    );
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
