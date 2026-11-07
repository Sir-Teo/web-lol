import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import reference from '../docs/reference/source-noise-field-samples.json';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
test('noise fixtures retain their independent pinned external producer and native source identity', () => {
  expect(sha('docs/reference/source-noise-field-samples.json')).toBe(
    '92d964afd3f79012e771246ee7d366a868ca534bc42163d95d82f4e749e36109'
  );
  expect(sha('tools/qa/build-source-noise-field-reference.mjs')).toBe(reference.producerSha256);
  expect(sha('tools/qa/source-noise-field-reference.ts')).toBe(reference.entrySha256);
  expect(sha(reference.source.path)).toBe(reference.source.sha256);
  expect(reference.externalRevision).toBe('2adda384347dd43e76d6295d77fe1f13623b2808');
  expect(reference.clocks).toHaveLength(4);
  expect(reference.preparations).toHaveLength(24);
  expect(reference.impulses).toHaveLength(162);
  expect(reference.inputs).toHaveLength(8);
});
