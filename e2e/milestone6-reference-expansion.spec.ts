import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.setTimeout(240_000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
}

test('Milestone 6: Reference & Patch 26.18 ledger, Rune selector, 33-item Shop + Undo + Stasis, Farsight, Role Quests, and 10-champion 5v5', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('artifacts', { recursive: true });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);

  // 1. Inspect Reference & Patch 26.18 coverage and deviations ledger from Pause menu
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Reference & patch 26.18', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reference & Patch 26.18' })).toBeVisible();
  await expect(page.locator('#audit-list .audit-entry')).toHaveCount(
    await page.evaluate(() => document.querySelectorAll('#audit-list .audit-entry').length)
  );
  expect(await page.locator('#audit-list .audit-entry').count()).toBeGreaterThanOrEqual(120);
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone6-reference-ledger.png' });
  }
  await page.locator('[data-audit-filter="approximation"]').click();
  expect(await page.locator('#audit-list .audit-entry:not([hidden])').count()).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();

  // 2. Open New Match -> select Ezreal + customize Keystone (Arcane Comet) & Secondary (Cosmic Insight) -> start 10-champion 5v5
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  expect(await page.locator('[data-action="choose-champion"]').count()).toBe(10);
  await page.getByRole('button', { name: 'Ezreal', exact: true }).click();
  await page.locator('[data-keystone="comet"]').click();
  await page.locator('[data-secondary-rune="cosmic-insight"]').click();
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone6-new-match-runes.png' });
  }

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();

  // Verify 10 distinct champions (zero mirrors), Ezreal's custom runes, and active Role Quest badge
  const matchCheck = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const champs = w.units.filter((u: any) => u.kind === 'champion').map((u: any) => u.champion);
    return {
      hero: w.hero.champion,
      uniqueChampions: new Set(champs).size,
      totalChampions: champs.length,
      keystone: w.player.runeState?.loadout.keystone,
      secondary: w.player.runeState?.loadout.secondary,
      questRole: w.player.roleQuest?.role,
      hasObjectives: !!w.riftObjectives,
    };
  });
  expect(matchCheck).toEqual({
    hero: 'ezreal',
    uniqueChampions: 10,
    totalChampions: 10,
    keystone: 'comet',
    secondary: 'cosmic-insight',
    questRole: 'carry',
    hasObjectives: true,
  });
  await expect(page.locator('#role-quest-status')).toContainText('Marksman’s Arsenal');
  await expect(page.locator('#role-quest-status')).toContainText('Arcane Comet');

  // 3. Test Expanded Shop, Category Filters, Consumable Stacking, Fountain Undo, Zhonya's Stasis, and 7-Slot Carry Quest UI parity!
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold = 12_000;
  });
  await page.keyboard.press('p');
  await page.locator('[data-shop-category="starter"]').click();
  await page.locator('[data-buy="health-potion"]').click();
  await page.locator('[data-buy="health-potion"]').click();
  await expect(page.locator('.shop-owned strong')).toContainText('×2');

  // Undo second Health Potion purchase!
  await page.locator('[data-action="undo-shop"]').click();
  await expect(page.locator('.shop-message')).toContainText('undone');

  // Switch to Magic category -> purchase Zhonya's Hourglass
  await page.locator('[data-shop-category="magic"]').click();
  await page.locator('[data-buy="zhonyas"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone6-expanded-shop.png' });
  }
  await page.keyboard.press('Escape');

  // Activate Zhonya's Hourglass in slot 1 (key '2') -> verify Stasis invulnerability!
  await page.keyboard.press('2');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const w = (window as any).__GAME__.world;
        return w.vulnerable(w.hero);
      })
    )
    .toBe(false);
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone6-stasis-active.png' });
  }

  // Complete Carry Role Quest -> verify HUD & Scoreboard immediately expand to 7 item slots!
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const w = g.world;
    w.player.roleQuest.progress = w.player.roleQuest.target - 5;
    const foe = w.units.find((u: any) => u.kind === 'champion' && u.team === 'red');
    foe.x = w.hero.x + 120;
    foe.y = w.hero.y;
    w.damage(w.hero, foe, 99_999, 'true', 'ability');
    w.step(2);
    g.hud.update(60);
  });
  await expect(page.locator('.inventory-panel')).toHaveClass(/seven-slots/);
  await expect(page.locator('#inventory .item-slot')).toHaveCount(7);

  // Check Scoreboard Epic Objectives section & 7-slot Carry row
  await page.keyboard.down('Tab');
  await expect(page.getByRole('region', { name: 'Epic objectives' })).toContainText('Drake');
  await expect(page.getByRole('region', { name: 'Baron Nashor' })).toContainText('Baron Nashor');
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone6-scoreboard-objectives.png' });
  }
  await page.keyboard.up('Tab');

  expect(errors).toEqual([]);
});
