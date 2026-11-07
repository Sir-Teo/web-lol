import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectCohortHorizon, writeCohortHorizon } from './inspect-cohort-horizon.mjs';
import { writeCohortSnapshot } from './lib/cohort-snapshot.ts';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'rift-horizon-')),
    folder = join(root, 'seeds/2');
  mkdirSync(folder, { recursive: true });
  const checkpoints = [];
  for (const tick of [0, 60, 120]) {
    const counter = tick / 60;
    const state = {
      ruleset: 'fixture-rule',
      tick,
      winner: null,
      player: { kills: counter, deaths: counter, cs: counter * 10 },
      otherChampions: [],
      units: [
        { kind: 'champion', team: 'blue', hp: 10 },
        { kind: 'nexus', team: 'blue', hp: 100 - tick / 2 },
        { kind: 'nexus', team: 'red', hp: 100 },
      ],
    };
    const body = JSON.stringify(state),
      path = join(folder, tick + '.match.json');
    writeFileSync(path, body + '\n');
    checkpoints.push({ tick, path, stateSha256: sha(body), fileSha256: sha(body + '\n') });
  }
  const final = join(folder, 'final.match.json');
  writeFileSync(final, readFileSync(checkpoints[2].path));
  const report = {
    ruleset: 'fixture-rule',
    outcome: 'unfinished',
    winner: null,
    finalTick: 120,
    finalPath: final,
    finalStateSha256: checkpoints[2].stateSha256,
    checkpoints,
  };
  const ledgerFile = join(root, 'ledger.json');
  const saveReport = () => {
    const raw = JSON.stringify(report);
    writeFileSync(join(folder, 'report.json'), raw);
    writeFileSync(
      ledgerFile,
      JSON.stringify({
        ruleset: 'fixture-rule',
        unfinishedSeeds: [2],
        seedLedger: [
          {
            seed: 2,
            outcome: 'unfinished',
            finalTick: 120,
            reportSha256: sha(raw),
            finalStateSha256: report.finalStateSha256,
          },
        ],
      })
    );
  };
  saveReport();
  try {
    run({ root, folder, report, ledgerFile, saveReport });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('horizon reader preserves sampled counters and limits without replaying a world', () =>
  fixture(({ root, ledgerFile }) => {
    const result = inspectCohortHorizon(root, ledgerFile);
    assert.deepEqual(result.cases[0].counterDeltas, { kills: 2, deaths: 2, cs: 20 });
    assert.equal(result.cases[0].samples.length, 3);
    assert.deepEqual(result.cases[0].nexusChanges, [
      { tick: 60, hp: { blue: 70, red: 100 } },
      { tick: 120, hp: { blue: 40, red: 100 } },
    ]);
    assert.equal(inspectCohortHorizon(root, ledgerFile, 60).cases[0].samples.length, 2);
  }));
for (const [name, mutate] of [
  ['edited report', ({ folder }) => writeFileSync(join(folder, 'report.json'), '{}')],
  ['changed checkpoint', ({ report }) => writeFileSync(report.checkpoints[1].path, '{}\n')],
  ['changed final state', ({ report }) => writeFileSync(report.finalPath, '{}\n')],
  [
    'resealed wrong source ruleset',
    ({ report, saveReport }) => {
      report.ruleset = 'other-rule';
      saveReport();
    },
  ],
  [
    'resealed reordered checkpoints',
    ({ report, saveReport }) => {
      report.checkpoints.reverse();
      saveReport();
    },
  ],
])
  test(`horizon reader rejects ${name}`, () =>
    fixture((data) => {
      mutate(data);
      assert.throws(() => inspectCohortHorizon(data.root, data.ledgerFile));
    }));

function compress(data) {
  const { report, saveReport } = data;
  const pack = (path) => writeCohortSnapshot(path, readFileSync(path, 'utf8').slice(0, -1), 'gzip');
  report.checkpoints = report.checkpoints.map((row) => ({ tick: row.tick, ...pack(row.path) }));
  report.finalSnapshot = pack(report.finalPath);
  report.finalPath = report.finalSnapshot.path;
  report.snapshotEncoding = 'gzip';
  saveReport();
}
test('gzip horizon diagnostics retain the exact plain observations and pin stored evidence', () =>
  fixture((data) => {
    const plain = inspectCohortHorizon(data.root, data.ledgerFile).cases[0];
    compress(data);
    const packed = inspectCohortHorizon(data.root, data.ledgerFile).cases[0];
    for (const key of ['samples', 'counterDeltas', 'nexusChanges'])
      assert.deepEqual(packed[key], plain[key]);
    for (const row of packed.evidence) {
      const raw = readFileSync(join(data.root, row.path));
      assert.equal(row.bytes, raw.length);
      assert.equal(row.sha256, sha(raw));
    }
  }));
for (const [name, mutate] of [
  ['stored corruption', ({ report }) => writeFileSync(report.checkpoints[1].path, 'broken')],
  ['decoded extent', ({ report }) => report.checkpoints[1].uncompressedBytes--],
  ['missing stored hash', ({ report }) => delete report.checkpoints[1].fileSha256],
  ['missing final descriptor', ({ report }) => delete report.finalSnapshot],
  [
    'different final descriptor',
    ({ report }) => (report.finalSnapshot.stateSha256 = '0'.repeat(64)),
  ],
  ['mixed checkpoint codec', ({ report }) => (report.checkpoints[1].encoding = 'none')],
  ['unknown report codec', ({ report }) => (report.snapshotEncoding = 'zip')],
])
  test(`gzip horizon reader rejects ${name} without changing archived inputs`, () =>
    fixture((data) => {
      compress(data);
      mutate(data);
      data.saveReport();
      const before = readFileSync(join(data.folder, 'report.json'));
      assert.throws(() => inspectCohortHorizon(data.root, data.ledgerFile));
      assert.deepEqual(readFileSync(join(data.folder, 'report.json')), before);
    }));

for (const nested of [false, true])
  test(`diagnostic publication refuses ${nested ? 'nested' : 'root'} archive output`, () =>
    fixture(({ root, folder, ledgerFile }) => {
      const output = join(nested ? folder : root, 'new-diagnostic.json');
      assert.throws(
        () => writeCohortHorizon(root, ledgerFile, output),
        /outside the immutable cohort/
      );
      assert.equal(existsSync(output), false);
    }));
test('diagnostic publication resolves a symlinked parent before protecting archive inputs', () =>
  fixture(({ root, folder, ledgerFile }) => {
    const outside = mkdtempSync(join(tmpdir(), 'rift-diagnostic-output-'));
    try {
      symlinkSync(folder, join(outside, 'alias'));
      const output = join(outside, 'alias/result.json');
      assert.throws(
        () => writeCohortHorizon(root, ledgerFile, output),
        /outside the immutable cohort/
      );
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  }));
test('fresh external diagnostics publish exact observations and cannot overwrite prior evidence', () =>
  fixture(({ root, ledgerFile }) => {
    const outside = mkdtempSync(join(tmpdir(), 'rift-diagnostic-output-'));
    try {
      const output = join(outside, 'result.json');
      const result = writeCohortHorizon(root, ledgerFile, output);
      assert.deepEqual(JSON.parse(readFileSync(output)), inspectCohortHorizon(root, ledgerFile));
      assert.deepEqual(result.cases[0].counterDeltas, { kills: 2, deaths: 2, cs: 20 });
      const before = readFileSync(output);
      assert.throws(() => writeCohortHorizon(root, ledgerFile, output), /already exists/);
      assert.deepEqual(readFileSync(output), before);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  }));
test('failed source verification leaves no external diagnostic output', () =>
  fixture(({ root, ledgerFile, folder }) => {
    const outside = mkdtempSync(join(tmpdir(), 'rift-diagnostic-output-'));
    try {
      const output = join(outside, 'result.json');
      writeFileSync(join(folder, 'report.json'), '{}');
      assert.throws(() => writeCohortHorizon(root, ledgerFile, output), /Frozen report differs/);
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  }));
