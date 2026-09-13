import { expect, test } from '@playwright/test';

test('unchanged world labels avoid DOM mutations and still reflect health and status changes', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const mutations = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.render(g.world, 1, g.world.time);
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('.world-labels')!, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    for (let i = 0; i < 20; i++) g.view.render(g.world, 1, g.world.time);
    const count = observer.takeRecords().length;
    observer.disconnect();
    g.world.hero.hp = g.world.hero.maxHp / 2;
    g.world.hero.stunUntil = g.world.tick + 60;
    g.view.render(g.world, 1, g.world.time);
    return count;
  });
  expect(mutations).toBe(0);
  expect(
    await page
      .locator('.unit-bar.champion.blue .unit-hp i')
      .evaluate((element) => (element as HTMLElement).style.width)
  ).toBe('50%');
  await expect(page.locator('.unit-bar.champion.blue .unit-status')).toHaveText('STUNNED');
});
