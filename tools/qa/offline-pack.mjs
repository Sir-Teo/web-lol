/** Production offline gate plus isolated two-version worker activation. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import ts from 'typescript';
import { chromium } from '@playwright/test';
const run =
  process.argv[2] ??
  new Date()
    .toISOString()
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
assert(/^[a-z0-9-]+$/.test(run));
const artifactPrefix = `artifacts/offline-pack-${run}`;
assert(
  !existsSync(artifactPrefix + '-production.json') && !existsSync(artifactPrefix + '-failure.json')
);
const prefix = '/nested/rift/',
  fixture = '/offline-fixture/',
  root = resolve('dist');
const manifest = JSON.parse(readFileSync('dist/offline-pack.json', 'utf8'));
assert.equal(manifest.format, 1);
assert.equal(
  createHash('sha256')
    .update(
      JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files })
    )
    .digest('hex'),
  manifest.id
);
for (const file of manifest.files) {
  const bytes = readFileSync(resolve(root, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
}
const workerTemplate = readFileSync('tools/offline-worker.js', 'utf8');
assert.equal(
  createHash('sha256').update(workerTemplate).digest('hex'),
  manifest.workerPolicySha256
);
const client = ts.transpileModule(readFileSync('src/storage/offline-pack.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
function version(number) {
  const files = new Map([
    [
      'index.html',
      `<body>Version ${number}<script type="module">import {OfflinePack} from './offline-client.js';window.pack=new OfflinePack(new URL('./',location.href));window.fixtureVersion=${number};</script>`,
    ],
    ['offline-client.js', client],
    ['data.json', JSON.stringify({ version: number })],
  ]);
  const entries = [...files]
    .map(([path, body]) => ({
      path,
      bytes: Buffer.byteLength(body),
      sha256: createHash('sha256').update(body).digest('hex'),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const workerPolicySha256 = createHash('sha256').update(workerTemplate).digest('hex');
  const pack = {
    format: 1,
    workerPolicySha256,
    id: createHash('sha256')
      .update(JSON.stringify({ workerPolicySha256, files: entries }))
      .digest('hex'),
    bytes: entries.reduce((s, f) => s + f.bytes, 0),
    files: entries,
  };
  files.set('offline-pack.json', JSON.stringify(pack));
  files.set(
    'offline-worker.js',
    workerTemplate.replace(/\/\*__PACK__\*\/\s*null/, JSON.stringify(pack))
  );
  return { files, pack };
}
let current = version(1),
  mode = 'normal',
  holdSeen;
const counts = new Map();
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost'),
      path = url.pathname;
    if (path.startsWith(fixture)) {
      const name = path.slice(fixture.length) || 'index.html',
        body = current.files.get(name);
      if (body === undefined) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, {
          'Content-Type': mime[extname(name)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(body);
      return;
    }
    if (!path.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    const name = decodeURIComponent(path.slice(prefix.length)) || 'index.html';
    const file = resolve(root, name);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (mode === 'corrupt' && name === manifest.files[1].path) {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end('wrong bytes');
      return;
    }
    if (mode === 'hold' && name === manifest.files[2].path) {
      holdSeen?.();
      await new Promise((yes) => setTimeout(yes, 2000));
    }
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    if (response.destroyed) return;
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    createReadStream(file)
      .on('error', () => response.destroy())
      .pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((yes, no) => {
  server.once('error', no);
  server.listen(0, '127.0.0.1', yes);
});
const origin = `http://127.0.0.1:${server.address().port}`;
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
const report = {
  manifest: { id: manifest.id, files: manifest.files.length, bytes: manifest.bytes },
  checks: {},
};
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    page = await context.newPage();
  const errors = [],
    serviceResponses = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.fromServiceWorker()) serviceResponses.push(new URL(r.url()).pathname);
  });
  page.setDefaultTimeout(30000);
  await page.goto(origin + prefix);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  await page.locator('.offline-size').filter({ hasText: 'Full game pack:' }).waitFor();
  assert(
    await page.locator('.game-dialog').evaluate((dialog) => dialog.contains(document.activeElement))
  );
  await page.keyboard.press('Tab');
  assert(
    await page.locator('.game-dialog').evaluate((dialog) => dialog.contains(document.activeElement))
  );
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    0
  );
  mode = 'corrupt';
  await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
  await page.locator('.offline-status').filter({ hasText: 'failed verification' }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Download game pack', exact: true })
      .evaluate((node) => document.activeElement === node),
    true,
    'Verification failure must preserve retry focus'
  );
  report.checks.integrityFailureRestoresDownloadFocus = true;
  report.checks.integrityFailure = true;
  const firstBefore = counts.get(manifest.files[0].path);
  mode = 'hold';
  const held = new Promise((yes) => {
    holdSeen = yes;
  });
  await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
  await held;
  assert.equal(
    await page
      .getByRole('button', { name: 'Cancel download', exact: true })
      .evaluate((node) => document.activeElement === node),
    true,
    'Starting a download must focus Cancel'
  );
  report.checks.downloadFocusesCancel = true;
  await page.keyboard.press('Enter');
  await page.locator('.offline-status').filter({ hasText: 'cancelled' }).waitFor();
  report.checks.cancelRetainsVerified = true;
  assert.equal(
    await page
      .getByRole('button', { name: 'Download game pack', exact: true })
      .evaluate((node) => document.activeElement === node),
    true,
    'Cancelling must restore the download control'
  );
  report.checks.cancelRestoresDownloadFocus = true;
  mode = 'normal';
  console.log(
    JSON.stringify({
      stage: 'full production pack download',
      files: manifest.files.length,
      bytes: manifest.bytes,
    })
  );
  await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
  const cancel = page.getByRole('button', { name: 'Cancel download', exact: true });
  assert.equal(await cancel.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Tab');
  const back = page.getByRole('button', { name: 'Back to pause menu', exact: true });
  assert.equal(await back.evaluate((node) => document.activeElement === node), true);
  await page
    .locator('.offline-status')
    .filter({ hasText: 'Ready for offline use' })
    .waitFor({ timeout: 180000 });
  assert.equal(
    counts.get(manifest.files[0].path),
    firstBefore,
    'retry must reuse the first verified file'
  );
  report.checks.retryWithoutRedownload = true;
  assert.equal(
    await back.evaluate((node) => document.activeElement === node),
    true,
    'Completion must retain focus on another control'
  );
  report.checks.completionPreservesOtherControlFocus = true;
  const names = await page.evaluate(() => caches.keys());
  assert.equal(names.filter((n) => n.startsWith('rift-offline-v1:')).length, 1);
  await page.screenshot({ path: artifactPrefix + '-ready.png' });
  await page.getByRole('button', { name: 'Back to pause menu' }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'Match saved on this browser.' }).waitFor();
  const saved = await storedMatch(page);
  assert.equal(typeof saved, 'string');
  await context.setOffline(true);
  await page.reload();
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.getByRole('heading', { name: 'Game paused', exact: true }).waitFor();
  const seconds = Math.floor(JSON.parse(saved).tick / 60),
    clock = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  assert.equal(await page.locator('#clock').textContent(), clock);
  report.checks.pausedSavedTickBootsOffline = true;
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  await page.locator('.offline-status').filter({ hasText: 'Ready for offline use' }).waitFor();
  await page.getByRole('button', { name: 'Check and repair game pack', exact: true }).click();
  await page
    .locator('.offline-status')
    .filter({ hasText: 'Ready for offline use' })
    .waitFor({ timeout: 120000 });
  report.checks.completePackRepairOffline = true;
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload cached game', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.getByRole('heading', { name: 'Game paused', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'LUX');
  await page.keyboard.press('Escape');
  await page.mouse.move(1000, 450);
  await page.keyboard.press('Control+e');
  await page.keyboard.down('e');
  await page.mouse.click(1000, 450);
  await page.keyboard.up('e');
  await page.waitForTimeout(800);
  await page.locator('[data-ability="e"].recasting').waitFor();
  await page.keyboard.down('Tab');
  assert(await page.locator('.scoreboard').isVisible());
  for (const role of ['top', 'jungle', 'mid', 'carry', 'support'])
    assert.equal(await page.locator(`.scoreboard-row[data-role="${role}"]`).count(), 2);
  await page.keyboard.up('Tab');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: artifactPrefix + '-lux-lanes.png' });
  assert(serviceResponses.length > 50);
  report.checks.newLuxLaneMatchOffline = true;
  report.checks.serviceWorkerResponses = serviceResponses.length;
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  await page.locator('.offline-status').filter({ hasText: 'Ready for offline use' }).waitFor();
  const beforeRemoval = await storedMatch(page);
  assert.equal(typeof beforeRemoval, 'string');
  await page.getByRole('button', { name: 'Remove offline files', exact: true }).click();
  assert.equal(await storedMatch(page), beforeRemoval);
  await page.locator('.offline-status').filter({ hasText: 'Saved matches were kept' }).waitFor();
  assert.equal(
    await page.evaluate(
      async () => (await caches.keys()).filter((n) => n.startsWith('rift-offline-v1:')).length
    ),
    0
  );
  assert.deepEqual(errors, []);
  report.checks.removalKeepsSavedBytes = true;
  await context.close();
  console.log(
    JSON.stringify({ stage: 'production offline controls passed; testing two-version activation' })
  );
  const versions = await browser.newContext(),
    first = await versions.newPage();
  await first.goto(origin + fixture);
  await first.waitForFunction(() => !!window.pack);
  await first.evaluate(async () => {
    await window.pack.check();
    await window.pack.download(() => {});
  });
  const oldID = current.pack.id;
  const other = await versions.newPage();
  await other.goto(origin + fixture);
  await other.waitForFunction(() => !!window.pack);
  current = version(2);
  await first.evaluate(async () => {
    await window.pack.check();
    await window.pack.download(() => {});
  });
  assert.equal(await first.evaluate(() => window.fixtureVersion), 1);
  const rejected = await first.evaluate(async () => {
    try {
      await window.pack.reload();
      return '';
    } catch (e) {
      return e.message;
    }
  });
  assert.match(rejected, /Close other game tabs/);
  report.checks.updateRefusesOtherTabs = true;
  await other.close();
  await versions.setOffline(true);
  await Promise.all([first.waitForEvent('load'), first.evaluate(() => window.pack.reload())]);
  await first.waitForFunction(() => window.fixtureVersion === 2);
  assert.equal(
    (await first.evaluate(() => caches.keys())).filter((n) => n.endsWith(oldID)).length,
    1,
    'old complete pack retained'
  );
  report.checks.explicitAtomicVersionSwitchOffline = true;
  await first.evaluate(async () => {
    await window.pack.check();
    const cache = await caches.open(window.pack.cacheName);
    await cache.delete(new URL('data.json', location.href));
  });
  assert.equal((await first.evaluate(() => window.pack.check())).complete, false);
  const partial = await first.evaluate(async () => {
    try {
      await window.pack.reload();
      return '';
    } catch (e) {
      return e.message;
    }
  });
  assert.match(partial, /incomplete/);
  report.checks.missingEntryRevokesReady = true;
  await first.evaluate(async () => {
    await caches.open('unrelated-user-cache');
    await window.pack.remove();
  });
  assert.deepEqual(await first.evaluate(() => caches.keys()), ['unrelated-user-cache']);
  report.checks.scopeOnlyRemoval = true;
  await versions.close();
  report.result = 'passed';
  report.productionErrors = errors;
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(artifactPrefix + '-production.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch (error) {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    artifactPrefix + '-failure.json',
    JSON.stringify({ ...report, error: error.stack }, null, 2) + '\n'
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((yes) => server.close(yes));
}
