import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { writeCohortSnapshot } from './lib/cohort-snapshot.ts';
import { compareSnapshotBytes } from './compare-cohort-snapshot-bytes.mjs';
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const write = (path, value) => writeFileSync(path, JSON.stringify(value) + '\n');
function fixture(t) {
  const base = mkdtempSync(resolve(tmpdir(), 'cohort byte comparison '));
  const roots = ['plain', 'packed'].map((name) => base + '/' + name),
    plans = [],
    reports = [];
  const raw = JSON.stringify({
    version: 181,
    ruleset: '1'.repeat(64),
    tick: 3600,
    player: { gold: 500 },
    winner: null,
  });
  for (const [i, root] of roots.entries()) {
    mkdirSync(root + '/seeds/1', { recursive: true });
    const encoding = i ? 'gzip' : 'none';
    const checkpoint = writeCohortSnapshot(root + '/seeds/1/003600.match.json', raw, encoding);
    const final = writeCohortSnapshot(root + '/seeds/1/final.match.json', raw, encoding);
    const plan = {
      ruleset: '1'.repeat(64),
      seeds: [1],
      horizonTicks: 3600,
      runtime: { node: process.version, v8: process.versions.v8 },
      ...(i ? { snapshotEncoding: 'gzip' } : {}),
    };
    const report = {
      seed: 1,
      ruleset: plan.ruleset,
      horizonTicks: 3600,
      outcome: 'unfinished',
      winner: null,
      finalTick: 3600,
      checkedTicks: 3600,
      roundTrips: 1,
      futureChecks: 0,
      futureCheckedTicks: 0,
      checkpoints: [{ ...checkpoint, tick: 3600 }],
      finalPath: final.path,
      finalStateSha256: final.stateSha256,
      ...(i ? { snapshotEncoding: 'gzip', finalSnapshot: final } : {}),
    };
    plans.push(plan);
    reports.push(report);
    write(root + '/plan.json', plan);
    write(root + '/seeds/1/report.json', report);
  }
  const persist = () => {
    roots.forEach((root, i) => {
      write(root + '/plan.json', plans[i]);
      write(root + '/seeds/1/report.json', reports[i]);
    });
  };
  const compare = () => compareSnapshotBytes(...roots);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, roots, plans, reports, raw, persist, compare };
}
test('plain and gzip preserve every decoded artifact byte with distinct stored hashes', (t) => {
  const f = fixture(t),
    result = f.compare();
  assert.equal(result.snapshotCount, 2);
  assert(result.comparisons.every((row) => row.stored[0].sha256 !== row.stored[1].sha256));
  assert.equal(result.comparisons[0].decodedBytes, Buffer.byteLength(f.raw + '\n'));
  assert(!('hundredSeedInvariantGate' in result));
});
for (const [name, raw] of [
  [
    'gameplay value',
    JSON.stringify({
      version: 181,
      ruleset: '1'.repeat(64),
      tick: 3600,
      player: { gold: 501 },
      winner: null,
    }),
  ],
  [
    'JSON property order',
    JSON.stringify({
      winner: null,
      player: { gold: 500 },
      tick: 3600,
      ruleset: '1'.repeat(64),
      version: 181,
    }),
  ],
])
  test(`resealed ${name} differences cannot be normalized away`, (t) => {
    const f = fixture(t);
    const replacement = writeCohortSnapshot(
      f.roots[1] + '/seeds/1/resealed.match.json',
      raw,
      'gzip'
    );
    f.reports[1].checkpoints[0] = { ...replacement, tick: 3600 };
    f.persist();
    assert.throws(f.compare, /Decoded bytes differ/);
  });
test('corrupt compressed storage is refused before comparing decoded states', (t) => {
  const f = fixture(t),
    path = f.reports[1].checkpoints[0].path;
  writeFileSync(path, 'altered gzip');
  assert.throws(f.compare, /stored hash|strictly equal/);
});
for (const [name, mutate] of [
  ['ruleset', (f) => (f.plans[1].ruleset = '2'.repeat(64))],
  ['runtime', (f) => (f.plans[1].runtime.v8 = 'different')],
  ['seed coverage', (f) => (f.plans[1].seeds = [2])],
  ['report coverage', (f) => (f.reports[1].checkedTicks = 1)],
  ['missing final descriptor', (f) => delete f.reports[1].finalSnapshot],
  ['escaping snapshot', (f) => (f.reports[1].checkpoints[0].path = f.base + '/outside.match.json')],
])
  test(`storage comparison rejects ${name} drift`, (t) => {
    const f = fixture(t);
    mutate(f);
    f.persist();
    assert.throws(f.compare);
  });
test('comparing one archive to itself is refused', (t) => {
  const f = fixture(t);
  assert.throws(() => compareSnapshotBytes(f.roots[0], f.roots[0]), /distinct cohorts/);
});
