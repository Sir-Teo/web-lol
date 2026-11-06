import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyCurrentPack } from './verify-current-pack.mjs';
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'rift-pack-audit-'));
  try {
    mkdirSync(join(root, 'assets'));
    const policy = readFileSync('tools/offline-worker.js', 'utf8');
    writeFileSync(join(root, 'assets/clip.wav'), 'float master');
    const files = [{ path: 'assets/clip.wav', bytes: 12, sha256: hash('float master') }];
    const manifest = {
      format: 1,
      id: hash(JSON.stringify({ workerPolicySha256: hash(policy), files })),
      workerPolicySha256: hash(policy),
      bytes: 12,
      files,
    };
    const save = () => {
      writeFileSync(join(root, 'offline-pack.json'), JSON.stringify(manifest));
      writeFileSync(
        join(root, 'offline-worker.js'),
        policy.replace(/\/\*__PACK__\*\/\s*null/, JSON.stringify(manifest))
      );
    };
    save();
    run({ root, manifest, save });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('current pack verifier accepts an exact complete distribution', () =>
  fixture(({ root }) => {
    assert.equal(verifyCurrentPack(root).files, 1);
  }));
for (const [name, mutate] of [
  [
    'same-length corruption',
    ({ root }) => writeFileSync(join(root, 'assets/clip.wav'), 'changed data'),
  ],
  ['missing file', ({ root }) => rmSync(join(root, 'assets/clip.wav'))],
  ['unlisted file', ({ root }) => writeFileSync(join(root, 'extra.js'), '')],
  ['worker edit', ({ root }) => writeFileSync(join(root, 'offline-worker.js'), '// changed')],
  [
    'total extent',
    ({ manifest, save }) => {
      manifest.bytes++;
      save();
    },
  ],
  [
    'pack identity',
    ({ manifest, save }) => {
      manifest.id = '0'.repeat(64);
      save();
    },
  ],
  [
    'parent traversal',
    ({ manifest, save }) => {
      manifest.files[0].path = '../escape';
      save();
    },
  ],
  [
    'duplicate path',
    ({ manifest, save }) => {
      manifest.files.push(manifest.files[0]);
      save();
    },
  ],
  [
    'symlink master',
    ({ root }) => {
      rmSync(join(root, 'assets/clip.wav'));
      symlinkSync('/dev/null', join(root, 'assets/clip.wav'));
    },
  ],
])
  test(`current pack verifier rejects ${name}`, () =>
    fixture((data) => {
      mutate(data);
      assert.throws(() => verifyCurrentPack(data.root));
    }));
