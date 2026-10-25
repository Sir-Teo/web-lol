/** Verify the retained model preparation checkpoint; --historical uses frozen files. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledgerFile =
  option < 0 ? 'docs/reference/masteryi/model-verification.json' : process.argv[option + 1];
const ledger = JSON.parse(readFileSync(ledgerFile));
const digest = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(digest(readFileSync(ledger.sourceArchive)), ledger.sourceArchiveSha256);
const sources = JSON.parse(readFileSync(ledger.sourceArchive)).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  const b = readFileSync(row.archived);
  assert.equal(b.length, row.bytes, row.file);
  assert.equal(digest(b), row.sha256, row.file);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(readFileSync(row.file)), row.sha256, row.file);
  byFile.set(row.file, row);
}
if (!historical) {
  const current = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter((p) => p && p !== ledgerFile && existsSync(p) && lstatSync(p).isFile());
  assert.deepEqual([...new Set(current)].sort(), sources.map((r) => r.file).sort());
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const bytes = (file) => {
  assert(byFile.has(file), file);
  return readFileSync(byFile.get(file).archived);
};
const text = (file) => bytes(file).toString(),
  data = (file) => JSON.parse(text(file));
assert.equal(ledger.schema, 137);
assert.equal(ledger.ruleset, '5eb9fc897a3193c5a5d575afca7dc397dc987bbe8d8a47df35fadea1f4d0e29c');
const baselinePath = 'docs/reference/masteryi/verification.json';
assert.equal(
  digest(bytes(baselinePath)),
  '2775eb027ebacdbde0ebbb3fd866ba734a3f475ef45d2da6ed978d5bca3c262a'
);
const baseline = data(baselinePath);
assert.equal(digest(bytes(baseline.sourceArchive)), baseline.sourceArchiveSha256);
const priorSources = data(baseline.sourceArchive).files;
const coreFile = (p) =>
  p.startsWith('src/') ||
  (!p.includes('/') && /\.(ts|json|html)$/.test(p)) ||
  ['tools/offline-pack.ts', 'tools/offline-worker.js', 'tools/ruleset-fingerprint.ts'].includes(p);
const identities = (list) =>
  list
    .filter((r) => coreFile(r.file))
    .map((r) => [r.file, r.bytes, r.sha256])
    .sort((a, b) => a[0].localeCompare(b[0]));
assert.deepEqual(identities(sources), identities(priorSources));
const priorPublic = priorSources.filter((r) => r.file.startsWith('public/'));
assert.equal(priorPublic.length, 1015);
for (const row of priorPublic) {
  assert.equal(bytes(row.file).length, row.bytes);
  assert.equal(digest(bytes(row.file)), row.sha256, row.file);
}
const knownPublic = new Set(priorPublic.map((r) => r.file));
assert.deepEqual(
  sources
    .filter((r) => r.file.startsWith('public/') && !knownPublic.has(r.file))
    .map((r) => r.file)
    .sort(),
  ['public/assets/models/masteryi-base.glb', 'public/assets/models/masteryi-base.json']
);
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(pack.id, '531452e69c6d8f9ac4e34947761cdae19017a8f913c0776b410e624082047068');
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, 1067);
assert.equal(pack.bytes, 526570727);
for (const row of pack.files) {
  assert.equal(bytes('dist/' + row.path).length, row.bytes);
  assert.equal(digest(bytes('dist/' + row.path)), row.sha256);
}
const modelRoot = '.cache/masteryi-model-research-20261023',
  work = '.cache/masteryi-model-work-v1-20261025/';
const pinPath = 'docs/reference/masteryi-model.json';
assert.equal(
  digest(bytes(pinPath)),
  '4295bceeba96cfb15e006d392e7d0f3c480bb51bf8cff8872a9c39fc9873c7ce'
);
const pin = data(pinPath),
  metadata = data('public/assets/models/masteryi-base.json'),
  asset = bytes('public/assets/models/masteryi-base.glb');
assert.equal(asset.length, 6487088);
assert.equal(digest(asset), '7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc');
assert.equal(metadata.output.path, 'public/assets/models/masteryi-base.glb');
assert.equal(metadata.output.sha256, digest(asset));
assert.equal(metadata.definitionsSha256, digest(bytes(pinPath)));
assert.equal(metadata.triangles, 9144);
assert.equal(metadata.bones, 90);
assert.equal(metadata.clips.length, 47);
assert.equal(metadata.skinScale, 1.5);
assert.equal(metadata.unitScale, 0.015);
assert.equal(metadata.canonicalizedJointSlots, 13475);
assert.deepEqual(metadata.sources, pin.extraction.files);
for (const row of pin.extraction.files)
  for (const folder of ['archive', 'archive-reverified']) {
    const b = bytes(`${modelRoot}/${folder}/${row.path}`);
    assert.equal(b.length, row.bytes);
    assert.equal(digest(b), row.sha256);
  }
assert.equal(pin.extraction.files.length, 29);
assert.equal(new Set(Object.values(pin.atomicClips)).size, 24);
for (const clip of metadata.clips) {
  assert.equal(clip.source, pin.atomicClips[clip.state]);
  assert.equal(
    clip.name,
    clip.state.startsWith('{') ? `entry_${clip.state.slice(1, -1)}` : clip.state.toLowerCase()
  );
  assert(clip.durationSeconds > 0);
}
assert.equal(metadata.sourceQuaternionCorrections.length, 26);
metadata.sourceQuaternionCorrections.forEach((q, i) => {
  assert.equal(q.clip, 'spell3');
  assert.equal(q.bone, 'C_Buffbone_Glb_Center_Loc');
  assert.equal(q.key, i);
  assert.deepEqual(q.raw, [0, 0.8457037210464478, 0, 0]);
  assert.deepEqual(q.normalized, [0, 1, 0, 0]);
});
assert.deepEqual(metadata.acceptance, {
  developmentRigPrepared: true,
  nativeEquivalent: false,
  playableKit: false,
  productionRosterExpanded: false,
});
const key = data(work + 'public-key-audit-v2.json');
assert.equal(key.result, 'passed');
assert.equal(key.animations, 47);
assert.equal(key.channels, 12492);
assert.equal(key.keys, 899082);
assert.equal(key.correctedQuaternionKeys, 26);
assert.equal(key.source.bytes, metadata.rawConversion.bytes);
assert.equal(key.source.sha256, metadata.rawConversion.sha256);
assert.equal(digest(bytes(key.source.file)), key.source.sha256);
assert.equal(key.output.sha256, digest(asset));
assert.equal(key.verifier.sha256, digest(bytes('tools/assets/verify-masteryi-keys.mjs')));
assert.equal(key.geometryIndicesAndAttributesEqualAfterDeclaredConversion, true);
assert.equal(key.sourceNormalsPreserved, true);
assert.deepEqual(key.gltf, { errors: 0, warnings: 0 });
const comparison = data(work + 'pose-comparison.json');
assert.equal(comparison.samples, 141);
assert.equal(comparison.clips, 47);
assert.equal(comparison.changedVertexIndices.length, 6);
assert(comparison.maxNormalizedReferenceToExportErrorWorldUnits < 0.00002);
assert.equal(comparison.acceptance.nativeEquivalenceProven, false);
const inspection = data(work + 'candidate-inspection.json');
assert.equal(inspection.candidate.sha256, digest(asset));
assert.equal(inspection.sources.length, 29);
assert.equal(inspection.vertices, 5760);
assert.deepEqual(inspection.gltf, { errors: 0, warnings: 0 });
for (const mode of ['normal', 'optimized']) {
  assert.deepEqual(data(work + 'model-source-' + mode + '-v2.log'), {
    result: 'passed',
    files: 29,
    records: [2, 1],
    atomicClips: 47,
    uniqueAnimations: 24,
    nativeEquivalent: false,
  });
  assert.match(text(work + 'model-tests-' + mode + '.log'), /Ran 5 tests[\s\S]*OK/);
  assert.match(
    text(work + 'quaternion-bytes-' + mode + '.log'),
    /PASS: exact version3 source bytes, all26 literal float tuples/
  );
  assert.match(text(work + 'static-model-' + mode + '.log'), /PASS/);
}
assert.match(text(work + 'model-source-normal.log'), /Unexpected linked model BIN/);
const guards = data(work + 'converter-guards.json');
assert.equal(guards.tamperedSourceRejected, true);
assert.equal(guards.outputNotCreated, true);
assert.equal(guards.existingOutputRejected, true);
assert.equal(guards.originalAssetUnchanged, true);
assert.equal(guards.originalAssetSha256, digest(asset));
for (const name of ['rebuild.log', 'rebuild-v2.log'])
  assert.equal(data(work + name).sha256, digest(asset));
const modelAudit = '.cache/master-yi-model-static-review-v1-20261025/',
  byteAudit = '.cache/master-yi-model-quaternion-bytes-v1-20261025/';
assert.equal(
  digest(bytes(modelAudit + 'findings.json')),
  '8bc015f24972ee02edb7ceab652bc5d9b143283e98b0812ee59217d58f941ceb'
);
assert.equal(
  digest(bytes(byteAudit + 'findings.json')),
  'f6f9667a3e7f2a3eab3aa12c53e7b31d4ea6200a2ef8d913faa46f4c3d66dcf1'
);
const rawAudit = data(byteAudit + 'findings.json');
assert.equal(rawAudit.source.magic, 'r3d2anmd');
assert.equal(rawAudit.source.version, 3);
assert.equal(rawAudit.source.nonunitSamples.length, 26);
for (const row of [...data(modelAudit + 'inputs.json'), ...rawAudit.inputs]) {
  assert.equal(bytes(row.path).length, row.bytes);
  assert.equal(digest(bytes(row.path)), row.sha256, row.path);
}
const browser = data(ledger.checks.browser);
assert.deepEqual(
  [browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky],
  [49, 0, 0, 0]
);
const named = (suffix) => {
  const matches = rows.filter(
    (r) =>
      r.file.startsWith('.cache/masteryi-model-browser-v1-20261025/') &&
      r.file.endsWith('/' + suffix)
  );
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const review = data(named('masteryi-model.json'));
assert.equal(review.clips, 47);
assert.equal(review.poses.length, 141);
assert.equal(review.captures.length, 8);
assert.deepEqual(review.errors, []);
assert.equal(review.nativeEquivalent, false);
for (const pose of review.poses) {
  assert.equal(pose.bones, 90);
  assert.equal(pose.finite, true);
  assert.equal(pose.triangles, 9144);
  assert(
    pose.projectedCorners.every(
      (v) => Math.abs(v[0]) < 0.9 && Math.abs(v[1]) < 0.9 && v[2] > -1 && v[2] < 1
    )
  );
}
for (const capture of review.captures) {
  const s = capture.silhouette;
  assert(
    s.count > 100 && s.minX > 20 && s.minY > 20 && s.maxX < s.width - 20 && s.maxY < s.height - 20
  );
}
for (const name of [
  ...review.captures.map((c) => 'masteryi-' + c.name + '.png'),
  'masteryi-view-1.png',
  'masteryi-view-2.png',
  'masteryi-view-3.png',
]) {
  const png = bytes(named(name));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
assert.match(text(ledger.checks.unit), /338 passed \(338\)/);
assert.match(text(ledger.checks.unit), /2182 passed \(2182\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
assert.match(
  text('.cache/masteryi-model-assets-v1-20261025.log'),
  /garen-aa-garen_base_q_sidewall.json/
);
const assets = text(ledger.checks.assets);
assert.equal(
  [...assets.matchAll(/public\/assets\/models\/[^\n]+: 0 errors, 0 warnings;/g)].length,
  74
);
assert.match(assets, /masteryi-base.glb: 0 errors, 0 warnings; 47 animations, 9144 triangles/);
assert.match(assets, /Map: 0 errors, 0 warnings;/);
const production = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const v = JSON.parse(line);
      return v.result === 'passed' ? [v] : [];
    } catch {
      return [];
    }
  });
assert.equal(production.length, 1);
assert.equal(production[0].recordings, 32);
assert.equal(production[0].developmentHook, false);
assert.equal(production[0].unrequestedMasterYiPreloads, 0);
assert.equal(production[0].unrequestedAhriPreloads, 0);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(offline.checks.serviceWorkerResponses, 963);
for (const flag of Object.values(offline.checks))
  if (typeof flag === 'boolean') assert.equal(flag, true);
assert.deepEqual(data(work + 'public-identity.json'), {
  baseline: 1015,
  unchanged: 1015,
  current: 1017,
  changed: [],
  added: ['public/assets/models/masteryi-base.glb', 'public/assets/models/masteryi-base.json'],
});
assert.deepEqual(ledger.acceptance, {
  developmentRigPrepared: true,
  exactSourceRebuildVerified: true,
  allAnimationKeysPreserved: true,
  isolatedBrowserReviewVerified: true,
  sampledBrowserPoses: 141,
  modelRuntimeIntegrated: false,
  nativeQuaternionMagnitudeVerified: false,
  nativeBehaviorVerified: false,
  nativePresentationVerified: false,
  productionRosterExpanded: false,
  fullMasterYiKit: false,
  fullPerformanceGate: false,
  fullProjectComplete: false,
});
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
    sources: sources.length,
    generated: ledger.generated.length,
    evidence: ledger.evidence.length,
    clips: 47,
    animationKeys: 899082,
    browserPoses: 141,
    browserCases: 49,
    assets: 74,
    developmentRigPrepared: true,
    modelRuntimeIntegrated: false,
    nativePresentationVerified: false,
    fullProjectComplete: false,
  })
);
