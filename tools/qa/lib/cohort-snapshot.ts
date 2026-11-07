import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

export type SnapshotEncoding = 'none' | 'gzip';
export interface SnapshotRecord {
  path: string;
  stateSha256: string;
  fileSha256?: string;
  encoding?: SnapshotEncoding;
  uncompressedBytes?: number;
  storedBytes?: number;
}
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function snapshotEncoding(value: unknown): SnapshotEncoding {
  if (value !== 'none' && value !== 'gzip') throw Error('Use snapshot compression none or gzip');
  return value;
}
/** Optional transport only. State bytes, their single appended delimiter and the
 * state hash are identical to the existing plain checkpoint convention. */
export function writeCohortSnapshot(basePath: string, raw: string, encoding: SnapshotEncoding) {
  snapshotEncoding(encoding);
  assert(basePath.endsWith('.match.json'), 'Expected a match snapshot base path');
  assert.equal(typeof raw, 'string');
  const decoded = Buffer.from(raw + '\n');
  const stored = encoding === 'gzip' ? gzipSync(decoded, { level: 6 }) : decoded;
  const path = basePath + (encoding === 'gzip' ? '.gz' : '');
  writeFileSync(path, stored, { flag: 'wx' });
  return {
    path,
    stateSha256: hash(raw),
    fileSha256: hash(stored),
    encoding,
    uncompressedBytes: decoded.length,
    storedBytes: stored.length,
  };
}
/** Verifies storage before decoding and the complete original state afterward.
 * Older plain final records may omit their file hash; gzip records cannot. */
export function readCohortSnapshot(record: SnapshotRecord, expected: SnapshotEncoding = 'none') {
  snapshotEncoding(expected);
  const encoding = snapshotEncoding(record.encoding ?? 'none');
  assert.equal(encoding, expected, 'Snapshot encoding differs from frozen plan');
  assert(
    record.path.endsWith(encoding === 'gzip' ? '.match.json.gz' : '.match.json'),
    'Snapshot filename differs from encoding'
  );
  assert.match(record.stateSha256, /^[0-9a-f]{64}$/);
  const stored = readFileSync(record.path);
  if (record.fileSha256 !== undefined) {
    assert.match(record.fileSha256, /^[0-9a-f]{64}$/);
    assert.equal(hash(stored), record.fileSha256, 'Snapshot stored hash mismatch');
  }
  if (record.storedBytes !== undefined) assert.equal(stored.length, record.storedBytes);
  let decoded = stored;
  if (encoding === 'gzip') {
    assert(record.fileSha256, 'Compressed snapshot needs a stored hash');
    assert(
      Number.isSafeInteger(record.uncompressedBytes) && record.uncompressedBytes! > 0,
      'Compressed snapshot needs its decoded extent'
    );
    assert(
      Number.isSafeInteger(record.storedBytes) && record.storedBytes! > 0,
      'Compressed snapshot needs its stored extent'
    );
    decoded = gunzipSync(stored, { maxOutputLength: record.uncompressedBytes });
  }
  if (record.uncompressedBytes !== undefined)
    assert.equal(decoded.length, record.uncompressedBytes);
  assert.equal(decoded.at(-1), 10, 'Snapshot delimiter missing');
  const state = decoded.subarray(0, -1);
  assert.equal(hash(state), record.stateSha256, 'Snapshot state hash mismatch');
  return { raw: state.toString('utf8'), bytes: decoded, storedBytes: stored.length };
}
