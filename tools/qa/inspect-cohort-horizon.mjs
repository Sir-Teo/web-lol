/** Read-only horizon diagnostics; never loads snapshots into a different ruleset. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCohortSnapshot, snapshotEncoding } from './lib/cohort-snapshot.ts';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');

export function inspectCohortHorizon(directory, ledgerFile, lastTicks = 36000) {
  assert(Number.isSafeInteger(lastTicks) && lastTicks > 0, 'Invalid diagnostic window');
  const root = resolve(directory),
    ledgerRaw = readFileSync(ledgerFile),
    ledger = JSON.parse(ledgerRaw);
  assert(
    Array.isArray(ledger.seedLedger) && Array.isArray(ledger.unfinishedSeeds),
    'Missing frozen seed ledger'
  );
  const cases = [];
  for (const seed of ledger.unfinishedSeeds) {
    assert(Number.isSafeInteger(seed) && seed >= 0, 'Invalid seed');
    const pin = ledger.seedLedger.find((row) => row.seed === seed);
    assert(pin?.outcome === 'unfinished', 'Seed is not pinned unfinished');
    const seedRoot = resolve(root, 'seeds', String(seed)),
      reportRaw = readFileSync(resolve(seedRoot, 'report.json'));
    assert.equal(sha(reportRaw), pin.reportSha256, 'Frozen report differs');
    const report = JSON.parse(reportRaw);
    const encoding = snapshotEncoding(report.snapshotEncoding ?? 'none');
    assert.equal(report.ruleset, ledger.ruleset, 'Report ruleset differs');
    assert.equal(report.outcome, 'unfinished');
    assert.equal(report.winner, null);
    assert.equal(report.finalStateSha256, pin.finalStateSha256);
    assert.equal(report.finalTick, pin.finalTick);
    const evidence = [
      { path: `seeds/${seed}/report.json`, sha256: sha(reportRaw), bytes: reportRaw.length },
    ];
    const readState = (record, tick) => {
      const path = record.path;
      const local = resolve(seedRoot, basename(path));
      const raw = readFileSync(local);
      if (encoding === 'gzip') assert.match(record.fileSha256, /^[0-9a-f]{64}$/);
      const decoded = readCohortSnapshot(
        { ...record, path: local, fileSha256: record.fileSha256 ?? sha(raw) },
        encoding
      );
      const state = JSON.parse(decoded.raw);
      assert.equal(state.ruleset, ledger.ruleset, 'Snapshot ruleset differs');
      assert.equal(state.tick, tick, 'Snapshot tick differs');
      assert.equal(state.winner, null, 'Unfinished snapshot has a winner');
      evidence.push({
        path: `seeds/${seed}/${basename(path)}`,
        bytes: raw.length,
        sha256: sha(raw),
      });
      return state;
    };
    let previousTick = -1;
    for (const checkpoint of report.checkpoints) {
      assert(
        checkpoint.tick > previousTick && checkpoint.tick <= report.finalTick,
        'Checkpoint order differs'
      );
      previousTick = checkpoint.tick;
    }
    const selected = report.checkpoints.filter((row) => row.tick >= report.finalTick - lastTicks);
    const states = selected.map((row) => {
      assert.match(row.fileSha256, /^[0-9a-f]{64}$/);
      return readState(row, row.tick);
    });
    if (encoding === 'gzip') assert(report.finalSnapshot, 'Missing compressed final descriptor');
    const finalRecord = report.finalSnapshot ?? {
      path: report.finalPath,
      stateSha256: report.finalStateSha256,
    };
    assert.equal(finalRecord.path, report.finalPath, 'Final descriptor path differs');
    assert.equal(
      finalRecord.stateSha256,
      report.finalStateSha256,
      'Final descriptor state differs'
    );
    const final = readState(finalRecord, report.finalTick);
    if (states.at(-1)?.tick === final.tick)
      assert.equal(
        selected.at(-1).stateSha256,
        report.finalStateSha256,
        'Final checkpoint differs'
      );
    else states.push(final);
    const samples = states.map((state) => {
      const champions = [state.player, ...state.otherChampions];
      const sum = (key) =>
        champions.reduce((total, champion) => {
          assert(Number.isFinite(champion[key]), 'Invalid champion counter');
          return total + champion[key];
        }, 0);
      const units = state.units,
        live = (kind) => units.filter((u) => u.kind === kind && u.hp > 0).length;
      return {
        tick: state.tick,
        kills: sum('kills'),
        deaths: sum('deaths'),
        cs: sum('cs'),
        aliveChampions: live('champion'),
        liveMinions: units.filter(
          (u) => ['melee', 'caster', 'siege', 'super'].includes(u.kind) && u.hp > 0
        ).length,
        liveTurrets: live('turret'),
        liveInhibitors: live('inhibitor'),
        nexusHp: Object.fromEntries(
          units.filter((u) => u.kind === 'nexus').map((u) => [u.team, u.hp])
        ),
      };
    });
    const first = samples[0],
      last = samples.at(-1);
    assert(first && last, 'No diagnostic samples');
    cases.push({
      seed,
      outcome: report.outcome,
      finalTick: report.finalTick,
      samples,
      counterDeltas: {
        kills: last.kills - first.kills,
        deaths: last.deaths - first.deaths,
        cs: last.cs - first.cs,
      },
      nexusChanges: samples
        .slice(1)
        .filter(
          (row, index) => JSON.stringify(row.nexusHp) !== JSON.stringify(samples[index].nexusHp)
        )
        .map((row) => ({ tick: row.tick, hp: row.nexusHp })),
      evidence,
    });
  }
  return {
    format: 1,
    ruleset: ledger.ruleset,
    ledgerSha256: sha(ledgerRaw),
    lastTicks,
    cases,
    limits: [
      'Read-only archived snapshots; no simulation, ruleset bridge or current-build certification.',
      'Counter and sampled HP changes establish observed activity, not causal AI diagnosis.',
      'Minute-spaced snapshots cannot establish recall loops, exact paths or fight timing.',
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, ledgerFile, output] = process.argv.slice(2);
  assert(
    directory && ledgerFile && output && process.argv.length === 5,
    'Pass cohort directory, frozen ledger and fresh output file'
  );
  const result = inspectCohortHorizon(directory, ledgerFile);
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      seeds: result.cases.map((c) => c.seed),
      ruleset: result.ruleset,
    })
  );
}
