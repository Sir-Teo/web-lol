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
execFileSync(
  process.execPath,
  ['tools/qa/verify-match-cohort.mjs', resolve(directory), '--historical'],
  { stdio: 'pipe' }
);
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const rawPlan = readFileSync(resolve(directory, 'plan.json')),
  plan = JSON.parse(rawPlan);
assert.equal(plan.ruleset, '64f63c0976c13ca41aad687f2135c6b178706ffd62fe96720627ec87626dd537');
assert.equal(plan.sourceRevision, 'eac4f9fa375789091a8425e869d9da02f5f779e4');
assert.equal(
  sha(readFileSync('tests/helpers/ahri-r-visual-gameplay.ts')),
  JSON.parse(readFileSync('docs/reference/ahri/r-visual-gameplay-reference.json'))
    .scenarioHelperSha256
);
assert.equal(process.version, plan.runtime.node);
assert.equal(process.versions.v8, plan.runtime.v8);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const raw = readFileSync(resolve(archive, row.file));
  assert.equal(raw.length, row.bytes);
  assert.equal(sha(raw), row.sha256, row.file);
}
const temporary = mkdtempSync(resolve(tmpdir(), 'r-render-reference-'));
try {
  const aliases = {
    'r-render-reference-world': 'src/simulation/world.ts',
    'r-render-reference-field': 'src/content/practice-fixture.ts',
  };
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-spirit-rush-world',
        resolveId(id) {
          if (aliases[id]) return resolve(archive, aliases[id]);
        },
      },
    ],
    define: { __SIMULATION_HASH__: JSON.stringify(plan.ruleset) },
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-render-gameplay-reference.ts',
      outDir: temporary,
      emptyOutDir: false,
      minify: false,
    },
  });
  const runner = resolve(temporary, 'ahri-r-render-gameplay-reference.js'),
    results = resolve(temporary, 'samples.json');
  execFileSync(process.execPath, [runner, results], { stdio: 'inherit' });
  const record = {
    format: 1,
    ruleset: plan.ruleset,
    planSha256: sha(rawPlan),
    sourceFiles: plan.sources.length,
    runnerSha256: sha(readFileSync(runner)),
    scenarioHelperSha256: sha(readFileSync('tests/helpers/ahri-r-visual-gameplay.ts')),
    projectionHelperSha256: sha(readFileSync('tests/helpers/ahri-r-render-gameplay.ts')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-render-gameplay-reference.ts')),
    sourceRevision: plan.sourceRevision,
    excludedFields: ['version', 'ruleset'],
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-render-gameplay-reference.mjs')),
    runtime: { node: process.version, v8: process.versions.v8 },
    cases: JSON.parse(readFileSync(results)),
    limits: [
      'Archived gameplay baseline; no native client comparison.',
      'Only schema/ruleset are excluded; all R/Q/W/E/audio saved facts remain.',
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
