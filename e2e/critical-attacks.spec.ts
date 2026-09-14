import { expect, test } from '@playwright/test';

for (const champion of ['ashe', 'lux'] as const)
  test(`${champion} critical attack uses the source clip and restores its damage payload`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate((champion) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const source = w.spawn('champion', 'blue', w.battlefield.spawns.blue, champion);
      w.championState(source.id).gold = 600;
      if (w.buy('agility', source.id)) throw new Error('Cannot buy critical item');
      for (let seed = 0; ; seed++) {
        w.random.state = seed;
        if (w.random.next() < 0.15) {
          w.random.state = seed;
          break;
        }
      }
      const target = w.spawn('dummy', 'red', { x: source.x + 300, y: source.y });
      target.hp = target.maxHp = 5000;
      w.setOrder(source, { type: 'attack', target: target.id });
      w.step();
      w.step(source.releaseTick - w.tick);
      g.view.render(w, 1, 0);
      const model = g.view.models.get(source.id);
      const snapshot = w.snapshot(),
        damage = w.projectiles[0].damage;
      w.step(20);
      const expected = w.snapshot();
      Object.assign(w, w.constructor.fromSnapshot(snapshot, w.battlefield));
      g.view.render(w, 1, 0);
      const restored = g.view.models.get(source.id).actionName;
      w.step(20);
      return {
        clip: model.actionName,
        restored,
        weight: model.actions.crit.getEffectiveWeight(),
        expected,
        after: w.snapshot(),
        damage,
        ad: source.damage,
        hp: w.unit(target.id).hp,
      };
    }, champion);
    expect(result.clip).toBe('crit');
    expect(result.restored).toBe('crit');
    expect(result.weight).toBe(1);
    expect(result.after).toBe(result.expected);
    expect(result.damage).toBeCloseTo(result.ad * (champion === 'lux' ? 2 : 1.15));
    expect(result.hp).toBeCloseTo(5000 - result.damage);
  });

test('Cloak of Agility is purchasable and sellable with its source icon', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 600;
  });
  await page.keyboard.press('p');
  await page.locator('[data-buy="agility"]').click();
  expect(await page.evaluate(() => (window as any).__GAME__.world.criticalChance())).toBe(0.15);
  const icon = page.locator('#inventory img[src$="1018.png"]');
  await expect(icon).toHaveCount(1);
  expect(
    await icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 64)
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Sell Cloak of Agility, slot 1, for 420 gold', exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__GAME__.world.criticalChance())).toBe(0);
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 420');
});
