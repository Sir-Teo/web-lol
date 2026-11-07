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
  'Pass frozen accepted layout-mesh cohort and fresh output file'
);
const directory = resolve(directoryArg);
const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json')));
assert.equal(plan.ruleset, '943a706f9191ebc8f30b1ab10dc37668489f4f29631332a99a9ce7c60e3230ba');
assert.equal(plan.sourceRevision, 'aabe05260691f94d800f6b6016148e9fea4d6717');
assert.equal(plan.runtime.node, process.version);
assert.equal(plan.runtime.v8, process.versions.v8);
assert.equal(
  sha(readFileSync(resolve(directory, 'plan.json'))),
  '26b54398e9912b18f229c412856e2db2c7bf82d5c2fbe8965428556ec2cb5550'
);
assert.equal(plan.sources.length, 698);
const archive = resolve(directory, 'frozen-source');
for (const row of plan.sources) {
  const b = readFileSync(resolve(archive, row.file));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256, row.file);
}
const temp = mkdtempSync(resolve(tmpdir(), 'r-layout-mesh-packets-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-r-layout-mesh-packets',
        resolveId(id) {
          if (id === 'frozen-r-layout-mesh-particles')
            return resolve(archive, 'src/render/ahri-r-particles.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/ahri-r-layout-mesh-packet-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(
    process.execPath,
    [resolve(temp, 'ahri-r-layout-mesh-packet-reference.js'), result],
    {
      stdio: 'pipe',
    }
  );
  const record = {
    format: 1,
    producerSha256: sha(readFileSync('tools/qa/build-ahri-r-layout-mesh-packet-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/ahri-r-layout-mesh-packet-reference.ts')),
    sourceRevision: plan.sourceRevision,
    applicationRevision: 'aabe05260691f94d800f6b6016148e9fea4d6717',
    archivePlanSha256: '26b54398e9912b18f229c412856e2db2c7bf82d5c2fbe8965428556ec2cb5550',
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
