import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  readdirSync,
  rmSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import {
  inspectResume,
  ownedProcesses,
  prepareRecovery,
  SUPPORTED_CONTROLLER_SHA256,
} from './lib/cohort-resume.mjs';

const cli = fileURLToPath(new URL('./resume-match-cohort.mjs', import.meta.url)),
  driver = fileURLToPath(new URL('./lib/cohort-resume-driver.mjs', import.meta.url)),
  canonical = fileURLToPath(new URL('./match-cohort.mjs', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function pin(file, label = file) {
  const bytes = readFileSync(file);
  return { file: label, bytes: bytes.length, sha256: digest(bytes) };
}
function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function report(seed, overrides = {}) {
  return {
    seed,
    ruleset: '1'.repeat(64),
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    outcome: 'victory',
    winner: 'blue',
    finalTick: 5,
    checkedTicks: 5,
    roundTrips: 1,
    futureChecks: 0,
    futureCheckedTicks: 0,
    finalStateSha256: '2'.repeat(64),
    ...overrides,
  };
}
function fixture(t) {
  const base = mkdtempSync(resolve(tmpdir(), 'cohort resume ')),
    project = base + '/project',
    root = base + '/cohort',
    procRoot = base + '/proc';
  for (const path of [
    project + '/tools/qa',
    root + '/runner',
    root + '/maps',
    root + '/seeds/3',
    procRoot,
  ])
    mkdirSync(path, { recursive: true });
  const controller = project + '/tools/qa/match-cohort.mjs';
  copyFileSync(canonical, controller);
  assert.equal(pin(controller).sha256, SUPPORTED_CONTROLLER_SHA256);
  writeFileSync(project + '/source.txt', 'frozen fixture input\n');
  for (const name of ['rift-nav.bin', 'rift-nav.json', 'rift-layout.json'])
    writeFileSync(root + '/maps/' + name, 'fixture:' + name);
  const runner = root + '/runner/match-seed.js';
  writeFileSync(
    runner,
    `import {mkdirSync,writeFileSync} from 'node:fs';
const args=process.argv.slice(2),output=args[args.indexOf('--output')+1],seed=Number(args.at(-1));
mkdirSync(output);await new Promise(r=>setTimeout(r,20));
writeFileSync(output+'/report.json',JSON.stringify({...${JSON.stringify(report(0))},seed,finalTick:1,checkedTicks:1})+'\\n');
console.log(JSON.stringify({fixtureWorker:seed}));\n`
  );
  const plan = {
    format: 1,
    ruleset: '1'.repeat(64),
    seeds: [1, 2, 3, 4],
    jobs: 2,
    horizonTicks: 3600,
    developmentLeona: false,
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      cpu: cpus()[0]?.model,
    },
    runner: pin(runner),
    inputs: ['rift-nav.bin', 'rift-nav.json', 'rift-layout.json'].map((name) =>
      pin(root + '/maps/' + name)
    ),
    sources: [
      pin(controller, 'tools/qa/match-cohort.mjs'),
      pin(project + '/source.txt', 'source.txt'),
    ],
  };
  const accepted = report(3);
  writeFileSync(root + '/seeds/3/report.json', JSON.stringify(accepted, null, 3) + '\n\n');
  writeFileSync(root + '/seed-3.log', 'accepted worker log stays exact\n');
  const status = {
    format: 1,
    root,
    ruleset: plan.ruleset,
    completed: 1,
    requested: 4,
    failures: 0,
    victories: 1,
    unfinished: 0,
    results: [accepted],
    elapsedSeconds: 12,
  };
  writeJson(root + '/plan.json', plan);
  writeJson(root + '/status.json', status);
  const f = { base, project, root, procRoot, runner, plan, status, controller, launch: null };
  t.after(() => {
    if (f.launch?.launcherPid && !existsSync(f.launch.recovery + '/supervisor-exit.json')) {
      try {
        const argv = readFileSync(`/proc/${f.launch.launcherPid}/cmdline`).toString().split('\0');
        if (argv.includes(root)) process.kill(-f.launch.launcherPid, 'SIGKILL');
      } catch (error) {
        if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
      }
    }
    if (t.passed === true && process.env.COHORT_RESUME_RETAIN_FIXTURES !== '1')
      rmSync(base, { recursive: true, force: true });
    else t.diagnostic('Retained fixture: ' + base);
  });
  return f;
}
function inspect(f) {
  return inspectResume({ output: f.root, project: f.project, procRoot: f.procRoot });
}
function interrupted(f, seed = 1) {
  const directory = `${f.root}/seeds/${seed}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(directory + '/000123.match.json', '{"retained":"partial checkpoint"}\n');
  writeJson(directory + '/progress.json', { seed, tick: 123 });
  writeFileSync(`${f.root}/seed-${seed}.log`, 'partial worker log\n');
  return directory;
}
async function waitFor(file, timeout = 15000) {
  const until = Date.now() + timeout;
  while (!existsSync(file) && Date.now() < until) await pause(25);
  assert(existsSync(file), `Missing ${file}`);
}
function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesBelow(resolve(root, e.name)) : [resolve(root, e.name)]
  );
}

test('resume preflight retains non-prefix completions and identifies interrupted output without writes', (t) => {
  const f = fixture(t);
  interrupted(f);
  const before = filesBelow(f.root).map((file) => pin(file));
  const inspected = inspect(f);
  assert.deepEqual(
    inspected.completed.map((r) => r.seed),
    [3]
  );
  assert.deepEqual(inspected.pending, [1, 2, 4]);
  assert.deepEqual(
    inspected.attempts.map((r) => r.seed),
    [1]
  );
  assert.deepEqual(
    filesBelow(f.root).map((file) => pin(file)),
    before
  );
});

test('exact argv ownership handles spaces and relative output without matching shell text', (t) => {
  const f = fixture(t);
  function proc(pid, argv) {
    const dir = `${f.procRoot}/${pid}`;
    mkdirSync(dir);
    writeFileSync(dir + '/cmdline', argv.join('\0') + '\0');
    symlinkSync(f.base, dir + '/cwd');
  }
  proc(101, ['node', '/private/match-cohort.mjs', '--output', 'cohort']);
  proc(102, ['node', f.runner, '--output', f.root + '/seeds/1']);
  proc(103, ['bash', '-lc', `node ${f.runner} --output ${f.root}`]);
  assert.deepEqual(
    ownedProcesses(f.root, f.runner, f.procRoot).map((r) => [r.pid, r.kind]),
    [
      [101, 'supervisor'],
      [102, 'worker'],
    ]
  );
  assert.throws(() => inspect(f), { code: 'COHORT_LIVE' });
});

test('runtime and frozen source mismatches refuse before altering evidence', (t) => {
  const f = fixture(t),
    original = readFileSync(f.root + '/status.json');
  f.plan.runtime.v8 = 'incompatible';
  writeJson(f.root + '/plan.json', f.plan);
  assert.throws(() => inspect(f), { code: 'COHORT_RUNTIME_MISMATCH' });
  f.plan.runtime.v8 = process.versions.v8;
  writeJson(f.root + '/plan.json', f.plan);
  writeFileSync(f.project + '/source.txt', 'changed input');
  assert.throws(() => inspect(f), { code: 'COHORT_PIN_MISMATCH' });
  assert.deepEqual(readFileSync(f.root + '/status.json'), original);
  assert(!existsSync(f.root + '/recovery'));
});

test('changed accepted reports and unknown controller formats cannot be resumed', (t) => {
  const f = fixture(t),
    path = f.root + '/seeds/3/report.json',
    bytes = readFileSync(path);
  writeJson(path, report(3, { finalTick: 6 }));
  assert.throws(() => inspect(f), { code: 'COHORT_REPORT_MISMATCH' });
  writeFileSync(path, bytes);
  writeFileSync(f.controller, readFileSync(f.controller, 'utf8') + '\n// unknown controller\n');
  f.plan.sources[0] = pin(f.controller, 'tools/qa/match-cohort.mjs');
  writeJson(f.root + '/plan.json', f.plan);
  assert.throws(() => inspect(f), { code: 'COHORT_UNSUPPORTED_CONTROLLER' });
  assert(!existsSync(f.root + '/recovery'));
});

test('both accepted and unaccepted recorded failures are retained rather than retried', (t) => {
  const f = fixture(t);
  f.status.results[0].outcome = 'failed';
  f.status.failures = 1;
  writeJson(f.root + '/status.json', f.status);
  assert.throws(() => inspect(f), { code: 'COHORT_RECORDED_FAILURE' });
  f.status.results[0].outcome = 'victory';
  f.status.failures = 0;
  writeJson(f.root + '/status.json', f.status);
  mkdirSync(f.root + '/seeds/2');
  const failed = f.root + '/seeds/2/report.json';
  writeJson(failed, report(2, { outcome: 'failed', failure: { message: 'real fixture failure' } }));
  const bytes = readFileSync(failed);
  assert.throws(() => inspect(f), { code: 'COHORT_RECORDED_FAILURE' });
  assert.deepEqual(readFileSync(failed), bytes);
  assert(!existsSync(f.root + '/recovery'));
});

test('the internal preparation driver refuses mutation without the OS lock', (t) => {
  const f = fixture(t);
  interrupted(f);
  const bytes = readFileSync(f.root + '/seeds/1/progress.json');
  assert.throws(
    () =>
      prepareRecovery({
        output: f.root,
        project: f.project,
        recoveryId: 'unlocked',
        readyFile: f.root + '/recovery/requests/x/ready.json',
      }),
    { code: 'COHORT_LOCK_REQUIRED' }
  );
  assert.deepEqual(readFileSync(f.root + '/seeds/1/progress.json'), bytes);
  assert(!existsSync(f.root + '/recovery'));
});

test('flock rejects a duplicate recovery even before a supervisor has launched', async (t) => {
  const f = fixture(t),
    directory = interrupted(f),
    bytes = readFileSync(directory + '/progress.json'),
    lock = f.root + '/.resume.lock';
  const holder = spawn(
    'flock',
    [
      '--close',
      lock,
      process.execPath,
      '--input-type=module',
      '-e',
      'console.log("held");setTimeout(()=>{},1800)',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  await new Promise((yes, no) => {
    holder.once('error', no);
    holder.stdout.once('data', yes);
  });
  try {
    let error;
    try {
      execFileSync(process.execPath, [cli, '--output', f.root, '--project', f.project], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (e) {
      error = e;
    }
    assert(error);
    assert.equal(JSON.parse(error.stderr.trim()).code, 'COHORT_LOCKED');
    assert.deepEqual(readFileSync(directory + '/progress.json'), bytes);
    assert(!filesBelow(f.root).some((file) => file.endsWith('/recovery.json')));
  } finally {
    await new Promise((yes) => holder.once('close', yes));
  }
});

test('a real locked recovery preserves accepted bytes, archives partial attempts and runs only pending fixture seeds', async (t) => {
  const f = fixture(t),
    directory = interrupted(f),
    partial = readFileSync(directory + '/000123.match.json'),
    accepted = readFileSync(f.root + '/seeds/3/report.json'),
    plan = readFileSync(f.root + '/plan.json');
  mkdirSync(f.root + '/seeds/2');
  writeJson(f.root + '/seeds/2/report.json', report(2));
  const unconfirmed = readFileSync(f.root + '/seeds/2/report.json');
  const output = execFileSync(process.execPath, [cli, '--output', f.root, '--project', f.project], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  f.launch = JSON.parse(output.trim());
  assert.equal(f.launch.result, 'started');
  assert.deepEqual(f.launch.pending, [1, 2, 4]);
  assert.deepEqual(f.launch.dispatchOrder, [3, 1, 2, 4]);
  await waitFor(f.launch.recovery + '/supervisor-exit.json');
  const summary = JSON.parse(readFileSync(f.root + '/summary.json'));
  assert.equal(summary.completed, 4);
  assert.equal(summary.failures, 0);
  assert.deepEqual(
    summary.results.map((r) => r.seed),
    [1, 2, 3, 4]
  );
  assert.deepEqual(readFileSync(f.root + '/plan.json'), plan);
  assert.deepEqual(readFileSync(f.root + '/seeds/3/report.json'), accepted);
  assert.equal(JSON.parse(readFileSync(f.root + '/seeds/3/report.json')).finalTick, 5);
  assert.deepEqual(
    readFileSync(f.launch.recovery + '/interrupted/seeds/1/000123.match.json'),
    partial
  );
  assert.deepEqual(
    readFileSync(f.launch.recovery + '/interrupted/seeds/2/report.json'),
    unconfirmed
  );
  assert.equal(JSON.parse(readFileSync(f.root + '/seeds/2/report.json')).finalTick, 1);
  const record = JSON.parse(readFileSync(f.launch.recovery + '/recovery.json'));
  assert.deepEqual(record.restartsFromZero, [1, 2]);
  assert(record.canonicalDispatchInvariantTail.byteIdentical);
  assert.equal(record.claimsUninterruptedExecution, false);
  assert.equal(record.simulationSourceChanged, false);
  const generated = readFileSync(record.controller.file, 'utf8'),
    source = readFileSync(canonical, 'utf8');
  assert.equal(
    generated.slice(generated.indexOf('function state()')),
    source.slice(source.indexOf('function state()'))
  );
});

test('accepted terminal coverage and winner metadata must remain valid even when status matches', (t) => {
  const f = fixture(t);
  for (const change of [
    { finalTick: -1, checkedTicks: -1, roundTrips: 0 },
    { finalTick: 3601, checkedTicks: 3601, roundTrips: 2 },
    { finalStateSha256: 'invalid' },
    { outcome: 'unfinished', finalTick: 3600, checkedTicks: 3600, winner: 'blue' },
    { winner: 'unknown' },
  ]) {
    const row = report(3, change);
    f.status.results = [row];
    writeJson(f.root + '/status.json', f.status);
    writeJson(f.root + '/seeds/3/report.json', row);
    assert.throws(() => inspect(f), { code: 'COHORT_REPORT_INVALID' });
  }
  assert(!existsSync(f.root + '/recovery'));
});

test('all accepted results can restore a missing summary without rerunning a seed', async (t) => {
  const f = fixture(t);
  for (const seed of [1, 2, 4]) {
    mkdirSync(`${f.root}/seeds/${seed}`);
    writeJson(`${f.root}/seeds/${seed}/report.json`, report(seed));
    writeFileSync(`${f.root}/seed-${seed}.log`, 'accepted log\n');
  }
  f.status.results = f.plan.seeds.map((seed) =>
    JSON.parse(readFileSync(`${f.root}/seeds/${seed}/report.json`))
  );
  f.status.completed = 4;
  f.status.victories = 4;
  writeJson(f.root + '/status.json', f.status);
  const before = f.plan.seeds.map((seed) => pin(`${f.root}/seeds/${seed}/report.json`));
  f.launch = JSON.parse(
    execFileSync(process.execPath, [cli, '--output', f.root, '--project', f.project], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  );
  assert.deepEqual(f.launch.pending, []);
  await waitFor(f.launch.recovery + '/supervisor-exit.json');
  assert.deepEqual(
    f.plan.seeds.map((seed) => pin(`${f.root}/seeds/${seed}/report.json`)),
    before
  );
  assert.equal(JSON.parse(readFileSync(f.root + '/summary.json')).completed, 4);
  assert.deepEqual(
    JSON.parse(readFileSync(f.launch.recovery + '/recovery.json')).restartsFromZero,
    []
  );
});

test('an archive rename failure rolls earlier moves back and keeps a failure receipt', (t) => {
  const f = fixture(t),
    directory = interrupted(f),
    checkpoint = readFileSync(directory + '/000123.match.json'),
    log = readFileSync(f.root + '/seed-1.log');
  const moduleUrl = new URL('./lib/cohort-resume.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict';import{renameSync}from'node:fs';import{prepareRecovery}from${JSON.stringify(moduleUrl)};
let calls=0;assert.throws(()=>prepareRecovery({output:${JSON.stringify(f.root)},project:${JSON.stringify(f.project)},recoveryId:'rollback',readyFile:${JSON.stringify(f.root + '/recovery/requests/test/ready.json')},renameFile(from,to){if(++calls===2)throw Object.assign(Error('fixture IO failure'),{code:'EIO'});renameSync(from,to);}}),{code:'EIO'});`;
  execFileSync(
    'flock',
    ['--close', f.root + '/.resume.lock', process.execPath, '--input-type=module', '-e', script],
    { stdio: 'pipe' }
  );
  assert.deepEqual(readFileSync(directory + '/000123.match.json'), checkpoint);
  assert.deepEqual(readFileSync(f.root + '/seed-1.log'), log);
  const receipt = JSON.parse(readFileSync(f.root + '/recovery/rollback/preparation-failure.json'));
  assert.deepEqual(receipt.rollbackErrors, []);
  assert(!existsSync(f.root + '/recovery/rollback/recovery.json'));
});

