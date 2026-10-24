import { expect, test } from '@playwright/test';

test('stable labels skip style setters while camera and same-tick stat changes stay live', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    v.render(w, 1, w.time);
    const writes: string[] = [];
    const descriptors = new Map<HTMLElement, PropertyDescriptor | undefined>();
    // Count actual DOM calls, even when the browser suppresses identical mutations.
    for (const element of document.querySelectorAll<HTMLElement>(
      '.world-labels div, .world-labels i, .world-labels span'
    )) {
      const style = element.style;
      descriptors.set(element, Object.getOwnPropertyDescriptor(element, 'style'));
      const proxy = new Proxy(style, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, key, value) {
          if (['transform', 'width', 'left'].includes(String(key))) writes.push(String(key));
          return Reflect.set(target, key, value, target);
        },
      });
      Object.defineProperty(element, 'style', { configurable: true, get: () => proxy });
    }
    try {
      for (let i = 0; i < 20; i++) v.render(w, 1, w.time);
      const stableWrites = writes.splice(0);
      const bar = v.healthBars.get(w.hero.id) as HTMLElement;
      const beforeMove = bar.style.transform;
      v.locked = false;
      v.center.x += 100;
      v.render(w, 1, w.time);
      const cameraWrites = writes.splice(0);
      const afterMove = bar.style.transform;
      // No tick advance: presentation caches cannot key freshness on the clock.
      w.hero.hp = w.hero.maxHp / 2;
      w.hero.mana = w.hero.maxMana / 4;
      w.hero.rootUntil = w.tick + 60;
      v.render(w, 1, w.time);
      const stats = {
        health: bar.querySelector<HTMLElement>('.unit-hp i')!.style.width,
        mana: bar.querySelector<HTMLElement>('.unit-mana i')!.style.width,
        status: bar.querySelector('.unit-status')!.textContent,
      };
      writes.length = 0;
      v.render(w, 1, w.time);
      return { stableWrites, cameraWrites, beforeMove, afterMove, stats, settledWrites: writes };
    } finally {
      for (const [element, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(element, 'style', descriptor);
        else delete (element as any).style;
      }
    }
  });
  expect(result.stableWrites).toEqual([]);
  expect(result.cameraWrites.length).toBeGreaterThan(0);
  expect(result.cameraWrites.every((key) => key === 'transform')).toBe(true);
  expect(result.afterMove).not.toBe(result.beforeMove);
  expect(result.stats).toEqual({ health: '50%', mana: '25%', status: 'ROOTED' });
  expect(result.settledWrites).toEqual([]);
});

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
