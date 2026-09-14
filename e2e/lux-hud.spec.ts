import { expect, test, type Page } from '@playwright/test';
test.use({ viewport: { width: 1366, height: 768 } });
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function lux(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const original = w.hero;
    const unit = w.spawn('champion', 'blue', { x: original.x, y: original.y }, 'lux');
    w.player = w.championState(unit.id);
    w.units = w.units.filter((u: any) => u.id !== original.id);
    const { writeMatch } = await import('/src/storage/match-store.ts');
    await writeMatch('rift', w.snapshot());
  });
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
}

test('restored Lux shows her source portrait, spell icons, learning previews and safe practice reset', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await lux(page);
  await expect(page.locator('.champion-title strong')).toHaveText('LUX');
  await expect(page.locator('.champion-portrait img')).toHaveAttribute('alt', 'Lux');
  await expect(page.locator('.focus-pips')).toHaveCount(0);
  await expect(page.locator('.ability-charges')).toHaveCount(0);
  for (const [key, name] of [
    ['q', 'Light Binding'],
    ['w', 'Prismatic Barrier'],
    ['e', 'Lucent Singularity'],
    ['r', 'Final Spark'],
  ]) {
    const button = page.locator(`[data-ability="${key}"]`);
    await expect(button).toHaveAttribute('aria-label', name);
    expect(
      await button
        .locator('img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    ).toBe(true);
  }
  await page.locator('[data-ability="q"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('50 MANA');
  await expect(page.locator('#ability-tooltip')).toContainText('80 magic damage');
  await page.screenshot({ path: 'artifacts/lux-hud-preview.png' });
  await page.locator('[data-learn="q"]').click();
  await page.getByRole('button', { name: 'Practice tools' }).click();
  await page.locator('[data-action="cooldowns"]').click();
  const reset = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const save = w.snapshot();
    return {
      q: w.player.qStacks,
      e: w.player.eCharges,
      valid: w.constructor.fromSnapshot(save, w.battlefield).snapshot() === save,
    };
  });
  expect(reset).toEqual({ q: 0, e: 0, valid: true });
  expect(errors).toEqual([]);
});

test('Lux E displays free recast during its zone, updates an open tooltip, then restores cooldown display', async ({
  page,
}) => {
  await lux(page);
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('e');
    return g.view.screenPoint({ x: w.hero.x + 450, y: w.hero.y - 100 });
  });
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press('e');
  const button = page.locator('[data-ability="e"]');
  await expect(button).toHaveAttribute('aria-label', 'Detonate Lucent Singularity');
  await expect(button.locator('.cooldown-text')).toHaveText('RECAST');
  await button.hover();
  await expect(page.locator('#ability-tooltip')).toContainText('NO COST');
  await expect(page.locator('#ability-tooltip')).toContainText('Press E to detonate');
  await page.screenshot({ path: 'artifacts/lux-hud-recast.png' });
  const before = await page.evaluate(() => (window as any).__GAME__.world.hero.mana);
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Lucent Singularity');
  await expect(button).toHaveClass(/cooling/);
  await expect(page.locator('#ability-tooltip')).toContainText('70 MANA');
  await expect(page.locator('#ability-tooltip')).toContainText('Hold the key to aim');
  expect(
    await page.evaluate(() => (window as any).__GAME__.world.hero.mana)
  ).toBeGreaterThanOrEqual(before);
});
