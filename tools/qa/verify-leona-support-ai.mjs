/** Frozen local support pursuit correction and contact-history save acceptance. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledgerIndex = process.argv.indexOf('--ledger');
const ledger = json(
  ledgerIndex < 0
    ? 'docs/reference/leona/support-ai-verification.json'
    : process.argv[ledgerIndex + 1]
);
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(digest(row.archived), row.sha256, row.archived);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(row.file), row.sha256, row.file);
  byFile.set(row.file, row);
}
const key = (p) => {
  if (!isAbsolute(p)) return p;
  assert(p.startsWith(ledger.workspaceRoot + '/'), p);
  return p.slice(ledger.workspaceRoot.length + 1);
};
const frozen = (p) => {
    const r = byFile.get(key(p));
    assert(r, p);
    return r.archived;
  },
  data = (p) => json(frozen(p)),
  text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 130);
assert.match(text(ledger.checks.standard), /2054 passed \(2054\)/);
assert.match(text(ledger.checks.standard), /329 passed \(329\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.regression), /2 failed/);
assert.match(text(ledger.checks.contactRegression), /1 failed \| 1 passed/);
assert.match(text(ledger.checks.previousAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.previousAccepted), /"historical":true/);
const browser = data(ledger.checks.browser),
  movingBrowser = data(ledger.checks.movingBrowser);
for (const [report, count] of [
  [browser, 90],
  [movingBrowser, 1],
]) {
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.expected, count);
  for (const k of ['unexpected', 'skipped', 'flaky']) assert.equal(report.stats[k], 0);
}
const artifacts = (name) =>
  rows.filter(
    (r) =>
      r.file.startsWith('.cache/leona-support-ai-v1-20261025/') &&
      r.file.includes('/leona-support-ai-') &&
      r.file.endsWith('/' + name)
  );
const supportArtifacts = artifacts('support-ai.json').filter((r) =>
  r.file.includes('/browser-final/')
);
assert.equal(supportArtifacts.length, 2);
for (const row of supportArtifacts) {
  const r = data(row.file),
    p = r.prepared,
    c = r.restored;
  assert.deepEqual(r.errors, []);
  assert(p.sameObserver);
  assert.equal(p.snapshot, c.snapshot);
  assert.equal(p.future, c.future);
  assert.equal(p.role, 'support');
  assert.equal(p.champion, 'leona');
  assert.equal(p.battlefield, 'rift');
  assert(p.staging.length > 0);
  assert(p.adoptions.every((a) => a.inReach || a.held || a.allies.length > 0));
  const s = JSON.parse(p.snapshot);
  assert.equal(s.version, 130);
  assert.equal(s.ruleset, ledger.ruleset);
}
const movingArtifacts = artifacts('moving-contact.json').filter((r) =>
  r.file.includes('/browser-moving-final/')
);
assert.equal(movingArtifacts.length, 1);
const m = data(movingArtifacts[0].file),
  hit = m.prepared.impact;
assert.deepEqual(m.errors, []);
assert.equal(m.prepared.terrain, 'rift');
assert.equal(m.prepared.snapshot, m.restored.snapshot);
assert.equal(m.prepared.future, m.restored.future);
assert.deepEqual({ x: hit.contactFrame.x, y: hit.contactFrame.y }, hit.point);
assert.notDeepEqual({ x: hit.frames[0].x, y: hit.frames[0].y }, hit.point);
assert.equal(hit.contactFrame.tick, hit.tick);
assert(
  hit.contactFrame.animationTimeline.tick >= hit.tick - 1 &&
    hit.contactFrame.animationTimeline.tick <= hit.tick
);
assert.equal(hit.frames[0].animationTimeline.tick, hit.tick);
const failedRoot = ledger.checks.failedCorpus,
  failedPlan = data(failedRoot + '/plan.json'),
  failedSummary = data(failedRoot + '/summary.json'),
  failed = data(failedRoot + '/seeds/719/report.json');
assert.equal(failedSummary.status, 'completed');
assert.equal(failedSummary.failures, 1);
assert.equal(failedSummary.victories, 1);
assert.equal(failedSummary.active.length, 0);
assert.equal(failed.finalTick, 75600);
assert.equal(failed.outcome, 'failed');
assert.match(failed.failure.message, /invalid Leona ordinary attack history/);
const archive = data(ledger.checks.failedSourceArchive);
assert.equal(archive.ruleset, failedPlan.ruleset);
assert.equal(archive.files.length, failedPlan.sources.length);
for (const pin of failedPlan.sources) {
  const row = archive.files.find((r) => r.file === pin.file);
  assert(row, pin.file);
  assert.equal(row.bytes, pin.bytes);
  assert.equal(row.sha256, pin.sha256);
  assert.equal(digest(frozen(row.archived)), pin.sha256);
}
const normalize = (s) => {
  const t = structuredClone(s);
  delete t.version;
  delete t.ruleset;
  for (const o of [t.player, ...t.otherChampions])
    for (const r of o.leonaAAVisuals) if (r.impact) delete r.impact.contactFrame;
  return t;
};
const old = data(failed.finalPath),
  fixedAtFailure = data(ledger.checks.corpus + '/seeds/719/075600.match.json');
assert.equal(old.version, 129);
assert.equal(fixedAtFailure.version, 130);
assert.deepEqual(normalize(old), normalize(fixedAtFailure));
assert(data(ledger.checks.contactComparison).sameGameplayAtFailureClock);
const oldHit = old.player.leonaAAVisuals[0].impact;
assert.notDeepEqual(oldHit.point, { x: oldHit.frames[0].x, y: oldHit.frames[0].y });
const root = ledger.checks.corpus,
  plan = data(root + '/plan.json'),
  summary = data(root + '/summary.json');
assert.equal(plan.ruleset, ledger.ruleset);
assert.equal(plan.developmentLeona, true);
assert.equal(plan.qaAutomatedHumanRole, 'support');
assert.equal(plan.qaAutomatedHumanCarry, false);
assert.equal(plan.horizonTicks, 216000);
assert.deepEqual(plan.seeds, [26018, 719]);
assert.match(text(ledger.checks.corpusVerification), /"result":"passed"/);
for (const pin of [...plan.sources, ...plan.inputs, plan.runner]) {
  const row = byFile.get(key(pin.file));
  assert(row, pin.file);
  assert.equal(row.sha256, pin.sha256);
  assert.equal(row.bytes, pin.bytes);
}
assert.equal(summary.status, 'completed');
assert.equal(summary.completed, 2);
assert.equal(summary.victories, 2);
assert.equal(summary.failures, 0);
assert.equal(summary.unfinished, 0);
assert.equal(summary.active.length, 0);
assert.equal(summary.checkedTicks, 273583);
assert.equal(summary.roundTrips, 77);
assert.equal(summary.futureChecks, 75);
assert.equal(summary.futureCheckedTicks, 4500);
assert.equal(summary.hundredSeedInvariantGate, false);
assert.equal(summary.hundredSeedDevelopmentLeonaInvariantGate, false);
for (const seed of plan.seeds) {
  const r = data(root + `/seeds/${seed}/report.json`);
  assert.equal(r.failure, null);
  assert.equal(r.ruleset, ledger.ruleset);
  assert.equal(r.outcome, 'victory');
  assert.equal(r.winner, 'red');
  assert.equal(r.finalTick, seed === 26018 ? 130839 : 142744);
  assert.equal(r.checkedTicks, r.finalTick);
  for (const c of r.checkpoints) {
    const bytes = readFileSync(frozen(c.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), c.fileSha256);
    assert.equal(createHash('sha256').update(bytes.subarray(0, -1)).digest('hex'), c.stateSha256);
    const s = JSON.parse(bytes);
    assert.equal(s.version, 130);
    assert.equal(s.ruleset, ledger.ruleset);
    assert.equal(s.battlefield, 'rift');
    assert.equal(s.player.role, 'support');
    assert.equal(s.units.find((u) => u.id === s.player.id).champion, 'leona');
  }
  const final = data(r.finalPath);
  assert.equal(final.player.deaths, seed === 26018 ? 8 : 6);
  assert.equal(final.player.kills, 0);
  assert.equal(final.winner, 'red');
}
const comparison = data(ledger.checks.comparison);
assert.equal(comparison.rows.length, 2);
for (const row of comparison.rows) {
  for (const part of [row.before, row.after]) assert.equal(digest(frozen(part.path)), part.sha256);
  const before = row.before.metrics.find((m) => m.champion === 'leona'),
    after = row.after.metrics.find((m) => m.champion === 'leona');
  assert.equal(before.deaths, row.seed === 26018 ? 4 : 5);
  assert.equal(after.deaths, row.seed === 26018 ? 0 : 1);
  assert.equal(before.level, 4);
  assert.equal(after.level, row.seed === 26018 ? 5 : 6);
}
const production = text(ledger.checks.production)
  .trim()
  .split('\n')
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .findLast((r) => r?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.leonaPlayerFixtureInProduction, false);
assert.equal(production.leonaRiftTrialInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.bytes, ledger.packBytes);
assert.equal(manifest.files.length, 1060);
assert(offline.checks.serviceWorkerResponses > 0);
assert(
  Object.values(offline.checks)
    .filter((v) => typeof v === 'boolean')
    .every(Boolean)
);
assert.equal(
  createHash('sha256')
    .update(
      JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files })
    )
    .digest('hex'),
  manifest.id
);
for (const entry of manifest.files) {
  const row = byFile.get('dist/' + entry.path);
  assert(row, entry.path);
  assert.equal(row.sha256, entry.sha256);
  assert.equal(row.bytes, entry.bytes);
}
const assets = data(ledger.checks.assets);
assert.equal(assets.publicFiles, 1010);
assert.equal(assets.unchanged, 1010);
for (const k of ['added', 'modified', 'removed']) assert.deepEqual(assets[k], []);
for (const k of [
  'boundedPursuitCorrectionIntegrated',
  'movingContactHistoryIntegrated',
  'twoSeedFullMatchVerified',
])
  assert.equal(ledger.acceptance[k], true);
for (const k of [
  'hundredSeedGate',
  'supportRoleComplete',
  'nativeComparisonVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 2054,
    browserCases: 91,
    checkedTicks: 273583,
    roundTrips: 77,
    futureChecks: 75,
    gameplayUnchangedAtFailureClock: true,
    hundredSeedGate: false,
    schema: 130,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
