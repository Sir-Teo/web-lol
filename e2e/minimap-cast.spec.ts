import { expect, test } from '@playwright/test';

for (const ability of ['e', 'r']) {
  test(`${ability.toUpperCase()} aims and casts at minimap coordinates without changing the camera`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const initial = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.nextWaveTick = Infinity;
      for (const u of w.units) u.ai = false;
      return {
        half: w.battlefield.half,
        hero: { x: w.hero.x, y: w.hero.y },
        center: { ...g.view.center },
      };
    });
    const box = (await page.locator('#minimap').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
    await page.keyboard.down(ability);
    const aim = await page.evaluate(() => (window as any).__GAME__.view.aimPoint);
    expect(aim.x).toBeCloseTo(-initial.half * 0.6, 0);
    expect(aim.y).toBeCloseTo(-initial.half * 0.5, 0);
    await page.keyboard.up(ability);
    await expect
      .poll(() =>
        page.evaluate((ability) => {
          const w = (window as any).__GAME__.world;
          return w.projectiles.some(
            (p: any) => p.type === (ability === 'e' ? 'hawkshot' : 'ultimate')
          );
        }, ability)
      )
      .toBe(true);
    const result = await page.evaluate((ability) => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      const p = g.world.projectiles.find(
        (p: any) => p.type === (ability === 'e' ? 'hawkshot' : 'ultimate')
      );
      return {
        direction: p.direction,
        endpoint: { x: p.x + p.direction.x * p.remaining, y: p.y + p.direction.y * p.remaining },
        center: g.view.center,
        aim: g.view.aimPoint,
      };
    }, ability);
    const dx = aim.x - initial.hero.x,
      dy = aim.y - initial.hero.y,
      distance = Math.hypot(dx, dy);
    expect(result.direction.x).toBeCloseTo(dx / distance);
    expect(result.direction.y).toBeCloseTo(dy / distance);
    if (ability === 'e') {
      expect(result.endpoint.x).toBeCloseTo(aim.x);
      expect(result.endpoint.y).toBeCloseTo(aim.y);
    }
    expect(result.center).toEqual(initial.center);
    expect(result.aim).toBeNull();
  });
}

test('held targeting follows transitions between battlefield, minimap and non-targetable HUD', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const box = (await page.locator('#minimap').boundingBox())!;
  await page.mouse.move(600, 400);
  await page.keyboard.down('e');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).not.toBeNull();
  await page.locator('.champion-hud').hover();
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).toBeNull();
  await page.keyboard.up('e');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.keyboard.down('w');
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).toBeNull();
  await page.keyboard.up('w');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.w)).toBe(0);
  await page.keyboard.down('e');
  await page.keyboard.press('Escape');
  await page.keyboard.up('e');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
  await page.keyboard.down('e');
  await page.mouse.move(600, 400);
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).not.toBeNull();
  await page.keyboard.up('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.eCharges))
    .toBe(1);
});

test('right-click minimap movement cancels a held scout cast', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const map = page.locator('#minimap');
  await map.hover();
  await page.keyboard.down('e');
  await map.click({ button: 'right', position: { x: 70, y: 90 } });
  await page.keyboard.up('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
    .toBe('move');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
});
