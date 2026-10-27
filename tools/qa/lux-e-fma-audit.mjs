/** Reproduce the retained Lux checksum with a pinned compiler-math reference.
 * Diagnostic only: no production imports, golden edits or global persistent math. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { rolldown } from 'rolldown';
import {
  samplerSnapshot,
  traceSamplerMath,
  replaySamplerTrig,
  float64Hex,
  float64FromHex,
} from './lib/lux-e-sampler-audit.ts';

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string' },
    'fdlibm-source': { type: 'string' },
    'three-tarball': { type: 'string' },
    cxx: { type: 'string', default: 'g++' },
    'cxx-arg': { type: 'string', multiple: true, default: [] },
    python: { type: 'string', default: 'python3' },
  },
});
assert.equal(process.arch, 'x64', 'This controlled experiment requires an FMA-capable x64 host');
const root = process.cwd(),
  output = resolve(values['output-dir'] ?? `.cache/lux-e-fma-${Date.now()}`),
  baseline = 'ee5b92c1a8a69910f8c2837133158d892564ada2',
  archiveSha = '416479ffe8bf4c2fae0f4f5de50b6aadfeda410da2a08c5d2f3b63e2cf5f54b5',
  sourceUrl = 'https://raw.githubusercontent.com/nodejs/node/v26.12.1/deps/v8/src/base/ieee754.cc',
  sourceSha = 'badd30a2643ed785dcfbbce42f95c2522ccea3605cd39e2933467688aae1de14',
  originalGolden = '09b53b57121711b36aef97f538295b21e5f04e53bcbfb34cde19450118d628df',
  uncontractedHash = '4258cc67eef3b42afb26960a816f30a9237f2c203a3040e0acf3afb364580f9a',
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(
  output.startsWith(root + sep) && !existsSync(output),
  'Supply a fresh output directory inside the project'
);
mkdirSync(output, { recursive: true });
const save = (name, value) =>
  writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
async function fetchBounded(url, maxBytes) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.url, url);
  const reader = response.body.getReader(),
    chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      assert(bytes <= maxBytes, 'Reference download exceeds bound');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
const archive = execFileSync(
  'git',
  [
    'archive',
    baseline,
    'src',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tests/lux-e-missile.test.ts',
  ],
  { maxBuffer: 8 * 1024 * 1024 }
);
assert.equal(sha(archive), archiveSha, 'Original project archive differs');
writeFileSync(resolve(output, 'original-source.tar'), archive, { flag: 'wx' });
const originalRoot = resolve(output, 'source');
mkdirSync(originalRoot);
execFileSync('tar', ['-xf', '-', '-C', originalRoot], { input: archive });
const lockRaw = readFileSync(resolve(originalRoot, 'package-lock.json')),
  lock = JSON.parse(lockRaw),
  originalThree = lock.packages['node_modules/three'];
assert(
  lockRaw.equals(readFileSync('package-lock.json')),
  'Current lock differs from the historical experiment'
);
symlinkSync(resolve('node_modules'), resolve(originalRoot, 'node_modules'), 'dir');
const tarball = values['three-tarball']
  ? readFileSync(values['three-tarball'])
  : await fetchBounded(originalThree.resolved, 50 * 1024 * 1024);
assert.equal(
  'sha512-' + createHash('sha512').update(tarball).digest('base64'),
  originalThree.integrity,
  'Three archive differs from historical lock'
);
const tarPath = resolve(output, 'three.tgz');
writeFileSync(tarPath, tarball, { flag: 'wx' });
const installedThree = [];
for (const name of ['package.json', 'build/three.module.js', 'build/three.core.js']) {
  const expected = execFileSync('tar', ['-xOf', tarPath, 'package/' + name], {
      maxBuffer: 8 * 1024 * 1024,
    }),
    path = resolve('node_modules/three', name),
    raw = readFileSync(path);
  assert(raw.equals(expected), 'Installed Three runtime differs: ' + name);
  installedThree.push({ path: relative(root, path), sha256: sha(raw) });
}
const pinnedSource = values['fdlibm-source']
  ? readFileSync(values['fdlibm-source'])
  : await fetchBounded(sourceUrl, 1024 * 1024);
assert.equal(sha(pinnedSource), sourceSha, 'Pinned V8 trig source differs');
const cppPath = resolve(output, 'ieee754.cc');
writeFileSync(cppPath, pinnedSource, { flag: 'wx' });
const bundle = await rolldown({
  input: resolve(originalRoot, 'src/render/lux-e-field-particles.ts'),
  platform: 'node',
  external: ['three'],
});
const modulePath = resolve(output, 'original-sampler.mjs');
try {
  await bundle.write({ file: modulePath, format: 'esm' });
} finally {
  await bundle.close();
}
const { luxEFieldParticles: sample } = await import(pathToFileURL(modulePath).href),
  raw = samplerSnapshot(sample),
  trace = traceSamplerMath(sample);
assert.equal(trace.samples, raw, 'Math instrumentation changed samples');
assert(
  readFileSync(resolve(originalRoot, 'tests/lux-e-missile.test.ts'), 'utf8').includes(
    originalGolden
  )
);
writeFileSync(resolve(output, 'default-samples.json'), raw + '\n', { flag: 'wx' });
save('default-math.json', trace.calls);
const compilerCommand = [
  resolve('tools/qa/lib/lux-e-fdlibm-reference.py'),
  '--source',
  cppPath,
  '--calls',
  resolve(output, 'default-math.json'),
  '--output-dir',
  resolve(output, 'reference'),
  '--cxx',
  values.cxx,
  ...values['cxx-arg'].map((arg) => '--cxx-arg=' + arg),
];
execFileSync(values.python, compilerCommand, {
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 180000,
});
const reference = JSON.parse(readFileSync(resolve(output, 'reference/reference.json'))),
  variants = [];
for (const variant of reference.variants) {
  const callsRaw = readFileSync(variant.callsPath);
  assert.equal(sha(callsRaw), variant.callsSha256);
  const calls = JSON.parse(callsRaw),
    replay = replaySamplerTrig(sample, calls),
    hash = sha(replay.samples);
  assert.equal(hash, variant.contraction === 'off' ? uncontractedHash : originalGolden);
  assert.equal(replay.replayedCalls, 17888);
  writeFileSync(
    resolve(output, 'samples-' + variant.contraction + '.json'),
    replay.samples + '\n',
    { flag: 'wx' }
  );
  variants.push({
    contraction: variant.contraction,
    sha256: hash,
    replayedCalls: replay.replayedCalls,
  });
}
const off = JSON.parse(readFileSync(resolve(output, 'reference/calls-off.json'))),
  on = JSON.parse(readFileSync(resolve(output, 'reference/calls-on.json'))),
  changedTrig = on.filter((row, index) => {
    assert.equal(row.key, off[index].key);
    return row.bits !== off[index].bits;
  });
assert.equal(changedTrig.length, 1);
assert.equal(changedTrig[0].key, 'cos:3fe96796f5ab7d51');
const savedCos = Math.cos;
let substitutedCalls = 0,
  oneChange;
try {
  Math.cos = (x) => {
    if (float64Hex(x) === '3fe96796f5ab7d51') {
      substitutedCalls++;
      return float64FromHex(changedTrig[0].bits);
    }
    return savedCos(x);
  };
  oneChange = samplerSnapshot(sample);
} finally {
  Math.cos = savedCos;
}
assert.equal(sha(oneChange), originalGolden);
assert.equal(substitutedCalls, 2);
assert.equal(Math.cos, savedCos);
const before = JSON.parse(readFileSync(resolve(output, 'samples-off.json'))),
  after = JSON.parse(oneChange),
  differences = [];
function compare(a, b, path = '') {
  if (typeof a === 'number' && typeof b === 'number') {
    if (!Object.is(a, b))
      differences.push({
        path,
        before: a,
        after: b,
        delta: Math.abs(a - b),
        sameFloat32: Object.is(Math.fround(a), Math.fround(b)),
      });
    return;
  }
  if (a && typeof a === 'object') {
    assert.deepEqual(Object.keys(a), Object.keys(b));
    for (const key of Object.keys(a)) compare(a[key], b[key], path + '/' + key);
  } else assert.equal(a, b);
}
compare(before, after);
assert.equal(differences.length, 2);
assert(differences.every((r) => r.sameFloat32));
const result = {
  baseline,
  archiveSha256: archiveSha,
  lockSha256: sha(lockRaw),
  installedThree,
  fdlibmSource: { url: sourceUrl, sha256: sourceSha },
  node: process.version,
  v8: process.versions.v8,
  samplerModuleSha256: sha(readFileSync(modulePath)),
  defaultSha256: sha(raw),
  originalGolden,
  reference,
  variants,
  changedTrig,
  substitutedCalls,
  differences,
  allDifferencesSameFloat32: true,
  mathFunctionRestored: true,
  producerSha256: sha(readFileSync(new URL(import.meta.url))),
  referenceProducerSha256: sha(readFileSync(compilerCommand[0])),
  limits: [
    'Controlled compiler experiment reproduces the historical checksum; it does not identify the original machine, Node build or compiler flags.',
    'Only two measured output scalars differ and cast to identical Float32 values; no cross-engine GPU or native visual parity claim.',
    'Game math, the original checksum assertion and golden remain unchanged.',
  ],
};
save('reading.json', result);
console.log(
  JSON.stringify({
    variants,
    changedTrigInputs: changedTrig.length,
    differingScalars: differences.length,
    allDifferencesSameFloat32: true,
  })
);
