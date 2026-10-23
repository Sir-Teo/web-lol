/** Immutable per-seed process pool. Stop dispatch on failure; drain live handles. */
import { build } from 'vite';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  renameSync,
  copyFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { parseArgs } from 'node:util';
import { rulesetFiles, rulesetFingerprint } from '../ruleset-fingerprint.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    jobs: { type: 'string', default: '4' },
    minutes: { type: 'string', default: '60' },
    output: { type: 'string' },
    'keep-going': { type: 'boolean', default: false },
  },
});
const jobs = Number(values.jobs),
  minutes = Number(values.minutes);
const seeds = positionals.length
  ? positionals.map(Number)
  : [
      26018,
      719,
      1,
      927,
      ...Array.from({ length: 93 }, (_, index) => index + 2),
      0x7fffffff,
      0x80000000,
      0xffffffff,
    ];
if (
  !Number.isInteger(jobs) ||
  jobs < 1 ||
  jobs > 8 ||
  !Number.isInteger(minutes) ||
  minutes < 1 ||
  minutes > 120 ||
  seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) ||
  new Set(seeds).size !== seeds.length
)
  throw new Error('Use 1..8 jobs, 1..120 minutes, and unique positive uint32 seeds.');
const ruleset = rulesetFingerprint();
const root = resolve(
  values.output ??
    `.cache/match-cohort/${ruleset.slice(0, 12)}-${new Date().toISOString().replace(/[^a-z0-9]/gi, '-')}`
);
if (existsSync(root)) throw new Error('Cohort directory already exists; use a fresh output.');
mkdirSync(root, { recursive: true });
const pin = (file) => {
  const bytes = readFileSync(file);
  return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const sources = [
  ...new Set([
    ...rulesetFiles,
    'tools/qa/match-cohort.mjs',
    'tools/qa/match-seed.ts',
    'tools/qa/match-contract.ts',
    'tools/qa/verify-match-cohort.mjs',
  ]),
]
  .sort()
  .map(pin);
mkdirSync(`${root}/maps`);
const inputs = ['rift-nav.bin', 'rift-nav.json', 'rift-layout.json'].map((name) => {
  const file = `${root}/maps/${name}`;
  copyFileSync(`public/assets/maps/${name}`, file);
  return pin(file);
});
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  define: { __SIMULATION_HASH__: JSON.stringify(ruleset) },
  ssr: { noExternal: true },
  build: {
    ssr: 'tools/qa/match-seed.ts',
    outDir: `${root}/runner`,
    emptyOutDir: true,
    minify: false,
  },
});
for (const source of sources) {
  if (pin(source.file).sha256 !== source.sha256)
    throw new Error(`Source changed while freezing: ${source.file}`);
}
for (const input of inputs) {
  const source = sources.find(
    (entry) => entry.file === `public/assets/maps/${input.file.split('/').at(-1)}`
  );
  if (source?.sha256 !== input.sha256) throw new Error('Map changed while freezing');
}
const runner = `${root}/runner/match-seed.js`;
const plan = {
  format: 1,
  ruleset,
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  createdAt: new Date().toISOString(),
  seeds,
  jobs,
  horizonTicks: minutes * 3600,
  qaAutomatedHumanCarry: true,
  roster: 'six Ashe/four Lux; five roles per team',
  runtime: {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0].model,
  },
  sources,
  inputs,
  runner: pin(runner),
  invariantContract:
    'per-tick finite resources/economy, protected structure damage, minute checkpoint equality and following 60-tick future, final victory dependencies',
};
writeFileSync(`${root}/plan.json`, JSON.stringify(plan, null, 2) + '\n');
const results = [],
  active = new Map();
let next = 0,
  halted = false,
  interrupted = false;
