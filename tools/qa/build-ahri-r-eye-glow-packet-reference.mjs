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
  'Pass frozen accepted eye-glow cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, '186133424c3e28265877ba008d887874ddfc6da10edf515e83bc2a0cf4f5f7d2');
assert.equal(plan.sourceRevision, '0d6b714fb2fca5301988260166386656b2419deb');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
assert.equal(
  sha(readFileSync(resolve(directory, 'plan.json'))),
  'ecb0cef1e90ac6526f0d0776cc567028c98f7b7c7cbe71132e9f1ce7b1d608dc'
);
assert.equal(plan.sources.length, 693);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-eye-glow-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-eye-glow-packets',
        resolveId(id) {
          if (id === 'frozen-r-eye-glow-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-eye-glow-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(process.execPath, [resolve(temp, 'ahri-r-eye-glow-packet-reference.js'), result], {
    stdio: 'pipe',
  });
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-eye-glow-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-eye-glow-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
    applicationRevision: 'c5ab62306895bb20fb3940b2f546239829f8c8fa',
    archivePlanSha256: 'ecb0cef1e90ac6526f0d0776cc567028c98f7b7c7cbe71132e9f1ce7b1d608dc',
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
