/** Fresh diagnostic continuation using verified frozen source, with no ruleset bridge. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
const [directory, ledgerFile, seedText, minutesText, destination] = process.argv.slice(2);
assert(
  process.argv.length === 7,
  'Pass archive directory, frozen ledger, seed, additional minutes and fresh output directory'
);
const seed = Number(seedText),
  minutes = Number(minutesText),
  root = resolve(directory),
  output = resolve(destination);
assert(
  Number.isSafeInteger(seed) &&
    seed > 0 &&
    Number.isSafeInteger(minutes) &&
    minutes > 0 &&
    minutes <= 60,
  'Invalid seed/window'
);
assert(!existsSync(output), 'Continuation output already exists');
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const ledgerRaw = readFileSync(ledgerFile),
  ledger = JSON.parse(ledgerRaw);
const planRaw = readFileSync(resolve(root, 'plan.json')),
  plan = JSON.parse(planRaw);
assert.equal(
  sha(planRaw),
  ledger.evidence.find((row) => row.path.endsWith('/plan.json'))?.sha256,
  'Frozen plan differs'
);
assert.equal(plan.ruleset, ledger.ruleset);
assert.equal(process.version, plan.runtime.node, 'Use the original Node runtime');
assert.equal(process.versions.v8, plan.runtime.v8, 'Use the original V8 runtime');
assert(
  !plan.developmentLeona && !plan.developmentRoster,
  'This continuation supports the ordinary archived roster only'
);
const pin = ledger.seedLedger.find((row) => row.seed === seed);
assert(
  pin?.outcome === 'unfinished' && ledger.unfinishedSeeds.includes(seed),
  'Choose a pinned unfinished seed'
);
const reportRaw = readFileSync(resolve(root, 'seeds', String(seed), 'report.json'));
assert.equal(sha(reportRaw), pin.reportSha256, 'Frozen report differs');
const original = JSON.parse(reportRaw),
  snapshot = resolve(root, 'seeds', String(seed), basename(original.finalPath));
const raw = readFileSync(snapshot);
assert.equal(raw.at(-1), 10);
assert.equal(sha(raw.subarray(0, -1)), pin.finalStateSha256, 'Frozen final state differs');
assert.equal(original.ruleset, plan.ruleset);
assert.equal(original.finalTick, pin.finalTick);
const archive = resolve(root, 'frozen-source');
function verifySources() {
  for (const row of plan.sources) {
    assert(
      !row.file.split('/').includes('..') && !row.file.startsWith('/'),
      'Invalid archive source path'
    );
    const raw = readFileSync(resolve(archive, row.file));
    assert.equal(raw.length, row.bytes, 'Archived source extent differs: ' + row.file);
    assert.equal(sha(raw), row.sha256, 'Archived source differs: ' + row.file);
  }
  for (const row of plan.inputs) {
    const raw = readFileSync(resolve(root, 'maps', basename(row.file)));
    assert.equal(raw.length, row.bytes);
    assert.equal(sha(raw), row.sha256, 'Archived map differs');
  }
}
verifySources();
mkdirSync(output, { recursive: true });
const aliases = {
  'archived-world': 'src/simulation/world.ts',
  'archived-navgrid': 'src/simulation/navgrid.ts',
  'archived-rift': 'src/content/rift.ts',
  'archived-contract': 'tools/qa/match-contract.ts',
};
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  plugins: [
    {
      name: 'verified-archive-only',
      resolveId(id) {
        if (aliases[id]) return resolve(archive, aliases[id]);
      },
    },
  ],
  define: { __SIMULATION_HASH__: JSON.stringify(plan.ruleset) },
  ssr: { noExternal: true },
  build: {
    ssr: 'tools/qa/continue-archived-match.ts',
    outDir: resolve(output, 'runner'),
    emptyOutDir: false,
    minify: false,
  },
});
verifySources();
const runner = resolve(output, 'runner/continue-archived-match.js');
const job = {
  seed,
  snapshot,
  snapshotSha256: sha(raw),
  data: resolve(root, 'maps'),
  output,
  startTick: original.finalTick,
  stopTick: original.finalTick + minutes * 3600,
};
writeFileSync(resolve(output, 'job.json'), JSON.stringify(job, null, 2) + '\n', { flag: 'wx' });
const result = spawnSync(process.execPath, [runner, resolve(output, 'job.json')], {
  stdio: 'inherit',
});
assert.equal(result.status, 0, 'Archived continuation failed; retain its evidence');
verifySources();
const provenance = {
  format: 1,
  ruleset: plan.ruleset,
  seed,
  additionalMinutes: minutes,
  ledgerSha256: sha(ledgerRaw),
  planSha256: sha(planRaw),
  sourceFiles: plan.sources.length,
  originalReportSha256: sha(reportRaw),
  initialSnapshotSha256: sha(raw),
  runnerSha256: sha(readFileSync(runner)),
  workerSourceSha256: sha(readFileSync('tools/qa/continue-archived-match.ts')),
  controllerSha256: sha(readFileSync('tools/qa/continue-archived-match.mjs')),
  runtime: { node: process.version, v8: process.versions.v8 },
  limits: [
    'Archived source continuation, not current-ruleset acceptance.',
    'Original sixty-minute cohort results and snapshots remain unchanged.',
  ],
};
writeFileSync(resolve(output, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', {
  flag: 'wx',
});