const started = Date.now();
function state() {
  const victories = results.filter((r) => r.outcome === 'victory'),
    failed = results.filter((r) => r.outcome === 'failed');
  const unfinished = results.filter((r) => r.outcome === 'unfinished');
  const durations = victories.map((r) => r.finalTick / 60).sort((a, b) => a - b);
  const percentile = (p) =>
    durations.length ? durations[Math.ceil(p * durations.length) - 1] : null;
  return {
    format: 1,
    ruleset,
    root,
    status: active.size
      ? 'running'
      : next >= seeds.length
        ? 'completed'
        : interrupted
          ? 'interrupted'
          : halted
            ? 'stopped-on-failure'
            : 'preparing',
    completed: results.length,
    requested: seeds.length,
    queued: seeds.slice(next),
    active: [...active].map(([seed, child]) => {
      let progress = null;
      try {
        progress = JSON.parse(readFileSync(`${root}/seeds/${seed}/progress.json`, 'utf8'));
      } catch {}
      return { seed, pid: child.pid, progress };
    }),
    victories: victories.length,
    unfinished: unfinished.length,
    failures: failed.length,
    checkedTicks: results.reduce((s, r) => s + (r.checkedTicks ?? 0), 0),
    roundTrips: results.reduce((s, r) => s + (r.roundTrips ?? 0), 0),
    futureChecks: results.reduce((s, r) => s + (r.futureChecks ?? 0), 0),
    futureCheckedTicks: results.reduce((s, r) => s + (r.futureCheckedTicks ?? 0), 0),
    completionRate: results.length ? victories.length / results.length : null,
    victoryDurationSeconds: { p10: percentile(0.1), p50: percentile(0.5), p90: percentile(0.9) },
    allRequestedExecuted: results.length === seeds.length,
    hundredSeedInvariantGate:
      minutes === 60 &&
      seeds.length >= 100 &&
      results.length === seeds.length &&
      failed.length === 0,
    roadmapMilestone4Complete: false,
    elapsedSeconds: (Date.now() - started) / 1000,
    results: [...results].sort((a, b) => a.seed - b.seed),
  };
}
function persist() {
  const file = `${root}/status.json`;
  writeFileSync(file + '.tmp', JSON.stringify(state(), null, 2) + '\n');
  renameSync(file + '.tmp', file);
}
function launch(seed) {
  const log = openSync(`${root}/seed-${seed}.log`, 'wx');
  const child = spawn(
    process.execPath,
    [
      runner,
      '--minutes',
      String(minutes),
      '--data',
      `${root}/maps`,
      '--output',
      `${root}/seeds/${seed}`,
      String(seed),
    ],
    { stdio: ['ignore', log, log] }
  );
  closeSync(log);
  active.set(seed, child);
  return new Promise((yes) => {
    let spawnError = null;
    child.on('error', (error) => {
      spawnError = error.message;
    });
    child.on('close', (code, signal) => {
      let report;
      try {
        report = JSON.parse(readFileSync(`${root}/seeds/${seed}/report.json`, 'utf8'));
        if (report.seed !== seed || report.ruleset !== ruleset)
          throw new Error('Seed/ruleset mismatch');
        if (report.runtime.node !== plan.runtime.node || report.runtime.v8 !== plan.runtime.v8)
          throw new Error('Worker runtime differs from the frozen plan');
        if (!['victory', 'unfinished', 'failed'].includes(report.outcome))
          throw new Error('Unknown worker outcome');
        if (
          report.outcome !== 'failed' &&
          (report.checkedTicks !== report.finalTick ||
            report.finalTick > minutes * 3600 ||
            report.roundTrips !== Math.ceil(report.finalTick / 3600) ||
            !report.finalStateSha256)
        )
          throw new Error('Incomplete tick/checkpoint coverage');
        if (
          report.outcome === 'unfinished' &&
          (report.finalTick !== minutes * 3600 || report.winner !== null)
        )
          throw new Error('Unfinished match did not reach the requested horizon');
        if (code !== 0 && report.outcome !== 'failed')
          throw new Error(`Worker ended with ${code}/${signal}`);
      } catch (error) {
        report = {
          seed,
          ruleset,
          outcome: 'failed',
          failure: { message: spawnError ?? String(error) },
          exitCode: code,
          signal,
        };
      }
      results.push(report);
      active.delete(seed);
      if (report.outcome === 'failed' && !values['keep-going']) halted = true;
      persist();
      console.log(
        JSON.stringify({
          seed,
          completed: results.length,
          requested: seeds.length,
          outcome: report.outcome,
          tick: report.finalTick,
          failure: report.failure?.message ?? null,
        })
      );
      yes();
    });
  });
}
function interrupt() {
  interrupted = true;
  halted = true;
  persist();
  console.log('Stopping dispatch; waiting for owned seed processes to finish.');
}
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const heartbeat = setInterval(() => {
  persist();
  const s = state();
  console.log(
    JSON.stringify({
      type: 'progress',
      completed: s.completed,
      requested: s.requested,
      active: s.active.map((r) => ({ seed: r.seed, pid: r.pid, tick: r.progress?.tick ?? 0 })),
      elapsedSeconds: s.elapsedSeconds,
    })
  );
}, 45000);
try {
  console.log(
    JSON.stringify({ type: 'started', root, ruleset, jobs, seeds: seeds.length, minutes })
  );
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (next < seeds.length && !halted) {
        const seed = seeds[next++];
        await launch(seed);
      }
    })
  );
} finally {
  clearInterval(heartbeat);
  persist();
}
const summary = state();
writeFileSync(`${root}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify({
    type: 'finished',
    root,
    status: summary.status,
    completed: summary.completed,
    victories: summary.victories,
    unfinished: summary.unfinished,
    failures: summary.failures,
    hundredSeedInvariantGate: summary.hundredSeedInvariantGate,
  })
);
if (summary.failures || interrupted) process.exitCode = 1;
