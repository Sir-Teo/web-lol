import { expect, test } from '@playwright/test';

for (const kind of ['champion', 'caster', 'dummy'])
  test(`A-click explicitly attacks the clicked ${kind} despite a nearer enemy`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const setup = await page.evaluate((kind) => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      w.setOrder(w.hero, { type: 'idle' });
      const near = w.spawn('melee', 'red', { x: w.hero.x + 100, y: w.hero.y - 100 });
      const target = w.spawn(kind, 'red', { x: w.hero.x + 450, y: w.hero.y });
      near.stunUntil = target.stunUntil = Infinity;
      g.view.render(w, 1, 0);
      return {
        id: target.id,
        hp: target.hp,
        nearId: near.id,
        nearHp: near.hp,
        point: g.view.screenPoint(target, 0.65),
      };
    }, kind);
    await page.keyboard.press('a');
    await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
    await page.mouse.click(setup.point.x, setup.point.y);
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order))
      .toEqual({ type: 'attack', target: setup.id });
    await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
    await expect
      .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.id))
      .toBeLessThan(setup.hp);
    expect(
      await page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.nearId)
    ).toBe(setup.nearHp);
  });

test('A-click on ground or an ally keeps attack-move, and Escape cancels targeting', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const points = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const ally = w.spawn('melee', 'blue', { x: w.hero.x + 300, y: w.hero.y });
    return [
      g.view.screenPoint(ally, 0.65),
      g.view.screenPoint({ x: w.hero.x + 450, y: w.hero.y - 200 }),
    ];
  });
  for (const point of points) {
    await page.keyboard.press('a');
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
      .toBe('attackMove');
    await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
    await page.keyboard.press('s');
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
      .toBe('idle');
  }
  await page.keyboard.press('a');
  await page.keyboard.press('Escape');
  await page.mouse.click(points[0].x, points[0].y);
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.order.type)).toBe('idle');
});
