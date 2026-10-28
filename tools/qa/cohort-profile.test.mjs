import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const verifier = fileURLToPath(new URL('./verify-match-cohort.mjs', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (file) => ({
  file,
  bytes: readFileSync(file).length,
  sha256: hash(readFileSync(file)),
});
const write = (file, value) => writeFileSync(file, JSON.stringify(value) + '\n');
function fixture(t) {
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
      owners.push({ id, role: roles[i], gold: 500, level: 1 });
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
    horizonTicks: 3600,
    finalTick: 3600,
    checkedTicks: 3600,
    roundTrips: 1,
    futureChecks: 0,
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
  const plan = {
    ruleset,
    developmentLeona: false,
    developmentRoster: true,
    qaAutomatedHumanCarry: false,
    qaAutomatedHumanRole: 'mid',
    roster: 'two Garen/two Master Yi/two Ashe/two Leona/one Ahri/one Lux; five roles per team',
    seeds: [1],
    horizonTicks: 3600,
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
    checkedTicks: 3600,
    roundTrips: 1,
    futureChecks: 0,
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
  const run = () =>
    execFileSync(process.execPath, [verifier, root, '--historical'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  t.after(() => {
    if (t.passed === true) rmSync(root, { recursive: true, force: true });
    else t.diagnostic('Retained profile fixture: ' + root);
  });
  return { root, plan, report, persist, mutateState, run };
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
