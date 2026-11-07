import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectCohortProgress } from './inspect-cohort-progress.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const write = (path, value) => writeFileSync(path, JSON.stringify(value) + '\n');
function fixture(t) {
  const base = mkdtempSync(resolve(tmpdir(), 'cohort progress ')),
    root = base + '/cohort',
    procRoot = base + '/proc';
  for (const path of [root + '/runner', root + '/seeds/2', root + '/seeds/3', procRoot])
    mkdirSync(path, { recursive: true });
  const runner = root + '/runner/match-seed.js';
  writeFileSync(runner, 'frozen fixture runner');
  const bytes = readFileSync(runner);
  const plan = {
    format: 1,
    seeds: [1, 2, 3],
    ruleset: '1'.repeat(64),
    horizonTicks: 7200,
    runner: { file: runner, bytes: bytes.length, sha256: hash(bytes) },
  };
  const status = {
    root,
    ruleset: plan.ruleset,
    status: 'running',
    completed: 1,
    requested: 3,
    active: [{ seed: 2, pid: 102 }],
    results: [{ seed: 1, outcome: 'victory' }],
  };
  const persist = () => {
    write(root + '/plan.json', plan);
    write(root + '/status.json', status);
  };
  persist();
  const proc = (pid, argv) => {
    const folder = procRoot + '/' + pid;
    mkdirSync(folder);
    writeFileSync(folder + '/cmdline', argv.join('\0') + '\0');
    symlinkSync(base, folder + '/cwd');
  };
  const sample = (seed, tick) =>
    write(root + '/seeds/' + seed + '/progress.json', { seed, tick, horizonTicks: 7200 });
  const inspect = () => inspectCohortProgress(root, { procRoot });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, root, runner, procRoot, plan, status, persist, proc, sample, inspect };
}
function pins(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = root + '/' + entry.name;
    return entry.isDirectory() ? pins(path) : [{ path, sha256: hash(readFileSync(path)) }];
  });
}
test('live exact-argv owners and current progress are observed without mutating cohort bytes', (t) => {
  const f = fixture(t);
  f.proc(101, ['node', '/private/match-cohort.mjs', '--output', 'cohort']);
  f.proc(102, ['node', f.runner, '--output', f.root + '/seeds/2', '2']);
  f.sample(2, 1234);
  const before = pins(f.root),
    result = f.inspect();
  assert.equal(result.processStatus, 'running');
  assert.equal(result.completed, 1);
  assert.deepEqual(result.outcomes, { victory: 1, unfinished: 0, failed: 0 });
  assert.equal(result.processes.find((row) => row.pid === 102).progress.tick, 1234);
  assert.equal(result.finalVerificationPerformed, false);
  assert.deepEqual(pins(f.root), before);
});
test('stale recorded active PIDs do not imply a running cohort', (t) => {
  const f = fixture(t),
    result = f.inspect();
  assert.equal(result.recordedStatus, 'running');
  assert.equal(result.processStatus, 'stopped');
  assert.deepEqual(result.recordedActivePids, [102]);
  assert.equal(result.summaryPresent, false);
});
test('new workers are visible even before the next parent status update', (t) => {
  const f = fixture(t);
  f.proc(103, ['node', f.runner, '--output', f.root + '/seeds/3', '3']);
  f.sample(3, 600);
  assert.equal(f.inspect().processes[0].seed, 3);
});
for (const [name, content] of [
  ['truncated JSON', '{"seed":'],
  ['wrong seed', JSON.stringify({ seed: 1, tick: 60, horizonTicks: 7200 })],
  ['wrong horizon', JSON.stringify({ seed: 2, tick: 60, horizonTicks: 3600 })],
  ['out-of-range tick', JSON.stringify({ seed: 2, tick: 7201, horizonTicks: 7200 })],
])
  test(`unreliable progress (${name}) is not presented as a verified tick`, (t) => {
    const f = fixture(t);
    f.proc(102, ['node', f.runner, '--output', f.root + '/seeds/2', '2']);
    writeFileSync(f.root + '/seeds/2/progress.json', content);
    const worker = f.inspect().processes[0];
    assert.equal(worker.progress, null);
    assert.equal(worker.progressState, 'invalid');
  });
test('shell text cannot masquerade as an owned worker', (t) => {
  const f = fixture(t);
  f.proc(303, ['bash', '-lc', `node ${f.runner} --output ${f.root}`]);
  assert.equal(f.inspect().processStatus, 'stopped');
});
test('a changed frozen runner is rejected without rewriting it', (t) => {
  const f = fixture(t);
  writeFileSync(f.runner, 'changed runner');
  const before = readFileSync(f.runner);
  assert.throws(f.inspect);
  assert.deepEqual(readFileSync(f.runner), before);
});
for (const [name, change] of [
  ['ruleset', (f) => (f.status.ruleset = '2'.repeat(64))],
  ['completed count', (f) => (f.status.completed = 2)],
  [
    'duplicate results',
    (f) => {
      f.status.results.push({ ...f.status.results[0] });
      f.status.completed = 2;
    },
  ],
])
  test(`inconsistent recorded ${name} is rejected`, (t) => {
    const f = fixture(t);
    change(f);
    f.persist();
    assert.throws(f.inspect);
  });

test('a frozen runner mentioned as data is not a live worker entrypoint', (t) => {
  const f = fixture(t);
  f.proc(404, ['node', '/private/read-report.mjs', f.runner]);
  assert.equal(f.inspect().processStatus, 'stopped');
});

for (const [osState, executionState] of [
  ['T', 'paused'],
  ['t', 'paused'],
  ['S', 'not-paused'],
  ['R', 'not-paused'],
])
  test(`owned worker scheduling state ${osState} is reported separately from ownership`, (t) => {
    const f = fixture(t);
    f.proc(102, ['node', f.runner, '--output', f.root + '/seeds/2', '2']);
    writeFileSync(
      f.procRoot + '/102/status',
      `Name:\tfrozen-worker\nState:\t${osState} (fixture)\n`
    );
    const before = pins(f.root),
      result = f.inspect();
    assert.equal(result.processStatus, 'running');
    assert.equal(result.processes[0].osState, osState);
    assert.equal(result.processes[0].executionState, executionState);
    assert.deepEqual(result.pausedWorkerPids, executionState === 'paused' ? [102] : []);
    assert.deepEqual(pins(f.root), before);
  });
test('missing scheduling status keeps observed ownership without inventing execution state', (t) => {
  const f = fixture(t);
  f.proc(102, ['node', f.runner, '--output', f.root + '/seeds/2', '2']);
  const result = f.inspect();
  assert.equal(result.processStatus, 'running');
  assert.equal(result.processes[0].osState, null);
  assert.equal(result.processes[0].executionState, 'unavailable');
  assert.deepEqual(result.pausedWorkerPids, []);
});
