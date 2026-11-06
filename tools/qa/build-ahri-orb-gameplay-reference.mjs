/** Execute a verified frozen World; no current-World import or identity bridge. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
const [directory, output] = process.argv.slice(2);
assert(
  directory && output && process.argv.length === 4 && !existsSync(output),
  'Pass frozen cohort and fresh output file'
);
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const rawPlan = readFileSync(resolve(directory, 'plan.json')),
  plan = JSON.parse(rawPlan);
assert.equal(plan.ruleset, 'ae079c84268e4fd83c1d0c85568a6ea457f3b92f99d9f4adee58d15286085033');
assert.equal(process.version, plan.runtime.node);
assert.equal(process.versions.v8, plan.runtime.v8);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const raw = readFileSync(resolve(archive, row.file));
  assert.equal(raw.length, row.bytes);
  assert.equal(sha(raw), row.sha256, row.file);
}
const temporary = mkdtempSync(resolve(tmpdir(), 'orb-reference-'));
try {
  const aliases = {
    'orb-reference-world': 'src/simulation/world.ts',
    'orb-reference-field': 'src/content/practice-fixture.ts',
  };
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-orb-world',
        resolveId(id) {
          if (aliases[id]) return resolve(archive, aliases[id]);
        },
      },
    ],
    define: { __SIMULATION_HASH__: JSON.stringify(plan.ruleset) },
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-orb-gameplay-reference.ts',
      outDir: temporary,
      emptyOutDir: false,
      minify: false,
    },
  });
  const runner = resolve(temporary, 'ahri-orb-gameplay-reference.js'),
    results = resolve(temporary, 'samples.json');
  execFileSync(process.execPath, [runner, results], { stdio: 'inherit' });
  const record = {
    format: 1,
    ruleset: plan.ruleset,
    planSha256: sha(rawPlan),
    sourceFiles: plan.sources.length,
    runnerSha256: sha(readFileSync(runner)),
    scenarioHelperSha256: sha(readFileSync('tests/helpers/ahri-orb-gameplay.ts')),
    producerSha256: sha(readFileSync('tools/qa/build-ahri-orb-gameplay-reference.mjs')),
    runtime: { node: process.version, v8: process.versions.v8 },
    cases: JSON.parse(readFileSync(results)),
    limits: [
      'Archived gameplay baseline; no native client comparison.',
      'Only schema/ruleset and new Orb presentation history are excluded.',
    ],
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      cases: record.cases.length,
      samples: record.cases.reduce((n, c) => n + c.samples.length, 0),
      sourceFiles: plan.sources.length,
    })
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
