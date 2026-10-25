/** Verify the retained character-only checkpoint; --historical uses frozen files. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledgerFile =
  option < 0 ? 'docs/reference/masteryi/verification.json' : process.argv[option + 1];
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
const baselinePath = 'docs/reference/ahri/player-verification.json';
assert.equal(
  digest(bytes(baselinePath)),
  'a0776b6c8d86b5357fcce7f86ddeabf4e148aa96715b5ce2a3fc38360b47f5d2'
);
const baseline = data(baselinePath);
assert.equal(digest(bytes(baseline.sourceArchive)), baseline.sourceArchiveSha256);
const baselineSources = data(baseline.sourceArchive).files;
const runtimeFile = (p) =>
  p.startsWith('src/') ||
  p.startsWith('public/') ||
  (!p.includes('/') && /\.(ts|json|html)$/.test(p)) ||
  ['tools/offline-pack.ts', 'tools/offline-worker.js', 'tools/ruleset-fingerprint.ts'].includes(p);
const runtime = sources
  .filter((r) => runtimeFile(r.file))
  .sort((a, b) => a.file.localeCompare(b.file));
const prior = baselineSources
  .filter((r) => runtimeFile(r.file))
  .sort((a, b) => a.file.localeCompare(b.file));
assert.deepEqual(
  runtime.map((r) => [r.file, r.bytes, r.sha256]),
  prior.map((r) => [r.file, r.bytes, r.sha256])
);
assert.equal(runtime.length, 1590);
assert.equal(runtime.filter((r) => r.file.startsWith('public/')).length, 1015);
assert.deepEqual(
  ledger.generated.map((r) => [r.file, r.bytes, r.sha256]),
  baseline.generated.map((r) => [r.file, r.bytes, r.sha256])
);
assert.equal(ledger.pack, baseline.pack);
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, 1065);
assert.equal(pack.bytes, 520057332);
for (const row of pack.files) {
  assert.equal(bytes('dist/' + row.path).length, row.bytes);
  assert.equal(digest(bytes('dist/' + row.path)), row.sha256);
}
const declarations = data('docs/reference/masteryi/declarations.json');
assert.equal(declarations.sourceRecordCount, 60);
assert.equal(declarations.stats.length, 18);
assert.deepEqual(
  declarations.stats
    .filter((r) => !r.agreesWithinFloat32Tolerance)
    .map((r) => [r.name, r.sourceValue, r.dataDragonValue]),
  [['damageGrowth', 2.5, 0]]
);
const spells = declarations.spells;
assert.deepEqual(
  spells.map((s) => [s.id, s.maxRanks]),
  [
    ['AlphaStrike', 5],
    ['Meditate', 5],
    ['WujuStyle', 5],
    ['Highlander', 3],
  ]
);
assert.equal(
  spells.reduce((n, s) => n + s.calculationLinks.length, 0),
  23
);
for (const [index, field, client] of [
  [1, 'cooldownTime', [10, 10, 10, 10, 10]],
  [2, 'mana', [0, 0, 0, 0, 0]],
]) {
  const r = spells[index].rankArrays[field];
  assert.equal(r.present, false);
  assert.equal(r.rankValues, null);
  assert.equal(r.agreesWithinExactNumericComparison, null);
  assert.deepEqual(r.dataDragonValues, client);
  assert(!Object.hasOwn(spells[index].declaration, field));
}
assert(!Object.hasOwn(spells[3].declaration, 'mSpellCalculations'));
assert.equal(declarations.unboundReposition.record, '{6ae04a15}');
assert.deepEqual(declarations.acceptance, {
  playable: false,
  productionRosterExpanded: false,
  fullKit: false,
  modelAccepted: false,
  nativeBehaviorVerified: false,
  runtimePolicyGenerated: false,
});
for (const row of declarations.inputs) {
  const b = bytes('docs/reference/masteryi/' + row.file);
  assert.equal(b.length, row.bytes);
  assert.equal(digest(b), row.sha256);
}
const pin = data('docs/reference/masteryi/character.json');
assert.equal(Object.keys(pin.records).length, 61);
assert.deepEqual(pin.records.__linked, []);
assert.deepEqual(pin.records, data('docs/reference/masteryi/names.json'));
const raw = bytes('docs/reference/masteryi/character.bin');
assert.equal(raw.length, 27930);
assert.equal(digest(raw), 'a4e05e2f6eee68116478fd56893ee320ac4955645d45e887860c88e67e4547f1');
assert.equal(
  pin.extraction.manifest.sha256,
  '564984ff169e7554607cae96d3cdca7812dfc5978736e889f347def39142a0cb'
);
assert.equal(pin.extraction.archive, 'DATA/FINAL/Champions/MasterYi.wad.client');
const work = '.cache/masteryi-character-work-v1-20261025/';
assert.equal(data(work + 'previous-stage-identity.json').verified, 17);
for (const mode of ['normal', 'optimized']) {
  assert.match(
    text(work + 'export-' + mode + '.log'),
    /60 records, 18 stat comparisons, four spell rank tables/
  );
  assert.match(text(work + 'verify-' + mode + '.log'), /complete 60-record MasterYi closure/);
  assert.match(text(work + 'tests-' + mode + '.log'), /Ran 9 tests[\s\S]*OK/);
  assert.match(
    text(work + 'independent-' + mode + '.log'),
    /PASS MasterYi character:60typedrecords\/27930B,exact95451Bdecode/
  );
}
const auditPath = '.cache/master-yi-character-static-review-v1-20261025/';
assert.equal(
  digest(bytes(auditPath + 'findings.json')),
  '2ceb1055e3d5e63c9dd744c0197dde31932429f74aba918501e1b100345b83d2'
);
assert.equal(
  digest(bytes(auditPath + 'check.py')),
  '0febf7336bb3f160f2e9a8f85353d51c623e6c53c2ca7c1ec955dc0e447832fe'
);
const audit = data(auditPath + 'findings.json');
assert.equal(audit.parserObservation.recordsCompared, 60);
assert.equal(audit.parserObservation.strictTypesCompared.booleans, 99);
assert.equal(
  audit.spells.reduce((n, s) => n + s.calculationLinks.length, 0),
  23
);
assert.match(text(ledger.checks.unit), /338 passed \(338\)/);
assert.match(text(ledger.checks.unit), /2182 passed \(2182\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
assert.equal(ledger.checks.reusedApplicationEvidence, true);
const browser = data(baseline.checks.browser);
assert.deepEqual(
  [browser.stats.expected, browser.stats.unexpected, browser.stats.flaky, browser.stats.skipped],
  [48, 0, 0, 0]
);
assert.equal(data(baseline.checks.offline).result, 'passed');
assert.match(text(baseline.checks.production), /"ahriPlayerFixtureInProduction":false/);
assert.deepEqual(ledger.acceptance, {
  completeCharacterReference: true,
  completeRecordReparse: true,
  rankedDeclarationProjection: true,
  independentSourceAudit: true,
  unchangedRuntime: true,
  modelAccepted: false,
  playable: false,
  productionRosterExpanded: false,
  nativeBehaviorVerified: false,
  fullKit: false,
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
    characterRecords: 60,
    statComparisons: 18,
    calculationLinks: 23,
    pythonTestsPerMode: 9,
    unitTests: 2182,
    reusedApplicationEvidence: true,
    modelAccepted: false,
    playable: false,
    fullProjectComplete: false,
  })
);
