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
  'Pass a fresh trajectory fixture output path'
);
assert.equal(process.version, 'v24.22.1');
assert.equal(process.versions.v8, '13.6.233.17-node.58');
const manifest = '.cache/ahri-r-noise-motion-readers/inputs-with-rng.json';
assert.equal(
  sha(readFileSync(manifest)),
  '5600cf9166bfbd6f8c9bb3b6942f8d00105efe783bb9f652a04d2a7f31a3f7be'
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
const temp = mkdtempSync(resolve(tmpdir(), 'source-noise-motion-fixtures-'));
try {
  const aliases = {
    'frozen-noise-motion-rng': '.cache/ahri-r-noise-motion-readers/engine/utils/Rng.ts',
    'frozen-noise-motion-integrate':
      '.cache/ahri-r-noise-motion-readers/engine/simulation/integrate.ts',
    'frozen-noise-motion-pool': '.cache/ahri-r-noise-motion-readers/engine/simulation/pool.ts',
    'frozen-noise-motion-fixture':
      '.cache/ahri-r-noise-motion-readers/engine/simulation/__tests__/emitterFixture.ts',
    '@/modules/viewport/shared/utils/space': '.cache/ahri-r-noise-motion-readers/space.ts',
  };
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [
      {
        name: 'frozen-noise-motion',
        resolveId(id) {
          if (aliases[id]) return resolve(aliases[id]);
        },
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/source-noise-motion-reference.ts',
      outDir: temp,
      emptyOutDir: false,
      minify: false,
    },
  });
  const result = resolve(temp, 'result.json');
  execFileSync(
    process.execPath,
    [resolve(temp, 'source-noise-motion-reference.js'), result, resolve(source)],
    { stdio: 'pipe' }
  );
  const record = {
    format: 1,
    scope:
      'Unmodified external stepEmitters controlled trajectories; fixed 60 Hz system clock, accumulated emitter age, manual particle rows, disabled automatic emission and actual seeded Rng; no native certification',
    externalRevision: '2adda384347dd43e76d6295d77fe1f13623b2808',
    node: process.version,
    v8: process.versions.v8,
    producerSha256: sha(readFileSync('tools/qa/build-source-noise-motion-reference.mjs')),
    entrySha256: sha(readFileSync('tools/qa/source-noise-motion-reference.ts')),
    inputManifestSha256: sha(readFileSync(manifest)),
    inputs,
    source: { path: source, sha256: sha(readFileSync(source)) },
    trajectories: JSON.parse(readFileSync(result)),
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      result: 'passed',
      trajectories: record.trajectories.length,
      rows: record.trajectories.reduce((sum, t) => sum + t.rows.length, 0),
    })
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
