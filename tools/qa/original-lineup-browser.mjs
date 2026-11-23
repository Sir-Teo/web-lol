/** Exercise the production lineup through normal input, checkpoints, and replay. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, firefox, webkit } from '@playwright/test';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:4173/' },
    browser: { type: 'string', default: 'chromium' },
    'chromium-path': { type: 'string' },
    'browser-path': { type: 'string' },
    headed: { type: 'boolean', default: false },
    output: { type: 'string', default: 'artifacts/original-lineup-chromium' },
  },
});
const engine = { chromium, firefox, webkit }[values.browser];
assert(engine, 'Choose chromium, firefox, or webkit');
const output = resolve(values.output);
await mkdir(output);
const base = new URL(values.url);
const browser = await engine.launch({
  headless: !values.headed,
  ...(values['browser-path'] ? { executablePath: resolve(values['browser-path']) } : {}),
  ...(values.browser === 'chromium' && values['chromium-path']
    ? {
        executablePath: resolve(values['chromium-path']),
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      }
    : {}),
  ...(values.browser === 'firefox'
    ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.forbid-software': false } }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(90000);
const result = {
  browser: values.browser,
  version: browser.version(),
  checks: {},
  errors: [],
  failedRequests: [],
};
page.on('pageerror', (error) => result.errors.push(error.message));
page.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText;
  if (failure && !/ABORTED|cancelled|interrupted/i.test(failure))
    result.failedRequests.push({ url: request.url(), failure });
});
const button = (name) => page.getByRole('button', { name, exact: true });
async function ready() {
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 150000 });
  await page.locator('canvas#battlefield').waitFor();
  assert.equal(await page.evaluate(() => Boolean(window.__GAME__)), false);
}

try {
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await ready();
  await page.locator('#pause-button').click();
  await button('New match').click();
  const selector = page.getByRole('group', { name: 'Original lineup', exact: true });
  const names = [
    ['Brannic', 'top'],
    ['Taviq', 'jungle'],
    ['Irielle', 'mid'],
    ['Oona Vale', 'support'],
    ['Vess', 'bottom'],
  ];
  assert.equal(await page.locator('[data-champion]').count(), 15);
  for (const [name, role] of names) {
    const choice = selector.getByRole('button', { name, exact: true });
    await choice.click();
    assert.equal(await choice.getAttribute('aria-pressed'), 'true');
    const description = (await page.locator('.lane-description').textContent()).toLowerCase();
    assert(description.includes(role), description);
  }
  await page.screenshot({ path: resolve(output, 'lineup.png') });
  result.checks.originalSelections = names.map(([name]) => name);
  await button('Start 5v5 match').click();
  await button('Return to the Rift').waitFor();
  await ready();
  assert.equal(
    (await page.locator('.champion-title strong').textContent()).trim().toUpperCase(),
    'VESS'
  );
  await button('Return to the Rift').click();
  await page.keyboard.down('Tab');
  await page.locator('.scoreboard-row').last().waitFor();
  assert.equal(await page.locator('.scoreboard-row').count(), 10);
  const scoreboard = await page.locator('.scoreboard-row strong').allTextContents();
  for (const [name] of names)
    assert(
      scoreboard.some((value) => value.includes(name)),
      scoreboard.join(', ')
    );
  await page.screenshot({ path: resolve(output, 'scoreboard.png') });
  await page.keyboard.up('Tab');
  result.checks.tenChampionScoreboard = true;

  await page.keyboard.press('Control+q');
  const spell = page.locator('.ability[data-ability="q"]');
  await page.locator('.ability[data-ability="q"]:not(.insufficient)').waitFor();
  await page.mouse.move(875, 405);
  await page.keyboard.down('q');
  await page.locator('#battlefield.aiming').waitFor();
  await page.screenshot({ path: resolve(output, 'aim.png') });
  await page.keyboard.up('q');
  await page.waitForFunction(
    () => !!document.querySelector('.ability[data-ability="q"] .cooldown-text')?.textContent?.trim()
  );
  assert((await spell.textContent()).length > 0);
  result.checks.copperShot = true;

  await page.locator('#pause-button').click();
  await button('Save match').click();
  await page.locator('#toast').filter({ hasText: 'Match saved on this browser.' }).waitFor();
  await button('Replay').click();
  const replayDownload = page.waitForEvent('download');
  await button('Download replay file').click();
  const replay = JSON.parse(await readFile(await (await replayDownload).path(), 'utf8'));
  assert.equal(replay.champion, 'vess');
  assert(
    replay.entries.some(
      ({ action }) =>
        action.type === 'enqueue' &&
        action.command.type === 'cast' &&
        action.command.ability === 'q'
    )
  );
  result.checks.replayCapturedPlayerCast = true;
  await button('Watch current replay').click();
  await page.locator('#replay-bar').waitFor();
  await button('Play replay').waitFor();
  await page.waitForFunction(() => {
    const badge = document.querySelector('#replay-verify')?.textContent ?? '';
    const match = /^(?:✓ )?(\d+)\/(\d+) hashes/.exec(badge);
    return match && match[1] === match[2];
  });
  assert.equal(await page.locator('#replay-verify.error').count(), 0);
  await button('Exit replay').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  assert.equal(
    (await page.locator('.champion-title strong').textContent()).trim().toUpperCase(),
    'VESS'
  );
  await button('Return to the Rift').waitFor();
  result.checks.checkpointReload = true;
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.failedRequests, []);
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.failure = String(error);
  await page.screenshot({ path: resolve(output, 'failure.png'), timeout: 5000 }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
