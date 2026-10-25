/** Frozen Ahri player evidence; --historical verifies its retained checkpoint. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(
    option < 0 ? 'docs/reference/ahri/player-verification.json' : process.argv[option + 1]
  )
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(digest(readFileSync(ledger.sourceArchive)), ledger.sourceArchiveSha256);
const sources = JSON.parse(readFileSync(ledger.sourceArchive)).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  const bytes = readFileSync(row.archived);
  assert.equal(bytes.length, row.bytes, row.file);
  assert.equal(digest(bytes), row.sha256, row.file);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(readFileSync(row.file)), row.sha256, row.file);
  byFile.set(row.file, row);
}
const bytes = (file) => {
  assert(byFile.has(file), file);
  return readFileSync(byFile.get(file).archived);
};
const text = (file) => bytes(file).toString();
const data = (file) => JSON.parse(text(file));
assert.equal(ledger.schema, 137);
assert.equal(ledger.ruleset, '5eb9fc897a3193c5a5d575afca7dc397dc987bbe8d8a47df35fadea1f4d0e29c');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 137;/);
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, ledger.packFiles);
assert.equal(pack.bytes, ledger.packBytes);
assert.equal(
  pack.files.reduce((sum, row) => sum + row.bytes, 0),
  pack.bytes
);
for (const row of pack.files) {
  assert.equal(bytes(`dist/${row.path}`).length, row.bytes);
  assert.equal(digest(bytes(`dist/${row.path}`)), row.sha256);
}
assert.match(text(ledger.checks.unit), /338 passed \(338\)/);
assert.match(text(ledger.checks.unit), /2182 passed \(2182\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.expected, 48);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const named = (suffix) => {
  const matches = rows.filter(
    (row) =>
      row.file.startsWith('.cache/ahri-player-browser-v2-20261025/') &&
      row.file.endsWith('/' + suffix)
  );
  assert.equal(matches.length, 1, suffix);
  return matches[0].file;
};
const q = data(named('ahri-player-q.json'));
assert.deepEqual(q.initial, {
  champion: 'ahri',
  mana: 418,
  damage: 53,
  context: true,
  serializedContext: null,
});
assert.deepEqual(
  q.icons.map((i) => i.src),
  [
    'assets/icons/AhriQ.png',
    'assets/icons/AhriW.png',
    'assets/icons/AhriE.png',
    'assets/icons/AhriR.png',
  ]
);
assert(q.icons.every((i) => i.loaded));
assert.deepEqual(q.held, { mode: 'q', pending: null, cooldown: 0 });
assert.equal(q.accepted.cast.ability, 'q');
assert.equal(q.accepted.clip, 'spell1');
assert.equal(q.accepted.focus, 0);
assert.equal(q.accepted.hawkshot, 0);
assert.deepEqual(q.errors, []);
const controls = data(named('ahri-player-controls.json'));
assert.deepEqual(controls.wCast, { mode: null, fires: 3, clip: 'spell2' });
assert.equal(controls.eCast.cast.ability, 'e');
assert.equal(controls.eCast.clip, 'spell3_north');
assert.equal(controls.first.clip, 'spell4');
assert.equal(controls.first.rush.remainingCasts, 2);
assert.equal(controls.restored.rush.remainingCasts, 2);
assert.equal(controls.restored.rush.bursts.length, 2);
assert.equal(controls.restored.rush.resets.length, 1);
assert.equal(controls.restored.counter.stacks, 8);
assert.equal(controls.restored.cooldown, controls.first.cooldown);
for (const phase of ['q-windup', 'r-reset']) {
  const r = data(named('ahri-player-' + phase + '-reload.json'));
  assert.equal(r.phase, phase);
  assert.equal(r.expected.saved, r.result.saved);
  assert.equal(r.expected.future, r.result.future);
  assert.equal(r.result.champion, 'ahri');
  assert.equal(r.result.paused, true);
  assert.equal(r.expected.pending, phase === 'q-windup' ? 'q' : null);
  if (phase === 'r-reset') {
    assert.equal(r.expected.rush.remainingCasts, 3);
    assert.equal(r.expected.rush.resets.length, 1);
  }
}
const isolation = data(named('ahri-player-save-isolation.json'));
assert.equal(isolation.ordinary, isolation.normalRestored);
assert.equal(isolation.privateSaved, isolation.privateRestored);
assert.equal(isolation.restarted.champion, 'ahri');
assert.equal(isolation.restarted.gold, 500);
assert.deepEqual(isolation.restarted.ranks, { q: 0, w: 0, e: 0, r: 0 });
assert.equal(isolation.restarted.counter.stacks, 0);
assert.deepEqual(data(named('ahri-player-imports.json')), {
  privateRejectsAshe: true,
  ownLoadExact: true,
  ordinaryRejectsAhri: true,
  currentStatePreserved: true,
});
for (const name of [
  'ahri-player-q-aim.png',
  'ahri-player-r-aim.png',
  'ahri-player-resources.png',
]) {
  const png = bytes(named(name));
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 1440);
  assert.equal(png.readUInt32BE(20), 900);
}
const before = data(ledger.checks.firstBrowserBefore),
  after = data(ledger.checks.firstBrowserAfter);
assert.equal(before.stats.expected, 1);
assert.equal(before.stats.unexpected, 5);
assert.equal(after.stats.expected, 6);
assert.equal(after.stats.unexpected, 0);
assert.match(
  text('.cache/ahri-player-tooltip-before-v1-20261025.log'),
  /1 failed \| 8 skipped \(9\)/
);
assert.match(text('.cache/ahri-player-tooltip-before-v1-20261025.log'), /1.4 seconds/);
assert.match(text('.cache/ahri-player-focus-v2-20261025.log'), /114 passed \(114\)/);
assert.deepEqual(data('.cache/ahri-player-work-v1-20261025/public-identity.json'), {
  baseline: 1015,
  unchanged: 1015,
  changed: [],
  added: [],
});
const reports = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const r = JSON.parse(line);
      return r.result === 'passed' ? [r] : [];
    } catch {
      return [];
    }
  });
assert.equal(reports.length, 1);
assert.equal(reports[0].recordings, 32);
assert.equal(reports[0].developmentHook, false);
assert.equal(reports[0].unrequestedAhriPreloads, 0);
assert.equal(reports[0].ahriNpcFixtureInProduction, false);
assert.equal(reports[0].ahriPlayerFixtureInProduction, false);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(offline.manifest.files, pack.files.length);
for (const value of Object.values(offline.checks))
  if (typeof value === 'boolean') assert.equal(value, true);
assert.deepEqual(ledger.acceptance, {
  developmentAhriPlayerIntegrated: true,
  trustedPracticeContextVerified: true,
  ownControlsAndHudVerified: true,
  privateSaveAndRestartVerified: true,
  fileImportBoundaryVerified: true,
  realPlayerReloadPhases: 2,
  productionRosterExpanded: false,
  fullAhriKit: false,
  nativeBehaviorVerified: false,
  nativePresentationVerified: false,
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
    unitTests: 2182,
    browserCases: 48,
    developmentAhriPlayerIntegrated: true,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
