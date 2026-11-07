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
  'Pass frozen accepted layout-quad cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, 'f71c3f787f38e62d3b7dba290bb64de32da3fd7cae14e97f64e16e6853d03c6e');
assert.equal(plan.sourceRevision, 'f85b2455feebbe6860c13a466bbb924c731e62fd');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
assert.equal(
  sha(readFileSync(resolve(directory, 'plan.json'))),
  'ebd0d01971723860311934770b9ed5e88a0a08807d86cef537b041e510f79ec1'
);
assert.equal(plan.sources.length, 696);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-layout-quad-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-layout-quad-packets',
        resolveId(id) {
          if (id === 'frozen-r-layout-quad-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-layout-quad-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(
    process.execPath,
    [resolve(temp, 'ahri-r-layout-quad-packet-reference.js'), result],
    {
      stdio: 'pipe',
    }
  );
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-layout-quad-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-layout-quad-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
    applicationRevision: 'f85b2455feebbe6860c13a466bbb924c731e62fd',
    archivePlanSha256: 'ebd0d01971723860311934770b9ed5e88a0a08807d86cef537b041e510f79ec1',
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
