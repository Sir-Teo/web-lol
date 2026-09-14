import { expect, test } from '@playwright/test';

test('scoreboard death countdown freezes, restores and clears on the exact respawn tick', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const saved = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const enemy = w.spawn('champion', 'red', { x: w.hero.x + 100, y: w.hero.y }, 'lux');
    enemy.ai = false;
    w.damage(w.hero, enemy, 10000, 'true');
    g.hud.scoreboard(true);
    return {
      id: enemy.id,
      seconds: Math.ceil((enemy.respawnTick - w.tick) / 60),
      snapshot: w.snapshot(),
    };
  });
  const row = page.locator(`[data-champion="${saved.id}"]`);
  await expect(row).toHaveClass(/dead/);
  await expect(row.locator('.scoreboard-death-timer')).toHaveText(String(saved.seconds));
  await expect(row.locator('.scoreboard-portrait')).toHaveAttribute(
    'aria-label',
    `Lux, level 1, dead, respawns in ${saved.seconds} seconds`
  );
  expect(
    await row.locator('.scoreboard-portrait > img').evaluate((el) => getComputedStyle(el).filter)
  ).toContain('grayscale(1)');
  await page.screenshot({ path: 'artifacts/scoreboard-dead.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved.snapshot);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.hud.scoreboard(true);
  });
  await expect(row.locator('.scoreboard-death-timer')).toHaveText(String(saved.seconds));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved.snapshot);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(60);
    g.hud.update(60);
  });
  await expect(row.locator('.scoreboard-death-timer')).toHaveText(String(saved.seconds - 1));
  await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(w.unit(id).respawnTick - w.tick - 1);
    g.hud.update(60);
  }, saved.id);
  await expect(row.locator('.scoreboard-death-timer')).toHaveText('1');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step();
    g.hud.update(60);
  });
  await expect(row).not.toHaveClass(/dead/);
  await expect(row.locator('.scoreboard-death-timer')).toBeHidden();
  await expect(row.locator('.scoreboard-portrait')).toHaveAttribute('aria-label', 'Lux, level 1');
  expect(
    await row.locator('.scoreboard-portrait > img').evaluate((el) => getComputedStyle(el).filter)
  ).toBe('none');
  await page.screenshot({ path: 'artifacts/scoreboard-respawned.png' });
});
