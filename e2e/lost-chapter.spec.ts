import { expect, test } from '@playwright/test';

test('Lost Chapter completes in the shop and its level-up restoration updates the mana HUD', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 1200;
    for (const id of ['tome', 'sapphire', 'mote']) g.world.buy(id);
  });
  await page.keyboard.press('p');
  const chapter = page.locator('[data-buy="chapter"]');
  await expect(chapter.locator('b')).toHaveText('◆ 250');
  await expect(chapter).toContainText('20% max Mana over 3s');
  await chapter.scrollIntoViewIfNeeded();
  await expect
    .poll(() => chapter.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await chapter.click();
  await expect(page.locator('#ap')).toHaveText('40');
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 0');
  await page.keyboard.press('p');
  const start = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.hero.x += 1000;
    w.hero.mana = 0;
    for (const u of w.units)
      if (u.id !== w.hero.id) {
        u.ai = false;
        u.stunUntil = w.tick + 1000;
      }
    w.gainExperience(280);
    g.hud.update(60);
    return {
      mana: w.hero.mana,
      max: w.hero.maxMana,
      start: w.tick,
      end: w.player.enlighten?.endTick,
    };
  });
  expect(start.end - start.start).toBe(180);
  const finish = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    for (let i = 0; i < 180; i++) w.step();
    g.hud.update(60);
    g.view.render(w, 1, performance.now() / 1000);
    return { mana: w.hero.mana, max: w.hero.maxMana, effect: w.player.enlighten };
  });
  expect(finish.effect).toBeNull();
  expect(finish.mana - start.mana).toBeGreaterThanOrEqual(start.max * 0.2);
  await expect(page.locator('#mana-text')).toHaveText(
    `${Math.floor(finish.mana)} / ${Math.floor(finish.max)}`
  );
  await page.screenshot({ path: 'artifacts/lost-chapter.png' });
});
