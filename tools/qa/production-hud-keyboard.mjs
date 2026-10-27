/** Verify native HUD button keyboard activation in the compiled static entry. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/production-hud-keyboard-${Date.now()}`);
assert(!existsSync(output), 'Use a fresh output directory');
await mkdir(output, { recursive: true });

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
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
    errors = [],
    failed = [],
    outside = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    failed.push({ url: request.url(), error: request.failure()?.errorText })
  );
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http') && !url.startsWith(base)) outside.push(url);
  });
  await page.addInitScript(() => {
    const contexts = [];
    Object.defineProperty(window, '__QA_AUDIO_CONTEXTS__', { value: contexts });
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args);
        contexts.push(context);
        return context;
      },
    });
  });
  await page.goto(base);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.equal(await page.evaluate(() => window.__QA_AUDIO_CONTEXTS__.length), 0);
  await page.keyboard.press('s');
  await page.waitForFunction(() =>
    window.__QA_AUDIO_CONTEXTS__.some((context) => context.state === 'running')
  );
  assert.equal(await page.evaluate(() => window.__QA_AUDIO_CONTEXTS__.length), 1);

  const sound = page.getByRole('button', { name: 'Toggle sound', exact: true }),
    camera = page.getByRole('button', { name: 'Toggle camera lock', exact: true }),
    isMuted = () => sound.evaluate((node) => node.classList.contains('off'));
  const before = await isMuted();
  await camera.focus();
  await page.keyboard.press('Tab');
  assert.equal(await sound.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await camera.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Tab');
  assert.equal(await sound.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Space');
  assert.equal(await isMuted(), !before, 'Focused sound button must activate with Space');
  await page.keyboard.press('Enter');
  assert.equal(await isMuted(), before, 'Enter must retain its native button activation');
  await page.locator('#trinket').click();
  assert.equal(
    await page.locator('#battlefield').evaluate((node) => node.classList.contains('aiming')),
    true
  );
  await page.getByRole('button', { name: 'Heal', exact: true }).click();
  assert.equal(
    await page.locator('#battlefield').evaluate((node) => node.classList.contains('aiming')),
    false,
    'HUD Heal must clear ward selection'
  );
  assert.equal(await page.locator('#trinket .trinket-charges').textContent(), '1');
  await page.getByRole('button', { name: 'Pause game', exact: true }).focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('heading', { name: 'Game paused', exact: true })
    .waitFor({ state: 'visible' });
  await page.screenshot({ path: resolve(output, 'paused-with-space.png') });
  await page.getByRole('button', { name: 'Offline files', exact: true }).click();
  const offlineDialog = page.getByRole('dialog'),
    back = page.getByRole('button', { name: 'Back to pause menu', exact: true });
  await page.locator('.offline-size').filter({ hasText: 'Full game pack:' }).waitFor();
  assert.equal(await offlineDialog.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await back.evaluate((node) => document.activeElement === node),
    true,
    'Initial reverse traversal must reach the last control'
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .getByRole('button', { name: 'Close menu', exact: true })
      .evaluate((node) => document.activeElement === node),
    true
  );
  await page.keyboard.press('Shift+Tab');
  assert.equal(await back.evaluate((node) => document.activeElement === node), true);
  await page.screenshot({ path: resolve(output, 'offline-modal-focus.png') });
  await page.keyboard.press('Space');
  await page.getByRole('heading', { name: 'Game paused', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current match', exact: true }).click();
  const importBytes = readFileSync(await (await exported).path()),
    importState = JSON.parse(importBytes);
  // Hold the native IndexedDB completion callback after the real write. This
  // exercises pending production UI without exposing a development game hook.
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = Reflect.apply(original, this, args);
      if (args[1] === 'readwrite')
        Object.defineProperty(tx, 'oncomplete', {
          configurable: true,
          get() {
            return complete.get.call(tx);
          },
          set(callback) {
            complete.set.call(tx, (event) => {
              window.__QA_RELEASE_IMPORT__ = () => callback.call(tx, event);
            });
          },
        });
      return tx;
    };
  });
  await page
    .getByLabel('Match file', { exact: true })
    .setInputFiles({
      name: 'paused-keyboard-match.json',
      mimeType: 'application/json',
      buffer: importBytes,
    });
  const load = page.getByRole('button', { name: 'Load this match', exact: true });
  await load.click();
  await page.locator('.file-status').filter({ hasText: 'Loading match…' }).waitFor();
  await page.waitForFunction(() => typeof window.__QA_RELEASE_IMPORT__ === 'function');
  const importDialog = page.getByRole('dialog');
  assert.equal(await importDialog.evaluate((node) => document.activeElement === node), true);
  assert.equal(await importDialog.locator('button:not([disabled])').count(), 0);
  for (const key of ['Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    assert.equal(await importDialog.evaluate((node) => document.activeElement === node), true);
  }
  await page.screenshot({ path: resolve(output, 'import-pending-focus.png') });
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => window.__QA_RELEASE_IMPORT__()),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.getByRole('heading', { name: 'Game paused', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  const restored = await page.evaluate(async () => {
    const request = indexedDB.open('rift-local-matches', 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('checkpoints', 'readonly'),
          r = tx.objectStore('checkpoints').get('rift');
        tx.oncomplete = () => resolve(r.result);
        tx.onabort = reject;
      });
    } finally {
      db.close();
    }
  });
  assert.equal(restored, importBytes.toString());
  const seconds = Math.floor(importState.tick / 60);
  assert.equal(
    await page.locator('#clock').textContent(),
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  );
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('heading', { name: 'Game paused', exact: true })
    .waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(outside, []);
  const result = {
    result: 'passed',
    prefix,
    developmentHook: false,
    firstKeyboardAudio: true,
    audioContextsCreated: 1,
    soundSpace: true,
    soundEnter: true,
    hudTabNavigation: true,
    pauseSpace: true,
    offlineDialogReverseInitialFocus: true,
    wardPreviewReplacedByHeal: true,
    resumeSpace: true,
    pendingImportRetainsDialogFocus: true,
    importedStateExactAfterNativeWrite: true,
    errors,
    failed,
    outside,
    browser: await browser.version(),
    screenshots: 3,
  };
  writeFileSync(resolve(output, 'reading.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
