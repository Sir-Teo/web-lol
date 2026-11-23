/** Verify a real completed normal-match checkpoint through cached production import/export. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, sep, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { readCohortSnapshot } from './lib/cohort-snapshot.ts';
import { chromium, firefox, webkit } from '@playwright/test';

const { values } = parseArgs({
    options: {
      'output-dir': { type: 'string' },
      report: { type: 'string' },
      'system-chromium': { type: 'boolean', default: false },
      'chromium-path': { type: 'string' },
      browser: { type: 'string', default: 'chromium' },
      'browser-path': { type: 'string' },
      'pack-timeout-ms': { type: 'string', default: '300000' },
      headed: { type: 'boolean', default: false },
      'software-rendering': { type: 'boolean', default: false },
    },
  }),
  output = resolve(values['output-dir'] ?? `.cache/offline-completed-match-${Date.now()}`);
assert(!existsSync(output), 'Use a fresh output directory');
await mkdir(output, { recursive: true });

assert(values.report, 'Pass --report with a completed normal cohort seed report');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reportPath = resolve(values.report),
  reportBytes = readFileSync(reportPath),
  sourceReport = JSON.parse(reportBytes);
assert.equal(sourceReport.failure, null);
assert.equal(sourceReport.outcome, 'victory');
assert.equal(sourceReport.developmentLeona ?? false, false);
assert.equal(sourceReport.ruleset, rulesetFingerprint());
const snapshotPath = resolve(sourceReport.finalPath),
  snapshotBytes = readFileSync(snapshotPath);
const descriptor = sourceReport.finalSnapshot ?? {
  path: sourceReport.finalPath,
  stateSha256: sourceReport.finalStateSha256,
};
assert.equal(resolve(descriptor.path), snapshotPath);
assert.equal(descriptor.stateSha256, sourceReport.finalStateSha256);
const { raw: snapshot } = readCohortSnapshot(descriptor, sourceReport.snapshotEncoding ?? 'none');
const state = JSON.parse(snapshot);
assert.equal(state.tick, sourceReport.finalTick);
assert.equal(state.winner, sourceReport.winner);
assert.equal(state.ruleset, sourceReport.ruleset);
assert.equal(state.matchMode, 'lanes');
const manifestBytes = readFileSync('dist/offline-pack.json'),
  manifest = JSON.parse(manifestBytes);
const reading = {
  runtime: { node: process.version, v8: process.versions.v8, arch: process.arch },
  sourceReport: { path: reportPath, sha256: sha(reportBytes) },
  sourceSnapshot: {
    path: snapshotPath,
    sha256: sha(snapshotBytes),
    tick: state.tick,
    winner: state.winner,
    ruleset: state.ruleset,
  },
  manifest: { id: manifest.id, files: manifest.files.length, bytes: manifest.bytes },
  checks: {},
  limits: [
    'Completed-match import, offline restore and exact export; not full browser-match simulation or the 100-seed gate.',
  ],
};
const root = resolve('dist'),
  prefix = '/nested/rift/';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
};
let originRequests = 0;
const server = createServer(async (request, response) => {
  originRequests++;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    const relative = pathname.slice(prefix.length) || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(path);
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    createReadStream(path)
      .on('error', () => response.destroy())
      .pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
async function storedMatch(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('rift-local-matches', 1);
    const db = await new Promise((yes, no) => {
      request.onsuccess = () => yes(request.result);
      request.onerror = no;
    });
    try {
      return await new Promise((yes, no) => {
        const t = db.transaction('checkpoints', 'readonly'),
          r = t.objectStore('checkpoints').get('rift');
        t.oncomplete = () => yes(r.result);
        t.onabort = no;
      });
    } finally {
      db.close();
    }
  });
}
let context;
let page;
const profile = await mkdtemp(join(tmpdir(), 'rift-offline-result-'));
try {
  const engine = { chromium, firefox, webkit }[values.browser];
  assert(engine, 'Choose chromium, firefox, or webkit');
  assert(
    [values['system-chromium'], values['chromium-path'], values['browser-path']].filter(Boolean)
      .length <= 1,
    'Choose one browser executable'
  );
  const executablePath = values['system-chromium']
    ? '/usr/bin/chromium'
    : (values['chromium-path'] ?? values['browser-path']);
  context = await engine.launchPersistentContext(profile, {
    ...(executablePath
      ? { executablePath: resolve(executablePath) }
      : engine === chromium
        ? { channel: 'chrome' }
        : {}),
    ...(values['software-rendering'] && engine === chromium
      ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
      : {}),
    ...(engine === firefox
      ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.forbid-software': false } }
      : {}),
    headless: !values.headed,
    viewport: { width: 1280, height: 900 },
  });
  page = context.pages()[0] ?? (await context.newPage());
  let browserVersion = await page.evaluate(() => navigator.userAgent);
  if (engine === chromium) {
    const cdp = await context.newCDPSession(page);
    browserVersion = (await cdp.send('Browser.getVersion')).product;
    await cdp.detach();
  }
  const errors = [],
    failed = [],
    outside = [],
    serviceResponses = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    failed.push({ url: request.url(), error: request.failure()?.errorText })
  );
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith(base))
      outside.push(request.url());
  });
  page.on('response', (response) => {
    if (response.fromServiceWorker()) serviceResponses.push(new URL(response.url()).pathname);
  });
  page.setDefaultTimeout(60000);
  const ready = async () => {
    await page.locator('#loading').waitFor({ state: 'detached', timeout: 120000 });
    assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  };
  await page.goto(base);
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  await page.locator('.offline-size').filter({ hasText: 'Full game pack:' }).waitFor();
  await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
  const packTimeout = Number(values['pack-timeout-ms']);
  assert(Number.isSafeInteger(packTimeout) && packTimeout > 0, 'Invalid pack timeout');
  await page.waitForFunction(
    () => !document.querySelector('.offline-progress:not([hidden])'),
    undefined,
    { timeout: packTimeout }
  );
  await page.locator('.offline-status').filter({ hasText: 'Ready for offline use' }).waitFor();
  reading.checks.fullPackReady = true;
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'Match saved on this browser.' }).waitFor();
  // Worker update requests can bypass browser automation's offline emulation.
  // Stop the real origin as well so every offline reload uses only cached files.
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  const onlineRequests = originRequests;
  // The Playwright WebKit offline override also blocks service-worker navigation.
  // A stopped origin supplies the network failure without that override.
  if (engine !== webkit) await context.setOffline(true);
  reading.checks.networkEmulation = engine !== webkit;
  await page.reload();
  await ready();
  await page.getByRole('heading', { name: 'Game paused', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByLabel('Match file', { exact: true }).setInputFiles({
    name: 'completed-normal-match.json',
    mimeType: 'application/json',
    buffer: Buffer.from(snapshot),
  });
  const seconds = Math.floor(state.tick / 60),
    previewTime = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  await page.waitForFunction(() => {
    const status = document.querySelector('.file-status')?.textContent;
    return status && !status.startsWith('Choose a file') && status !== 'Checking match file…';
  });
  const preview = await page.locator('.file-status').textContent();
  assert.ok(
    preview?.includes(
      `5v5 match · ${previewTime} · ${state.winner === 'blue' ? 'Blue' : 'Red'} team victory`
    ),
    `Completed match preview was: ${preview}`
  );
  await page.screenshot({ path: resolve(output, 'preview.png') });
  reading.checks.normalCompletedPreviewOffline = true;
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match', exact: true }).click(),
  ]);
  await ready();
  const outcome = state.winner === 'blue' ? 'Victory' : 'Defeat';
  const verifyOutcome = async () => {
    await page.getByRole('heading', { name: outcome, exact: true }).waitFor();
    const clock = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    assert.equal(await page.locator('#clock').textContent(), clock);
    assert.equal(await storedMatch(page), snapshot);
  };
  const downloadExact = async (name) => {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download current match', exact: true }).click();
    const download = await event;
    assert.equal(download.suggestedFilename(), `rift-rift-tick-${state.tick}.json`);
    await download.saveAs(resolve(output, name));
    assert.equal(readFileSync(resolve(output, name), 'utf8'), snapshot);
  };
  await verifyOutcome();
  await downloadExact('first-export.json');
  reading.checks.exactCompletedStateImportAndExportOffline = true;

  // A restored result opens a replay of that checkpoint alone. The terminal
  // digest must not count as a second checkpoint or change the active match.
  await page.getByRole('button', { name: 'Watch replay', exact: true }).click();
  await page.locator('#replay-bar').waitFor();
  await page.getByText('✓ 1/1 hashes', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'result-checkpoint-replay.png') });
  await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
  await verifyOutcome();
  reading.checks.resultCheckpointReplayVerifiedOnce = true;

  await page.reload();
  await ready();
  await verifyOutcome();
  await downloadExact('reloaded-export.json');
  reading.checks.exactCompletedStateReloadAndExportOffline = true;
  await page.screenshot({ path: resolve(output, 'result-offline.png') });
  const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  assert.equal(controller, new URL('offline-worker.js', base).href);
  assert.equal(originRequests, onlineRequests, 'The offline browser contacted the origin');
  reading.checks.offlineWorkerControlsPage = true;
  reading.checks.originRequestsWhileOffline = originRequests - onlineRequests;
  if (engine === chromium)
    assert(serviceResponses.length > 50, 'Expected cached service-worker asset responses');
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(outside, []);
  assert.equal(sha(readFileSync(reportPath)), sha(reportBytes));
  assert.equal(sha(readFileSync(snapshotPath)), sha(snapshotBytes));
  assert.equal(sha(readFileSync('dist/offline-pack.json')), sha(manifestBytes));
  reading.checks.sourceReportSnapshotAndManifestUnchanged = true;
  reading.checks.serviceWorkerResponses = serviceResponses.length;
  reading.browser = {
    engine: values.browser,
    version: browserVersion,
    systemChromium: values['system-chromium'] ?? false,
  };
  reading.productionErrors = errors;
  reading.failedRequests = failed;
  reading.outsidePrefixRequests = outside;
  reading.result = 'passed';
  writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
  console.log(JSON.stringify(reading));
} catch (error) {
  if (page) {
    reading.offlineStatus = await page
      .locator('.offline-status')
      .textContent({ timeout: 3000 })
      .catch(() => null);
  }
  writeFileSync(
    resolve(output, 'failure.json'),
    JSON.stringify({ ...reading, result: 'failed', error: error.stack }, null, 2) + '\n'
  );
  throw error;
} finally {
  await context?.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
