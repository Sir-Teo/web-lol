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
  'Pass frozen palette cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, 'a68ca14b74c144ccb6b0d183f2d41395403a8defa0ae514756463c369f46b90d');
assert.equal(plan.sourceRevision, 'a7092caa82f751cc1eb6064bd795cd7309b480c5');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-spell-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-spell-packets',
        resolveId(id) {
          if (id === 'frozen-r-spell-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-spell-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(process.execPath, [resolve(temp, 'ahri-r-spell-packet-reference.js'), result], {
    stdio: 'pipe',
  });
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-spell-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-spell-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
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
