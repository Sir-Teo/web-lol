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
  'Pass frozen accepted eye-trail cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, '0cbdb13a8ae7a5bdbd1ff2dba9d8798fa486c7a4f003a3fe14cba6eab32fe8c9');
assert.equal(plan.sourceRevision, '2cfece301e465bbb2ae6ba9f4eeb63b5ee736887');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
assert.equal(
  sha(readFileSync(resolve(directory, 'plan.json'))),
  '2fe28fd379677135bfbc3b31a2c409f51a39a09d138b84e0efd2d65e3f4720cf'
);
assert.equal(plan.sources.length, 696);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-eye-trail-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-eye-trail-packets',
        resolveId(id) {
          if (id === 'frozen-r-eye-trail-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-eye-trail-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(process.execPath, [resolve(temp, 'ahri-r-eye-trail-packet-reference.js'), result], {
    stdio: 'pipe',
  });
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-eye-trail-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-eye-trail-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
    applicationRevision: '69a05a865069face8bcbc7826d02a87d1b80363e',
    archivePlanSha256: '2fe28fd379677135bfbc3b31a2c409f51a39a09d138b84e0efd2d65e3f4720cf',
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
