/** Explicit opt-in macOS/Metal execution; never part of npm check or game boot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { metalSkinCases, expectedMetalSkin } from './metal-skin-cases.mjs';
import { metalSkinLookupCases, expectedMetalSkinLookup } from './metal-skin-lookup-cases.mjs';

assert(
  process.argv.includes('--run'),
  'Use --run to execute the retained shaders in the owned harness'
);
assert.equal(process.platform, 'darwin', 'Metal harness requires macOS');
const outputArg = process.argv.indexOf('--output');
assert(outputArg >= 0 && process.argv[outputArg + 1], '--output directory is required');
const output = resolve(process.argv[outputArg + 1]);
assert(!existsSync(output), 'Use a fresh output directory to preserve earlier evidence');
mkdirSync(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (path) => {
  const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
};
const lookup = process.argv.includes('--lookup');
const expected = lookup ? expectedMetalSkinLookup : expectedMetalSkin;
const libraries = [
  {
    stage: 'vertex',
    program: 0,
    path: '.cache/leona-skin-metal-abi-v1-20261024/candidate-skin-vs0.metallib',
  },
  {
    stage: 'fragment',
    program: lookup ? 11 : 34,
    path: `.cache/leona-w-skin-shaders/particle_ps.ps-metal-${lookup ? 11 : 34}.metallib`,
  },
];
execFileSync(
  '.tools/cdtb-venv/bin/python',
  ['-O', '.cache/leona-skin-metal-abi-v2-20261024/check.py', '--check'],
  { stdio: 'pipe' }
);
if (lookup)
  execFileSync(
    '.tools/cdtb-venv/bin/python',
    ['-O', '.cache/leona-skin-nonerosion-abi-v1-20261024/check.py', '--check'],
    { stdio: 'pipe' }
  );
const inputs = [
  ...libraries.map((l) => ({ ...l, ...record(l.path) })),
  ...[
    'tools/qa/leona-metal-skin.swift',
    'tools/qa/metal-skin-cases.mjs',
    'tools/qa/metal-skin-lookup-cases.mjs',
    'tools/qa/run-leona-metal-skin.mjs',
    'tools/qa/leona-metal-skin-preview.ts',
    'tools/qa/leona-metal-skin-preview.html',
    'src/render/leona-eclipse-skin-material.ts',
    'src/render/particle-color-phase.ts',
    'src/content/leona-w-skin-fresnel.json',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
  ].map(record),
];
const digests = new Map([
  [0, '129c06c6d4aeeb30090665c4b9a96f8222cda7c9b910f8d9fed54d074fb98397'],
  [34, 'f766696d141aa3b772612ec73476e9c745e3b7dceb84410b4de68a7190442fcd'],
  [11, '9aafc8fe2b07c5d5420210480ed0cacfd37f3667660cfdf3b13d8d74336524d3'],
]);
for (const row of inputs.filter((r) => r.program !== undefined))
  assert.equal(row.sha256, digests.get(row.program), row.path);
const cases = lookup ? metalSkinLookupCases() : metalSkinCases();
const webglCases = cases.filter((o) => o.webglSupported !== false);
if (lookup)
  for (const o of webglCases) {
    assert.deepEqual(
      o.lookup,
      [255, 255, 255, 255],
      'Local no-lookup material only supports this explicit neutral lookup fixture'
    );
    assert.equal(o.lookupWidth ?? 1, 1);
  }
for (const o of cases) expected(o); // Reject uncovered/degenerate fixtures before loading libraries.
const save = (name, data) =>
  writeFileSync(join(output, name), JSON.stringify(data, null, 2) + '\n');
save('inputs.json', inputs);
const snapshots = inputs.map((row) => {
  const snapshot = join(output, 'inputs', row.path);
  mkdirSync(dirname(snapshot), { recursive: true });
  copyFileSync(row.path, snapshot);
  const captured = record(snapshot);
  assert.equal(captured.sha256, row.sha256, 'Input changed while being captured');
  return { path: row.path, snapshot, bytes: captured.bytes, sha256: captured.sha256 };
});
save('input-snapshots.json', snapshots);
save('cases.json', cases);
save('scope.json', {
  target: libraries,
  lifecycle:
    'Owned 1px synthetic harness, compile then submit one draw per case and release process',
  nativeGameExecuted: false,
  intendedNativeShaderExecution: true,
  depthPush: 0,
  webglCompared: webglCases.length,
  lookupControls: lookup
    ? 'Only explicit white-RGBA lookup is compared to the existing local no-lookup material; other lookup controls use Metal/scalar only.'
    : null,
  bones:
    'All256 initialized identity; explicit sample palettes/weights/indices replace selected inputs.',
  exclusions: [
    'game process',
    'emitter dispatch',
    'source frame bindings',
    'native gameplay frame acceptance',
    'depth/FOW/blend/cull parity',
  ],
});
const executable = join(output, 'render');
const compilerVersion = execFileSync('xcrun', ['swiftc', '--version'], { encoding: 'utf8' });
writeFileSync(join(output, 'compiler-version.txt'), compilerVersion);
const execute = (name, command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  save(`${name}-command.json`, { command, args, status: result.status, signal: result.signal });
  writeFileSync(join(output, `${name}-stdout.log`), result.stdout ?? '');
  writeFileSync(join(output, `${name}-stderr.log`), result.stderr ?? '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
execute('compile', 'xcrun', [
  'swiftc',
  'tools/qa/leona-metal-skin.swift',
  '-o',
  executable,
  '-framework',
  'Metal',
  '-framework',
  'Foundation',
]);
const native = JSON.parse(
  execute('native', executable, [
    ...(lookup ? ['--lookup'] : []),
    ...libraries.map((l) => l.path),
    join(output, 'cases.json'),
  ])
);
save('native.json', native);
save('executable.json', record(executable));

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5209', '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);
let serverLog = '',
  browser;
server.stdout.on('data', (b) => {
  serverLog += b;
});
server.stderr.on('data', (b) => {
  serverLog += b;
});
try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw Error(`Vite exited: ${serverLog}`);
    // Wait for our strict-port server to announce readiness before using the port.
    try {
      if (serverLog.includes('Local:') && (await fetch('http://127.0.0.1:5209')).ok) break;
    } catch {}
    assert(i < 100, `Vite startup timeout: ${serverLog}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:5209/tools/qa/leona-metal-skin-preview.html');
  await page.waitForFunction(() => window.__METAL_SKIN__?.ready);
  const webgl = await page.evaluate(
    (cases) => cases.map((o) => ({ id: o.id, ...window.__METAL_SKIN__.probe(o) })),
    webglCases
  );
  save('webgl.json', { errors, results: webgl });
  assert.deepEqual(errors, []);
  assert.equal(native.results.length, cases.length);
  const webglById = new Map(webgl.map((o) => [o.id, o]));
  const comparisons = cases.map((o, i) => {
    const n = native.results[i],
      w = webglById.get(o.id),
      scalar = expected(o);
    assert.equal(n.id, o.id);
    assert.equal(n.commandStatus, 'completed');
    if (w) {
      assert.equal(w.id, o.id);
      assert.equal(w.error, 0);
    } else assert.equal(o.webglSupported, false);
    const difference = (a, b) => Math.max(...a.map((v, j) => Math.abs(v - b[j])));
    return {
      id: o.id,
      metal: n.pixels,
      webgl: w?.pixels ?? null,
      scalar,
      metalScalarMax: difference(n.pixels, scalar),
      webglScalarMax: w ? difference(w.pixels, scalar) : null,
      metalWebglMax: w ? difference(n.pixels, w.pixels) : null,
    };
  });
  const summary = {
    cases: cases.length,
    webglCases: webglCases.length,
    device: native.device,
    os: native.os,
    browser: browser.version(),
    maxMetalScalar: Math.max(...comparisons.map((r) => r.metalScalarMax)),
    maxWebglScalar: Math.max(
      ...comparisons.flatMap((r) => (r.webglScalarMax === null ? [] : [r.webglScalarMax]))
    ),
    maxMetalWebgl: Math.max(
      ...comparisons.flatMap((r) => (r.metalWebglMax === null ? [] : [r.metalWebglMax]))
    ),
    comparisons,
  };
  save('comparison.json', summary);
  assert(summary.maxMetalScalar <= 1, 'Metal/scalar differs by more than one byte');
  assert(summary.maxWebglScalar <= 1, 'WebGL/scalar differs by more than one byte');
  assert(summary.maxMetalWebgl <= 1, 'Metal/WebGL differs by more than one byte');
  console.log(
    JSON.stringify({
      cases: summary.cases,
      webglCases: summary.webglCases,
      maxMetalScalar: summary.maxMetalScalar,
      maxWebglScalar: summary.maxWebglScalar,
      maxMetalWebgl: summary.maxMetalWebgl,
      device: native.device,
    })
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((r) => {
    if (server.exitCode !== null) r();
    else server.once('exit', r);
  });
  writeFileSync(join(output, 'vite.log'), serverLog);
}
