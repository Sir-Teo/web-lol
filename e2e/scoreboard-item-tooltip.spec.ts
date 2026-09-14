import { expect, test } from '@playwright/test';

test('item inspection uses displayed knowledge and survives focus and scoreboard refresh', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -800, y: -50 });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 }, 'lux');
    enemy.ai = false;
    w.championState(enemy.id).inventory = ['tome'];
    w.step();
    Object.assign(w.hero, { x: -820, y: 450 });
    w.championState(enemy.id).inventory[0] = 'wand';
    w.player.inventory = ['chapter', 'boots'];
    w.step();
    g.hud.scoreboard(true);
    return { hero: w.hero.id, enemy: enemy.id };
  });
  const tip = page.locator('#scoreboard-item-tooltip');
  const enemy = page.locator(`[data-item-key="${ids.enemy}:0"]`);
  const chapter = page.locator(`[data-item-key="${ids.hero}:0"]`);
  const boots = page.locator(`[data-item-key="${ids.hero}:1"]`);
  await enemy.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('strong')).toHaveText('Amplifying Tome');
  await expect(tip.locator('p')).toHaveText('+20 Ability Power');
  await expect(tip.locator('.tooltip-meta')).toHaveText('400 GOLD');
  await expect(enemy).toHaveAttribute('aria-describedby', 'scoreboard-item-tooltip');
  await boots.focus();
  await expect(tip.locator('strong')).toHaveText('Boots');
  await page.mouse.move(30, 400);
  await expect(tip.locator('strong')).toHaveText('Boots');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.player.cs++;
    g.hud.update(60);
  });
  await expect(boots).toBeFocused();
  await expect(tip.locator('strong')).toHaveText('Boots');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.player.inventory[1] = null;
    g.hud.update(60);
  });
  await expect(tip).toBeHidden();
  await chapter.hover();
  await expect(tip.locator('strong')).toHaveText('Lost Chapter');
  await expect(tip.locator('p')).toContainText('300 Mana');
  const box = await tip.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
  expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  await page.screenshot({ path: 'artifacts/scoreboard-item-tooltip.png' });
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(page.locator('[aria-describedby="scoreboard-item-tooltip"]')).toHaveCount(0);
});
