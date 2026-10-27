/** Verify native HUD button keyboard activation in the compiled static entry. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
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
    isMuted = () => sound.evaluate((node) => node.classList.contains('off'));
  const before = await isMuted();
  await sound.focus();
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
    pauseSpace: true,
    wardPreviewReplacedByHeal: true,
    resumeSpace: true,
    errors,
    failed,
    outside,
    browser: await browser.version(),
    screenshots: 1,
  };
  writeFileSync(resolve(output, 'reading.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
