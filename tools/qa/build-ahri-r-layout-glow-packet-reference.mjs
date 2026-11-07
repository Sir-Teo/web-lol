import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const [directoryArg, output] = process.argv.slice(2);
assert(
  directoryArg && output && process.argv.length === 4 && !existsSync(output),
  'Pass frozen accepted layout-glow cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, 'bf6953c524b116f399a8a38b6b29cdbab23c3ccb2228774001f09aae0b681076');
assert.equal(plan.sourceRevision, 'e27cc4c46998d016c890dbeaef43fc2b970e8aaa');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
assert.equal(
  sha(readFileSync(resolve(directory, 'plan.json'))),
  '486459aad60107fd33f4961924c9fbfeded70378af2dc2c6e3faaf7114f3f960'
);
assert.equal(plan.sources.length, 697);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-layout-glow-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-layout-glow-packets',
        resolveId(id) {
          if (id === 'frozen-r-layout-glow-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-layout-glow-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(
    process.execPath,
    [resolve(temp, 'ahri-r-layout-glow-packet-reference.js'), result],
    {
      stdio: 'pipe',
    }
  );
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-layout-glow-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-layout-glow-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
    applicationRevision: 'e27cc4c46998d016c890dbeaef43fc2b970e8aaa',
    archivePlanSha256: '486459aad60107fd33f4961924c9fbfeded70378af2dc2c6e3faaf7114f3f960',
    ruleset: plan.ruleset,
    node: process.version,
    v8: process.versions.v8,
    verifiedArchiveFiles: plan.sources.length,
    sourceModuleSha256: sha(readFileSync(resolve(archive, 'src/render/ahri-r-particles.ts'))),
    context: 'boundObjectSize=100; root(t)={x:t*120,y:t*t*8,height:100,facing:t/4}',
    samples: JSON.parse(readFileSync(result)),
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      samples: record.samples.length,
      verifiedArchiveFiles: record.verifiedArchiveFiles,
    })
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
