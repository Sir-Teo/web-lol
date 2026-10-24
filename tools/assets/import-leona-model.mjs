/** Import the retained source-key candidate without rewriting its GLB bytes. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const check = process.argv.includes('--check');
const source = '.cache/leona-model-research-20261023';
const target = 'public/assets/models/leona-base.glb';
const digest = '5b845c3ba98ca15fdf61bb3eb549d54b858709c051c3c03f1cb26f76c890e5a9';
const bytes = 6253628;
const hash = (b) => createHash('sha256').update(b).digest('hex');
if (!check) {
  const candidate = `${source}/browser-model-preserved-keys/leona-base.glb`;
  const raw = readFileSync(candidate);
  assert.equal(hash(raw), digest);
  assert.equal(raw.length, bytes);
  const meta = JSON.parse(readFileSync(`${source}/browser-model-preserved-keys/leona-base.json`));
  const audit = JSON.parse(readFileSync(`${source}/preserved-key-audit.json`));
  assert.equal(audit.result, 'passed');
  assert.equal(audit.keys, 608016);
  assert.equal(audit.correctedQuaternionKeys, 0);
  assert.equal(audit.sourceNormalsPreserved, true);
  assert.equal(meta.clips.length, 23);
  if (existsSync(target)) assert.equal(hash(readFileSync(target)), digest);
  else copyFileSync(candidate, target);
  meta.output.path = target;
  meta.status =
    'Development source rig. Key-preserving import; native shading, animation dispatch and full spell presentation remain open.';
  meta.importedCandidate = { file: candidate, bytes, sha256: digest };
  writeFileSync(target.replace('.glb', '.json'), JSON.stringify(meta, null, 2) + '\n');
  copyFileSync(`${source}/model-pin.json`, 'docs/reference/leona-model.json');
}
const raw = readFileSync(target),
  meta = JSON.parse(readFileSync(target.replace('.glb', '.json')));
assert.equal(hash(raw), digest);
assert.equal(raw.length, bytes);
assert.equal(meta.output.path, target);
assert.equal(meta.output.sha256, digest);
assert.equal(meta.output.bytes, bytes);
assert.equal(meta.clips.length, 23);
assert.deepEqual(meta.sourceQuaternionCorrections, []);
console.log(
  JSON.stringify({
    result: 'passed',
    bytes,
    sha256: digest,
    clips: 23,
    sourceKeys: 608016,
    nativePresentationVerified: false,
  })
);
