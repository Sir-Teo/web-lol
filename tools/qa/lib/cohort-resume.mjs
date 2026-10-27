/** Immutable cohort recovery preflight and evidence preparation. */
import {
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  renameSync,
  writeFileSync,
  statSync,
  lstatSync,
} from 'node:fs';
import { resolve, basename, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { cpus } from 'node:os';
import { spawnSync } from 'node:child_process';
export const SUPPORTED_CONTROLLER_SHA256 =
  '23d32770882f4c6958326b7bf9e44931a45cfd3ed867276ba06ab25185ea7c45';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function check(condition, message, code = 'COHORT_INVALID') {
  if (!condition) throw Object.assign(new Error(message), { code });
}
function inside(root, file) {
  const path = relative(root, file);
  return path !== '..' && !path.startsWith('../') && !isAbsolute(path);
}
function json(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
function verify(row, file) {
  const bytes = readFileSync(file);
  check(
    bytes.length === row.bytes && sha(bytes) === row.sha256,
    `Frozen input differs: ${file}`,
    'COHORT_PIN_MISMATCH'
  );
  return { file, bytes: bytes.length, sha256: row.sha256 };
}
export function ownedProcesses(root, runner, procRoot = '/proc') {
  const owners = [];
  for (const entry of readdirSync(procRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const prefix = resolve(procRoot, entry.name);
    let bytes, argv;
    try {
      bytes = readFileSync(prefix + '/cmdline');
      argv = bytes.toString().split('\0').filter(Boolean);
    } catch (error) {
      if (error.code === 'EACCES')
        throw Object.assign(new Error('Process ownership is not fully visible.'), {
          code: 'COHORT_PROCESS_VISIBILITY',
        });
      if (['ENOENT', 'ESRCH'].includes(error.code)) continue;
      throw error;
    }
    let kind = argv.includes(runner) ? 'worker' : null;
    if (!kind && basename(argv[1] ?? '') === 'match-cohort.mjs') {
      const i = argv.indexOf('--output');
      if (i >= 0 && argv[i + 1]) {
        try {
          if (
            (isAbsolute(argv[i + 1])
              ? resolve(argv[i + 1])
              : resolve(readlinkSync(prefix + '/cwd'), argv[i + 1])) === root
          )
            kind = 'supervisor';
        } catch (error) {
          if (error.code === 'EACCES')
            throw Object.assign(
              new Error('Potential cohort owner working directory is not visible.'),
              { code: 'COHORT_PROCESS_VISIBILITY' }
            );
          if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
        }
      }
    }
    if (kind) owners.push({ pid: Number(entry.name), kind, cmdlineSha256: sha(bytes) });
  }
  return owners;
}
export function inspectResume({ output, project, procRoot = '/proc' }) {
  const root = realpathSync(output),
    sourceRoot = realpathSync(project),
    planBytes = readFileSync(root + '/plan.json'),
    plan = JSON.parse(planBytes);
  for (const name of ['runner', 'maps', 'seeds', 'recovery']) {
    const path = resolve(root, name);
    if (existsSync(path))
      check(
        lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink(),
        `Cohort directory is unsafe: ${path}`,
        'COHORT_PATH_UNSAFE'
      );
  }
  check(
    plan.format === 1 && Array.isArray(plan.seeds) && plan.seeds.length > 0,
    'Unsupported or empty cohort plan.'
  );
  check(
    plan.seeds.every((n) => Number.isInteger(n) && n >= 1 && n <= 0xffffffff) &&
      new Set(plan.seeds).size === plan.seeds.length,
    'Invalid cohort seed list.'
  );
  check(
    Number.isInteger(plan.jobs) && plan.jobs >= 1 && plan.jobs <= 8,
    'Invalid frozen worker count.'
  );
  if (existsSync(root + '/seeds'))
    for (const item of readdirSync(root + '/seeds', { withFileTypes: true })) {
      check(
        item.isDirectory() &&
          !item.isSymbolicLink() &&
          plan.seeds.some((seed) => String(seed) === item.name),
        `Unexpected seed output: ${item.name}`,
        'COHORT_PATH_UNSAFE'
      );
    }
  check(
    Number.isInteger(plan.horizonTicks / 3600) &&
      plan.horizonTicks >= 3600 &&
      plan.horizonTicks <= 120 * 3600,
    'Invalid frozen horizon.'
  );
  for (const [key, value] of Object.entries({
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  }))
    check(
      plan.runtime?.[key] === value,
      `Frozen runtime differs: ${key}`,
      'COHORT_RUNTIME_MISMATCH'
    );
  if (plan.runtime.cpu)
    check(plan.runtime.cpu === cpus()[0]?.model, 'Frozen CPU differs.', 'COHORT_RUNTIME_MISMATCH');
  const runner = resolve(plan.runner.file);
  check(inside(root + '/runner', runner), 'Runner escapes cohort root.');
  const owners = ownedProcesses(root, runner, procRoot);
  check(
    owners.length === 0,
    `Cohort has live owned processes: ${owners.map((o) => `${o.kind}:${o.pid}`).join(', ')}`,
    'COHORT_LIVE'
  );
  const pins = [verify(plan.runner, runner)];
  for (const row of plan.inputs) {
    const file = resolve(row.file);
    check(inside(root + '/maps', file), 'Map input escapes cohort root.');
    pins.push(verify(row, file));
  }
  for (const row of plan.sources) {
    const file = resolve(sourceRoot, row.file);
    check(inside(sourceRoot, file), 'Source input escapes project root.');
    pins.push(verify(row, file));
  }
  const controllerRow = plan.sources.find((row) => row.file === 'tools/qa/match-cohort.mjs');
  check(
    controllerRow?.sha256 === SUPPORTED_CONTROLLER_SHA256,
    'Unsupported frozen controller format.',
    'COHORT_UNSUPPORTED_CONTROLLER'
  );
  const statusBytes = readFileSync(root + '/status.json'),
    status = JSON.parse(statusBytes);
  check(
    status.ruleset === plan.ruleset &&
      resolve(status.root) === root &&
      Array.isArray(status.results),
    'Status identity differs from plan.'
  );
  check(
    status.completed === status.results.length && status.requested === plan.seeds.length,
    'Status result count differs from plan.'
  );
  check(
    new Set(status.results.map((r) => r.seed)).size === status.results.length,
    'Duplicate completed seed.'
  );
  check(
    status.failures === 0 && !status.results.some((r) => r.outcome === 'failed'),
    'Cohort contains a recorded failure; retain and diagnose it.',
    'COHORT_RECORDED_FAILURE'
  );
  const completed = [],
    attempts = [],
    accepted = new Set();
  for (const row of status.results) {
    check(plan.seeds.includes(row.seed), 'Completed seed is outside plan.');
    const file = `${root}/seeds/${row.seed}/report.json`,
      report = json(file);
    check(
      isDeepStrictEqual(report, row),
      `Accepted report differs: ${row.seed}`,
      'COHORT_REPORT_MISMATCH'
    );
    check(
      report.ruleset === plan.ruleset &&
        ['node', 'v8', 'platform', 'arch'].every(
          (key) => report.runtime?.[key] === plan.runtime[key]
        ),
      `Accepted report identity differs: ${row.seed}`
    );
    check(
      ['victory', 'unfinished'].includes(report.outcome) &&
        Number.isSafeInteger(report.finalTick) &&
        report.finalTick > 0 &&
        report.checkedTicks === report.finalTick &&
        report.finalTick <= plan.horizonTicks &&
        report.roundTrips === Math.ceil(report.finalTick / 3600) &&
        /^[0-9a-f]{64}$/.test(report.finalStateSha256) &&
        ['futureChecks', 'futureCheckedTicks'].every(
          (key) => Number.isSafeInteger(report[key]) && report[key] >= 0
        ),
      `Incomplete accepted report: ${row.seed}`,
      'COHORT_REPORT_INVALID'
    );
    if (report.outcome === 'unfinished')
      check(
        report.finalTick === plan.horizonTicks && report.winner === null,
        'Unfinished report has invalid horizon/winner.',
        'COHORT_REPORT_INVALID'
      );
    else
      check(
        ['blue', 'red'].includes(report.winner),
        'Victory report has invalid winner.',
        'COHORT_REPORT_INVALID'
      );
    const bytes = readFileSync(file);
    completed.push({ seed: row.seed, file, bytes: bytes.length, sha256: sha(bytes) });
    accepted.add(row.seed);
  }
  for (const seed of plan.seeds.filter((seed) => !accepted.has(seed))) {
    const directory = `${root}/seeds/${seed}`,
      reportFile = directory + '/report.json';
    if (existsSync(reportFile))
      check(
        json(reportFile).outcome !== 'failed',
        `Unaccepted worker report records a failure: ${seed}`,
        'COHORT_RECORDED_FAILURE'
      );
    if (existsSync(directory) || existsSync(`${root}/seed-${seed}.log`))
      attempts.push({
        seed,
        directory,
        log: `${root}/seed-${seed}.log`,
        unconfirmedTerminal: existsSync(reportFile),
      });
  }
  return {
    root,
    project: sourceRoot,
    plan,
    status,
    pins,
    completed,
    attempts,
    controller: resolve(sourceRoot, controllerRow.file),
    planSha256: sha(planBytes),
    statusSha256: sha(statusBytes),
    pending: plan.seeds.filter((seed) => !accepted.has(seed)),
  };
}

/** The driver must run beneath util-linux flock, which owns this inode. */
export function assertRecoveryLock(root) {
  check(
    process.platform === 'linux',
    'Cohort recovery currently requires Linux /proc and flock.',
    'COHORT_LOCK_UNSUPPORTED'
  );
  const file = resolve(root, '.resume.lock');
  check(
    existsSync(file) && lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(),
    'Recovery driver requires a regular exclusive flock file.',
    'COHORT_LOCK_REQUIRED'
  );
  const inode = statSync(file, { bigint: true }).ino.toString();
  const argv = readFileSync(`/proc/${process.ppid}/cmdline`).toString().split('\0').filter(Boolean);
  check(
    basename(argv[0]) === 'flock' && argv.includes(file),
    'Recovery driver requires the exclusive cohort flock.',
    'COHORT_LOCK_REQUIRED'
  );
  const held = readFileSync('/proc/locks', 'utf8')
    .split('\n')
    .some((line) => {
      const fields = line.trim().split(/\s+/);
      return (
        fields[1] === 'FLOCK' &&
        fields[3] === 'WRITE' &&
        fields[4] === String(process.ppid) &&
        fields[5]?.split(':').at(-1) === inode
      );
    });
  check(held, 'Exclusive cohort flock is not held by the driver parent.', 'COHORT_LOCK_REQUIRED');
}
function filePin(file) {
  const bytes = readFileSync(file);
  return { file, bytes: bytes.length, sha256: sha(bytes) };
}
function treePins(directory) {
  check(
    lstatSync(directory).isDirectory(),
    `Interrupted output is not a regular directory: ${directory}`
  );
  const files = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, item.name);
    check(!item.isSymbolicLink(), `Interrupted evidence contains a symbolic link: ${file}`);
    if (item.isDirectory()) files.push(...treePins(file));
    else {
      check(item.isFile(), `Interrupted evidence is not a regular file: ${file}`);
      files.push(filePin(file));
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}
function controllerText(inspected, recovery, readyFile) {
  const source = readFileSync(inspected.controller, 'utf8');
  check(
    sha(source) === SUPPORTED_CONTROLLER_SHA256,
    'Frozen controller source changed.',
    'COHORT_UNSUPPORTED_CONTROLLER'
  );
  const offset = source.indexOf('function state()');
  check(
    offset >= 0 && source.indexOf('function state()', offset + 1) < 0,
    'Unsupported controller tail.'
  );
  const tail = source.slice(offset),
    literal = JSON.stringify;
  const preamble = `/** Recovery preamble; the canonical dispatch/invariant tail below is byte-exact. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, openSync, closeSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
const {values:cli}=parseArgs({options:{output:{type:'string'}}});
const root=resolve(cli.output);assert.equal(root,${literal(inspected.root)});
const plan=JSON.parse(readFileSync(root+'/plan.json','utf8'));
const baseline=JSON.parse(readFileSync(${literal(recovery + '/before-status.json')},'utf8'));
assert.equal(process.version,plan.runtime.node);assert.equal(process.versions.v8,plan.runtime.v8);
assert.equal(process.platform,plan.runtime.platform);assert.equal(process.arch,plan.runtime.arch);
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(hash(root+'/plan.json'),${literal(inspected.planSha256)});
for(const row of plan.sources)assert.equal(hash(resolve(${literal(inspected.project)},row.file)),row.sha256,row.file);
for(const row of [plan.runner,...plan.inputs])assert.equal(hash(row.file),row.sha256,row.file);
const results=baseline.results.map(row=>{const actual=JSON.parse(readFileSync(root+'/seeds/'+row.seed+'/report.json','utf8'));assert.deepEqual(actual,row);return actual;});
const accepted=new Set(results.map(row=>row.seed));
const seeds=[...plan.seeds.filter(seed=>accepted.has(seed)),...plan.seeds.filter(seed=>!accepted.has(seed))];
const ruleset=plan.ruleset,runner=plan.runner.file,jobs=plan.jobs,minutes=plan.horizonTicks/3600;
const values={'development-leona':plan.developmentLeona,'keep-going':false},active=new Map();
let next=results.length,halted=false,interrupted=false;
const started=Date.now()-(baseline.elapsedSeconds??0)*1000;
const recoveryLaunch={pid:process.pid,cmdlineSha256:createHash('sha256').update(readFileSync('/proc/self/cmdline')).digest('hex'),root,recovery:${literal(recovery)},completedRetained:results.length,pending:seeds.slice(next),dispatchOrder:seeds,claimsUninterruptedExecution:false};
writeFileSync(${literal(recovery + '/launch.json')},JSON.stringify(recoveryLaunch,null,2)+'\\n');
writeFileSync(${literal(readyFile)},JSON.stringify(recoveryLaunch,null,2)+'\\n');
console.log(JSON.stringify({type:'recovered',completedRetained:results.length,remaining:seeds.length-results.length,recovery:${literal(recovery)}}));
`;
  return { source: preamble + tail, tailSha256: sha(tail) };
}

/** Preflight is repeated under the OS lock. Interrupted evidence is moved, never deleted. */
export function prepareRecovery({
  output,
  project,
  recoveryId,
  readyFile,
  renameFile = renameSync,
}) {
  const root = realpathSync(output);
  assertRecoveryLock(root);
  const inspected = inspectResume({ output: root, project });
  check(/^[a-zA-Z0-9_-]+$/.test(recoveryId), 'Invalid recovery identifier.');
  check(
    typeof readyFile === 'string' && inside(resolve(root, 'recovery/requests'), resolve(readyFile)),
    'Startup receipt escapes the cohort request directory.'
  );
  const recovery = resolve(root, 'recovery', recoveryId);
  check(
    !existsSync(recovery),
    'Recovery evidence directory already exists.',
    'COHORT_RECOVERY_EXISTS'
  );
  const attempts = inspected.attempts.map((row) => {
    const files = existsSync(row.directory) ? treePins(row.directory) : [];
    if (existsSync(row.log))
      check(lstatSync(row.log).isFile(), 'Interrupted worker log is not a regular file.');
    return { ...row, files, logPin: existsSync(row.log) ? filePin(row.log) : null };
  });
  check(
    sha(readFileSync(root + '/plan.json')) === inspected.planSha256 &&
      sha(readFileSync(root + '/status.json')) === inspected.statusSha256,
    'Cohort changed during recovery preflight.',
    'COHORT_CHANGED'
  );
  check(
    ownedProcesses(root, inspected.plan.runner.file).length === 0,
    'Cohort became active during preflight.',
    'COHORT_LIVE'
  );
  const generated = controllerText(inspected, recovery, readyFile);
  const syntax = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: generated.source,
    encoding: 'utf8',
  });
  check(
    syntax.status === 0,
    'Generated controller syntax check failed: ' + syntax.stderr,
    'COHORT_CONTROLLER_SYNTAX'
  );
  mkdirSync(recovery, { recursive: true });
  copyFileSync(root + '/plan.json', recovery + '/before-plan.json');
  copyFileSync(root + '/status.json', recovery + '/before-status.json');
  mkdirSync(recovery + '/accepted');
  for (const row of inspected.completed) {
    verify(row, row.file);
    copyFileSync(row.file, `${recovery}/accepted/report-${row.seed}.json`);
  }
  const moved = [];
  try {
    for (const row of attempts) {
      const destination = `${recovery}/interrupted/seeds/${row.seed}`;
      if (existsSync(row.directory)) {
        mkdirSync(resolve(destination, '..'), { recursive: true });
        renameFile(row.directory, destination);
        moved.push([row.directory, destination]);
        for (const file of row.files) {
          file.retained = resolve(destination, relative(row.directory, file.file));
          verify(file, file.retained);
        }
      }
      if (row.logPin) {
        const log = `${recovery}/interrupted/seed-${row.seed}.log`;
        mkdirSync(resolve(log, '..'), { recursive: true });
        renameFile(row.log, log);
        moved.push([row.log, log]);
        row.logPin.retained = log;
        verify(row.logPin, log);
      }
    }
    const controller = recovery + '/supervisor/match-cohort.mjs';
    mkdirSync(resolve(controller, '..'));
    writeFileSync(controller, generated.source, { flag: 'wx' });
    const record = {
      format: 1,
      createdAt: new Date().toISOString(),
      root,
      project: inspected.project,
      originalPlan: filePin(recovery + '/before-plan.json'),
      originalStatus: filePin(recovery + '/before-status.json'),
      sourceInputsVerified: inspected.plan.sources.length,
      frozenRunner: inspected.plan.runner,
      frozenMaps: inspected.plan.inputs,
      completedRetained: inspected.completed,
      interruptedRetained: attempts,
      pendingSeeds: inspected.pending,
      controller: filePin(controller),
      canonicalControllerSha256: SUPPORTED_CONTROLLER_SHA256,
      canonicalDispatchInvariantTail: { sha256: generated.tailSha256, byteIdentical: true },
      restartsFromZero: attempts.map((row) => row.seed),
      claimsUninterruptedExecution: false,
      simulationSourceChanged: false,
    };
    writeFileSync(recovery + '/recovery.json', JSON.stringify(record, null, 2) + '\n', {
      flag: 'wx',
    });
    return { ...record, recovery, controller };
  } catch (error) {
    const rollbackErrors = [];
    for (const [from, to] of moved.reverse()) {
      try {
        check(!existsSync(from), `Rollback would overwrite ${from}`);
        renameFile(to, from);
      } catch (rollbackError) {
        rollbackErrors.push(String(rollbackError));
      }
    }
    writeFileSync(
      recovery + '/preparation-failure.json',
      JSON.stringify(
        {
          message: String(error),
          moved: moved.map(([from, to]) => ({ from, to })),
          rollbackErrors,
        },
        null,
        2
      ) + '\n'
    );
    if (rollbackErrors.length)
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Recovery preparation failed; rollback needs inspection.'
      );
    throw error;
  }
}
