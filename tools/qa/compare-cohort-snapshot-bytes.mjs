/** Exact storage comparison. Frozen feature-specific projection producers stay unchanged. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCohortSnapshot, snapshotEncoding } from './lib/cohort-snapshot.ts';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => JSON.parse(readFileSync(file));
function inside(root, path) {
  const file = resolve(root, path),
    delta = relative(root, file);
  assert(
    delta && delta !== '..' && !delta.startsWith('../') && !isAbsolute(delta),
    'Snapshot escapes cohort'
  );
  return file;
}
/** Storage identity only. The CLI verifies both complete archives before publishing a receipt. */
export function compareSnapshotBytes(before, after) {
  const roots = [before, after].map((root) => realpathSync(root));
  assert.notEqual(roots[0], roots[1], 'Choose two distinct cohorts');
  const plans = roots.map((root) => read(root + '/plan.json'));
  assert.equal(plans[0].ruleset, plans[1].ruleset, 'Rulesets differ; no schema bridge is allowed');
  assert.equal(plans[0].horizonTicks, plans[1].horizonTicks, 'Horizons differ');
  for (const field of ['node', 'v8', 'platform', 'arch', 'cpu'])
    assert.equal(
      plans[0].runtime[field],
      plans[1].runtime[field],
      `Recorded runtime differs: ${field}`
    );
  for (const flag of ['developmentLeona', 'developmentRoster'])
    assert.equal(plans[0][flag] ?? false, plans[1][flag] ?? false, 'Roster profiles differ');
  const seeds = plans.map((plan) => [...plan.seeds].sort((a, b) => a - b));
  assert(seeds[0].length && new Set(seeds[0]).size === seeds[0].length, 'Invalid seed list');
  assert.deepEqual(seeds[0], seeds[1], 'Seed coverage differs');
  const encodings = plans.map((plan) => snapshotEncoding(plan.snapshotEncoding ?? 'none'));
  const comparisons = [];
  for (const seed of seeds[0]) {
    const reports = roots.map((root) => read(`${root}/seeds/${seed}/report.json`));
    for (const field of [
      'seed',
      'ruleset',
      'horizonTicks',
      'outcome',
      'winner',
      'finalTick',
      'checkedTicks',
      'roundTrips',
      'futureChecks',
      'futureCheckedTicks',
    ])
      assert.deepEqual(
        reports[0][field],
        reports[1][field],
        `Report differs: seed ${seed}, ${field}`
      );
    assert.equal(reports[0].seed, seed);
    assert.equal(reports[0].ruleset, plans[0].ruleset);
    const rows = reports.map((report, i) => {
      assert.equal(report.snapshotEncoding ?? 'none', encodings[i]);
      if (encodings[i] === 'gzip')
        assert(report.finalSnapshot, 'Compressed final descriptor missing');
      const final = report.finalSnapshot ?? {
        path: report.finalPath,
        stateSha256: report.finalStateSha256,
      };
      assert.equal(final.path, report.finalPath);
      assert.equal(final.stateSha256, report.finalStateSha256);
      return [
        ...report.checkpoints.map((row) => ({ ...row, kind: 'checkpoint' })),
        { ...final, tick: report.finalTick, kind: 'final' },
      ];
    });
    assert.equal(rows[0].length, rows[1].length, 'Snapshot coverage differs');
    for (let index = 0; index < rows[0].length; index++) {
      const pair = rows.map((list, i) => {
        const row = list[index],
          path = inside(roots[i], row.path);
        if (row.kind === 'checkpoint') assert.match(row.fileSha256, /^[0-9a-f]{64}$/);
        const decoded = readCohortSnapshot({ ...row, path }, encodings[i]);
        return { row, decoded, path };
      });
      assert.equal(pair[0].row.tick, pair[1].row.tick, 'Snapshot ticks differ');
      assert.equal(pair[0].row.kind, pair[1].row.kind, 'Snapshot kinds differ');
      assert(
        pair[0].decoded.bytes.equals(pair[1].decoded.bytes),
        `Decoded bytes differ: seed ${seed}, ${pair[0].row.kind}, tick ${pair[0].row.tick}`
      );
      comparisons.push({
        seed,
        tick: pair[0].row.tick,
        kind: pair[0].row.kind,
        stateSha256: pair[0].row.stateSha256,
        decodedBytes: pair[0].decoded.bytes.length,
        stored: pair.map(({ row, decoded, path }, i) => ({
          path,
          encoding: encodings[i],
          bytes: decoded.storedBytes,
          sha256: row.fileSha256 ?? hash(decoded.bytes),
        })),
      });
    }
  }
  return {
    ruleset: plans[0].ruleset,
    seeds: seeds[0],
    snapshotCount: comparisons.length,
    cohorts: roots.map((root, i) => ({
      root,
      sourceRevision: plans[i].sourceRevision ?? null,
      planSha256: hash(readFileSync(root + '/plan.json')),
      encoding: encodings[i],
    })),
    comparisons,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { positionals } = parseArgs({ allowPositionals: true, options: {} });
  assert.equal(positionals.length, 3, 'Pass two completed cohorts and a fresh external receipt');
  const [before, after, outputArg] = positionals,
    output = resolve(outputArg);
  assert(!existsSync(output), 'Output already exists');
  const actual = resolve(realpathSync(dirname(output)), basename(output));
  for (const directory of [before, after]) {
    const delta = relative(realpathSync(directory), actual);
    assert(
      delta === '..' || delta.startsWith('../') || isAbsolute(delta),
      'Output must be outside immutable cohorts'
    );
  }
  const verifier = fileURLToPath(new URL('./verify-match-cohort.mjs', import.meta.url));
  const verifications = [before, after].map((root) =>
    JSON.parse(
      execFileSync(process.execPath, [verifier, resolve(root), '--historical'], {
        encoding: 'utf8',
        stdio: 'pipe',
      })
    )
  );
  assert(verifications.every((row) => row.result === 'passed'));
  const comparison = compareSnapshotBytes(before, after);
  const record = {
    format: 1,
    result: 'passed',
    producerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    excludedFields: [],
    normalizedFields: [],
    ...comparison,
    verifications,
    scope:
      'Complete decoded artifact bytes, including delimiters; frozen archives verified; no World replay or current-build certification.',
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      seeds: comparison.seeds.length,
      snapshots: comparison.snapshotCount,
    })
  );
}
