import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeCohortSnapshot } from './lib/cohort-snapshot.ts';
import { inspectCohortHorizon } from './inspect-cohort-horizon.mjs';
const verifier = fileURLToPath(new URL('./verify-match-cohort.mjs', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (file) => ({
  file,
  bytes: readFileSync(file).length,
  sha256: hash(readFileSync(file)),
});
const write = (file, value) => writeFileSync(file, JSON.stringify(value) + '\n');
function fixture(t, horizonTicks = 3600) {
  const root = mkdtempSync(resolve(tmpdir(), 'cohort profile '));
  for (const path of ['maps', 'runner', 'seeds/1', 'frozen-source'])
    mkdirSync(root + '/' + path, { recursive: true });
  for (const file of ['maps/input', 'runner/match-seed.js', 'frozen-source/source.txt'])
    writeFileSync(root + '/' + file, 'fixture bytes\n');
  const roles = ['mid', 'top', 'jungle', 'carry', 'support'];
  const identities = {
    blue: ['lux', 'garen', 'masteryi', 'ashe', 'leona'],
    red: ['ahri', 'garen', 'masteryi', 'ashe', 'leona'],
  };
  const units = [],
    owners = [];
  for (const team of ['blue', 'red'])
    for (const [i, champion] of identities[team].entries()) {
      const id = units.length + 1;
      units.push({
        id,
        kind: 'champion',
        team,
        champion,
        x: 0,
        y: 0,
        hp: 500,
        maxHp: 500,
        mana: 100,
        maxMana: 100,
      });
      owners.push({ id, role: roles[i], gold: 500, level: 1, kills: 0, deaths: 0, cs: 0 });
    }
  const ruleset = '1'.repeat(64),
    state = {
      ruleset,
      tick: 3600,
      winner: null,
      units,
      player: owners[0],
      otherChampions: owners.slice(1),
    };
  const checkpoint = root + '/seeds/1/003600.match.json',
    final = root + '/seeds/1/final.match.json';
  write(checkpoint, state);
  write(final, state);
  const report = {
    seed: 1,
    ruleset,
    developmentLeona: false,
    developmentRoster: true,
    automatedHumanCarry: false,
    automatedHumanRole: 'mid',
    failure: null,
    horizonTicks,
    finalTick: horizonTicks,
    checkedTicks: horizonTicks,
    roundTrips: horizonTicks / 3600,
    futureChecks: horizonTicks / 3600 - 1,
    futureCheckedTicks: horizonTicks === 3600 ? 0 : 60,
    runtime: { node: process.version, v8: process.versions.v8 },
    outcome: 'unfinished',
    winner: null,
    checkpoints: [
      {
        tick: 3600,
        path: checkpoint,
        fileSha256: hash(readFileSync(checkpoint)),
        stateSha256: hash(readFileSync(checkpoint).subarray(0, -1)),
      },
    ],
    finalPath: final,
    finalStateSha256: hash(readFileSync(final).subarray(0, -1)),
  };
  if (horizonTicks === 7200) {
    const second = root + '/seeds/1/007200.match.json';
    write(second, { ...state, tick: 7200 });
    write(final, { ...state, tick: 7200 });
    report.checkpoints.push({
      tick: 7200,
      path: second,
      fileSha256: hash(readFileSync(second)),
      stateSha256: hash(readFileSync(second).subarray(0, -1)),
    });
    report.finalStateSha256 = report.checkpoints[1].stateSha256;
  }
  const plan = {
    ruleset,
    developmentLeona: false,
    developmentRoster: true,
    qaAutomatedHumanCarry: false,
    qaAutomatedHumanRole: 'mid',
    roster: 'two Garen/two Master Yi/two Ashe/two Leona/one Ahri/one Lux; five roles per team',
    seeds: [1],
    horizonTicks,
    runtime: report.runtime,
    runner: pin(root + '/runner/match-seed.js'),
    inputs: [pin(root + '/maps/input')],
    sources: [{ ...pin(root + '/frozen-source/source.txt'), file: 'source.txt' }],
    sourceArchive: root + '/frozen-source',
  };
  const summary = {
    ruleset,
    completed: 1,
    active: [],
    results: [report],
    checkedTicks: horizonTicks,
    roundTrips: report.roundTrips,
    futureChecks: report.futureChecks,
    futureCheckedTicks: report.futureCheckedTicks,
    victories: 0,
    unfinished: 1,
    hundredSeedInvariantGate: false,
    hundredSeedDevelopmentLeonaInvariantGate: false,
    hundredSeedDevelopmentRosterInvariantGate: false,
  };
  const persist = () => {
    write(root + '/plan.json', plan);
    write(root + '/summary.json', summary);
    write(root + '/seeds/1/report.json', report);
  };
  persist();
  const mutateState = (change) => {
    change(state);
    write(checkpoint, state);
    report.checkpoints[0].fileSha256 = hash(readFileSync(checkpoint));
    report.checkpoints[0].stateSha256 = hash(readFileSync(checkpoint).subarray(0, -1));
    persist();
  };
  const run = (args = []) =>
    execFileSync(process.execPath, [verifier, root, '--historical', ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  t.after(() => {
    if (t.passed === true) rmSync(root, { recursive: true, force: true });
    else t.diagnostic('Retained profile fixture: ' + root);
  });
  return { root, plan, report, summary, persist, mutateState, run };
}

test('a historical combined-profile fixture verifies its archived inputs and exact roster', (t) => {
  const f = fixture(t),
    result = JSON.parse(f.run());
  assert.equal(result.result, 'passed');
  assert.equal(result.developmentRoster, true);
  assert.equal(result.hundredSeedInvariantGate, false);
});
for (const [name, mutate] of [
  [
    'wrong human',
    (s) => {
      s.units[0].champion = 'ashe';
    },
  ],
  [
    'wrong support',
    (s) => {
      s.units[4].champion = 'lux';
    },
  ],
  [
    'duplicated position',
    (s) => {
      s.otherChampions[0].role = 'mid';
    },
  ],
])
  test(`valid checkpoint hashes cannot hide a ${name} composition`, (t) => {
    const f = fixture(t);
    f.mutateState(mutate);
    assert.throws(f.run);
  });

test('a worker cannot silently drop the combined-profile flag', (t) => {
  const f = fixture(t);
  f.report.developmentRoster = false;
  f.persist();
  assert.throws(f.run);
});

test('historical verification still rejects a changed archived source', (t) => {
  const f = fixture(t);
  writeFileSync(f.root + '/frozen-source/source.txt', 'changed fixture bytes\n');
  assert.throws(f.run);
});

for (const [name, mutate] of [
  ['summary result disagreement', (f) => (f.summary.results = [{ ...f.report, winner: 'blue' }])],
  [
    'fabricated victory totals',
    (f) => {
      f.summary.victories = 1;
      f.summary.unfinished = 0;
    },
  ],
  [
    'omitted minute checkpoint',
    (f) => {
      f.report.checkpoints.shift();
      f.report.roundTrips = 1;
      f.report.futureChecks = 0;
      f.report.futureCheckedTicks = 0;
      f.summary.roundTrips = 1;
      f.summary.futureChecks = 0;
      f.summary.futureCheckedTicks = 0;
    },
  ],
  ['reordered checkpoints', (f) => f.report.checkpoints.reverse()],
  ['duplicate checkpoints', (f) => (f.report.checkpoints[1] = { ...f.report.checkpoints[0] })],
  [
    'invented future checks',
    (f) => {
      f.report.futureChecks = 100;
      f.summary.futureChecks = 100;
    },
  ],
  [
    'missing future ticks',
    (f) => {
      f.report.futureCheckedTicks = 0;
      f.summary.futureCheckedTicks = 0;
    },
  ],
  [
    'different final state',
    (f) => {
      const state = JSON.parse(readFileSync(f.report.finalPath));
      state.player.gold++;
      write(f.report.finalPath, state);
      f.report.finalStateSha256 = hash(readFileSync(f.report.finalPath).subarray(0, -1));
    },
  ],
])
  test(`cohort verification rejects ${name} even with resealed reports`, (t) => {
    const f = fixture(t, 7200);
    mutate(f);
    f.persist();
    assert.throws(f.run);
  });
test('complete two-minute coverage verifies its exact future tick total', (t) => {
  const f = fixture(t, 7200);
  assert.equal(JSON.parse(f.run()).futureCheckedTicks, 60);
});

test('optional verification ledger pins reports and feeds read-only horizon diagnostics', (t) => {
  const f = fixture(t, 7200),
    output = f.root + '.ledger.json';
  t.after(() => rmSync(output, { force: true }));
  const before = readFileSync(f.root + '/seeds/1/report.json');
  f.run(['--output', output]);
  const ledger = JSON.parse(readFileSync(output));
  assert.equal(ledger.result, 'passed');
  assert.equal(ledger.historical, true);
  assert.deepEqual(ledger.unfinishedSeeds, [1]);
  assert.equal(ledger.seedLedger[0].reportSha256, hash(before));
  assert.equal(ledger.planSha256, hash(readFileSync(f.root + '/plan.json')));
  assert.equal(ledger.summarySha256, hash(readFileSync(f.root + '/summary.json')));
  assert.equal(inspectCohortHorizon(f.root, output).cases[0].samples.length, 2);
  assert.deepEqual(readFileSync(f.root + '/seeds/1/report.json'), before);
});
test('gzip verification ledger feeds the same unfinished-state reader', (t) => {
  const f = fixture(t),
    output = f.root + '.ledger.json';
  t.after(() => rmSync(output, { force: true }));
  const pack = (path) => writeCohortSnapshot(path, readFileSync(path, 'utf8').slice(0, -1), 'gzip');
  f.report.checkpoints = f.report.checkpoints.map((row) => ({ tick: row.tick, ...pack(row.path) }));
  f.report.finalSnapshot = pack(f.report.finalPath);
  f.report.finalPath = f.report.finalSnapshot.path;
  f.report.snapshotEncoding = f.plan.snapshotEncoding = 'gzip';
  f.plan.runtime.zlib = process.versions.zlib;
  f.persist();
  f.run(['--output', output]);
  const ledger = JSON.parse(readFileSync(output));
  assert.equal(ledger.snapshotEncoding, 'gzip');
  assert.equal(inspectCohortHorizon(f.root, output).cases[0].samples[0].tick, 3600);
});
test('existing verification output is preserved', (t) => {
  const f = fixture(t),
    output = f.root + '.ledger.json';
  t.after(() => rmSync(output, { force: true }));
  writeFileSync(output, 'retain existing evidence');
  assert.throws(() => f.run(['--output', output]));
  assert.equal(readFileSync(output, 'utf8'), 'retain existing evidence');
});
test('a rejected report cannot create a verification ledger', (t) => {
  const f = fixture(t),
    output = f.root + '.ledger.json';
  t.after(() => rmSync(output, { force: true }));
  f.report.developmentRoster = false;
  f.persist();
  assert.throws(() => f.run(['--output', output]));
  assert.throws(() => readFileSync(output), { code: 'ENOENT' });
});
test('verification output cannot mutate the frozen cohort', (t) => {
  const f = fixture(t),
    output = f.root + '/ledger.json';
  assert.throws(() => f.run(['--output', output]));
  assert.throws(() => readFileSync(output), { code: 'ENOENT' });
});
test('unknown verification flags and extra cohort roots are rejected', (t) => {
  const f = fixture(t);
  assert.throws(() => f.run(['--historial']));
  assert.throws(() => f.run(['--output', '']));
  assert.throws(() => f.run([f.root]));
});

test('verification output cannot follow a parent symlink into the frozen cohort', (t) => {
  const f = fixture(t),
    alias = f.root + '-alias';
  symlinkSync(f.root, alias, 'dir');
  t.after(() => rmSync(alias, { force: true }));
  assert.throws(() => f.run(['--output', alias + '/ledger.json']));
  assert.throws(() => readFileSync(f.root + '/ledger.json'), { code: 'ENOENT' });
});
