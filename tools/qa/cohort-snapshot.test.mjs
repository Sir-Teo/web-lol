import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  readCohortSnapshot,
  writeCohortSnapshot,
  snapshotEncoding,
} from './lib/cohort-snapshot.ts';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const raw = JSON.stringify({
  tick: 3600,
  name: 'α 🦊',
  values: [0.10000000149011612, 1e-12],
  history: Array.from({ length: 120 }, (_, tick) => ({ tick, point: { x: tick * 0.3, y: 42 } })),
});
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'cohort-snapshot-'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('plain and gzip retain identical state bytes and hashes, with deterministic gzip output', () =>
  fixture((root) => {
    const plain = writeCohortSnapshot(join(root, 'plain.match.json'), raw, 'none');
    const gzip = writeCohortSnapshot(join(root, 'packed.match.json'), raw, 'gzip');
    const second = writeCohortSnapshot(join(root, 'second.match.json'), raw, 'gzip');
    assert.equal(plain.stateSha256, gzip.stateSha256);
    assert.equal(plain.fileSha256, sha(raw + '\n'));
    assert.deepEqual(readFileSync(gzip.path), readFileSync(second.path));
    assert(gzip.storedBytes < gzip.uncompressedBytes);
    assert.equal(readCohortSnapshot(plain).raw, raw);
    assert.equal(readCohortSnapshot(gzip, 'gzip').raw, raw);
    assert.deepEqual(readCohortSnapshot(plain).bytes, readCohortSnapshot(gzip, 'gzip').bytes);
  }));
test('historical plain checkpoint and final descriptors remain readable', () =>
  fixture((root) => {
    const plain = writeCohortSnapshot(join(root, 'old.match.json'), raw, 'none');
    assert.equal(
      readCohortSnapshot({
        path: plain.path,
        stateSha256: plain.stateSha256,
        fileSha256: plain.fileSha256,
      }).raw,
      raw
    );
    assert.equal(readCohortSnapshot({ path: plain.path, stateSha256: plain.stateSha256 }).raw, raw);
  }));
test('fresh evidence paths never overwrite an existing checkpoint', () =>
  fixture((root) => {
    const first = writeCohortSnapshot(join(root, 'save.match.json'), raw, 'gzip');
    const before = readFileSync(first.path);
    assert.throws(
      () => writeCohortSnapshot(join(root, 'save.match.json'), 'different', 'gzip'),
      /EEXIST/
    );
    assert.deepEqual(readFileSync(first.path), before);
  }));
test('compressed bytes, state hashes, extents and encoding cannot silently drift', () =>
  fixture((root) => {
    const record = writeCohortSnapshot(join(root, 'save.match.json'), raw, 'gzip');
    assert.throws(() => readCohortSnapshot(record), /encoding differs/);
    assert.throws(
      () => readCohortSnapshot({ ...record, stateSha256: '0'.repeat(64) }, 'gzip'),
      /state hash/
    );
    assert.throws(() =>
      readCohortSnapshot({ ...record, uncompressedBytes: record.uncompressedBytes - 1 }, 'gzip')
    );
    assert.throws(() =>
      readCohortSnapshot({ ...record, storedBytes: record.storedBytes + 1 }, 'gzip')
    );
    assert.throws(
      () => readCohortSnapshot({ ...record, fileSha256: undefined }, 'gzip'),
      /needs a stored hash/
    );
    const changed = readFileSync(record.path);
    changed[changed.length - 5] ^= 1;
    writeFileSync(record.path, changed);
    assert.throws(() => readCohortSnapshot(record, 'gzip'), /stored hash/);
    assert.throws(() => readCohortSnapshot({ ...record, fileSha256: sha(changed) }, 'gzip'));
  }));
test('unknown compression and mislabeled plaintext are rejected', () =>
  fixture((root) => {
    assert.throws(() => snapshotEncoding('zip'));
    const plain = writeCohortSnapshot(join(root, 'plain.match.json'), raw, 'none');
    assert.throws(() => readCohortSnapshot({ ...plain, encoding: 'gzip' }, 'gzip'), /filename/);
  }));
