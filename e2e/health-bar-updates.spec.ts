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
  const shielded = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.applyShield(w.hero, w.hero, w.hero.maxHp, 60);
    g.view.render(w, 1, w.time);
    const shield = document.querySelector<HTMLElement>('.unit-bar.champion.blue .unit-shield')!;
    const visible = !shield.hidden;
    const width = parseFloat(shield.style.width);
    const title = shield.title;
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('.world-labels')!, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    for (let i = 0; i < 20; i++) g.view.render(w, 1, w.time);
    const mutations = observer.takeRecords().length;
    observer.disconnect();
    w.hero.shields = [];
    g.view.render(w, 1, w.time);
    return {
      visible,
      width,
      title,
      mutations,
      hiddenAfterRemoval: shield.hidden,
      titleAfterRemoval: shield.title,
      maxHp: w.hero.maxHp,
    };
  });
  expect(shielded.visible).toBe(true);
  expect(shielded.width).toBeCloseTo((100 * 2) / 3, 3);
  expect(shielded.title).toBe(`${Math.ceil(shielded.maxHp)} shield`);
  expect(shielded.mutations).toBe(0);
  expect(shielded.hiddenAfterRemoval).toBe(true);
  expect(shielded.titleAfterRemoval).toBe('0 shield');
});
