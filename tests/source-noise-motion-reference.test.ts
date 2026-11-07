import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/source-noise-motion-samples.json';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
test('controlled noise trajectories pin the unmodified external integrator and independent producer', () => {
  expect(sha('docs/reference/source-noise-motion-samples.json')).toBe(
    '94ba38d53e0bd66695c0286837838b2158b09fc03c5d849fd68bc362d96aede2'
  );
  expect(sha('tools/qa/build-source-noise-motion-reference.mjs')).toBe(reference.producerSha256);
  expect(sha('tools/qa/source-noise-motion-reference.ts')).toBe(reference.entrySha256);
  expect(sha(reference.source.path)).toBe(reference.source.sha256);
  expect(reference.inputs).toHaveLength(16);
  expect(reference.trajectories).toHaveLength(24);
  expect(reference.trajectories.reduce((sum, t) => sum + t.rows.length, 0)).toBe(2880);
});
