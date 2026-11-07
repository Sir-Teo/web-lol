import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/ahri/r-eye-glow-packet-reference.json';
import { ahriRParticles } from '../src/render/ahri-r-particles';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('the accepted eye-glow packet reference preserves its frozen producer and archive identity', () => {
  expect(sha(readFileSync('docs/reference/ahri/r-eye-glow-packet-reference.json'))).toBe(
    'a406edefb6230922257a27d01f12144dbb5d604b34dffe2ee178b13fd353cb67'
  );
  expect(sha(readFileSync('tools/qa/build-ahri-r-eye-glow-packet-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(sha(readFileSync('tools/qa/ahri-r-eye-glow-packet-reference.ts'))).toBe(
    reference.entrySha256
  );
  expect(reference.applicationRevision).toBe('c5ab62306895bb20fb3940b2f546239829f8c8fa');
  expect(reference.ruleset).toBe(
    '186133424c3e28265877ba008d887874ddfc6da10edf515e83bc2a0cf4f5f7d2'
  );
  expect(reference.verifiedArchiveFiles).toBe(693);
  expect(reference.samples).toHaveLength(36);
});
test.each(reference.samples)(
  'accepted eye glows seed=$seed time=$time stop=$stopSeconds retain their full packet',
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
    ).filter((p) => p.profileIndex === 45 || p.profileIndex === 46);
    expect(particles).toHaveLength(sample.count);
    expect(sha(JSON.stringify(particles))).toBe(sample.sha256);
  }
);