test('cohort directories and seed outputs cannot redirect recovery through symbolic links', (t) => {
  for (const kind of ['maps', 'recovery', 'seed']) {
    const f = fixture(t),
      outside = f.base + '/outside';
    mkdirSync(outside);
    if (kind === 'maps') {
      rmSync(f.root + '/maps', { recursive: true });
      symlinkSync(outside, f.root + '/maps');
    } else if (kind === 'recovery') symlinkSync(outside, f.root + '/recovery');
    else symlinkSync(outside, f.root + '/seeds/1');
    assert.throws(() => inspect(f), { code: 'COHORT_PATH_UNSAFE' });
    assert.deepEqual(readdirSync(outside), []);
  }
});

test('detached readiness returns while fixture workers are active and keeps the owner discoverable', async (t) => {
  const f = fixture(t),
    barrier = f.base + '/release-workers';
  let source = readFileSync(f.runner, 'utf8').replace(
    '{mkdirSync,writeFileSync}',
    '{mkdirSync,writeFileSync,existsSync}'
  );
  source = source.replace(
    'await new Promise(r=>setTimeout(r,20));',
    `const deadline=Date.now()+5000;while(!existsSync(${JSON.stringify(barrier)})){if(Date.now()>deadline)throw Error('fixture barrier timeout');await new Promise(r=>setTimeout(r,25));}`
  );
  writeFileSync(f.runner, source);
  f.plan.runner = pin(f.runner);
  writeJson(f.root + '/plan.json', f.plan);
  f.launch = JSON.parse(
    execFileSync(process.execPath, [cli, '--output', f.root, '--project', f.project], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  );
  assert(Number.isInteger(f.launch.launcherPid));
  assert(!existsSync(f.root + '/summary.json'));
  assert(
    ownedProcesses(f.root, f.runner).some(
      (owner) => owner.pid === f.launch.pid && owner.kind === 'supervisor'
    )
  );
  writeFileSync(barrier, 'release\n');
  await waitFor(f.launch.recovery + '/supervisor-exit.json');
  assert.equal(JSON.parse(readFileSync(f.root + '/summary.json')).completed, 4);
});
