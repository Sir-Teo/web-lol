/** Verify a generated terminal lane-match checkpoint through the ordinary match-file UI. */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const [url, file, output] = process.argv.slice(2);
if (!url || !file || !output)
  throw new Error('Usage: restore-match.mjs URL SNAPSHOT OUTPUT_PREFIX');
const snapshot = await readFile(file, 'utf8');
const state = JSON.parse(snapshot);
assert.ok(state.winner, 'This diagnostic requires a terminal match');
assert.equal(state.matchMode, 'lanes', 'This diagnostic verifies lane-mode restart');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => window.__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto(url);
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByLabel('Match file', { exact: true }).setInputFiles(file);
  const load = page.getByRole('button', { name: 'Load this match', exact: true });
  await load.waitFor({ state: 'visible' });
  const preview = await page.locator('.file-status').innerText();
  await Promise.all([page.waitForEvent('load'), load.click()]);
  await ready();
  assert.equal(await page.evaluate(() => window.__GAME__.world.snapshot()), snapshot);
  const title = await page.locator('.game-dialog h2').innerText();
  assert.match(title, state.winner === 'blue' ? /Victory/i : /Defeat/i);
  await page.screenshot({ path: `${output}.png` });
  const frozen = await page.evaluate(() => {
    const w = window.__GAME__.world;
    const before = w.snapshot();
    w.step(120);
    return w.snapshot() === before;
  });
  assert.equal(frozen, true);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Play again', exact: true }).click(),
  ]);
  await ready();
  const restarted = await page.evaluate(() => {
    const g = window.__GAME__;
    return {
      mode: g.world.matchMode,
      tick: g.world.tick,
      winner: g.world.winner,
      paused: g.hud.paused,
      champions: g.world.units.filter((u) => u.kind === 'champion').length,
    };
  });
  assert.deepEqual(restarted, {
    mode: state.matchMode,
    tick: 0,
    winner: null,
    paused: true,
    champions: 10,
  });
  assert.deepEqual(errors, []);
  const result = {
    snapshotSHA256: createHash('sha256').update(snapshot).digest('hex'),
    preview,
    title,
    exactRestoration: true,
    terminalFrozen: frozen,
    restarted,
    errors,
  };
  await writeFile(`${output}.json`, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} finally {
  await browser.close();
}
