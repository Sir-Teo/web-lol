/** Exercise the real production build under a strict static-host subdirectory. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [],
    failed = [],
    outside = [],
    junglePreviewRequests = [],
    scheduledGrompRequests = [],
    recordings = new Set();
  let laneMatchStarted = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (
      /sru-(blue|gromp)-base|gromp-legacy|gromp-death|gromp-attack|jungle-character-source|jungle-characters/.test(
        request.url()
      )
    )
      if (
        !laneMatchStarted ||
        /sru-blue-base|jungle-character-source|jungle-characters/.test(request.url())
      )
        junglePreviewRequests.push(request.url());
      else scheduledGrompRequests.push(request.url());
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      outside.push(request.url());
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    if (response.ok() && /\/assets\/audio\/.*\.wav$/.test(response.url()))
      recordings.add(response.url());
  });
  await page.goto(`${base}map.html`);
  await page.locator('#status').waitFor({ state: 'hidden', timeout: 60000 });
  assert.equal(await page.getByRole('button', { name: 'Jungle sources' }).count(), 0);
  await page.getByRole('button', { name: 'Navigation', exact: true }).click();
  assert.equal(await page.locator('#grid').getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Mid lane', exact: true }).click();
  assert.equal(await page.locator('[data-view="mid"]').getAttribute('aria-pressed'), 'true');
  const practice = page.getByRole('link', { name: 'Practice game' });
  assert.equal(await practice.evaluate((link) => link.href), base);
  await practice.click();
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(page.url(), base);
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.equal(
    await page
      .locator('#battlefield')
      .evaluate((canvas) => canvas.getContext('webgl2').getContextAttributes().alpha),
    false,
    'The production battlefield must remain opaque under subtractive particles'
  );
  await page.goto(`${base}?scene=fixture&champion=garen&encounter=gromp`);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.equal(
    recordings.size,
    17,
    'Every source Hawkshot, Illumination and Light Binding cast/flight recording must load beneath the host prefix'
  );
  await page.mouse.click(880, 480, { button: 'right' });
  await page.waitForTimeout(1800);
  await page.mouse.move(1020, 440);
  await page.keyboard.down('w');
  assert(await page.locator('#battlefield').evaluate((node) => node.classList.contains('aiming')));
  await page.keyboard.press('Escape');
  await page.keyboard.up('w');
  await page.keyboard.press('Control+e');
  await page.waitForTimeout(100);
  await page.keyboard.down('e');
  await page.mouse.click(1040, 440);
  await page.keyboard.up('e');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('[data-ability="e"] .ability-charges').textContent(), '1');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/production-subpath.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Garen', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  laneMatchStarted = true;
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'LUX');
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('Control+q');
  await page.waitForFunction(
    () => !document.querySelector('[data-ability="q"]').classList.contains('insufficient')
  );
  await page.mouse.move(1020, 440);
  await page.keyboard.down('q');
  assert(await page.locator('#battlefield').evaluate((node) => node.classList.contains('aiming')));
  await page.keyboard.up('q');
  await page.waitForFunction(
    () => Number(document.querySelector('[data-ability="q"] .cooldown-text').textContent) > 0
  );
  for (const key of ['q', 'w', 'e', 'r'])
    assert(
      await page
        .locator(`[data-ability="${key}"] img`)
        .evaluate((img) => img.complete && img.naturalWidth > 0)
    );
  await page.screenshot({ path: 'artifacts/production-lux.png' });
  await page.keyboard.press('Escape');
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart lane match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'LUX');
  assert.equal(
    await page
      .locator('.match-identity')
      .textContent()
      .then((text) => text.includes('LANE MATCH')),
    true
  );
  assert.deepEqual(outside, [], 'Requests must stay beneath the static host prefix');
  assert.deepEqual(
    junglePreviewRequests,
    [],
    'Production must not request jungle review data or rigs'
  );
  assert(
    scheduledGrompRequests.some((url) => url.endsWith('/sru-gromp-base.glb')),
    'Lane matches must prepare the scheduled Gromp rig beneath the host prefix'
  );
  assert.deepEqual(failed, [], 'All production resources must load successfully');
  assert.deepEqual(errors, [], 'No production JavaScript or console errors');
  console.log(
    JSON.stringify({
      result: 'passed',
      prefix,
      recordings: recordings.size,
      mapNavigation: true,
      realHawkshotCast: true,
      realLuxBindingCast: true,
      luxLaneRestart: true,
      developmentHook: false,
      garenFixtureInProduction: false,
      junglePreviewRequests: junglePreviewRequests.length,
      scheduledGrompRequests: scheduledGrompRequests.length,
      screenshot: 'artifacts/production-subpath.png',
    })
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
