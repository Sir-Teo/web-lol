/** Inspect runtime math differences without updating a game golden or source file. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { samplerSnapshot, traceSamplerMath, replaySamplerTrig } from './lib/lux-e-sampler-audit.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string' },
    'baseline-ref': { type: 'string', default: 'ee5b92c^' },
    'chromium-executable': { type: 'string' },
    'no-sandbox': { type: 'boolean', default: false },
  },
});
const output = resolve(root, values['output-dir'] ?? `.cache/lux-e-portability-${Date.now()}`);
assert(output.startsWith(root + sep), 'Output must stay inside the project for Vite module access');
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sourcePath = 'src/render/lux-e-field-particles.ts',
  profilePath = 'src/content/lux-e-field.json';
const baselineCommit = git(
  'rev-parse',
  '--verify',
  '--end-of-options',
  `${values['baseline-ref']}^{commit}`
);
const baselineSource = execFileSync('git', ['show', `${baselineCommit}:${sourcePath}`], {
  cwd: root,
  encoding: 'utf8',
});
const baselineProfiles = execFileSync('git', ['show', `${baselineCommit}:${profilePath}`], {
  cwd: root,
});
const currentProfiles = JSON.parse(await readFile(resolve(root, profilePath), 'utf8'));
for (const [index, profile] of JSON.parse(baselineProfiles).entries())
  for (const key of Object.keys(profile))
    assert.deepEqual(currentProfiles[index][key], profile[key]);
const historicalModule = baselineSource
  .replace(/from '\.\/([^']+)'/g, (_match, name) => `from '/src/render/${name}'`)
  .replace("'../content/lux-e-field.json'", "'./baseline-profiles.json'");
await writeFile(resolve(output, 'baseline-sampler.ts'), historicalModule);
await writeFile(resolve(output, 'baseline-profiles.json'), baselineProfiles);
const outputUrl = '/' + relative(root, output).split(sep).join('/');
const goldenSource = await readFile(resolve(root, 'tests/lux-e-missile.test.ts'), 'utf8');
const golden = goldenSource.match(/'([0-9a-f]{64})'/)?.[1];
assert(golden, 'Expected the existing exact sampler golden');
const server = await createServer({
  configFile: false,
  root,
  appType: 'custom',
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
server.middlewares.use('/sampler-probe', (_request, response) => {
  response.setHeader('content-type', 'text/html');
  response.end('<!doctype html><title>Sampler portability audit</title>');
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const { luxEFieldParticles: current } = await server.ssrLoadModule('/' + sourcePath);
  const { luxEFieldParticles: earlier } = await server.ssrLoadModule(
    outputUrl + '/baseline-sampler.ts'
  );
  const nodeBefore = samplerSnapshot(earlier),
    nodeCurrent = samplerSnapshot(current),
    nodeTrace = traceSamplerMath(current);
  assert.equal(nodeTrace.samples, nodeCurrent, 'Tracing must not perturb Node output');
  browser = await chromium.launch({
    headless: true,
    ...(values['chromium-executable']
      ? { executablePath: values['chromium-executable'] }
      : { channel: 'chrome' }),
    args: values['no-sandbox'] ? ['--no-sandbox'] : [],
  });
  const page = await browser.newPage();
  await page.goto(base + '/sampler-probe');
  const client = await page.evaluate(
    async ({ outputUrl, nodeCalls }) => {
      const { luxEFieldParticles: current } = await import('/src/render/lux-e-field-particles.ts'),
        { luxEFieldParticles: earlier } = await import(outputUrl + '/baseline-sampler.ts'),
        { samplerSnapshot, traceSamplerMath, replaySamplerTrig } =
          await import('/tools/qa/lib/lux-e-sampler-audit.ts');
      return {
        before: samplerSnapshot(earlier),
        current: samplerSnapshot(current),
        trace: traceSamplerMath(current),
        replay: replaySamplerTrig(current, nodeCalls),
        userAgent: navigator.userAgent,
      };
    },
    { outputUrl, nodeCalls: nodeTrace.calls }
  );
  assert.equal(client.trace.samples, client.current, 'Tracing must not perturb Chromium output');
  assert.equal(
    client.replay.samples,
    nodeCurrent,
    'Node trig alone must reproduce its complete bytes in Chromium'
  );
  const nodeReplay = replaySamplerTrig(current, client.trace.calls);
  assert.equal(
    nodeReplay.samples,
    client.current,
    'Chromium trig alone must reproduce its complete bytes in Node'
  );
  assert.equal(
    nodeBefore,
    nodeCurrent,
    'Historical and current first-fifteen streams differ in Node'
  );
  assert.equal(
    client.before,
    client.current,
    'Historical and current first-fifteen streams differ in Chromium'
  );
  const nodeCalls = new Map(nodeTrace.calls.map((row) => [row.key, row])),
    browserCalls = new Map(client.trace.calls.map((row) => [row.key, row]));
  const mathDifferences = [...nodeCalls]
    .filter(([key, row]) => browserCalls.has(key) && browserCalls.get(key).bits !== row.bits)
    .map(([key, row]) => ({
      key,
      name: row.name,
      args: row.args,
      node: { result: row.result, bits: row.bits },
      browser: { result: browserCalls.get(key).result, bits: browserCalls.get(key).bits },
    }));
  const orderedBits = (value) => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    const bits = view.getBigUint64(0),
      sign = 1n << 63n;
    return bits & sign ? ~bits & ((1n << 64n) - 1n) : bits | sign;
  };
  const scalarDifferences = [];
  function compare(a, b, path) {
    if (Object.is(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      assert.equal(a.length, b.length, path.join('.'));
      a.forEach((value, index) => compare(value, b[index], [...path, index]));
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      assert.deepEqual(Object.keys(a), Object.keys(b));
      for (const key of Object.keys(a)) compare(a[key], b[key], [...path, key]);
    } else {
      assert.equal(typeof a, 'number');
      assert.equal(typeof b, 'number');
      const difference = orderedBits(a) - orderedBits(b);
      scalarDifferences.push({
        path,
        node: a,
        browser: b,
        absoluteDelta: Math.abs(a - b),
        ulps: (difference < 0 ? -difference : difference).toString(),
        float32Equal: Object.is(Math.fround(a), Math.fround(b)),
      });
    }
  }
  compare(JSON.parse(nodeCurrent), JSON.parse(client.current), []);
  const tracked = [
    'tests/lux-e-missile.test.ts',
    sourcePath,
    profilePath,
    'src/render/particle-emitter-value.ts',
    'src/render/particle-curves.ts',
    'src/render/lux-beam-birth-offset.ts',
    'src/render/lux-hoop-particles.ts',
    'src/render/lux-e-burst-particles.ts',
    'src/render/particle-color-lookup.ts',
    'package-lock.json',
    'tools/qa/lux-e-sampler-portability.mjs',
    'tools/qa/lib/lux-e-sampler-audit.ts',
    'tools/qa/lux-e-sampler-audit.test.mjs',
  ];
  const sourceHashes = await Promise.all(
    tracked.map(async (path) => ({ path, sha256: sha(await readFile(resolve(root, path))) }))
  );
  const report = {
    format: 1,
    commit: git('rev-parse', 'HEAD'),
    baselineCommit,
    baselinePolicy:
      'Historical entry and profiles under current shared dependencies; not a full reproduction of the original host environment.',
    existingGolden: golden,
    goldenTestSha256: sha(goldenSource),
    sourceHashes,
    node: {
      version: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      beforeHash: sha(nodeBefore),
      currentHash: sha(nodeCurrent),
      goldenMatched: sha(nodeCurrent) === golden,
    },
    chromium: {
      version: browser.version(),
      userAgent: client.userAgent,
      beforeHash: sha(client.before),
      currentHash: sha(client.current),
      goldenMatched: sha(client.current) === golden,
    },
    browserLaunch: {
      executablePath: values['chromium-executable'] ?? null,
      noSandbox: values['no-sandbox'],
    },
    snapshotsPerEngine: 24,
    withinEngineHistoricalStreamsExact: true,
    tracePreservesSampleBytes: true,
    bidirectionalTrigReplay: {
      exact: true,
      callsPerReplay: nodeReplay.replayedCalls,
      nodeWithBrowserTrigHash: sha(nodeReplay.samples),
      browserWithNodeTrigHash: sha(client.replay.samples),
    },
    sharedMathInputs: [...nodeCalls.keys()].filter((key) => browserCalls.has(key)).length,
    mathDifferences,
    scalarDifferences,
    maxAbsoluteDelta: Math.max(0, ...scalarDifferences.map((row) => row.absoluteDelta)),
    differingScalarFloat32CastsEqual: scalarDifferences.every((row) => row.float32Equal),
    limits: [
      'The original golden is retained. Neither differing runtime hash is substituted for it.',
      'Runtime trig differences explain the measured Node/Chromium divergence; the original golden environment remains unreproduced.',
      'Per-scalar Float32 agreement is not a cross-engine GPU-frame or native-client certificate.',
      'Math interception and captured-result replay exist only in this diagnostic process and blank browser page; game code is untouched.',
    ],
  };
  for (const [name, contents] of Object.entries({
    'before-node.json': nodeBefore,
    'current-node.json': nodeCurrent,
    'before-browser.json': client.before,
    'current-browser.json': client.current,
    'math-node.json': JSON.stringify(nodeTrace.calls, null, 2),
    'math-browser.json': JSON.stringify(client.trace.calls, null, 2),
    'report.json': JSON.stringify(report, null, 2) + '\n',
  }))
    await writeFile(resolve(output, name), contents);
  console.log(
    JSON.stringify({
      report: relative(root, resolve(output, 'report.json')),
      withinEngineHistoricalStreamsExact: true,
      bidirectionalTrigReplayExact: true,
      mathDifferences: mathDifferences.length,
      scalarDifferences: scalarDifferences.length,
      maxAbsoluteDelta: report.maxAbsoluteDelta,
      existingGoldenMatches: {
        node: report.node.goldenMatched,
        chromium: report.chromium.goldenMatched,
      },
    })
  );
} finally {
  await browser?.close();
  await server.close();
}
