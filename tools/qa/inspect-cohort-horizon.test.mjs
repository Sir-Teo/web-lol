import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectCohortHorizon } from './inspect-cohort-horizon.mjs';
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
