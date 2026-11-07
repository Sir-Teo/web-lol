/** Read-only telemetry. Process observations never substitute for final verification. */
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, readlinkSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ownedProcesses } from './lib/cohort-resume.mjs';
import { snapshotEncoding } from './lib/cohort-snapshot.ts';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function inspectCohortProgress(directory, { procRoot = '/proc' } = {}) {
  const root = realpathSync(directory);
  const plan = JSON.parse(readFileSync(root + '/plan.json'));
  const statusPath = root + '/status.json';
  const status = JSON.parse(readFileSync(statusPath));
  assert.equal(plan.format, 1);
  assert(
    Array.isArray(plan.seeds) &&
      plan.seeds.length > 0 &&
      new Set(plan.seeds).size === plan.seeds.length
  );
  assert.equal(status.ruleset, plan.ruleset);
  assert.equal(realpathSync(status.root), root);
  assert.equal(status.requested, plan.seeds.length);
  assert.equal(status.completed, status.results.length);
  assert.equal(new Set(status.results.map((row) => row.seed)).size, status.completed);
  for (const row of status.results) {
    assert(plan.seeds.includes(row.seed));
    assert(['victory', 'unfinished', 'failed'].includes(row.outcome));
  }
  const runner = resolve(plan.runner.file),
    delta = relative(root + '/runner', runner);
  assert(
    delta && delta !== '..' && !delta.startsWith('../') && !isAbsolute(delta),
    'Runner escapes cohort'
  );
  const runnerBytes = readFileSync(runner);
  assert.equal(runnerBytes.length, plan.runner.bytes, 'Frozen runner extent differs');
  assert.equal(hash(runnerBytes), plan.runner.sha256, 'Frozen runner hash differs');
  const owners = ownedProcesses(root, runner, procRoot);
  const processes = owners
    .map((owner) => {
      if (owner.kind !== 'worker') return owner;
      let argv;
      try {
        argv = readFileSync(`${procRoot}/${owner.pid}/cmdline`)
          .toString()
          .split('\0')
          .filter(Boolean);
      } catch (error) {
        if (['ENOENT', 'ESRCH'].includes(error.code)) return null;
        throw error;
      }
      // Recovery deliberately uses a conservative ownership fence. Telemetry only
      // labels a worker when the frozen runner is the actual Node entrypoint.
      if (argv[1] !== runner) return null;
      let seed = null,
        progress = null,
        progressState = 'unavailable';
      try {
        const outputIndex = argv.indexOf('--output');
        const output = argv[outputIndex + 1];
        const candidate = Number(argv.at(-1));
        assert(outputIndex >= 0 && output && plan.seeds.includes(candidate));
        const folder = isAbsolute(output)
          ? resolve(output)
          : resolve(readlinkSync(`${procRoot}/${owner.pid}/cwd`), output);
        assert.equal(folder, resolve(root, 'seeds', String(candidate)));
        seed = candidate;
        const file = folder + '/progress.json';
        const sample = JSON.parse(readFileSync(file));
        assert.equal(sample.seed, seed);
        assert.equal(sample.horizonTicks, plan.horizonTicks);
        assert(
          Number.isSafeInteger(sample.tick) && sample.tick >= 0 && sample.tick <= plan.horizonTicks
        );
        progress = {
          tick: sample.tick,
          ageSeconds: Math.max(0, (Date.now() - statSync(file).mtimeMs) / 1000),
        };
        progressState = 'available';
      } catch (error) {
        if (!['ENOENT', 'ESRCH'].includes(error.code)) progressState = 'invalid';
      }
      return { ...owner, seed, progressState, progress };
    })
    .filter(Boolean);
  const outcomes = Object.fromEntries(
    ['victory', 'unfinished', 'failed'].map((outcome) => [
      outcome,
      status.results.filter((row) => row.outcome === outcome).length,
    ])
  );
  return {
    format: 1,
    root,
    ruleset: plan.ruleset,
    sourceRevision: plan.sourceRevision ?? null,
    snapshotEncoding: snapshotEncoding(plan.snapshotEncoding ?? 'none'),
    observedAt: new Date().toISOString(),
    processStatus: processes.length ? 'running' : 'stopped',
    recordedStatus: status.status,
    completed: status.completed,
    requested: status.requested,
    outcomes,
    statusAgeSeconds: Math.max(0, (Date.now() - statSync(statusPath).mtimeMs) / 1000),
    recordedActivePids: (status.active ?? []).map((row) => row.pid),
    processes,
    summaryPresent: existsSync(root + '/summary.json'),
    finalVerificationPerformed: false,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { positionals } = parseArgs({ allowPositionals: true, options: {} });
  assert.equal(positionals.length, 1, 'Pass one frozen cohort directory');
  console.log(JSON.stringify(inspectCohortProgress(positionals[0]), null, 2));
}
