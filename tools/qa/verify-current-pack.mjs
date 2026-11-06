/** Audit the current build's complete bytes without rewriting historical receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function verifyCurrentPack(directory = 'dist', policyFile = 'tools/offline-worker.js') {
  const root = resolve(directory),
    policy = readFileSync(policyFile, 'utf8');
  const manifest = JSON.parse(readFileSync(resolve(root, 'offline-pack.json'), 'utf8'));
  assert.equal(manifest.format, 1, 'Unsupported pack format');
  assert(Array.isArray(manifest.files) && manifest.files.length, 'Empty/invalid pack');
  assert.equal(manifest.workerPolicySha256, digest(policy), 'Worker policy differs');
  const paths = new Set();
  let bytes = 0;
  for (const entry of manifest.files) {
    assert(
      typeof entry.path === 'string' &&
        entry.path &&
        !entry.path.includes('\\') &&
        entry.path.split('/').every((part) => part && part !== '.' && part !== '..') &&
        !entry.path.includes(':'),
      'Invalid pack path'
    );
    assert(!['offline-worker.js', 'offline-pack.json'].includes(entry.path), 'Reserved pack path');
    assert(!paths.has(entry.path), 'Duplicate pack path');
    paths.add(entry.path);
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0, 'Invalid file extent');
    assert(
      typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256),
      'Invalid file hash'
    );
    // Each component must be real: do not accept a symlinked parent or file.
    let component = root;
    for (const part of entry.path.split('/')) {
      component = resolve(component, part);
      assert(!lstatSync(component).isSymbolicLink(), 'Symlink in pack');
    }
    const raw = readFileSync(component);
    assert.equal(raw.length, entry.bytes, 'File extent differs: ' + entry.path);
    assert.equal(digest(raw), entry.sha256, 'File hash differs: ' + entry.path);
    bytes += raw.length;
    assert(Number.isSafeInteger(bytes), 'Pack extent overflow');
  }
  assert.equal(bytes, manifest.bytes, 'Total pack extent differs');
  assert.equal(
    manifest.id,
    digest(
      JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files })
    ),
    'Pack identity differs'
  );
  const walk = (folder, prefix = '') =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
      assert(!entry.isSymbolicLink(), 'Symlink in distribution');
      return entry.isDirectory()
        ? walk(resolve(folder, entry.name), prefix + entry.name + '/')
        : [prefix + entry.name];
    });
  assert.deepEqual(
    walk(root).sort(),
    [...paths, 'offline-pack.json', 'offline-worker.js'].sort(),
    'Distribution closure differs'
  );
  const marker = /\/\*__PACK__\*\/\s*null/g;
  assert.equal([...policy.matchAll(marker)].length, 1, 'Ambiguous worker pack marker');
  assert.equal(
    readFileSync(resolve(root, 'offline-worker.js'), 'utf8'),
    policy.replace(marker, JSON.stringify(manifest)),
    'Generated worker differs'
  );
  return {
    result: 'passed',
    pack: manifest.id,
    files: paths.size,
    bytes,
    workerPolicySha256: manifest.workerPolicySha256,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.length <= 3, 'Pass at most one distribution directory');
  console.log(JSON.stringify(verifyCurrentPack(process.argv[2])));
}
