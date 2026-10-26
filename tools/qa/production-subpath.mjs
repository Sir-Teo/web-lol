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
    leonaPreviewRequests = [],
    ahriPreviewRequests = [],
    masterYiPreviewRequests = [],
    masterYiAttackAudioRequests = [],
    masterYiHighlanderAudioRequests = [],
    masterYiAlphaAudioRequests = [],
    masterYiMeditateAudioRequests = [],
    masterYiWujuStyleAudioRequests = [],
    masterYiQCastRequests = [],
    masterYiQEndRequests = [],
    masterYiRCastRequests = [],
    masterYiQContactRequests = [],
    masterYiMeditateCastRequests = [],
    masterYiMeditateBuffRequests = [],
    preparedCompanionRequests = [],
    wardRigRequests = [],
    oracleRigRequests = [],
    oracleAudioRequests = [],
    scheduledGrompRequests = [],
    scheduledBlueRequests = [],
    scheduledRedRequests = [],
    scheduledWolfRequests = [],
    scheduledRaptorRequests = [],
    scheduledKrugRequests = [],
    scheduledScuttlerRequests = [],
    lucentSourceAssets = new Set(),
    recordings = new Set();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.url().endsWith('/ahri-base.glb')) ahriPreviewRequests.push(request.url());
    if (request.url().endsWith('/masteryi-base.glb')) masterYiPreviewRequests.push(request.url());
    if (/\/masteryi-aa-\d+\.wav$/.test(request.url()))
      masterYiAttackAudioRequests.push(request.url());
    if (/\/masteryi-r-\d+\.wav$/.test(request.url()))
      masterYiHighlanderAudioRequests.push(request.url());
    if (/\/masteryi-q-\d+\.wav$/.test(request.url()))
      masterYiAlphaAudioRequests.push(request.url());
    if (/\/masteryi-w-\d+\.wav$/.test(request.url()))
      masterYiMeditateAudioRequests.push(request.url());
    if (/\/masteryi-e-\d+\.wav$/.test(request.url()))
      masterYiWujuStyleAudioRequests.push(request.url());
    if (/\/masteryi-q-cast-[^/]+\.png$/.test(request.url()))
      masterYiQCastRequests.push(request.url());
    if (/\/masteryi-q-end-[^/]+\.png$/.test(request.url()))
      masterYiQEndRequests.push(request.url());
    if (/\/masteryi-r-cast-[^/]+\.(?:png|glb)$/.test(request.url()))
      masterYiRCastRequests.push(request.url());
    if (/\/masteryi-q-contact-(?:[0-9a-f]+\.png|trail\.glb)$/.test(request.url()))
      masterYiQContactRequests.push(request.url());
    if (/\/masteryi-w-cast-[^/]+\.(?:png|glb)$/.test(request.url()))
      masterYiMeditateCastRequests.push(request.url());
    if (/\/masteryi-w-buff-[^/]+\.(?:png|glb)$/.test(request.url()))
      masterYiMeditateBuffRequests.push(request.url());
    if (/\/(?:leona[^/]*\.(?:glb|png|wav)|base_brightspark_11\.png)$/i.test(request.url()))
      leonaPreviewRequests.push(request.url());
    if (request.url().endsWith('/sightward-base.glb')) wardRigRequests.push(request.url());
    if (/\/oracle-lens-[^/]+\.glb$/.test(request.url())) oracleRigRequests.push(request.url());
    if (/\/oracle-\d+\.wav$/.test(request.url())) oracleAudioRequests.push(request.url());
    if (/sru-jungle-companions-skin[012]-base|jungle-companions-source/.test(request.url()))
      preparedCompanionRequests.push(request.url());
    if (
      /sru-(blue|red|gromp|murkwolf|murkwolfmini|razorbeak|razorbeakmini|krug|krugmini|krugminimini|crab)-base|gromp-legacy|gromp-death|gromp-attack|jungle-character-source|jungle-characters/.test(
        request.url()
      )
    )
      if (/jungle-character-source|jungle-characters/.test(request.url()))
        junglePreviewRequests.push(request.url());
      else if (request.url().includes('sru-blue-base')) scheduledBlueRequests.push(request.url());
      else if (request.url().includes('sru-red-base')) scheduledRedRequests.push(request.url());
      else if (request.url().includes('sru-murkwolf')) scheduledWolfRequests.push(request.url());
      else if (request.url().includes('sru-razorbeak')) scheduledRaptorRequests.push(request.url());
      else if (request.url().includes('sru-krug')) scheduledKrugRequests.push(request.url());
      else if (request.url().includes('sru-crab-base'))
        scheduledScuttlerRequests.push(request.url());
      else scheduledGrompRequests.push(request.url());
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      outside.push(request.url());
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    if (response.ok() && /\/assets\/audio\/.*\.wav$/.test(response.url()))
      recordings.add(response.url());
    if (
      response.ok() &&
      /\/assets\/(?:effects\/lux-e-[^/]+\.png|models\/lux-e-(?:indicator|slash)\.glb)$/.test(
        response.url()
      )
    )
      lucentSourceAssets.add(new URL(response.url()).pathname.replace(prefix, ''));
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
  const practiceRigs = [
    ...scheduledGrompRequests,
    ...scheduledBlueRequests,
    ...scheduledRedRequests,
    ...scheduledWolfRequests,
    ...scheduledRaptorRequests,
    ...scheduledKrugRequests,
    ...scheduledScuttlerRequests,
  ].filter((url) => /\/models\/sru-[^/]+-base\.glb$/.test(url));
  assert.equal(
    new Set(practiceRigs).size,
    11,
    'Ordinary Rift practice must prepare all eleven scheduled monster rigs'
  );
  for (const champion of ['garen', 'leona', 'ahri']) {
    await page.goto(
      `${base}?scene=fixture&champion=${champion}&npc=${champion === 'ahri' ? 'ahri' : 'leona'}&encounter=gromp&companion=gustwalker`
    );
    await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
    assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
    assert.equal(await page.evaluate(() => !!window.__GAME__), false);
    assert.equal(await page.locator('#companion-status').count(), 0);
  }
  await page.goto(`${base}?scene=fixture&champion=ahri`);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
  assert.equal(await page.locator('#ahri-essence').count(), 0);
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.deepEqual(
    ahriPreviewRequests,
    [],
    'Ordinary production and diagnostic flags must not load Ahri'
  );
  await page.goto(`${base}?scene=fixture&npc=masteryi`);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  await page.goto(`${base}?scene=fixture&champion=masteryi`);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
  assert.equal(await page.locator('#masteryi-double-strike').count(), 0);
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  await page.goto(`${base}?scene=leona-rift&champion=leona`);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'ASHE');
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.equal(
    recordings.size,
    29,
    'Every source Lucent Singularity, Hawkshot, Illumination and Light Binding cast/flight recording must load beneath the host prefix'
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
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-subpath.png' });
  assert.equal(
    preparedCompanionRequests.length,
    0,
    'Unselected practice companions must not preload'
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Garen', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Ahri', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await page
    .getByRole('group', { name: 'F spell', exact: true })
    .getByRole('button', { name: 'Smite', exact: true })
    .click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'LUX');
  assert.equal(
    await page.locator('[data-ability="f"] img').getAttribute('src'),
    'assets/icons/SummonerSmite.png'
  );
  await page.waitForFunction(
    () => document.querySelector('[data-ability="f"] .ability-charges')?.textContent === '1'
  );
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
  await page.keyboard.down('Tab');
  for (const role of ['top', 'jungle', 'mid', 'carry', 'support'])
    assert.equal(await page.locator(`.scoreboard-row[data-role="${role}"]`).count(), 2);
  await page.waitForFunction(() => {
    const icons = [...document.querySelectorAll('.scoreboard-row img')];
    return icons.length >= 30 && icons.every((img) => img.complete && img.naturalWidth > 0);
  });
  const roleScoreboardIcons = await page.locator('.scoreboard-row img').count();
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-role-match.png' });
  await page.keyboard.up('Tab');
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-lux.png' });
  await page.keyboard.press('Escape');
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart 5v5 match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert.equal(await page.locator('.champion-title strong').textContent(), 'LUX');
  assert.equal(
    await page.locator('[data-ability="f"] img').getAttribute('src'),
    'assets/icons/SummonerSmite.png'
  );
  assert.equal(
    await page
      .locator('.match-identity')
      .textContent()
      .then((text) => text.includes('5V5 MATCH')),
    true
  );
  assert.deepEqual(outside, [], 'Requests must stay beneath the static host prefix');
  assert.equal(
    preparedCompanionRequests.length,
    2,
    'Both selected 5v5 boots prepare their owned jungle companion rig'
  );
  assert(
    preparedCompanionRequests.every((url) => url.endsWith('/sru-jungle-companions-skin2-base.glb'))
  );
  const roleCompanionRequests = preparedCompanionRequests.length;
  // The normal restart supplies a fresh level-one skill point. Exercise E through
  // actual production input without development hooks or granting experience.
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('Control+e');
  await page.mouse.move(980, 470);
  await page.keyboard.down('e');
  await page.keyboard.up('e');
  await page.waitForFunction(
    () => document.querySelector('[data-ability="e"] .cooldown-text')?.textContent === 'RECAST'
  );
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-lux-e-source.png' });
  await page.locator('[data-ability="e"]').click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-ability="e"] .cooldown-text')?.textContent) > 0
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-lux-e-moving-burst.png' });
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert(lucentSourceAssets.has('assets/models/lux-e-indicator.glb'));
  assert(lucentSourceAssets.has('assets/models/lux-e-slash.glb'));
  assert.equal(
    [...lucentSourceAssets].filter((p) => p.endsWith('.png')).length,
    17,
    'Only the seventeen selected E textures should load; unused prepared distortion assets remain unloaded'
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start practice', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  assert((await page.locator('.match-identity').textContent()).includes('PRACTICE'));
  assert.equal(
    await page.locator('[data-ability="f"] img').getAttribute('src'),
    'assets/icons/SummonerSmite.png'
  );
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('p');
  await page.locator('.shop-catalog').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => document.querySelector('[data-buy="boots"]')?.title === 'Buy a jungle companion first'
  );
  assert.equal(
    await page.locator('[data-buy="boots"]').getAttribute('title'),
    'Buy a jungle companion first'
  );
  await page.locator('[data-buy="gustwalker"]').click();
  await page.waitForFunction(
    () => document.querySelector('.shop-message')?.textContent === 'Item purchased'
  );
  await page.waitForFunction(() =>
    document.querySelector('#companion-status')?.textContent.includes('Gustwalker Hatchling')
  );
  assert.equal(
    await page.locator('.shop-owned [data-item="gustwalker"]').getAttribute('aria-disabled'),
    'true'
  );
  await page.locator('.close-button').click();
  await page.mouse.move(980, 480);
  await page.keyboard.down('4');
  await page.keyboard.up('4');
  await page.locator('.unit-bar.blue.ward:not([hidden])').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#trinket .trinket-charges').textContent(), '0');
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-ward.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#toast')?.textContent === 'Match saved on this browser.'
  );
  await page.reload();
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.waitForFunction(
    () => !!document.querySelector('#inventory img[alt="Gustwalker Hatchling"]')
  );
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  assert.equal(await page.locator('#inventory img[alt="Gustwalker Hatchling"]').count(), 1);
  assert.equal(await page.locator('#trinket .trinket-charges').textContent(), '0');
  assert.equal(await page.locator('.unit-bar.blue.ward:not([hidden])').count(), 1);
  assert(wardRigRequests.length >= 2);
  assert((await page.locator('#companion-status').textContent()).includes('0/35 treats'));
  assert(preparedCompanionRequests.length >= roleCompanionRequests + 2);
  assert(
    preparedCompanionRequests.every((url) =>
      /\/sru-jungle-companions-skin[02]-base\.glb$/.test(url)
    )
  );
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-companion-purchase.png' });
  assert.equal(oracleRigRequests.length, 0, 'Unequipped Oracle assets must not preload');
  assert.equal(oracleAudioRequests.length, 0, 'Unequipped Oracle audio must not preload');
  await page.keyboard.press('p');
  await page.locator('[data-trinket="oracle"]').click();
  await page.waitForFunction(
    () => document.querySelector('.shop-message')?.textContent === 'Trinket equipped'
  );
  await page.locator('.close-button').click();
  await page.locator('#practice-button').click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('4');
  await page.locator('#trinket.active').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#trinket .trinket-charges').textContent(), '1');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#toast')?.textContent === 'Match saved on this browser.'
  );
  await page.reload();
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.locator('#trinket.active').waitFor({ state: 'visible' });
  assert(
    (await page.locator('#trinket').getAttribute('aria-label')).startsWith(
      'Oracle Lens: 1/2 charges, scan active'
    )
  );
  assert.equal(await page.locator('.unit-bar.blue.ward:not([hidden])').count(), 1);
  assert.equal(await page.evaluate(() => !!window.__GAME__), false);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.screenshot({ path: 'artifacts/lux-e-hit-production-oracle.png' });
  assert(oracleRigRequests.length >= 8);
  assert.equal(new Set(oracleAudioRequests).size, 3);
  assert(
    oracleAudioRequests.length >= 6,
    'Selection and restore must prepare all three Oracle recordings'
  );
  assert.equal(recordings.size, 32);
  assert(
    oracleRigRequests.every((url) => /\/oracle-lens-(base|radar|laser|core-laser)\.glb$/.test(url))
  );
  assert.deepEqual(outside, [], 'Purchased companion assets must stay beneath the host prefix');
  assert.deepEqual(junglePreviewRequests, [], 'Production must not request jungle review data');
  assert(
    scheduledGrompRequests.some((url) => url.endsWith('/sru-gromp-base.glb')),
    'Rift matches must prepare the scheduled Gromp rig beneath the host prefix'
  );
  assert(
    scheduledBlueRequests.some((url) => url.endsWith('/sru-blue-base.glb')),
    'Rift matches must prepare the normal Blue Sentinel rig beneath the host prefix'
  );
  assert.deepEqual(failed, [], 'All production resources must load successfully');
  assert(
    scheduledRedRequests.some((url) => url.endsWith('/sru-red-base.glb')),
    'Rift matches must prepare the normal Red Brambleback rig beneath the host prefix'
  );
  assert.deepEqual(errors, [], 'No production JavaScript or console errors');
  for (const rig of ['sru-murkwolf-base', 'sru-murkwolfmini-base'])
    assert(
      scheduledWolfRequests.some((url) => url.endsWith(`/${rig}.glb`)),
      'Rift matches must prepare both wolf rigs'
    );
  for (const rig of ['sru-razorbeak-base', 'sru-razorbeakmini-base'])
    assert(
      scheduledRaptorRequests.some((url) => url.endsWith(`/${rig}.glb`)),
      'Rift matches must prepare both raptor rigs'
    );
  for (const rig of ['sru-krug-base', 'sru-krugmini-base', 'sru-krugminimini-base'])
    assert(
      scheduledKrugRequests.some((url) => url.endsWith(`/${rig}.glb`)),
      'Rift matches must prepare all three Krug rigs, including future descendants'
    );
  assert(
    scheduledScuttlerRequests.some((url) => url.endsWith('/sru-crab-base.glb')),
    'Rift matches must prepare the peaceful Scuttler rig before its calendar or shrine exists'
  );
  assert.deepEqual(
    leonaPreviewRequests,
    [],
    'Ordinary production worlds do not preload development Leona assets'
  );
  assert.deepEqual(
    masterYiPreviewRequests,
    [],
    'Production must not preload the development Master Yi rig'
  );
  assert.deepEqual(
    masterYiAttackAudioRequests,
    [],
    'Production must not preload development Master Yi attack audio'
  );
  assert.deepEqual(
    masterYiHighlanderAudioRequests,
    [],
    'Production must not preload development Highlander audio'
  );
  assert.deepEqual(
    masterYiRCastRequests,
    [],
    'Production must not preload development Highlander cast assets'
  );
  assert.deepEqual(
    masterYiQEndRequests,
    [],
    'Production must not preload development Alpha Strike reappearance assets'
  );
  assert.deepEqual(
    masterYiQCastRequests,
    [],
    'Production must not preload development Alpha Strike cast assets'
  );
  assert.deepEqual(
    masterYiQContactRequests,
    [],
    'Production must not preload development Alpha Strike contact assets'
  );
  assert.deepEqual(
    masterYiMeditateCastRequests,
    [],
    'Production must not preload development Meditate cast assets'
  );
  assert.deepEqual(
    masterYiMeditateBuffRequests,
    [],
    'Production must not preload development Meditate buff assets'
  );
  assert.deepEqual(
    masterYiWujuStyleAudioRequests,
    [],
    'Production must not preload development Wuju Style audio'
  );
  assert.deepEqual(
    masterYiMeditateAudioRequests,
    [],
    'Production must not preload development Meditate audio'
  );
  assert.deepEqual(
    masterYiAlphaAudioRequests,
    [],
    'Production must not preload development Alpha Strike audio'
  );
  console.log(
    JSON.stringify({
      result: 'passed',
      prefix,
      recordings: recordings.size,
      mapNavigation: true,
      practiceScheduledRigs: new Set(practiceRigs).size,
      realHawkshotCast: true,
      realLuxBindingCast: true,
      realLuxSingularityCastAndRecast: true,
      lucentSourceAssets: [...lucentSourceAssets].sort(),
      luxLaneRestart: true,
      selectedSmiteLoadoutAndRestart: true,
      companionPurchaseAndRestore: true,
      companionPurchaseInPractice: true,
      realWardPlacementAndRestore: true,
      oraclePurchaseActivationAndRestore: true,
      oracleRigRequests: oracleRigRequests.length,
      oracleAudioRequests: oracleAudioRequests.length,
      unrequestedOraclePreloads: 0,
      wardRigRequests: wardRigRequests.length,
      unrequestedCompanionPreloads: 0,
      developmentHook: false,
      garenFixtureInProduction: false,
      leonaPlayerFixtureInProduction: false,
      leonaRiftTrialInProduction: false,
      ahriNpcFixtureInProduction: false,
      ahriPlayerFixtureInProduction: false,
      unrequestedAhriPreloads: ahriPreviewRequests.length,
      unrequestedMasterYiPreloads: masterYiPreviewRequests.length,
      unrequestedMasterYiAttackAudioPreloads: masterYiAttackAudioRequests.length,
      unrequestedMasterYiHighlanderAudioPreloads: masterYiHighlanderAudioRequests.length,
      unrequestedMasterYiAlphaAudioPreloads: masterYiAlphaAudioRequests.length,
      unrequestedMasterYiMeditateAudioPreloads: masterYiMeditateAudioRequests.length,
      unrequestedMasterYiWujuStyleAudioPreloads: masterYiWujuStyleAudioRequests.length,
      unrequestedMasterYiHighlanderCastPreloads: masterYiRCastRequests.length,
      unrequestedMasterYiQEndPreloads: masterYiQEndRequests.length,
      unrequestedMasterYiQCastPreloads: masterYiQCastRequests.length,
      unrequestedMasterYiQContactPreloads: masterYiQContactRequests.length,
      unrequestedMasterYiMeditateCastPreloads: masterYiMeditateCastRequests.length,
      unrequestedMasterYiMeditateBuffPreloads: masterYiMeditateBuffRequests.length,
      masterYiNpcFixtureInProduction: false,
      masterYiPlayerFixtureInProduction: false,
      junglePreviewRequests: junglePreviewRequests.length,
      unrequestedLeonaPreloads: leonaPreviewRequests.length,
      preparedCompanionRequests: preparedCompanionRequests.length,
      roleCompanionRequests,
      roleScoreboardIcons,
      scheduledGrompRequests: scheduledGrompRequests.length,
      scheduledBlueRequests: scheduledBlueRequests.length,
      scheduledRedRequests: scheduledRedRequests.length,
      scheduledWolfRequests: scheduledWolfRequests.length,
      scheduledRaptorRequests: scheduledRaptorRequests.length,
      scheduledKrugRequests: scheduledKrugRequests.length,
      scheduledScuttlerRequests: scheduledScuttlerRequests.length,
      screenshot: 'artifacts/lux-e-hit-production-subpath.png',
    })
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
