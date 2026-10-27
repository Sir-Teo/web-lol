/** Verify a real completed normal-match checkpoint through cached production import/export. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
    options: {
      'output-dir': { type: 'string' },
      report: { type: 'string' },
      'system-chromium': { type: 'boolean', default: false },
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
assert.equal(snapshotBytes.at(-1), 10, 'Expected retained checkpoint newline');
const snapshot = snapshotBytes.subarray(0, -1).toString(),
  state = JSON.parse(snapshot);
assert.equal(sha(Buffer.from(snapshot)), sourceReport.finalStateSha256);
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
const server = createServer(async (request, response) => {
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
let browser;
try {
  browser = await chromium.launch(
    values['system-chromium']
      ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'], headless: true }
      : { channel: 'chrome', headless: true }
  );
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }),
    page = await context.newPage();
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
  page.setDefaultTimeout(30000);
  const ready = async () => {
    await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
    assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  };
  await page.goto(base);
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  await page.locator('.offline-size').filter({ hasText: 'Full game pack:' }).waitFor();
  await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
  await page
    .locator('.offline-status')
    .filter({ hasText: 'Ready for offline use' })
    .waitFor({ timeout: 180000 });
  reading.checks.fullPackReady = true;
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'Match saved on this browser.' }).waitFor();
  await context.setOffline(true);
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
  await page
    .locator('.file-status')
    .filter({
      hasText: `5v5 match · ${previewTime} · ${state.winner === 'blue' ? 'Blue' : 'Red'} team victory`,
    })
    .waitFor();
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
  await page.reload();
  await ready();
  await verifyOutcome();
  await downloadExact('reloaded-export.json');
  reading.checks.exactCompletedStateReloadAndExportOffline = true;
  await page.screenshot({ path: resolve(output, 'result-offline.png') });
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
    version: browser.version(),
    systemChromium: values['system-chromium'] ?? false,
  };
  reading.productionErrors = errors;
  reading.failedRequests = failed;
  reading.outsidePrefixRequests = outside;
  reading.result = 'passed';
  writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
  console.log(JSON.stringify(reading));
} catch (error) {
  writeFileSync(
    resolve(output, 'failure.json'),
    JSON.stringify({ ...reading, result: 'failed', error: error.stack }, null, 2) + '\n'
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
