/** Verify the retained NPC development checkpoint; --historical uses frozen files. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledgerFile =
  option < 0 ? 'docs/reference/masteryi/development-verification.json' : process.argv[option + 1];
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
assert.equal(ledger.schema, 138);
assert.equal(ledger.ruleset, 'f0b34678b01520ce117fcc4630a01317b8bfc1969a7c698a33fb298715dbd6f6');
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(pack.id, '72f1d7cc409de83255d37ff55633da06174c0992c9e73760c687bdcab9c2a57e');
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, 1068);
assert.equal(pack.bytes, 526605720);
for (const row of pack.files) {
  assert.equal(bytes('dist/' + row.path).length, row.bytes);
  assert.equal(digest(bytes('dist/' + row.path)), row.sha256);
}
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 138;/);
const baselinePath = 'docs/reference/masteryi/model-verification.json';
assert.equal(
  digest(bytes(baselinePath)),
  '8cd8df2d723bef92ca639c30098aee85d7e152cf0d4214cf9560111c18e359f8'
);
const baseline = data(baselinePath);
assert.equal(digest(bytes(baseline.sourceArchive)), baseline.sourceArchiveSha256);
const prior = data(baseline.sourceArchive).files.filter((r) => r.file.startsWith('public/'));
assert.equal(prior.length, 1017);
for (const row of prior)
  if (row.file !== 'public/assets/reference-manifest.json')
    assert.equal(digest(bytes(row.file)), row.sha256, row.file);
const oldNames = new Set(prior.map((r) => r.file));
assert.deepEqual(
  sources.filter((r) => r.file.startsWith('public/') && !oldNames.has(r.file)).map((r) => r.file),
  ['public/assets/icons/masteryi.png']
);
const oldManifestRow = prior.find((r) => r.file === 'public/assets/reference-manifest.json');
const oldManifestBytes = bytes(oldManifestRow.archived);
assert.equal(digest(oldManifestBytes), oldManifestRow.sha256);
const oldManifest = JSON.parse(oldManifestBytes);
const manifest = data('public/assets/reference-manifest.json');
assert.deepEqual(
  { ...manifest, assets: manifest.assets.filter((r) => r.path !== '/assets/icons/masteryi.png') },
  oldManifest
);
const portrait = bytes('public/assets/icons/masteryi.png');
assert.equal(portrait.length, 29421);
assert.equal(digest(portrait), '1c23534926a7956a260591fb3cee8f38cb6de3d9d4f064fe93fb88c8f76b1b66');
assert.equal(portrait.readUInt32BE(16), 128);
assert.equal(portrait.readUInt32BE(20), 128);
assert.equal(
  digest(bytes('public/assets/models/masteryi-base.glb')),
  '7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc'
);
const metadata = data('public/assets/models/masteryi-base.json');
assert.equal(metadata.clips.length, 47);
assert.equal(metadata.bones, 90);
const expectedDurations = Object.fromEntries(
  metadata.clips.map((c) => [c.name, c.durationSeconds])
);
assert.deepEqual(data('src/content/champion-clip-durations.json').masteryi, expectedDurations);
assert.deepEqual(
  data('src/content/mobile-clip-durations.json')['masteryi-base'],
  expectedDurations
);
const work = '.cache/masteryi-development-work-v1-20261025/';
for (const mode of ['normal', 'optimized'])
  assert.match(
    text(work + 'profile-' + mode + '.log'),
    /Verified Master Yi development profile; explicit BIN AD growth/
  );
assert.match(
  text('.cache/masteryi-development-focus-v1-20261025.log'),
  /4 failed \| 15 passed \(19\)/
);
assert.match(
  text('.cache/masteryi-development-focus-v1-20261025.log'),
  /Saved match contains unfinished Master Yi spell state/
);
assert.match(text('.cache/masteryi-development-focus-v2-20261025.log'), /19 passed \(19\)/);
assert.match(text('.cache/masteryi-development-focus-v3-20261025.log'), /34 passed \(34\)/);
assert.match(text(ledger.checks.unit), /339 passed \(339\)/);
assert.match(text(ledger.checks.unit), /2192 passed \(2192\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const browser = data(ledger.checks.browser);
assert.deepEqual(
  [browser.stats.expected, browser.stats.unexpected, browser.stats.skipped, browser.stats.flaky],
  [55, 0, 0, 0]
);
const named = (suffix) => {
  const found = rows.filter(
    (r) =>
      r.file.startsWith(
        '.cache/masteryi-development-browser-v1-20261025/results/masteryi-development-'
      ) && r.file.endsWith('/' + suffix)
  );
  assert.equal(found.length, 1, suffix);
  return found[0].file;
};
const rig = data(named('masteryi-rig.json'));
assert.equal(rig.hero, 'ashe');
assert.equal(rig.npc, 'masteryi');
assert.equal(rig.projectileCount, 0);
assert.equal(rig.exactFuture, true);
assert.equal(rig.damage, 65);
assert.deepEqual(rig.spellRanks, { q: 0, w: 0, e: 0, r: 0 });
assert.equal(rig.learning.length, 4);
assert(rig.learning.every((e) => /not implemented/.test(e)));
assert.deepEqual(
  rig.stages.map((s) => s.name),
  ['idle', 'run', 'attack', 'recovery', 'crit', 'recall-in', 'recall-loop', 'death']
);
assert.deepEqual(
  rig.stages.map((s) => s.before.clip),
  [
    'entry_56f6d84b',
    'run',
    'entry_d5c55cfd',
    'entry_d5c55cfd',
    'entry_e1798980',
    'recall_in',
    'recall_loop',
    'death',
  ]
);
for (const stage of rig.stages) {
  assert.equal(stage.samePose, true);
  assert.equal(stage.exactSave, true);
  assert.equal(stage.before.rig, 'masteryi-base');
  assert.equal(stage.before.clipCount, 47);
  assert.equal(stage.before.bones.length, 90 * 16);
  assert(stage.before.bones.every(Number.isFinite));
  assert.equal(stage.before.meshes.filter((m) => m.defaultHidden).length, 0);
}
for (const phase of ['pending', 'recovery']) {
  const r = data(named('masteryi-' + phase + '-reload.json'));
  assert.equal(r.phase, phase);
  assert.equal(r.expected.saved, r.restored.saved);
  assert.equal(r.expected.future, r.restored.future);
  assert.equal(r.restored.identity, 'masteryi');
  assert.equal(r.restored.paused, true);
  const saved = JSON.parse(r.expected.saved),
    npc = saved.units.find((u) => u.id === r.expected.id);
  assert.equal(npc.releaseTick !== null, phase === 'pending');
}
const isolation = data(named('masteryi-save-isolation.json'));
assert.equal(isolation.ordinary, isolation.normalRestored);
assert.equal(isolation.privateSaved, isolation.privateRestored);
assert.deepEqual(isolation.restarted, {
  hero: 'ashe',
  gold: 500,
  npc: 'masteryi',
  ranks: { q: 0, w: 0, e: 0, r: 0 },
  skillPoints: 1,
  ai: false,
});
assert.deepEqual(data(named('masteryi-imports.json')), {
  missingNpcRejected: true,
  foreignPlayerRejected: true,
  currentStatePreserved: true,
  ownLoadExact: true,
});
for (const name of ['masteryi-idle.png', 'masteryi-death.png']) {
  const b = bytes(named(name));
  assert(b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(b.readUInt32BE(16), 1440);
  assert.equal(b.readUInt32BE(20), 900);
}
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
assert.equal(production[0].masterYiNpcFixtureInProduction, false);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
assert.equal(offline.manifest.id, ledger.pack);
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.checks.serviceWorkerResponses, 963);
for (const value of Object.values(offline.checks))
  if (typeof value === 'boolean') assert.equal(value, true);
assert.deepEqual(ledger.acceptance, {
  developmentNpcIntegrated: true,
  ownMeleeProfileVerified: true,
  realNpcReloadPhases: 2,
  ordinarySaveIsolationVerified: true,
  npcImportBoundaryVerified: true,
  productionRosterExpanded: false,
  roleAiVerified: false,
  nativeBehaviorVerified: false,
  nativePresentationVerified: false,
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
    unitTests: 2192,
    browserCases: 55,
    poseStages: 8,
    realNpcReloadPhases: 2,
    developmentNpcIntegrated: true,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
