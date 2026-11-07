import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-layout-mesh-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted layout-mesh packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-layout-mesh-packet-reference.json'))).toBe(
    '7c0d760180cb6305918f5e2f168902949f26ab1bacf01a6312260a4d7896ce2d'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-layout-mesh-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-layout-mesh-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('aabe05260691f94d800f6b6016148e9fea4d6717');
  expect(reference.ruleset).toBe(
    '943a706f9191ebc8f30b1ab10dc37668489f4f29631332a99a9ce7c60e3230ba'
  );
  expect(reference.verifiedArchiveFiles).toBe(698);
  expect(reference.samples).toHaveLength(216);
});
test.each(reference.samples)(
  'accepted layout mesh profile=$profile seed=$seed time=$time stop=$stopSeconds retain their full packet',
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
    ).filter((p) => p.profileIndex === sample.profile);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
