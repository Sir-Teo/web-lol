import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const [output] = process.argv.slice(2);
assert(
  output && process.argv.length === 3 && !existsSync(output),
  'Pass a fresh fixture output path'
);
assert.equal(process.version, 'v24.22.1');
assert.equal(process.versions.v8, '13.6.233.17-node.58');
const manifest = '.cache/ahri-r-noise-readers/inputs.json';
assert.equal(
  sha(readFileSync(manifest)),
  '0c365fcc4ee51ae495a28f2fa0ef4c3089126673d3b9bd07cdfd2c8f7b95a813'
);
const inputs = JSON.parse(readFileSync(manifest));
for (const input of inputs) {
  const raw = readFileSync(input.path);
  assert.equal(raw.length, input.bytes);
  assert.equal(sha(raw), input.sha256, input.path);
  assert.equal(
    createHash('sha1')
      .update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`), raw]))
      .digest('hex'),
    input.gitBlob
  );
}
const source = 'src/content/ahri-r-particles.json';
assert.equal(
  sha(readFileSync(source)),
  'c9a65a9808d3206cfbaee6dc1f9e1a5a37d6351947d997e2a5c4b8d3b290f29f'
);
const temp = mkdtempSync(resolve(tmpdir(), 'source-noise-fixtures-'));
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-source-noise-fields',
        resolveId(id) {
          if (id === 'frozen-source-noise-fields')
            return resolve('.cache/ahri-r-noise-readers/engine/simulation/forceFields.ts');
          if (id === '@/modules/viewport/shared/utils/space')
            return resolve('.cache/ahri-r-noise-readers/space.ts');
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/source-noise-field-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(
    process.execPath,
    [resolve(temp, 'source-noise-field-reference.js'), result, resolve(source)],
    { stdio: 'pipe' }
  );
  const record = {
    format: 1,
    scope:
      'Pinned external preview noise policy; no native constructor, random-stream or pixel-equivalence certification',
    externalRevision: '2adda384347dd43e76d6295d77fe1f13623b2808',
    node: process.version,
    v8: process.versions.v8,
    producerSha256: sha(readFileSync('tools/qa/build-source-noise-field-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/source-noise-field-reference.ts')),
    inputManifestSha256: sha(readFileSync(manifest)),
    inputs,
    source: { path: source, sha256: sha(readFileSync(source)) },
    ...JSON.parse(readFileSync(result)),
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      clocks: record.clocks.length,
      preparations: record.preparations.length,
      impulses: record.impulses.length,
    })
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
