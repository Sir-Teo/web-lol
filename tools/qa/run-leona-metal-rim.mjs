/** Explicit opt-in macOS/Metal execution; never part of npm check or game boot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { metalRimCases, expectedMetalRim } from './metal-rim-cases.mjs';
import { metalReflectionCases, expectedMetalReflection } from './metal-reflection-cases.mjs';

assert(
  process.argv.includes('--run'),
  'Use --run to execute the retained shaders in the owned harness'
);
assert.equal(process.platform, 'darwin', 'Metal harness requires macOS');
const outputArg = process.argv.indexOf('--output');
assert(outputArg >= 0 && process.argv[outputArg + 1], '--output directory is required');
const output = resolve(process.argv[outputArg + 1]);
mkdirSync(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (path) => {
  const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
};
const reflective = process.argv.includes('--reflective');
const libraries = reflective
  ? [
      {
        stage: 'vertex',
        program: 33,
        path: '.cache/leona-e-reflection-shaders-v1-20261024/mesh_vs.vs-metal-33.metallib',
      },
      {
        stage: 'fragment',
        program: 54,
        path: '.cache/leona-e-reflection-shaders-v1-20261024/mesh_ps.ps-metal-54.metallib',
      },
    ]
  : [
      {
        stage: 'vertex',
        program: 1,
        path: '.cache/leona-native-reflection-inputs-v1-20261024/nonreflective/mesh_vs.vs-metal-1.metallib',
      },
      {
        stage: 'fragment',
        program: 9,
        path: '.cache/leona-native-reflection-inputs-v1-20261024/nonreflective/mesh_ps.ps-metal-9.metallib',
      },
      {
        stage: 'fragment',
        program: 24,
        path: '.cache/leona-native-scb-material-v1-20261024/shaders/mesh_ps.ps-metal-24.metallib',
      },
    ];
// Check extraction/native pins before loading any library; the run records exact bytes.
for (const script of [
  'verify-leona-native-reflection-inputs.py',
  'verify-leona-native-scb-material.py',
])
  execFileSync('python3', ['-O', `tools/assets/${script}`, '--check'], { stdio: 'pipe' });
const inputs = [
  ...libraries.map((l) => ({ ...l, ...record(l.path) })),
  ...[
    'tools/qa/leona-metal-rim.swift',
    'tools/qa/metal-rim-cases.mjs',
    'tools/qa/metal-reflection-cases.mjs',
    'tools/qa/run-leona-metal-rim.mjs',
    'tools/qa/particle-mesh-reflection-preview.ts',
    'src/render/particle-mesh-reflection-material.ts',
  ].map(record),
];
const expectedDigests = new Map([
  [1, '6b86adbd5b6f807e71248eff97c03fd42b5db82e9de81578dfebca0cb60dfb12'],
  [9, '6f497054a40a4ce2d84f7e217872ce4ec3a482e2c01361a70f82d546924e63f3'],
  [24, 'ae3c69a06bf883597412669be3ccd0309a7c0683d061908795fa6f96a2e80d30'],
  [33, '396edb76f948fc06da41ab4975f4697a4bdcb9621392fdfa4e3496ee3d0ab4e6'],
  [54, 'f79178c54b8fdf6e81f230ae0836204b64b6f48fee8271f1f39864a4b2dc4853'],
]);
for (const library of inputs.filter((r) => r.program))
  assert.equal(library.sha256, expectedDigests.get(library.program), library.path);
const cases = reflective ? metalReflectionCases() : metalRimCases();
const save = (name, data) =>
  writeFileSync(join(output, name), JSON.stringify(data, null, 2) + '\n');
save('inputs.json', inputs);
save('cases.json', cases);
save('scope.json', {
  target: libraries,
  lifecycle:
    'Owned 1px synthetic harness, compile then submit one draw per case and release process',
  nativeGameExecuted: false,
  intendedNativeShaderExecution: true,
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
  'tools/qa/leona-metal-rim.swift',
  '-o',
  executable,
  '-framework',
  'Metal',
  '-framework',
  'Foundation',
]);
const native = JSON.parse(
  execute('native', executable, [
    ...(reflective ? ['--reflective'] : []),
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
  await page.goto('http://127.0.0.1:5209/tools/qa/particle-mesh-reflection-preview.html');
  await page.waitForFunction(() => window.__MESH_REFLECTION__?.ready);
  const webgl = await page.evaluate(
    (cases) => cases.map((o) => ({ id: o.id, ...window.__MESH_REFLECTION__.probe(o) })),
    cases
  );
  save('webgl.json', { errors, results: webgl });
  assert.deepEqual(errors, []);
  assert.equal(native.results.length, cases.length);
  const comparisons = cases.map((o, i) => {
    const n = native.results[i],
      w = webgl[i],
      scalar = reflective ? expectedMetalReflection(o) : expectedMetalRim(o);
    assert.equal(n.id, o.id);
    assert.equal(w.id, o.id);
    assert.equal(n.commandStatus, 'completed');
    assert.equal(w.error, 0);
    assert.equal(w.cubeResources, reflective ? 1 : 0);
    const difference = (a, b) => Math.max(...a.map((v, j) => Math.abs(v - b[j])));
    return {
      id: o.id,
      metal: n.pixels,
      webgl: w.pixels,
      scalar,
      metalScalarMax: difference(n.pixels, scalar),
      webglScalarMax: difference(w.pixels, scalar),
      metalWebglMax: difference(n.pixels, w.pixels),
    };
  });
  const summary = {
    cases: cases.length,
    device: native.device,
    os: native.os,
    browser: browser.version(),
    maxMetalScalar: Math.max(...comparisons.map((r) => r.metalScalarMax)),
    maxWebglScalar: Math.max(...comparisons.map((r) => r.webglScalarMax)),
    maxMetalWebgl: Math.max(...comparisons.map((r) => r.metalWebglMax)),
    comparisons,
  };
  save('comparison.json', summary);
  assert(summary.maxMetalScalar <= 1, 'Metal/scalar differs by more than one byte');
  assert(summary.maxWebglScalar <= 1, 'WebGL/scalar differs by more than one byte');
  assert(summary.maxMetalWebgl <= 1, 'Metal/WebGL differs by more than one byte');
  console.log(
    JSON.stringify({
      cases: summary.cases,
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
