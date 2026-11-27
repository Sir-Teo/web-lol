import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
}

test('Milestone 10: Controls, cast modes, key rebinding, accessibility palettes, scaling, and persistence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);

  // Open pause menu -> Controls & accessibility
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Controls & accessibility', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Controls & accessibility' })).toBeVisible();

  // 1. Configure cast mode -> Normal cast, attack-move -> Quick, TCO -> Toggle, Color vision -> Deuteranopia, HUD scale -> 115%, Text scale -> 110%, Reduced motion -> On
  await page.locator('[data-setting-cast="normal"]').click();
  await page.locator('[data-setting-attack-move="quick"]').click();
  await page.locator('[data-setting-tco="toggle"]').click();
  await page.locator('[data-setting-color="deuteranopia"]').click();
  await page.locator('[data-setting-hud-scale="1.15"]').click();
  await page.locator('[data-setting-text-scale="1.1"]').click();
  await page.locator('[data-action="toggle-reduced-motion"]').click();

  // Verify document attributes and CSS variables applied immediately
  const attrs = await page.evaluate(() => ({
    colorVision: document.documentElement.dataset.colorVision,
    reducedMotion: document.documentElement.dataset.reducedMotion,
    hudScale: document.documentElement.style.getPropertyValue('--hud-scale'),
    textScale: document.documentElement.style.getPropertyValue('--text-scale'),
  }));
  expect(attrs).toEqual({
    colorVision: 'deuteranopia',
    reducedMotion: 'true',
    hudScale: '1.15',
    textScale: '1.1',
  });

  // 2. Rebind Ability W to key "z" (and verify HUD <kbd> updates dynamically)
  await page.locator('[data-rebind="w"]').click();
  await page.keyboard.press('z');
  await expect(page.locator('[data-rebind="w"] kbd')).toHaveText('Z');
  await expect(page.locator('button[data-ability="w"] kbd')).toHaveText('Z');

  // Rebind Ability E to "z" -> should swap E and W cleanly
  await page.locator('[data-rebind="e"]').click();
  await page.keyboard.press('z');
  await expect(page.locator('[data-rebind="e"] kbd')).toHaveText('Z');
  await expect(page.locator('[data-rebind="w"] kbd')).toHaveText('E');
  await expect(page.locator('.keybind-status')).toContainText('swapped with Ability W');

  // 3. Reload the page and verify all settings + custom keybindings persisted in localStorage
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);

  const persisted = await page.evaluate(() => ({
    colorVision: document.documentElement.dataset.colorVision,
    reducedMotion: document.documentElement.dataset.reducedMotion,
    hudScale: document.documentElement.style.getPropertyValue('--hud-scale'),
    textScale: document.documentElement.style.getPropertyValue('--text-scale'),
    wLabel: document.querySelector('button[data-ability="w"] kbd')?.textContent,
    eLabel: document.querySelector('button[data-ability="e"] kbd')?.textContent,
  }));
  expect(persisted).toEqual({
    colorVision: 'deuteranopia',
    reducedMotion: 'true',
    hudScale: '1.15',
    textScale: '1.1',
    wLabel: 'E',
    eLabel: 'Z',
  });

  // 4. Test Normal Cast mode + Target Champions Only toggle in live gameplay
  const resumeBtn = page.getByRole('button', { name: 'Return to the Rift', exact: true });
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
  }
  // Toggle Target Champions Only on and verify it stays active after keyup
  await page.keyboard.press('Backquote');
  await expect(page.locator('.hud')).toHaveClass(/champions-only/);
  // Toggle it back off
  await page.keyboard.press('Backquote');
  await expect(page.locator('.hud')).not.toHaveClass(/champions-only/);

  // Learn Ashe W (Ctrl+W or Ctrl+E) and press rebound W ("e") in Normal Cast: keyup keeps aiming active!
  await page.keyboard.press('Control+w');
  await page.mouse.move(760, 360);
  await page.keyboard.press('e');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  // Left-click commits normal cast and clears aiming
  await page.mouse.click(760, 360);
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);

  // 5. Reset settings to defaults and verify HUD/attributes return to clean defaults
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Controls & accessibility', exact: true }).click();
  await page.getByRole('button', { name: 'Reset defaults', exact: true }).click();
  const resetState = await page.evaluate(() => ({
    colorVision: document.documentElement.dataset.colorVision ?? 'default',
    hudScale: document.documentElement.style.getPropertyValue('--hud-scale'),
    wLabel: document.querySelector('button[data-ability="w"] kbd')?.textContent,
    eLabel: document.querySelector('button[data-ability="e"] kbd')?.textContent,
  }));
  expect(resetState).toEqual({
    colorVision: 'default',
    hudScale: '1',
    wLabel: 'W',
    eLabel: 'E',
  });
  expect(errors).toEqual([]);
});
